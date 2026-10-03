
import pg from 'pg';
const { Client } = pg;

async function test() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('No DATABASE_URL');
    return;
  }
  
  const configs = [
    { ssl: false },
    { ssl: { rejectUnauthorized: false } },
    { ssl: { rejectUnauthorized: true } }
  ];

  for (const config of configs) {
    console.log(`Testing with config: ${JSON.stringify(config)}`);
    const client = new Client({
      connectionString: url,
      ...config,
      connectionTimeoutMillis: 5000
    });
    try {
      await client.connect();
      console.log('✅ SUCCESS!');
      const res = await client.query('SELECT now()');
      console.log('Time:', res.rows[0]);
      await client.end();
      process.exit(0);
    } catch (err: any) {
      console.log('❌ Failed:', err.message);
    }
  }
}
test();
