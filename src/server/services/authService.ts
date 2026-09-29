import crypto from 'crypto';
import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import { AuthUser, SupportedLanguage } from '../../types/index.js';
import { hashPassword, verifyPassword } from '../../lib/auth/password.js';
import { generateSessionToken, calculateSessionExpiry } from '../../lib/auth/session.js';

// In-memory session cache for ultra-fast serverless warm invocations & fallback resilience
const memorySessions = new Map<string, { user: AuthUser; expiresAt: number }>();

export class AuthService {
  /**
   * Resolve configured application login mobile number from environment variables.
   */
  static getConfiguredMobile(): string {
    return (
      process.env.LOGIN_MOBILE_NUMBER ||
      process.env.OWNER_PHONE ||
      process.env.ADMIN_USERNAME ||
      ''
    ).trim();
  }

  /**
   * Resolve configured application login password from environment variables.
   */
  static getConfiguredPassword(): string {
    return (
      process.env.LOGIN_PASSWORD ||
      process.env.OWNER_PASSWORD ||
      process.env.ADMIN_PASSWORD ||
      ''
    ).trim();
  }

  /**
   * Authenticate owner using configured application credentials (LOGIN_MOBILE_NUMBER / LOGIN_PASSWORD)
   * or existing owner_credentials record in the database.
   * STRICT: On failure, always throws Error('Invalid username or password').
   */
  static async authenticate(input: any): Promise<{ sessionToken: string; user: AuthUser }> {
    const rawUsername = (
      input?.mobileNumber ||
      input?.mobile_number ||
      input?.username ||
      input?.phone ||
      ''
    )
      .toString()
      .trim();
    const rawPassword = (input?.password || '').toString();

    if (!rawUsername || !rawPassword) {
      throw new Error('Invalid username or password');
    }

    const configuredMobile = this.getConfiguredMobile();
    const configuredPassword = this.getConfiguredPassword();

    const isEnvMatch =
      Boolean(configuredMobile && configuredPassword) &&
      rawUsername === configuredMobile &&
      rawPassword === configuredPassword;

    const supabase = getSupabaseServiceClient();

    // 1. Check database owner_credentials table for exact mobile number
    const { data: owner } = await supabase
      .from('owner_credentials')
      .select('id, mobile_number, password_hash, active')
      .eq('mobile_number', rawUsername)
      .limit(1)
      .maybeSingle();

    let authenticatedOwnerId: string | null = null;
    let authenticatedMobile = rawUsername;

    if (owner && owner.active) {
      let isDbPassValid = false;
      try {
        isDbPassValid = await verifyPassword(rawPassword, owner.password_hash);
      } catch {
        isDbPassValid = false;
      }

      if (isDbPassValid || isEnvMatch) {
        authenticatedOwnerId = owner.id;
        authenticatedMobile = owner.mobile_number;

        // If matched via updated env password, sync hash in DB
        if (isEnvMatch && !isDbPassValid) {
          try {
            const updatedHash = await hashPassword(rawPassword);
            await supabase
              .from('owner_credentials')
              .update({ password_hash: updatedHash })
              .eq('id', owner.id);
          } catch {
            // Non-fatal
          }
        }
      }
    } else if (isEnvMatch) {
      // Configured env credentials matched, ensure owner row exists in owner_credentials
      try {
        const hashedPassword = await hashPassword(rawPassword);
        const { data: newOwner } = await supabase
          .from('owner_credentials')
          .insert({
            mobile_number: configuredMobile,
            password_hash: hashedPassword,
            active: true,
          })
          .select('id, mobile_number')
          .maybeSingle();

        if (newOwner) {
          authenticatedOwnerId = newOwner.id;
          authenticatedMobile = newOwner.mobile_number;
        } else {
          const { data: fallbackOwner } = await supabase
            .from('owner_credentials')
            .select('id, mobile_number')
            .limit(1)
            .maybeSingle();
          authenticatedOwnerId =
            fallbackOwner?.id ||
            crypto.randomUUID();
          authenticatedMobile = configuredMobile;
        }
      } catch {
        authenticatedOwnerId = crypto.randomUUID();
        authenticatedMobile = configuredMobile;
      }
    }

    if (!authenticatedOwnerId) {
      throw new Error('Invalid username or password');
    }

    // 2. Generate 64-hex-char cryptographically secure session token
    const sessionToken = generateSessionToken();
    const expiryDate = calculateSessionExpiry();
    const expiresAt = expiryDate.toISOString();

    // 3. Persist session to database (with graceful handling so login never 500s)
    try {
      await supabase.from('sessions').insert({
        session_token: sessionToken,
        owner_id: authenticatedOwnerId,
        expires_at: expiresAt,
        last_accessed_at: new Date().toISOString(),
      });
    } catch (sessionErr: any) {
      console.warn('[AuthService] Non-fatal session DB insert warning:', sessionErr?.message);
    }

    // 4. Fetch business settings
    let businessName = 'LiquorFlow Bar & Restaurant';
    let selectedLanguage: SupportedLanguage = 'en';
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('business_name, selected_language, language')
        .limit(1)
        .maybeSingle();
      if (settings?.business_name) businessName = settings.business_name;
      if (settings?.selected_language || settings?.language) {
        selectedLanguage = (settings.selected_language || settings.language) as SupportedLanguage;
      }
    } catch {
      // Fallback to default business info
    }

    const user: AuthUser = {
      id: authenticatedOwnerId,
      mobile_number: authenticatedMobile,
      business_name: businessName,
      selected_language: selectedLanguage,
    };

    memorySessions.set(sessionToken, {
      user,
      expiresAt: expiryDate.getTime(),
    });

    return { sessionToken, user };
  }

  /**
   * Validate active session token from cookie or header against Supabase sessions table.
   */
  static async validateSession(token: string): Promise<AuthUser | null> {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return null;
    }

    const cleanToken = token.trim();

    // Check warm memory cache first
    const cached = memorySessions.get(cleanToken);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return cached.user;
      }
      memorySessions.delete(cleanToken);
    }

    try {
      const supabase = getSupabaseServiceClient();

      // 1. Look up active session in database
      const { data: session, error } = await supabase
        .from('sessions')
        .select('id, session_token, owner_id, expires_at')
        .eq('session_token', cleanToken)
        .limit(1)
        .maybeSingle();

      if (error || !session) {
        return null;
      }

      // 2. Check session expiry
      const expiryMs = new Date(session.expires_at).getTime();
      if (expiryMs < Date.now()) {
        await supabase.from('sessions').delete().eq('session_token', cleanToken);
        return null;
      }

      // 3. Update last_accessed_at timestamp (non-blocking)
      supabase
        .from('sessions')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('session_token', cleanToken)
        .then(() => {}, () => {});

      // 4. Fetch owner details & settings
      const [{ data: owner }, { data: settings }] = await Promise.all([
        supabase
          .from('owner_credentials')
          .select('id, mobile_number')
          .eq('id', session.owner_id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('settings')
          .select('business_name, selected_language, language')
          .limit(1)
          .maybeSingle(),
      ]);

      const user: AuthUser = {
        id: session.owner_id,
        mobile_number: owner?.mobile_number || this.getConfiguredMobile() || '8857003771',
        business_name: settings?.business_name || 'LiquorFlow Bar & Restaurant',
        selected_language: (settings?.selected_language || settings?.language || 'en') as SupportedLanguage,
      };

      memorySessions.set(cleanToken, { user, expiresAt: expiryMs });
      return user;
    } catch (err: any) {
      console.error('[AuthService.validateSession] Error validating session:', err?.message);
      return null;
    }
  }

  /**
   * Logout and invalidate session in database and memory cache
   */
  static async logout(token: string): Promise<void> {
    if (!token) return;
    const cleanToken = token.trim();
    memorySessions.delete(cleanToken);
    try {
      const supabase = getSupabaseServiceClient();
      await supabase.from('sessions').delete().eq('session_token', cleanToken);
    } catch {
      // Ignore db logout errors
    }
  }
}
