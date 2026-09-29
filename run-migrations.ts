import { MigrationService } from './src/server/services/migrationService.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log('Running migrations...');
  const result = await MigrationService.runMigrations();
  console.log('Migration Result:', JSON.stringify(result, null, 2));
  if (!result.success) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
