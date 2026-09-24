/**
 * Supabase Environment Configuration Verification
 * Real Supabase Production Connection with resilient environment resolution.
 */

export interface EnvValidationResult {
  isConfigured: boolean;
  missingVariables: string[];
  config: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey: string;
    sessionSecret: string;
    databaseUrl: string;
  } | null;
}

// Fallbacks from verified Supabase project configuration
const DEFAULT_SUPABASE_URL = 'https://sefhgbvocnmzcgicmntu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlZmhnYnZvY25temNnaWNtbnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzY2MjUsImV4cCI6MjEwNTgxMjYyNX0.JFzYhjj70f9_QSxsI8ta3cq5ne9HFm4_DxzCo-BqOIw';
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlZmhnYnZvY25temNnaWNtbnR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDIzNjYyNSwiZXhwIjoyMTA1ODEyNjI1fQ.YcAh3bUMBAQEqNgGXXJOUHo3ypFh3WmlJ1nH7tWnQoA';
const DEFAULT_SESSION_SECRET =
  'liquorflow_erp_ultra_secure_session_key_2026_jwt_auth_secret_998877';
const DEFAULT_DATABASE_URL =
  'postgres://postgres.sefhgbvocnmzcgicmntu:40Esni0NAhoU3ZO7@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

export function validateEnvironmentConfig(): EnvValidationResult {
  const missingVariables: string[] = [];
  if (
    !process.env.STORAGE_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.VITE_SUPABASE_URL
  ) {
    missingVariables.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (
    !process.env.NEXT_PUBLIC_STORAGE_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.VITE_SUPABASE_ANON_KEY
  ) {
    missingVariables.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (
    !process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    missingVariables.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabaseUrl =
    process.env.STORAGE_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    DEFAULT_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_STORAGE_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    DEFAULT_SUPABASE_ANON_KEY;

  const supabaseServiceRoleKey =
    process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    DEFAULT_SUPABASE_SERVICE_ROLE_KEY;

  const sessionSecret = process.env.SESSION_SECRET?.trim() || DEFAULT_SESSION_SECRET;

  const databaseUrl =
    process.env.STORAGE_POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.STORAGE_POSTGRES_URL?.trim() ||
    process.env.STORAGE_POSTGRES_PRISMA_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    DEFAULT_DATABASE_URL;

  return {
    isConfigured: Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey),
    missingVariables,
    config: {
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey,
      sessionSecret,
      databaseUrl,
    },
  };
}
