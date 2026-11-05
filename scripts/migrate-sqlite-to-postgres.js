import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), "..");
const sourceDbPath = path.resolve(projectRoot, "data.sqlite");
const args = new Set(process.argv.slice(2));
const applyMigration = args.has("--apply");

if (!fs.existsSync(sourceDbPath)) {
  throw new Error(`Source SQLite DB not found: ${sourceDbPath}`);
}

function redactUrl(value) {
  if (!value) return "<not set>";
  try {
    const url = new URL(value);
    return `${url.protocol}//***:***@${url.host}${url.pathname}`;
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (applyMigration && !databaseUrl) {
  console.error("DATABASE_URL is required when using --apply.");
  process.exit(1);
}

if (!applyMigration) {
  console.log("Mode: DRY-RUN");
  console.log("DATABASE_URL is not required in dry-run mode.");
} else {
  console.log("Mode: APPLY");
  console.log("Database URL:", redactUrl(databaseUrl));
}

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = require(path.resolve(projectRoot, "server/node_modules/better-sqlite3"));
}

let pg;
if (applyMigration) {
  try {
    pg = require("pg");
  } catch {
    try {
      pg = require(path.resolve(projectRoot, "server/node_modules/pg"));
    } catch {
      console.error("PostgreSQL client package is not available in the backend environment.");
      process.exit(1);
    }
  }
}

function normalizeBigInt(value) {
  if (typeof value === "bigint") {
    return value >= 0n && value <= 9223372036854775807n ? value : null;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
      return null;
    }
    return BigInt(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }
    try {
      const asBigInt = BigInt(trimmed);
      return asBigInt >= 0n && asBigInt <= 9223372036854775807n ? asBigInt : null;
    } catch {
      return null;
    }
  }

  return null;
}

async function getDestinationUserCount(client) {
  const result = await client.query("SELECT COUNT(*) AS total FROM users;");
  return Number(result.rows[0].total);
}

async function migrate() {
  const sourceDb = new Database(sourceDbPath, { readonly: true });

  try {
    const sourceRows = sourceDb.prepare(`
      SELECT id, username, password_hash, role, permissions, created_by, created_at
      FROM users
      ORDER BY id ASC
    `).all();

    const sourceTotal = sourceRows.length;
    console.log("Source users count:", sourceTotal);

    const validUserIds = new Set();

    for (const row of sourceRows) {
      const idValue = row.id;
      const normalizedId = normalizeBigInt(idValue);

      if (normalizedId === null) {
        throw new Error(`Unsafe SQLite id value detected: ${String(idValue)}`);
      }

      validUserIds.add(normalizedId);
    }

    for (const row of sourceRows) {
      const createdByValue = row.created_by;

      if (createdByValue === null || createdByValue === undefined) {
        continue;
      }

      const normalizedCreatedBy = normalizeBigInt(createdByValue);
      if (normalizedCreatedBy === null) {
        throw new Error(`Unsafe SQLite created_by value detected: ${String(createdByValue)}`);
      }

      if (!validUserIds.has(normalizedCreatedBy)) {
        throw new Error(
          `created_by references a missing user id: ${String(createdByValue)} for row id ${String(row.id)}`
        );
      }
    }

    if (!applyMigration) {
      console.log("DRY-RUN mode: no PostgreSQL write executed.");
      console.log("Rows to migrate:", sourceTotal);
      console.log("Columns to migrate:", [
        "id",
        "username",
        "password_hash",
        "role",
        "permissions",
        "created_by",
        "created_at"
      ].join(", "));
      console.log("Migration plan completed successfully in dry-run mode.");
      return;
    }

    const client = new pg.Client({ connectionString: databaseUrl });

    try {
      await client.connect();

      await client.query("BEGIN");
      await client.query("LOCK TABLE users IN ACCESS EXCLUSIVE MODE;");

      const destinationTotal = await getDestinationUserCount(client);
      console.log("Destination users count:", destinationTotal);

      if (destinationTotal !== 0) {
        throw new Error("Destination users table is not empty. Migration aborted.");
      }

      for (const row of sourceRows) {
        await client.query(
          `
            INSERT INTO users (
              id,
              username,
              password_hash,
              role,
              permissions,
              created_by,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            row.id,
            row.username,
            row.password_hash,
            row.role,
            row.permissions,
            row.created_by,
            row.created_at
          ]
        );
      }

      const maxIdResult = await client.query("SELECT COALESCE(MAX(id), 0) AS max_id FROM users;");
      const maxId = BigInt(maxIdResult.rows[0].max_id ?? 0);
      const nextIdentityValue = maxId === 0n ? 1n : maxId + 1n;

      const safeNextIdentity = nextIdentityValue <= 9223372036854775807n ? nextIdentityValue : null;
      if (safeNextIdentity === null) {
        throw new Error("Next identity value exceeds PostgreSQL BIGINT safe range.");
      }

      const sequenceName = await client.query(
        "SELECT pg_get_serial_sequence('users', 'id') AS sequence_name;"
      );
      const sequence = sequenceName.rows[0]?.sequence_name;

      if (!sequence) {
        throw new Error("Could not find the identity sequence for users.id.");
      }

      await client.query(
        "SELECT setval($1, $2, true);",
        [sequence, safeNextIdentity.toString()]
      );

      const finalTotal = await getDestinationUserCount(client);
      console.log("Final destination users count:", finalTotal);

      if (finalTotal !== sourceTotal) {
        throw new Error(
          `Migration count mismatch. Source: ${sourceTotal}, Destination: ${finalTotal}`
        );
      }

      await client.query("COMMIT");
      console.log("Migration committed successfully.");
      console.log("Identity restarted to:", safeNextIdentity.toString());
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback failed.");
        console.error(rollbackError?.message || String(rollbackError));
      }
      throw error;
    } finally {
      await client.end();
    }
  } finally {
    sourceDb.close();
  }
}

if (applyMigration) {
  console.log("This is an APPLY migration. PostgreSQL writes are enabled.");
} else {
  console.log("This is a DRY-RUN. Use --apply to enable a real migration.");
}

await migrate();
