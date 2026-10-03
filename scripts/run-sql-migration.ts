
import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Client } = pg;

async function runMigration() {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20261001000006_lockdown_rls_policies.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Try direct PG connection URLs
  const urls = [
    process.env.DATABASE_URL,
    'postgresql://postgres.sefhgbvocnmzcgicmntu:liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
    'postgresql://postgres.sefhgbvocnmzcgicmntu:liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres:liquorflow9699@db.sefhgbvocnmzcgicmntu.supabase.co:5432/postgres',
    'postgresql://postgres.ckscmohjxmayazxncjmq:Liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
    'postgresql://postgres.ckscmohjxmayazxncjmq:Liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres:Liquorflow9699@db.ckscmohjxmayazxncjmq.supabase.co:5432/postgres'
  ].filter(Boolean) as string[];

  for (const url of urls) {
    console.log(`Trying DB URL: ${url.replace(/:[^:@]+@/, ':***@')}...`);
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      await client.connect();
      console.log('✅ Connected successfully!');
      console.log('Executing migration SQL...');
      await client.query(sql);
      console.log('✅ Migration executed successfully on Supabase database!');
      await client.end();
      return;
    } catch (err: any) {
      console.error('❌ Failed:', err.message);
      try { await client.end(); } catch {}
    }
  }

  console.error('\nCould not connect via pg driver. Please apply /supabase/migrations/20261001000006_lockdown_rls_policies.sql in the Supabase SQL Editor.');
}

runMigration().catch(console.error);
