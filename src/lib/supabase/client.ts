import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateEnvironmentConfig } from './config.js';

let _dbHasBarId: boolean | null = null;

export async function checkDbHasBarId(): Promise<boolean> {
  if (_dbHasBarId !== null) {
    return _dbHasBarId;
  }
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from('purchases').select('bar_id').limit(1);
    if (error) {
      if (error.code === 'PGRST106' || error.message?.includes('column') || error.message?.includes('bar_id')) {
        _dbHasBarId = false;
      } else {
        return false;
      }
    } else {
      _dbHasBarId = true;
    }
  } catch {
    _dbHasBarId = false;
  }
  return _dbHasBarId;
}

export function setDbHasBarId(val: boolean) {
  _dbHasBarId = val;
}

let supabaseServiceClient: SupabaseClient | null = null;
let supabaseAnonClient: SupabaseClient | null = null;

export class ConfigurationError extends Error {
  missingVariables: string[];
  constructor(missing: string[]) {
    super(`Required Supabase environment variables are missing: ${missing.join(', ')}`);
    this.name = 'ConfigurationError';
    this.missingVariables = missing;
  }
}

/**
 * Returns the Supabase Admin/Service-Role client for server-side trusted operations.
 * Throws ConfigurationError if environment variables are missing.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const env = validateEnvironmentConfig();
  if (!env.isConfigured || !env.config) {
    throw new ConfigurationError(env.missingVariables);
  }

  if (!supabaseServiceClient) {
    supabaseServiceClient = createClient(
      env.config.supabaseUrl,
      env.config.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return supabaseServiceClient;
}

/**
 * Returns the Supabase Anonymous client for public access.
 */
export function getSupabaseAnonClient(): SupabaseClient {
  const env = validateEnvironmentConfig();
  if (!env.isConfigured || !env.config) {
    throw new ConfigurationError(env.missingVariables);
  }

  if (!supabaseAnonClient) {
    supabaseAnonClient = createClient(
      env.config.supabaseUrl,
      env.config.supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return supabaseAnonClient;
}
