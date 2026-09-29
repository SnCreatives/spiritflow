import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

const DATA_DIR = path.join(process.cwd(), 'data');
const BARS_FILE = path.join(DATA_DIR, 'bar_outlets.json');
const ACCESS_FILE = path.join(DATA_DIR, 'user_bar_access.json');

const DEFAULT_BARS: BarOutlet[] = [];

export class BarStoreService {
  private static ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('[BarStore] Failed creating data dir:', err);
      }
    }
  }

  private static loadBarsFromDisk(): BarOutlet[] {
    this.ensureDataDir();
    if (fs.existsSync(BARS_FILE)) {
      try {
        const content = fs.readFileSync(BARS_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (err) {
        console.error('[BarStore] Error reading bars file:', err);
      }
    }
    // Initialize empty bars store
    this.saveBarsToDisk([]);
    return [];
  }

  private static saveBarsToDisk(bars: BarOutlet[]): void {
    this.ensureDataDir();
    try {
      fs.writeFileSync(BARS_FILE, JSON.stringify(bars, null, 2), 'utf-8');
    } catch (err) {
      console.error('[BarStore] Failed writing bars file:', err);
    }
  }

  private static loadAccessFromDisk(): UserBarAccessRecord[] {
    this.ensureDataDir();
    if (fs.existsSync(ACCESS_FILE)) {
      try {
        const content = fs.readFileSync(ACCESS_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (err) {
        console.error('[BarStore] Error reading access file:', err);
      }
    }
    return [];
  }

  private static saveAccessToDisk(access: UserBarAccessRecord[]): void {
    this.ensureDataDir();
    try {
      fs.writeFileSync(ACCESS_FILE, JSON.stringify(access, null, 2), 'utf-8');
    } catch (err) {
      console.error('[BarStore] Failed writing access file:', err);
    }
  }

  /**
   * Get all bars, filtered optionally by user permissions.
   */
  static async getBars(userId?: string): Promise<BarOutlet[]> {
    let bars: BarOutlet[] = [];

    // 1. Try Supabase table if available
    try {
      const supabase = getSupabaseServiceClient();
      const { data: dbBars, error } = await supabase
        .from('bar_outlets')
        .select('*')
        .order('name', { ascending: true });

      if (!error && Array.isArray(dbBars) && dbBars.length > 0) {
        bars = dbBars;
      }
    } catch {
      // Supabase table not available
    }

    // 2. Fallback to resilient file store if DB query returned nothing or failed
    if (bars.length === 0) {
      bars = this.loadBarsFromDisk();
    }

    // 3. If userId is provided, filter by user_bar_access if access records exist
    if (userId) {
      // Check Supabase user_bar_access
      let userAccessBars: BarOutlet[] = [];
      try {
        const supabase = getSupabaseServiceClient();
        const { data: accessList, error } = await supabase
          .from('user_bar_access')
          .select('bar_id, status')
          .eq('user_id', userId)
          .eq('status', 'Active');

        if (!error && Array.isArray(accessList) && accessList.length > 0) {
          const allowedBarIds = new Set(accessList.map((a: any) => a.bar_id));
          userAccessBars = bars.filter(b => allowedBarIds.has(b.id));
        }
      } catch {
        // Ignore error
      }

      // If Supabase didn't return access, check disk access store
      if (userAccessBars.length === 0) {
        const accessList = this.loadAccessFromDisk();
        const userRecords = accessList.filter(a => a.user_id === userId && a.status === 'Active');
        if (userRecords.length > 0) {
          const allowedBarIds = new Set(userRecords.map(a => a.bar_id));
          userAccessBars = bars.filter(b => allowedBarIds.has(b.id));
        }
      }

      if (userAccessBars.length > 0) {
        return userAccessBars;
      }
    }

    return bars;
  }

  /**
   * Fetch single bar by ID.
   */
  static async getBarById(id: string): Promise<BarOutlet | null> {
    // 1. Try Supabase
    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('bar_outlets')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch {
      // Ignore
    }

    // 2. Disk store
    const bars = this.loadBarsFromDisk();
    return bars.find(b => b.id === id) || null;
  }

  /**
   * Create a new Bar Outlet.
   */
  static async createBar(
    data: {
      name: string;
      code: string;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
      contact_person?: string | null;
      phone?: string | null;
      email?: string | null;
      license_number?: string | null;
      status?: 'Active' | 'Inactive';
    },
    ownerId?: string
  ): Promise<BarOutlet> {
    const trimmedName = data.name.trim();
    const trimmedCode = data.code.trim().toUpperCase();

    if (!trimmedName) {
      throw new Error('Bar name is required');
    }
    if (!trimmedCode) {
      throw new Error('Bar code is required');
    }

    // Verify code uniqueness in disk store
    const bars = this.loadBarsFromDisk();
    const existing = bars.find(b => b.code.toUpperCase() === trimmedCode);
    if (existing) {
      throw new Error(`A bar with code "${trimmedCode}" already exists.`);
    }

    const now = new Date().toISOString();
    const newBar: BarOutlet = {
      id: crypto.randomUUID(),
      name: trimmedName,
      code: trimmedCode,
      address: data.address || null,
      city: data.city || null,
      state: data.state || 'Maharashtra',
      pincode: data.pincode || null,
      contact_person: data.contact_person || null,
      phone: data.phone || null,
      email: data.email || null,
      license_number: data.license_number || null,
      status: data.status || 'Active',
      created_at: now,
      updated_at: now,
    };

    // 1. Try persisting to Supabase table
    try {
      const supabase = getSupabaseServiceClient();
      const { data: dbBar, error } = await supabase
        .from('bar_outlets')
        .insert({
          id: newBar.id,
          name: newBar.name,
          code: newBar.code,
          address: newBar.address,
          city: newBar.city,
          state: newBar.state,
          pincode: newBar.pincode,
          contact_person: newBar.contact_person,
          phone: newBar.phone,
          email: newBar.email,
          license_number: newBar.license_number,
          status: newBar.status,
        })
        .select()
        .single();

      if (!error && dbBar) {
        newBar.id = dbBar.id;
      }
    } catch {
      // Supabase table not available, using disk store
    }

    // 2. Persist to Disk store
    bars.push(newBar);
    this.saveBarsToDisk(bars);

    // 3. Assign access to owner if provided
    if (ownerId) {
      await this.assignUserAccess(ownerId, newBar.id, 'Owner');
    }

    return newBar;
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
      contact_person: string | null;
      phone: string | null;
      email: string | null;
      license_number: string | null;
      status: 'Active' | 'Inactive';
    }>
  ): Promise<BarOutlet> {
    const bars = this.loadBarsFromDisk();
    const index = bars.findIndex(b => b.id === id);
    if (index === -1) {
      throw new Error(`Bar outlet with ID "${id}" not found`);
    }

    if (data.code) {
      const upperCode = data.code.trim().toUpperCase();
      const codeDuplicate = bars.find(b => b.id !== id && b.code.toUpperCase() === upperCode);
      if (codeDuplicate) {
        throw new Error(`A bar with code "${upperCode}" already exists.`);
      }
    }

    const now = new Date().toISOString();
    const existing = bars[index];
    const updated: BarOutlet = {
      ...existing,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      code: data.code !== undefined ? data.code.trim().toUpperCase() : existing.code,
      address: data.address !== undefined ? data.address : existing.address,
      city: data.city !== undefined ? data.city : existing.city,
      state: data.state !== undefined ? data.state : existing.state,
      pincode: data.pincode !== undefined ? data.pincode : existing.pincode,
      contact_person: data.contact_person !== undefined ? data.contact_person : existing.contact_person,
      phone: data.phone !== undefined ? data.phone : existing.phone,
      email: data.email !== undefined ? data.email : existing.email,
      license_number: data.license_number !== undefined ? data.license_number : existing.license_number,
      status: data.status !== undefined ? data.status : existing.status,
      updated_at: now,
    };

    // 1. Try Supabase update
    try {
      const supabase = getSupabaseServiceClient();
      await supabase
        .from('bar_outlets')
        .update({
          name: updated.name,
          code: updated.code,
          address: updated.address,
          city: updated.city,
          state: updated.state,
          pincode: updated.pincode,
          contact_person: updated.contact_person,
          phone: updated.phone,
          email: updated.email,
          license_number: updated.license_number,
          status: updated.status,
          updated_at: now,
        })
        .eq('id', id);
    } catch {
      // Ignore
    }

    // 2. Update Disk store
    bars[index] = updated;
    this.saveBarsToDisk(bars);

    return updated;
  }

  /**
   * Toggle bar active / inactive status.
   */
  static async toggleBarStatus(id: string, status: 'Active' | 'Inactive'): Promise<BarOutlet> {
    return this.updateBar(id, { status });
  }

  /**
   * Assign user access to a bar.
   */
  static async assignUserAccess(userId: string, barId: string, role = 'Owner'): Promise<void> {
    // 1. Try Supabase table
    try {
      const supabase = getSupabaseServiceClient();
      await supabase
        .from('user_bar_access')
        .insert({
          user_id: userId,
          bar_id: barId,
          role,
          status: 'Active',
        })
        .select();
    } catch {
      // Ignore
    }

    // 2. Disk store
    const accessList = this.loadAccessFromDisk();
    const existing = accessList.find(a => a.user_id === userId && a.bar_id === barId);
    if (!existing) {
      accessList.push({
        id: crypto.randomUUID(),
        user_id: userId,
        bar_id: barId,
        role,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      this.saveAccessToDisk(accessList);
    }
  }

  /**
   * Safe Delete a bar outlet.
   * Checks for transactional records across inventory, opening stock, purchases,
   * purchases inward, sales, stock transfers, stock adjustments, stock ledger, batches, etc.
   * If transactions exist, deactivates the bar outlet instead of hard deleting to protect audit trail.
   * If no transactions exist, permanently deletes bar record & user_bar_access records.
   */
  static async deleteBar(id: string): Promise<{ action: 'deleted' | 'deactivated'; message: string; bar: BarOutlet }> {
    const existing = await this.getBarById(id);
    if (!existing) {
      throw new Error('Bar outlet not found');
    }

    const supabase = getSupabaseServiceClient();
    const transactionCheckDetails: string[] = [];

    // Helper to safely check Supabase table
    const checkSupabaseTable = async (tableName: string, barColumn = 'bar_id') => {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true })
          .eq(barColumn, id);
        if (!error && count && count > 0) {
          return count;
        }
      } catch {
        // Table or column might not exist in Supabase schema cache
      }
      return 0;
    };

    // Helper to safely check disk JSON data file
    const checkDiskFile = (fileName: string, barColumnKeys = ['bar_id', 'barId', 'source_bar_id', 'destination_bar_id']) => {
      try {
        const filePath = path.join(DATA_DIR, fileName);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            const matches = parsed.filter(item =>
              barColumnKeys.some(key => item[key] === id)
            );
            return matches.length;
          }
        }
      } catch {
        // Ignore read errors
      }
      return 0;
    };

    // 1. Inventory
    const invCount = Math.max(await checkSupabaseTable('inventory'), checkDiskFile('inventory.json'));
    if (invCount > 0) transactionCheckDetails.push(`${invCount} inventory items`);

    // 2. Opening Stock
    const osCount = Math.max(await checkSupabaseTable('opening_stock'), checkDiskFile('opening_stock.json'));
    if (osCount > 0) transactionCheckDetails.push(`${osCount} opening stock entries`);

    // 3. Purchases
    const purCount = Math.max(await checkSupabaseTable('purchases'), checkDiskFile('purchases.json'));
    if (purCount > 0) transactionCheckDetails.push(`${purCount} purchase records`);

    // 4. Purchases Inward
    const inwCount = Math.max(await checkSupabaseTable('purchases_inward'), checkDiskFile('purchases_inward.json'));
    if (inwCount > 0) transactionCheckDetails.push(`${inwCount} inward register entries`);

    // 5. Stock Adjustments
    const adjCount = Math.max(await checkSupabaseTable('stock_adjustments'), checkDiskFile('stock_adjustments.json'));
    if (adjCount > 0) transactionCheckDetails.push(`${adjCount} stock adjustments`);

    // 6. Stock Transfers
    const trnsSourceCount = Math.max(
      await checkSupabaseTable('stock_transfers', 'source_bar_id'),
      checkDiskFile('stock_transfers.json', ['source_bar_id'])
    );
    const trnsDestCount = Math.max(
      await checkSupabaseTable('stock_transfers', 'destination_bar_id'),
      checkDiskFile('stock_transfers.json', ['destination_bar_id'])
    );
    const trnsCount = trnsSourceCount + trnsDestCount;
    if (trnsCount > 0) transactionCheckDetails.push(`${trnsCount} stock transfers`);

    // 7. Stock Ledger
    const ledgerCount = Math.max(await checkSupabaseTable('stock_ledger'), checkDiskFile('stock_ledger.json'));
    if (ledgerCount > 0) transactionCheckDetails.push(`${ledgerCount} stock ledger records`);

    // 8. Batches
    const batchCount = Math.max(await checkSupabaseTable('batches'), checkDiskFile('batches.json'));
    if (batchCount > 0) transactionCheckDetails.push(`${batchCount} product batches`);

    const hasTransactions = transactionCheckDetails.length > 0;

    if (hasTransactions) {
      // SAFE DEACTIVATION: Bar has historical transactional data. Preserve compliance & audit trail!
      const deactivatedBar = await this.updateBar(id, { status: 'Inactive' });
      return {
        action: 'deactivated',
        message: `Bar "${existing.name}" contains historical transactions (${transactionCheckDetails.join(', ')}). To preserve audit compliance and register history, it has been deactivated instead of hard-deleted.`,
        bar: deactivatedBar,
      };
    }

    // NO TRANSACTIONS EXIST: Perform permanent safe removal
    // 1. Delete from Supabase
    try {
      await supabase.from('user_bar_access').delete().eq('bar_id', id);
      await supabase.from('bar_outlets').delete().eq('id', id);
    } catch (err) {
      console.error('[BarStore] Supabase bar delete error:', err);
    }

    // 2. Delete from Disk store
    const bars = this.loadBarsFromDisk();
    const updatedBars = bars.filter(b => b.id !== id);
    this.saveBarsToDisk(updatedBars);

    const accessList = this.loadAccessFromDisk();
    const updatedAccess = accessList.filter(a => a.bar_id !== id);
    this.saveAccessToDisk(updatedAccess);

    return {
      action: 'deleted',
      message: `Bar outlet "${existing.name}" permanently deleted successfully.`,
      bar: { ...existing, status: 'Inactive' },
    };
  }

  /**
   * Get dictionary mapping barId -> BarOutlet for quick in-memory lookups.
   */
  static async getBarMap(): Promise<Record<string, { id: string; name: string; code: string }>> {
    const bars = await this.getBars();
    const map: Record<string, { id: string; name: string; code: string }> = {};
    for (const b of bars) {
      map[b.id] = { id: b.id, name: b.name, code: b.code };
    }
    return map;
  }
}
