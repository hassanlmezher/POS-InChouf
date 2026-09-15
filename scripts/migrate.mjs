import { readdirSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import postgres from 'postgres';

try {
  loadEnvFile('.env');
} catch {}
try {
  loadEnvFile('.dev.vars');
} catch {}

const url = process.env.SUPABASE_DATABASE_URL;
if (!url) {
  console.error('SUPABASE_DATABASE_URL is required to run migrations.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
try {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`CREATE TABLE IF NOT EXISTS drizzle.schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  for (const file of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const applied = await sql`
      SELECT 1 FROM drizzle.schema_migrations WHERE filename = ${file}
    `;
    if (applied.length) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }
    const statements = readFileSync(`drizzle/${file}`, 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    console.log(`Applying ${file} (${statements.length} statements)`);
    await sql.begin(async (tx) => {
      for (const statement of statements) await tx.unsafe(statement);
      await tx`INSERT INTO drizzle.schema_migrations (filename) VALUES (${file})`;
    });
  }
} catch (error) {
  if (error?.code === 'ENOTFOUND') {
    console.error(
      [
        `Could not resolve database host: ${error.hostname}`,
        '',
        'Update SUPABASE_DATABASE_URL with the Supabase PostgreSQL pooler connection string.',
        'In Supabase: Project Settings -> Database -> Connection string -> Transaction pooler.',
        'It should look like:',
        'postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres',
      ].join('\n'),
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await sql.end();
}
