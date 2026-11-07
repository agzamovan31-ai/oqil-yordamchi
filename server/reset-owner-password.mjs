import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import readline from "node:readline";

if (!process.env.DATABASE_URL || !process.env.OWNER_USERNAME) {
  console.error("DATABASE_URL va OWNER_USERNAME kerak.");
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error("Xavfsizlik: parolni yashirin kiritish uchun TTY terminal kerak.");
  process.exit(1);
}
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    let password = "";

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    process.stdout.write(prompt);

    stdin.on("data", (char) => {
      const c = char.toString("utf8");
      if (c === "\n" || c === "\r") {
        if (stdin.isTTY) stdin.setRawMode(false);
        process.stdout.write("\n");
        rl.close();
        resolve(password);
      } else if (c === "\u0003") {
        process.exit();
      } else if (c === "\u007f") {
        password = password.slice(0, -1);
      } else {
        password += c;
      }
    });
  });
}

const newPassword = await askHidden("Yangi Owner parolini kiriting: ");
if (!newPassword || newPassword.length < 12) {
  console.error("Parol kamida 12 ta belgidan iborat bo'lsin.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ownerName = process.env.OWNER_USERNAME.trim();

try {
  const { rows } = await pool.query(
    "SELECT id, username, role FROM users WHERE LOWER(username) = LOWER($1)",
    [ownerName]
  );

  if (rows.length !== 1) {
    console.error("Aynan bitta Owner topilmadi.");
    process.exit(1);
  }

  const user = rows[0];
  if (user.role !== "owner") {
    console.error("Topilgan foydalanuvchi Owner emas.");
    process.exit(1);
  }

  console.log(`Yangilanadigan Owner: id=${user.id}, username=${user.username}`);
  const confirm = await askHidden("Tasdiqlash uchun 'YES' yozing: ");
  if (confirm !== "YES") {
    console.error("Bekor qilindi.");
    process.exit(1);
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, user.id]);
  console.log("Owner paroli yangilandi.");
} catch (error) {
  console.error("Xatolik:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
