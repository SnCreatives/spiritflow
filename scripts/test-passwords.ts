import { Pool } from 'pg';

const PASSWORDS = [
  'Liquorflow9699',
  'LiquorFlow9699',
  'liquorflow9699',
  'Liquorflow@9699',
  'LiquorFlow@9699',
  'Liquorflow9699!',
  'LiquorFlow9699!',
  'Liquorflow#9699',
  'Liquorflow123',
  'Liquorflow@123',
  'LiquorFlow@123',
  'postgres',
  'postgres123',
  'admin',
  'root',
];

const HOSTS = [
  'aws-0-ap-south-1.pooler.supabase.com:6543',
  'aws-0-ap-south-1.pooler.supabase.com:5432',
  'db.sefhgbvocnmzcgicmntu.supabase.co:5432',
];

async function findWorkingDbConnection() {
  console.log('Testing password combinations...');

  for (const host of HOSTS) {
    for (const pass of PASSWORDS) {
      const isDirect = host.startsWith('db.');
      const user = isDirect ? 'postgres' : 'postgres.sefhgbvocnmzcgicmntu';
      const encodedPass = encodeURIComponent(pass);
      const url = `postgresql://${user}:${encodedPass}@${host}/postgres`;

      try {
        const pool = new Pool({
          connectionString: url,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 2000,
        });
        const client = await pool.connect();
        console.log(`\n🎉 FOUND WORKING CONNECTION!`);
        console.log(`Host: ${host}`);
        console.log(`User: ${user}`);
        console.log(`Password: ${pass}`);
        
        const res = await client.query('SELECT current_database(), version()');
        console.log('Database:', res.rows[0]);
        client.release();
        await pool.end();
        return { host, user, pass, url };
      } catch (err: any) {
        // failed
      }
    }
  }
  console.log('No password matched standard list.');
  return null;
}

findWorkingDbConnection().then(res => {
  if (res) {
    console.log('Successful connection details found.');
  } else {
    console.log('Testing completed without match.');
  }
});
