import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "data.sqlite");
if (!fs.existsSync(dbPath)) {
  console.error("Database fayli topilmadi:", dbPath);
  process.exit(1);
}

const ownerName = (process.env.OWNER_USERNAME || "").trim();
if (!ownerName) {
  console.error("OWNER_USERNAME kerak.");
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error("Xavfsizlik: TTY terminal kerak.");
  process.exit(1);
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    let password = "";
    stdin.setRawMode(true);
    process.stdout.write(prompt);
    stdin.on("data", (char) => {
      const c = char.toString("utf8");
      if (c === "\n" || c === "\r") {
        stdin.setRawMode(false);
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

const db = new Database(dbPath);
try {
  const owner = db.prepare("SELECT id, username, role FROM users WHERE LOWER(username) = LOWER(?)").get(ownerName);
  if (!owner || owner.role !== "owner") {
    console.error("Aynan bitta Owner topilmadi.");
    process.exit(1);
  }
  const count = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'owner'").get().c;
  if (count !== 1) {
    console.error("Bitta Owner bo'lishi kerak.");
    process.exit(1);
  }

  console.log(`Yangilanadigan Owner: id=${owner.id}, username=${owner.username}`);
  const confirm = await askHidden("Tasdiqlash uchun 'YES' yozing: ");
  if (confirm !== "YES") {
    console.error("Bekor qilindi.");
    process.exit(1);
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, owner.id);
  });
  tx();
  console.log("Owner paroli yangilandi.");
} catch (error) {
  console.error("Xatolik:", error.message);
  process.exit(1);
} finally {
  db.close();
}
