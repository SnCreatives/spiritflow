import pg from 'pg';
const { Client } = pg;

async function test() {
  const urls = [
    'postgresql://postgres:Liquorflow9699@db.ckscmohjxmayazxncjmq.supabase.co:5432/postgres',
    'postgresql://postgres:liquorflow9699@db.sefhgbvocnmzcgicmntu.supabase.co:5432/postgres',
    'postgresql://postgres.sefhgbvocnmzcgicmntu:liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
    'postgresql://postgres.ckscmohjxmayazxncjmq:Liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
  ];

  for (const url of urls) {
    console.log(`Testing URL: ${url.replace(/:[^@]+@/, ':****@')}`);
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 2000
    });
    try {
      await client.connect();
      console.log('SUCCESS!');
      const res = await client.query('SELECT current_user, current_database();');
      console.log('Result:', res.rows[0]);
      await client.end();
      process.exit(0);
    } catch (err: any) {
      console.log('FAILED:', err.message);
    }
  }
}

test();
