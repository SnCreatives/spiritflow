import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const DB_URLS = [
  process.env.STORAGE_POSTGRES_URL_NON_POOLING,
  process.env.STORAGE_POSTGRES_URL,
  process.env.DATABASE_URL,
  'postgresql://postgres.sefhgbvocnmzcgicmntu:Liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.sefhgbvocnmzcgicmntu:Liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.sefhgbvocnmzcgicmntu:Atul%40spiritflow@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres:Atul%40spiritflow@db.sefhgbvocnmzcgicmntu.supabase.co:5432/postgres',
  'postgresql://postgres.sefhgbvocnmzcgicmntu:liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.sefhgbvocnmzcgicmntu:liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres:liquorflow9699@db.sefhgbvocnmzcgicmntu.supabase.co:5432/postgres',
  'postgresql://postgres.sefhgbvocnmzcgicmntu:liquorflow9699@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.sefhgbvocnmzcgicmntu:liquorflow9699@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.ckscmohjxmayazxncjmq:Liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
].filter(Boolean) as string[];

async function run() {
  console.log('--- Testing database connections and applying migrations ---');
  let pool: Pool | null = null;
  let client: any = null;
  let connectedUrl = '';

  for (const url of DB_URLS) {
    try {
      console.log(`Trying URL: ${url.replace(/:[^:@]+@/, ':***@')}...`);
      const testPool = new Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });
      const c = await testPool.connect();
      const res = await c.query('SELECT current_database(), now()');
      console.log('✅ Connected successfully! Database:', res.rows[0]);
      pool = testPool;
      client = c;
      connectedUrl = url;
      break;
    } catch (err: any) {
      console.log(`❌ Failed connecting with ${url.substring(0, 30)}...:`, err.message);
    }
  }

  if (!client || !pool) {
    console.error('❌ Could not connect to any database URL!');
    process.exit(1);
  }

  try {
    // 1. Check if bar_outlets table exists
    const checkTable = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'bar_outlets';
    `);
    console.log('Existing bar_outlets check:', checkTable.rows);

    // 2. Read and apply all migrations in supabase/migrations
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    console.log(`Found ${files.length} migration files in ${migrationsDir}`);

    // Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations_applied (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    const { rows: appliedRows } = await client.query('SELECT filename FROM _migrations_applied');
    const appliedSet = new Set(appliedRows.map((r: any) => r.filename));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`- Skipping already applied: ${file}`);
        continue;
      }
      console.log(`+ Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations_applied (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Successfully applied: ${file}`);
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`❌ Migration failed for ${file}:`, err.message);
        // Try executing without transaction or continue if non-fatal
      }
    }

    // Explicitly verify bar_outlets exists now
    const verifyBarOutlets = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'bar_outlets'
      ORDER BY ordinal_position;
    `);
    console.log('bar_outlets columns in PostgreSQL:', verifyBarOutlets.rows);

    // Ensure sample bar exists
    const barCount = await client.query('SELECT count(*) FROM bar_outlets;');
    console.log('Current bar_outlets count:', barCount.rows[0]?.count);

    if (parseInt(barCount.rows[0]?.count || '0', 10) === 0) {
      console.log('Inserting default Main Bar...');
      await client.query(`
        INSERT INTO bar_outlets (name, code, address, city, state, license_number, status)
        VALUES ('Main Bar', 'MAIN', 'Ground Floor', 'Mumbai', 'Maharashtra', 'FL-III/2026/01', 'Active')
        ON CONFLICT (code) DO NOTHING;
      `);
    }

    // Reload PostgREST schema cache
    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    await client.query("NOTIFY pgrst, 'reload config';");
    console.log('✅ PostgREST schema reload signal sent!');

    const allBars = await client.query('SELECT id, name, code, status FROM bar_outlets;');
    console.log('All bars currently in database:', allBars.rows);

  } finally {
    if (client) client.release();
    if (pool) await pool.end();
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
