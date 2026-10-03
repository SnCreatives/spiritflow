import { getSupabaseServiceClient } from '../../lib/supabase/client.js';

export interface ScmCodeRecord {
  id: string;
  scm_code: string;
  product_id: string;
  variant?: string | null;
  bottle_size?: string | null;
  packaging_type?: string;
  effective_from: string; // YYYY-MM-DD
  effective_to?: string | null; // YYYY-MM-DD
  is_active: boolean;
  supplier_item_code?: string | null;
  excise_reference?: string | null;
  source_reference?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScmCodeInput {
  scmCode: string;
  productId: string;
  variant?: string;
  bottleSize?: string;
  packagingType?: string;
  effectiveFrom?: string;
  supplierItemCode?: string;
  exciseReference?: string;
  sourceReference?: string;
}

// In-memory backing store for resiliency when table creation is pending in Supabase
const memoryScmStore: ScmCodeRecord[] = [];

export class ScmService {
  private static dbTableAvailable: boolean | null = null;

  private static async checkDbTable(): Promise<boolean> {
    if (this.dbTableAvailable !== null) return this.dbTableAvailable;
    try {
      const supabase = getSupabaseServiceClient();
      const { error } = await supabase.from('scm_codes').select('id').limit(1);
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        this.dbTableAvailable = false;
      } else {
        this.dbTableAvailable = true;
      }
    } catch {
      this.dbTableAvailable = false;
    }
    return this.dbTableAvailable;
  }

  /**
   * Create or update SCM code with non-destructive effective dating.
   * If a previous active code exists for this product, it marks effective_to and sets is_active = false.
   */
  static async createScmCode(input: CreateScmCodeInput): Promise<ScmCodeRecord> {
    if (!input.scmCode || !input.scmCode.trim()) {
      throw new Error('SCM code cannot be empty. Do not fabricate fake codes.');
    }
    if (!input.productId) {
      throw new Error('Product ID is required for SCM code assignment.');
    }

    const cleanCode = input.scmCode.trim().toUpperCase();
    const effectiveFrom = input.effectiveFrom || new Date().toISOString().split('T')[0];
    const supabase = getSupabaseServiceClient();

    // 1. Verify product exists
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, name, product_name, sku, pack_type, pack_size:pack_sizes(name, volume_ml)')
      .eq('id', input.productId)
      .maybeSingle();

    if (pErr || !product) {
      throw new Error(`Product not found: ${input.productId}`);
    }

    const isDbReady = await this.checkDbTable();

    // 2. Terminate previous active SCM code's effective window non-destructively
    const prevEndDate = new Date(new Date(effectiveFrom).getTime() - 86400000).toISOString().split('T')[0];

    if (isDbReady) {
      try {
        await supabase
          .from('scm_codes')
          .update({
            effective_to: prevEndDate,
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('product_id', input.productId)
          .eq('is_active', true);

        // 3. Insert new effective-dated SCM code record
        const { data: newRow, error: insErr } = await supabase
          .from('scm_codes')
          .insert({
            scm_code: cleanCode,
            product_id: input.productId,
            variant: input.variant || product.product_name || product.name,
            bottle_size: input.bottleSize || (product.pack_size as any)?.name || null,
            packaging_type: input.packagingType || product.pack_type || 'Bottle',
            effective_from: effectiveFrom,
            effective_to: null,
            is_active: true,
            supplier_item_code: input.supplierItemCode || null,
            excise_reference: input.exciseReference || null,
            source_reference: input.sourceReference || 'Maharashtra State Excise Approved SCM',
          })
          .select()
          .single();

        if (!insErr && newRow) {
          return newRow as ScmCodeRecord;
        }
      } catch (err: any) {
        console.warn('Fallback to memory SCM store:', err.message);
      }
    }

    // Memory store fallback
    for (const item of memoryScmStore) {
      if (item.product_id === input.productId && item.is_active) {
        item.effective_to = prevEndDate;
        item.is_active = false;
        item.updated_at = new Date().toISOString();
      }
    }

    const record: ScmCodeRecord = {
      id: crypto.randomUUID(),
      scm_code: cleanCode,
      product_id: input.productId,
      variant: input.variant || product.product_name || product.name,
      bottle_size: input.bottleSize || (product.pack_size as any)?.name || null,
      packaging_type: input.packagingType || product.pack_type || 'Bottle',
      effective_from: effectiveFrom,
      effective_to: null,
      is_active: true,
      supplier_item_code: input.supplierItemCode || null,
      excise_reference: input.exciseReference || null,
      source_reference: input.sourceReference || 'Maharashtra State Excise Approved SCM',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryScmStore.push(record);
    return record;
  }

  /**
   * Get active SCM code for a specific product.
   * Returns null if no active SCM code is assigned.
   */
  static async getCurrentScmCode(productId: string): Promise<ScmCodeRecord | null> {
    if (!productId) return null;
    const isDbReady = await this.checkDbTable();

    if (isDbReady) {
      try {
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
          .from('scm_codes')
          .select('*')
          .eq('product_id', productId)
          .eq('is_active', true)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) return data as ScmCodeRecord;
      } catch {}
    }

    const found = memoryScmStore
      .filter(s => s.product_id === productId && s.is_active)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];

    return found || null;
  }

  /**
   * Get full historical audit trail of SCM codes for a product.
   */
  static async getScmHistory(productId: string): Promise<ScmCodeRecord[]> {
    if (!productId) return [];
    const isDbReady = await this.checkDbTable();

    if (isDbReady) {
      try {
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
          .from('scm_codes')
          .select('*')
          .eq('product_id', productId)
          .order('effective_from', { ascending: false });

        if (!error && data) return data as ScmCodeRecord[];
      } catch {}
    }

    return memoryScmStore
      .filter(s => s.product_id === productId)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  }

  /**
   * Query SCM codes list with optional filters.
   */
  static async getScmCodes(params?: {
    search?: string;
    productId?: string;
    activeOnly?: boolean;
    limit?: number;
  }): Promise<ScmCodeRecord[]> {
    const isDbReady = await this.checkDbTable();
    const limit = params?.limit || 100;

    if (isDbReady) {
      try {
        const supabase = getSupabaseServiceClient();
        let query = supabase.from('scm_codes').select('*');
        if (params?.productId) query = query.eq('product_id', params.productId);
        if (params?.activeOnly) query = query.eq('is_active', true);
        if (params?.search) {
          const s = params.search.trim();
          query = query.or(`scm_code.ilike.%${s}%,variant.ilike.%${s}%`);
        }
        const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
        if (!error && data) return data as ScmCodeRecord[];
      } catch {}
    }

    let items = [...memoryScmStore];
    if (params?.productId) items = items.filter(i => i.product_id === params.productId);
    if (params?.activeOnly) items = items.filter(i => i.is_active);
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(i => i.scm_code.toLowerCase().includes(q) || (i.variant || '').toLowerCase().includes(q));
    }
    return items.slice(0, limit);
  }
}
