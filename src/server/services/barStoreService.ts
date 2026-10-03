import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import { BarOutlet } from '../../types/index.js';

export interface UserBarAccessRecord {
  id: string;
  user_id: string;
  bar_id: string;
  role: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export type BarUserAuthorizationRecord = UserBarAccessRecord;

export class BarStoreService {
  /**
   * Get all bars, filtered optionally by user permissions.
   * STRICT: Uses actual Supabase database.
   */
  static async getBars(userId?: string): Promise<BarOutlet[]> {
    const supabase = getSupabaseServiceClient();
    
    // 1. Fetch all bars
    const { data: dbBars, error: barError } = await supabase
      .from('bar_outlets')
      .select('*')
      .order('name', { ascending: true });

    if (barError) {
      throw new Error(`Failed to fetch bars from database: ${barError.message}`);
    }

    const bars = dbBars || [];

    // 2. If userId is provided, filter by user authorizations
    if (userId && bars.length > 0) {
      const { data: accessList, error: accessError } = await supabase
        .from('bar_user_authorizations')
        .select('bar_id')
        .eq('user_id', userId)
        .eq('status', 'Active');

      if (accessError) {
        throw new Error(`Failed to verify bar access: ${accessError.message}`);
      }

      const allowedBarIds = new Set(accessList?.map((a: any) => a.bar_id) || []);
      return bars.filter(b => allowedBarIds.has(b.id));
    }

    return bars;
  }

  /**
   * Fetch single bar by ID.
   */
  static async getBarById(id: string): Promise<BarOutlet | null> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('bar_outlets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching bar "${id}": ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new Bar Outlet.
   * ID is database-generated UUID.
   */
  static async createBar(
    data: {
      name: string;
      code?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
      license_number?: string | null;
      status?: 'Active' | 'Inactive';
    },
    ownerId?: string
  ): Promise<BarOutlet> {
    const trimmedName = data.name ? data.name.trim() : '';

    if (!trimmedName) {
      throw new Error('Bar name is required');
    }

    const supabase = getSupabaseServiceClient();
    
    // Attempt insert into Supabase. Let the DB generate the UUID.
    const { data: dbBar, error } = await supabase
      .from('bar_outlets')
      .insert({
        name: trimmedName,
        code: data.code || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || 'Maharashtra',
        pincode: data.pincode || null,
        license_number: data.license_number || null,
        status: data.status || 'Active',
        owner_user_id: ownerId || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create bar outlet: ${error.message}`);
    }

    if (!dbBar) {
      throw new Error('Failed to retrieve created bar outlet from database');
    }

    // Automatically assign owner authorization if ownerId is provided
    // This should ideally be handled by a DB trigger, but we provide service-level logic for now
    if (ownerId) {
      await this.assignUserAccess(ownerId, dbBar.id, 'Owner');
    }

    return dbBar;
  }

  /**
   * Update an existing Bar Outlet.
   */
  static async updateBar(
    id: string,
    data: Partial<{
      name: string;
      code: string;
      address: string | null;
      city: string | null;
      state: string | null;
      pincode: string | null;
      license_number: string | null;
      status: 'Active' | 'Inactive';
    }>
  ): Promise<BarOutlet> {
    const supabase = getSupabaseServiceClient();
    
    const { data: updatedBar, error } = await supabase
      .from('bar_outlets')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update bar outlet: ${error.message}`);
    }

    return updatedBar;
  }

  /**
   * Toggle bar active / inactive status.
   */
  static async toggleBarStatus(id: string, status: 'Active' | 'Inactive'): Promise<BarOutlet> {
    return this.updateBar(id, { status });
  }

  /**
   * Assign user authorization to a bar.
   * Strictly enforces UNIQUE(bar_id, user_id) via Supabase upsert logic.
   */
  static async assignUserAccess(userId: string, barId: string, role = 'Owner'): Promise<void> {
    const supabase = getSupabaseServiceClient();
    
    const { error } = await supabase
      .from('bar_user_authorizations')
      .upsert({
        user_id: userId,
        bar_id: barId,
        role,
        status: 'Active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'bar_id, user_id' });

    if (error) {
      throw new Error(`Failed to assign bar access: ${error.message}`);
    }

    // Mirror to legacy table if it exists (best effort)
    try {
      await supabase.from('user_bar_access').upsert({
        user_id: userId,
        bar_id: barId,
        role,
        status: 'Active'
      }, { onConflict: 'user_id, bar_id' });
    } catch {}
  }

  /**
   * Retrieve authorizations for a bar or user.
   */
  static async getAuthorizations(params?: { barId?: string; userId?: string }): Promise<UserBarAccessRecord[]> {
    const supabase = getSupabaseServiceClient();
    let query = supabase.from('bar_user_authorizations').select('*');

    if (params?.barId) query = query.eq('bar_id', params.barId);
    if (params?.userId) query = query.eq('user_id', params.userId);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch authorizations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Safe Delete a bar outlet.
   * Checks for transactional records in Supabase before deletion.
   */
  static async deleteBar(id: string): Promise<{ action: 'deleted' | 'deactivated'; message: string; bar: BarOutlet }> {
    const existing = await this.getBarById(id);
    if (!existing) {
      throw new Error('Bar outlet not found');
    }

    const supabase = getSupabaseServiceClient();
    const transactionCheckDetails: string[] = [];

    // Helper to safely check Supabase table
    const checkTable = async (tableName: string, barColumn = 'bar_id') => {
      const { count, error } = await supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .eq(barColumn, id);
      return (!error && count) ? count : 0;
    };

    const [invCount, osCount, purCount, ledgerCount] = await Promise.all([
      checkTable('inventory'),
      checkTable('opening_stock'),
      checkTable('purchases'),
      checkTable('stock_ledger')
    ]);

    if (invCount > 0) transactionCheckDetails.push(`${invCount} inventory items`);
    if (osCount > 0) transactionCheckDetails.push(`${osCount} opening stock entries`);
    if (purCount > 0) transactionCheckDetails.push(`${purCount} purchase records`);
    if (ledgerCount > 0) transactionCheckDetails.push(`${ledgerCount} stock ledger records`);

    if (transactionCheckDetails.length > 0) {
      const deactivatedBar = await this.updateBar(id, { status: 'Inactive' });
      return {
        action: 'deactivated',
        message: `Bar "${existing.name}" contains historical transactions (${transactionCheckDetails.join(', ')}). It has been deactivated to preserve audit compliance.`,
        bar: deactivatedBar,
      };
    }

    // NO TRANSACTIONS EXIST: Perform permanent safe removal
    const { error: delAuthError } = await supabase.from('bar_user_authorizations').delete().eq('bar_id', id);
    const { error: delBarError } = await supabase.from('bar_outlets').delete().eq('id', id);

    if (delBarError || delAuthError) {
      throw new Error(`Database error during bar deletion: ${delBarError?.message || delAuthError?.message}`);
    }

    return {
      action: 'deleted',
      message: `Bar outlet "${existing.name}" permanently deleted successfully.`,
      bar: { ...existing, status: 'Inactive' },
    };
  }

  /**
   * Get dictionary mapping barId -> { id, name, code } for quick lookups.
   */
  static async getBarMap(): Promise<Record<string, { id: string; name: string; code: string }>> {
    const bars = await this.getBars();
    const map: Record<string, { id: string; name: string; code: string }> = {};
    for (const b of bars) {
      map[b.id] = { id: b.id, name: b.name, code: b.code || b.name.slice(0, 4).toUpperCase() };
    }
    return map;
  }
}

