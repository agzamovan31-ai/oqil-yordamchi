
import "dotenv/config";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);

if (
  !process.env.JWT_SECRET ||
  !process.env.OWNER_USERNAME ||
  !process.env.OWNER_PASSWORD
) {
  throw new Error(".env faylida kerakli sozlamalar yo‘q.");
}

if (process.env.OWNER_PASSWORD.length < 12) {
  throw new Error("EGA paroli kamida 12 ta belgidan iborat bo‘lsin.");
}

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173"
}));

app.use(express.json({ limit: "20kb" }));

// Ma'lumotlar bazasi
const db = new Database("data.sqlite");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    permissions TEXT NOT NULL DEFAULT '{}',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
`);

const ustunlar = db.prepare("PRAGMA table_info(users)").all();

if (!ustunlar.some(ustun => ustun.name === "created_by")) {
  db.exec("ALTER TABLE users ADD COLUMN created_by INTEGER");
}

// EGA akkaunti
const ownerName = process.env.OWNER_USERNAME.trim();

const owner = db.prepare(
  "SELECT * FROM users WHERE username = ?"
).get(ownerName);

if (owner && owner.role !== "owner") {
  throw new Error("EGA username'i band. Boshqa OWNER_USERNAME tanlang.");
}

const anotherOwner = db.prepare(
  "SELECT id FROM users WHERE role = 'owner'"
).get();

if (!owner && anotherOwner) {
  throw new Error("Bazadagi EGA hisobini tekshiring.");
}

if (!owner) {
  const hash = bcrypt.hashSync(process.env.OWNER_PASSWORD, 12);

  db.prepare(`
    INSERT INTO users (username, password_hash, role, permissions)
    VALUES (?, ?, 'owner', '{}')
  `).run(ownerName, hash);

  console.log("EGA akkaunti yaratildi.");
}

// Login cheklovi
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: {
    error: "Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring."
  }
});

// Token yaratish
function tokenYaratish(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Foydalanuvchini tekshirish
function tekshirish(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Tizimga kiring."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = db.prepare(
      "SELECT id, username, role, permissions FROM users WHERE id = ?"
    ).get(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: "Hisob topilmadi."
      });
    }

    req.user = user;
    next();

  } catch {
    res.status(401).json({
      error: "Kirish muddati tugagan. Qayta kiring."
    });
  }
}

// Faqat EGA
function faqatEga(req, res, next) {
  if (req.user.role !== "owner") {
    return res.status(403).json({
      error: "Bu amal faqat EGA uchun."
    });
  }

  next();
}

// Admin yoki EGA
function faqatAdmin(req, res, next) {
  if (!["owner", "admin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Ruxsat yo‘q."
    });
  }

  next();
}

// Ruxsatlarni olish
function ruxsatlar(user) {
  try {
    return JSON.parse(user.permissions || "{}");
  } catch {
    return {};
  }
}

// Backend tekshirish
app.get("/", (req, res) => {
  res.json({
    xabar: "AI backend ishlayapti."
  });
});

// Ro‘yxatdan o‘tish
app.post("/api/auth/register", (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      !/^[a-zA-Z0-9_-]{3,20}$/.test(username.trim())
    ) {
      return res.status(400).json({
        error: "Username 3–20 ta belgi bo‘lsin."
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        error: "Parol 8–72 ta belgi bo‘lishi kerak."
      });
    }

    const hash = bcrypt.hashSync(password, 12);

    const result = db.prepare(`
      INSERT INTO users (username, password_hash)
      VALUES (?, ?)
    `).run(username.trim(), hash);

    const user = db.prepare(
      "SELECT id, username, role FROM users WHERE id = ?"
    ).get(result.lastInsertRowid);

    res.status(201).json({
      xabar: "Hisob yaratildi.",
      token: tokenYaratish(user),
      user
    });

  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "Bu username band."
      });
    }

    console.error(error);

    res.status(500).json({
      error: "Hisob yaratilmadi."
    });
  }
});

// Tizimga kirish
app.post("/api/auth/login", loginLimit, (req, res) => {
  const { username, password } = req.body;

  if (
    typeof username !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      error: "Username va parolni kiriting."
    });
  }

  const user = db.prepare(
    "SELECT * FROM users WHERE username = ?"
  ).get(username.trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({
      error: "Username yoki parol noto‘g‘ri."
    });
  }

  res.json({
    xabar: "Muvaffaqiyatli kirdingiz.",
    token: tokenYaratish(user),
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

// Joriy foydalanuvchi
app.get("/api/auth/me", tekshirish, (req, res) => {
  res.json({
    user: req.user
  });
});

// EGA barcha foydalanuvchilarni ko‘radi
app.get("/api/owner/users", tekshirish, faqatEga, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, permissions, created_by, created_at
    FROM users
    ORDER BY id DESC
  `).all();

  res.json({ users });
});

// Admin faqat o‘zi qo‘shgan foydalanuvchilarni ko‘radi
app.get("/api/admin/users", tekshirish, faqatAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, created_at
    FROM users
    WHERE created_by = ? AND role = 'user'
    ORDER BY id DESC
  `).all(req.user.id);

  res.json({ users });
});

// Admin yoki EGA foydalanuvchi qo‘shadi
app.post("/api/admin/users", tekshirish, faqatAdmin, (req, res) => {
  try {
    const { username, password } = req.body;
    const permissions = ruxsatlar(req.user);

    if (
      req.user.role === "admin" &&
      permissions.canAddUsers !== true
    ) {
      return res.status(403).json({
        error: "Foydalanuvchi qo‘shishga ruxsat yo‘q."
      });
    }

    if (
      typeof username !== "string" ||
      !/^[a-zA-Z0-9_-]{3,20}$/.test(username.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        error: "Username yoki parol noto‘g‘ri."
      });
    }

    const hash = bcrypt.hashSync(password, 12);

    const result = db.prepare(`
      INSERT INTO users (username, password_hash, created_by)
      VALUES (?, ?, ?)
    `).run(username.trim(), hash, req.user.id);

    res.status(201).json({
      xabar: "Foydalanuvchi qo‘shildi.",
      id: result.lastInsertRowid,
      username: username.trim()
    });

  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "Bu username band."
      });
    }

    console.error(error);

    res.status(500).json({
      error: "Foydalanuvchi qo‘shilmadi."
    });
  }
});

// EGA foydalanuvchini o‘chiradi
app.delete("/api/owner/users/:id", tekshirish, faqatEga, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: "ID noto‘g‘ri."
    });
  }

  const user = db.prepare(
    "SELECT role FROM users WHERE id = ?"
  ).get(id);

  if (!user || user.role === "owner") {
    return res.status(400).json({
      error: "Bu foydalanuvchini o‘chirib bo‘lmaydi."
    });
  }

  db.prepare(
    "DELETE FROM users WHERE id = ?"
  ).run(id);

  res.json({
    xabar: "Foydalanuvchi o‘chirildi."
  });
});

// EGA admin qiladi va ruxsat beradi
app.post("/api/owner/admins", tekshirish, faqatEga, (req, res) => {
  const {
    username,
    canAddUsers = true,
    canRequestGifts = true
  } = req.body;

  if (typeof username !== "string") {
    return res.status(400).json({
      error: "Username kiriting."
    });
  }

  const user = db.prepare(
    "SELECT id, role FROM users WHERE username = ?"
  ).get(username.trim());

  if (!user || user.role === "owner") {
    return res.status(404).json({
      error: "Foydalanuvchi topilmadi."
    });
  }

  const permissions = JSON.stringify({
    canAddUsers: canAddUsers === true,
    canRequestGifts: canRequestGifts === true
  });

  db.prepare(`
    UPDATE users
    SET role = 'admin', permissions = ?
    WHERE id = ?
  `).run(permissions, user.id);

  res.json({
    xabar: "Admin huquqi berildi."
  });
});

// EGA admin huquqini bekor qiladi
app.delete("/api/owner/admins/:id", tekshirish, faqatEga, (req, res) => {
  const id = Number(req.params.id);

  const result = db.prepare(`
    UPDATE users
    SET role = 'user', permissions = '{}'
    WHERE id = ? AND role = 'admin'
  `).run(id);

  if (!result.changes) {
    return res.status(404).json({
      error: "Admin topilmadi."
    });
  }

  res.json({
    xabar: "Admin huquqi bekor qilindi."
  });
});

// AI savol-javob — Gemini API
app.post("/api/savol", async (req, res) => {
  try {
    const savol = req.body.savol;

    if (typeof savol !== "string" || !savol.trim()) {
      return res.status(400).json({
        error: "Savolni kiriting."
      });
    }

    if (savol.length > 4000) {
      return res.status(400).json({
        error: "Savol juda uzun. Qisqartirib yuboring."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API kaliti topilmadi."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `Sen O‘quvchi AI nomli aqlli ta'lim yordamchisisan.

ASOSIY QOIDALAR:
1. Faqat o‘zbek tilida, lotin yozuvida javob ber.
2. Har bir savolga aniq, to‘liq va tushunarli javob ber.
3. O‘quvchiga murakkab mavzularni sodda qilib tushuntir.
4. Matematik misollarni shunchaki izohlamasdan, oxirigacha yech.
5. Hisob-kitoblarni diqqat bilan tekshir.
6. Javobni tugallanmagan holda qoldirma.

MATEMATIKA UCHUN:
- Berilgan misolni tushun.
- Yechish usulini tanla.
- Har bir amalni alohida ko‘rsat.
- Oraliq natijalarni yoz.
- Oxirida aniq javobni ko‘rsat.
- Imkon bo‘lsa, javobni qayta tekshir.

Masalan, 3x + 7 = 25 bo‘lsa:

1. 3x + 7 = 25
2. 3x = 25 - 7
3. 3x = 18
4. x = 18 / 3
5. x = 6

Javob: x = 6.

Hech qachon faqat "Keling, yechamiz" deb to‘xtab qolma.`
            }]
          },
          contents: [{
            parts: [{
              text: savol.trim()
            }]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini xatosi:",
        data.error?.message || "Noma'lum xato"
      );

      return res.status(502).json({
        error: "Gemini javob bera olmadi. Keyinroq urinib ko‘ring."
      });
    }

    const finishReason = data.candidates?.[0]?.finishReason;

    if (finishReason === "MAX_TOKENS") {
      return res.status(502).json({
        error: "AI javobi tugallanmay qoldi. Iltimos, qayta urinib ko‘ring."
      });
    }

    const javob = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!javob) {
      console.error("Gemini bo‘sh javob qaytardi:", finishReason);

      return res.status(502).json({
        error: "AI bo‘sh javob qaytardi."
      });
    }

    res.json({ javob });

  } catch (error) {
    console.error("Server xatosi:", error.message);

    res.status(500).json({
      error: "AI serveriga ulanib bo‘lmadi."
    });
  }
});

// Serverni ishga tushirish
app.listen(PORT, () => {
  console.log(`Backend ishlayapti: http://localhost:${PORT}`);
});
