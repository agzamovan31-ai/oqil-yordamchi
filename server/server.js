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

// Rasm frontendda 4.5 MB gacha siqiladi.
app.use(express.json({ limit: "8mb" }));

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

// Eski bazada created_by ustuni bo‘lmasa, qo‘shiladi.
const ustunlar = db.prepare(
  "PRAGMA table_info(users)"
).all();

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
    const { username, password } = req.body || {};

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
  const { username, password } = req.body || {};

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
    const { username, password } = req.body || {};
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
  } = req.body || {};

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

// Ovozli savolni matnga aylantirish
app.post("/api/transcribe", tekshirish, async (req, res) => {
  try {
    const { audio, mimeType } = req.body || {};

    const ruxsatEtilganTurlar = [
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/wav",
      "audio/mpeg"
    ];

    if (
      typeof audio !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(audio) ||
      audio.length % 4 !== 0 ||
      typeof mimeType !== "string" ||
      !ruxsatEtilganTurlar.includes(mimeType)
    ) {
      return res.status(400).json({
        error: "Ovoz fayli noto‘g‘ri."
      });
    }

    const audioHajmi = Buffer.from(audio, "base64").length;

    if (audioHajmi === 0 || audioHajmi > 5 * 1024 * 1024) {
      return res.status(400).json({
        error: "Ovoz fayli 5 MB dan oshmasligi kerak."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API kaliti topilmadi."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        signal: AbortSignal.timeout(45000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Ushbu audio yozuvdagi gaplarni diqqat bilan tingla. Faqat aytilgan so‘zlarni o‘zbek lotin yozuvida matn ko‘rinishida qaytar. Hech qanday izoh qo‘shma."
              },
              {
                inlineData: {
                  mimeType,
                  data: audio
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Ovoz transkripsiyasi xatosi:", data.error?.message);

      return res.status(502).json({
        error: "Ovoz matnga aylantirilmadi. Qayta urinib ko‘ring."
      });
    }

    const matn = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!matn) {
      return res.status(502).json({
        error: "Ovozdan matn aniqlanmadi."
      });
    }

    res.json({ matn });

  } catch (error) {
    console.error("Ovoz xatosi:", error.message);

    res.status(500).json({
      error: "Ovoz serveriga ulanib bo‘lmadi."
    });
  }
});

// AI savol-javob — Gemini API (matn va rasm)
app.post("/api/savol", async (req, res) => {
  const boshlanish = Date.now();

  try {
    const savol = typeof req.body?.savol === "string"
      ? req.body.savol.trim()
      : "";

    const rasm = req.body?.rasm;

    if (!savol && !rasm) {
      return res.status(400).json({
        error: "Savol yozing yoki rasm yuklang."
      });
    }

    if (savol.length > 4000) {
      return res.status(400).json({
        error: "Savol juda uzun. Qisqartirib yuboring."
      });
    }

    // Rasmni tekshirish
    if (rasm) {
      const ruxsatEtilganTurlar = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (
        typeof rasm.mimeType !== "string" ||
        !ruxsatEtilganTurlar.includes(rasm.mimeType) ||
        typeof rasm.data !== "string"
      ) {
        return res.status(400).json({
          error: "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin."
        });
      }

      if (
        !/^[A-Za-z0-9+/]+={0,2}$/.test(rasm.data) ||
        rasm.data.length % 4 !== 0
      ) {
        return res.status(400).json({
          error: "Rasm ma'lumotlari noto‘g‘ri."
        });
      }

      const rasmHajmi = Buffer.from(rasm.data, "base64").length;

      if (rasmHajmi === 0 || rasmHajmi > 50 * 1024 * 1024) {
        return res.status(400).json({
          error: "Rasm hajmi 50 MB dan oshmasligi kerak."
        });
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API kaliti topilmadi."
      });
    }

    console.log(
      rasm
        ? "Gemini rasmli so‘rovni boshladi."
        : "Gemini matnli so‘rovni boshladi."
    );

    const matn = savol ||
      "Ushbu rasmni tahlil qil va undagi topshiriqni tushuntir.";

    const parts = [
      { text: matn }
    ];

    if (rasm) {
      parts.push({
        inlineData: {
          mimeType: rasm.mimeType,
          data: rasm.data
        }
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        signal: AbortSignal.timeout(45000),
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

RASMLAR BILAN ISHLASH:
1. Yuklangan rasmni diqqat bilan tahlil qil.
2. Rasmdagi yozuvlar va topshiriqlarni o‘qi.
3. Agar rasmda matematika misoli bo‘lsa, bosqichma-bosqich yech.
4. Agar rasmda test bo‘lsa, to‘g‘ri javobni izohla.
5. Agar rasm xira yoki o‘qib bo‘lmaydigan bo‘lsa, buni ochiq ayt.
6. Rasmda ko‘rinmagan ma'lumotlarni o‘zingdan to‘qima.
7. Foydalanuvchi rasm haqida savol bersa, aynan shu savolga javob ber.

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
            parts
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1500
          }
        })
      }
    );

    console.log(
      "Gemini javob kutish vaqti:",
      ((Date.now() - boshlanish) / 1000).toFixed(1),
      "soniya"
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

    console.log(
      "To‘liq javob tayyor:",
      ((Date.now() - boshlanish) / 1000).toFixed(1),
      "soniya"
    );

    return res.json({ javob });

  } catch (error) {
    console.error("AI xatosi:", error.name, error.message);

    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return res.status(504).json({
        error: "AI juda sekin javob bermoqda. Iltimos, qayta urinib ko‘ring."
      });
    }

    return res.status(500).json({
      error: "AI serveriga ulanib bo‘lmadi."
    });
  }
});

// Serverni ishga tushirish
app.listen(PORT, () => {
  console.log(`Backend ishlayapti: http://localhost:${PORT}`);
});