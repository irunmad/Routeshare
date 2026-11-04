import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const migration = {
  version: "0001_initial",
  file: resolve(process.cwd(), "src/database/migrations/0001_initial.sql"),
};

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL search_path TO public, extensions");

  const postgis = await client.query(`
    SELECT n.nspname AS schema_name
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis'
  `);

  if (postgis.rows[0]?.schema_name !== "extensions") {
    throw new Error(
      "PostGIS is not enabled in the 'extensions' schema. In Supabase: Database → Extensions → postgis → Enable, keeping schema 'extensions'.",
    );
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const alreadyApplied = await client.query(
    "SELECT 1 FROM public.schema_migrations WHERE version = $1",
    [migration.version],
  );

  if (alreadyApplied.rowCount) {
    await client.query("COMMIT");
    console.log(`Migration ${migration.version} already applied.`);
  } else {
    const sql = await readFile(migration.file, "utf8");
    await client.query(sql);
    await client.query(
      "INSERT INTO public.schema_migrations(version) VALUES ($1)",
      [migration.version],
    );
    await client.query("COMMIT");
    console.log(`Migration ${migration.version} applied successfully.`);
  }
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {}
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
