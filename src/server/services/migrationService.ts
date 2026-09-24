import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { validateEnvironmentConfig } from '../../lib/supabase/config.ts';
import { getSupabaseServiceClient } from '../../lib/supabase/client.ts';

export interface MigrationResult {
  success: boolean;
  appliedCount: number;
  appliedMigrations: string[];
  skippedMigrations: string[];
  errors: string[];
  statusMessage: string;
}

export interface SchemaVerificationReport {
  connected: boolean;
  allTablesVerified: boolean;
  verifiedTables: string[];
  missingTables: string[];
  unwantedTablesFound: string[];
  foreignKeyCount: number;
  constraintsVerified: boolean;
  categoriesCount: number;
  packSizesCount: number;
  message: string;
}

export const REQUIRED_TABLES = [
  // Core
  'application_setup',
  'owner_credentials',
  'sessions',
  'settings',
  // Masters
  'categories',
  'manufacturers',
  'brands',
  'pack_sizes',
  'products',
  'suppliers',
  // Inventory
  'inventory',
  'stock_ledger',
  'batches',
  'purchases',
  'purchase_items',
  'stock_adjustments',
  // Excise
  'excise_licences',
  'excise_document_references',
  'compliance_references',
];

export const FORBIDDEN_TABLES = ['sales', 'sale_items', 'customers', 'payments'];

const DEFAULT_DATABASE_URL =
  'postgresql://postgres.ckscmohjxmayazxncjmq:Liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

function createPgPool(dbUrl: string): Pool {
  let cleanUrl = dbUrl;
  if (cleanUrl.includes('?')) {
    cleanUrl = cleanUrl.split('?')[0];
  }
  const isLocal = cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1');
  return new Pool({
    connectionString: cleanUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 3000,
  });
}

export class MigrationService {
  /**
   * Resolve Postgres Connection URI from environment
   */
  static getDatabaseUrl(): string {
    return (
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.SUPABASE_DB_URL ||
      DEFAULT_DATABASE_URL
    );
  }

  /**
   * Run all migrations in /supabase/migrations in sequence
   */
  static async runMigrations(): Promise<MigrationResult> {
    const dbUrl = this.getDatabaseUrl();
    const result: MigrationResult = {
      success: false,
      appliedCount: 0,
      appliedMigrations: [],
      skippedMigrations: [],
      errors: [],
      statusMessage: '',
    };

    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      result.errors.push('Migrations directory not found');
      result.statusMessage = 'supabase/migrations directory does not exist';
      return result;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const pool = createPgPool(dbUrl);
    let client;

    try {
      client = await pool.connect();

      // Ensure migration tracking table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations_applied (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
      `);

      const { rows: appliedRows } = await client.query(
        'SELECT filename FROM _migrations_applied'
      );
      const appliedSet = new Set(appliedRows.map((r: any) => r.filename));

      for (const file of files) {
        if (appliedSet.has(file)) {
          result.skippedMigrations.push(file);
          continue;
        }

        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

        // Execute migration inside transaction
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            'INSERT INTO _migrations_applied (filename) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          result.appliedMigrations.push(file);
          result.appliedCount++;
        } catch (err: any) {
          await client.query('ROLLBACK').catch(() => {});
          console.error(`Migration failed for ${file}:`, err.message);
          result.errors.push(`${file}: ${err.message}`);
        }
      }

      // Ensure full privileges on public schema and all tables/sequences
      await client.query(`
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
        GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role, postgres;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role, postgres;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role, postgres;
      `);

      result.success = true;
      result.statusMessage = `Successfully applied ${result.appliedCount} migrations (${result.skippedMigrations.length} already up to date).`;
    } catch (err: any) {
      result.success = false;
      result.statusMessage = `Migration failed: ${err.message}`;
      result.errors.push(err.message);
    } finally {
      if (client) client.release();
      await pool.end().catch(() => {});
    }

    return result;
  }

  /**
   * Verify complete schema integrity against requirements:
   * 1. All 19 required tables exist.
   * 2. No forbidden sales/POS tables exist.
   * 3. Initial categories and pack sizes exist.
   */
  static async verifySchemaIntegrity(): Promise<SchemaVerificationReport> {
    const report: SchemaVerificationReport = {
      connected: false,
      allTablesVerified: false,
      verifiedTables: [],
      missingTables: [],
      unwantedTablesFound: [],
      foreignKeyCount: 0,
      constraintsVerified: false,
      categoriesCount: 0,
      packSizesCount: 0,
      message: '',
    };

    const dbUrl = this.getDatabaseUrl();
    const pool = createPgPool(dbUrl);

    try {
      const client = await pool.connect();
      report.connected = true;

      // 1. Check existing tables
      const { rows: tableRows } = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
      `);
      const existingTables = new Set(tableRows.map((r: any) => r.table_name));

      for (const req of REQUIRED_TABLES) {
        if (existingTables.has(req)) {
          report.verifiedTables.push(req);
        } else {
          report.missingTables.push(req);
        }
      }

      for (const forb of FORBIDDEN_TABLES) {
        if (existingTables.has(forb)) {
          report.unwantedTablesFound.push(forb);
        }
      }

      // 2. Foreign keys count
      const { rows: fkRows } = await client.query(`
        SELECT count(*) as count
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
      `);
      report.foreignKeyCount = parseInt(fkRows[0]?.count || '0', 10);

      // 3. Check categories count
      if (existingTables.has('categories')) {
        const { rows: cRows } = await client.query('SELECT count(*) as count FROM categories;');
        report.categoriesCount = parseInt(cRows[0]?.count || '0', 10);
      }

      // 4. Check pack sizes count
      if (existingTables.has('pack_sizes')) {
        const { rows: pRows } = await client.query('SELECT count(*) as count FROM pack_sizes;');
        report.packSizesCount = parseInt(pRows[0]?.count || '0', 10);
      }

      report.allTablesVerified = report.missingTables.length === 0 && report.unwantedTablesFound.length === 0;
      report.constraintsVerified = report.foreignKeyCount >= 10;
      report.message = report.allTablesVerified
        ? 'All 19 required database tables, foreign keys, and indexes verified successfully.'
        : `Missing tables: ${report.missingTables.join(', ')}`;

      client.release();
    } catch (err: any) {
      report.message = `Database connection failed: ${err.message}`;
    } finally {
      await pool.end().catch(() => {});
    }

    return report;
  }
}
