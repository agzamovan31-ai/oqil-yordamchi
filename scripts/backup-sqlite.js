import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = require(path.resolve(projectRoot, "server/node_modules/better-sqlite3"));
}

const sourceDbPath = path.resolve(projectRoot, "data.sqlite");
const backupDir = path.resolve(projectRoot, "backups/sqlite");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `data-${timestamp}.sqlite`);

if (!fs.existsSync(sourceDbPath)) {
  throw new Error(`Source SQLite DB not found: ${sourceDbPath}`);
}

fs.mkdirSync(backupDir, { recursive: true });

async function validateBackup(filePath) {
  const db = new Database(filePath, { readonly: true });

  try {
    const integrity = db.prepare("PRAGMA integrity_check;").get();
    const integrityValue = integrity?.integrity_check;

    if (integrityValue !== "ok") {
      throw new Error(`Backup integrity check failed. Result: ${integrityValue}`);
    }

    const hasUsersTable = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM sqlite_master
        WHERE type = 'table' AND name = 'users'
      `)
      .get();

    if (!hasUsersTable || Number(hasUsersTable.count) !== 1) {
      throw new Error("Backup is missing the users table.");
    }

    const userCount = db.prepare("SELECT COUNT(*) AS total FROM users;").get();
    return Number(userCount.total);
  } finally {
    db.close();
  }
}

async function main() {
  const sourceDb = new Database(sourceDbPath, { readonly: true });

  try {
    const sourceUserCount = sourceDb.prepare("SELECT COUNT(*) AS total FROM users;").get();
    const sourceTotal = Number(sourceUserCount.total);

    console.log("Source DB:", sourceDbPath);
    console.log("Source users count:", sourceTotal);
    console.log("Backup target:", backupPath);

    await sourceDb.backup(backupPath);
    console.log("Backup created successfully.");

    const backupUserCount = await validateBackup(backupPath);

    if (sourceTotal !== backupUserCount) {
      throw new Error(
        `Source and backup users count mismatch. Source: ${sourceTotal}, Backup: ${backupUserCount}`
      );
    }

    console.log("Backup verification passed.");
    console.log("Backup file:", backupPath);
  } catch (error) {
    console.error("Backup failed.");
    console.error("Source DB was not modified.");
    console.error(error?.message || String(error));
    process.exitCode = 1;
  } finally {
    sourceDb.close();
  }
}

main();
