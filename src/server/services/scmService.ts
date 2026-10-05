import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import { ProductMasterService } from './productMasterService.js';

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

  /**
   * Validate a batch of SCM code imports without saving.
   */
  static async validateScmImport(rows: any[]): Promise<{
    summary: { total: number; valid: number; invalid: number; duplicate: number };
    validatedRows: any[];
  }> {
    const supabase = getSupabaseServiceClient();

    // 1. Fetch all master data for resolution
    const [categories, brands, packSizes, products, existingScm] = await Promise.all([
      ProductMasterService.getCategories(),
      ProductMasterService.getBrands(),
      supabase.from('pack_sizes').select('id, name, volume_ml, pack_type'),
      supabase.from('products').select('id, name, product_name, sku, brand_id, category_id, pack_size_id'),
      supabase.from('scm_codes').select('scm_code, product_id, is_active').eq('is_active', true),
    ]);

    const existingScmMap = new Map();
    if (existingScm.data) {
      existingScm.data.forEach(s => existingScmMap.set(s.scm_code.toUpperCase(), s));
    }

    const prodData = products.data || [];
    const psData = packSizes.data || [];

    const summary = { total: rows.length, valid: 0, invalid: 0, duplicate: 0 };
    const validatedRows: any[] = [];

    // Local file duplicate detection
    const fileCodes = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const row: any = { ...raw, rowIndex: i, status: 'VALID', errors: [] };

      // Normalize SCM Code
      const scmCode = (raw.scm_code || raw.scm || raw.scm_no || raw.scm_number || '').toString().trim().toUpperCase();
      row.scm_code = scmCode;

      if (!scmCode) {
        row.status = 'INVALID';
        row.errors.push('SCM Code is required.');
      }

      // Check for duplicates within the file
      if (scmCode && fileCodes.has(scmCode)) {
        row.status = 'DUPLICATE';
        row.errors.push('Duplicate SCM Code in import file.');
      }
      if (scmCode) fileCodes.add(scmCode);

      // Check for duplicates in DB
      if (scmCode && existingScmMap.has(scmCode)) {
        row.status = 'DUPLICATE';
        row.errors.push(`SCM Code "${scmCode}" already exists in database.`);
      }

      // Resolve Product
      // Logic: If Product ID is provided, use it. Otherwise try to resolve by SKU or Name/Brand/Size.
      let product: any = null;
      const productId = raw.product_id || raw.product_id;
      const sku = (raw.sku || '').toString().trim();
      const productName = (raw.product || raw.product_name || '').toString().trim();
      const brandName = (raw.brand || raw.brand_name || '').toString().trim();
      const sizeName = (raw.bottle_size || raw.size || raw.pack_size || '').toString().trim();

      if (productId) {
        product = prodData.find(p => p.id === productId);
      } else if (sku) {
        product = prodData.find(p => p.sku === sku);
      } else if (productName) {
        // Find product by name, brand, and size
        product = prodData.find(p => {
          const pName = (p.product_name || p.name || '').toLowerCase();
          const matchesName = pName === productName.toLowerCase();
          
          if (!matchesName) return false;

          if (brandName) {
            const brand = brands.find(b => b.id === p.brand_id);
            const matchesBrand = brand && (brand.brand_name || brand.name || '').toLowerCase() === brandName.toLowerCase();
            if (!matchesBrand) return false;
          }

          if (sizeName) {
            const ps = psData.find(s => s.id === p.pack_size_id);
            const matchesSize = ps && (ps.name.toLowerCase() === sizeName.toLowerCase() || ps.volume_ml.toString() === sizeName);
            if (!matchesSize) return false;
          }

          return true;
        });
      }

      if (product) {
        row.product_id = product.id;
        row.product_display = product.product_name || product.name;
        
        // Product Type Verification
        if (raw.product_type) {
          const pType = product.productType || ProductMasterService.resolveProductType(categories.find(c => c.id === product.category_id)?.name || '');
          if (pType.toLowerCase() !== raw.product_type.toLowerCase()) {
            row.status = 'WARNING';
            row.errors.push(`Product Type mismatch. File says "${raw.product_type}", System says "${pType}". System value will be used.`);
          }
        }

        // Resolve derived fields if not provided
        if (!row.variant) row.variant = product.product_name || product.name;
        if (!row.bottle_size) {
           const ps = psData.find(s => s.id === product.pack_size_id);
           row.bottle_size = ps ? ps.name : null;
        }
        if (!row.packaging_type) row.packaging_type = product.pack_type || 'Bottle';
      } else {
        row.status = 'INVALID';
        row.errors.push('Could not resolve product. Please check Product Name, Brand, or SKU.');
      }

      // Dates
      const effectiveFrom = raw.effective_from || raw.effective_date || new Date().toISOString().split('T')[0];
      row.effective_from = effectiveFrom;
      if (isNaN(Date.parse(effectiveFrom))) {
        row.status = 'INVALID';
        row.errors.push('Invalid Effective From date.');
      }

      if (raw.effective_to && isNaN(Date.parse(raw.effective_to))) {
        row.status = 'INVALID';
        row.errors.push('Invalid Effective To date.');
      }

      // Status / Active
      if (raw.status) {
        const s = raw.status.toLowerCase();
        row.is_active = !(s === 'inactive' || s === 'false' || s === '0' || s === 'disabled');
      } else {
        row.is_active = true;
      }

      if (row.status === 'VALID' || row.status === 'WARNING') {
        if (row.status === 'VALID') summary.valid++;
      } else if (row.status === 'DUPLICATE') {
        summary.duplicate++;
      } else {
        summary.invalid++;
      }

      validatedRows.push(row);
    }

    return { summary, validatedRows };
  }

  /**
   * Bulk insert SCM codes after validation.
   */
  static async bulkCreateScmCodes(rows: any[], options: { barId?: string } = {}): Promise<{ count: number }> {
    const supabase = getSupabaseServiceClient();
    
    // We process sequentially or in chunks to ensure the "terminate previous" logic in createScmCode works.
    // Or we do a more optimized batch update.
    // For safety and reuse of logic, let's use the existing createScmCode but in a loop.
    // In a real production app, we'd use a single transaction.
    
    let count = 0;
    for (const row of rows) {
      if (row.status === 'VALID' || row.status === 'WARNING') {
        const record = await this.createScmCode({
          scmCode: row.scm_code,
          productId: row.product_id,
          variant: row.variant,
          bottleSize: row.bottle_size,
          packagingType: row.packaging_type,
          effectiveFrom: row.effective_from,
          supplierItemCode: row.supplier_item_code,
          exciseReference: row.excise_reference,
          sourceReference: row.source_reference || 'Bulk Import',
        });

        // If specific effective_to or inactive status was provided, update it
        if (row.effective_to || row.is_active === false) {
           const supabase = getSupabaseServiceClient();
           await supabase.from('scm_codes').update({
             effective_to: row.effective_to || record.effective_to,
             is_active: row.is_active !== undefined ? row.is_active : record.is_active
           }).eq('id', record.id);
        }
        count++;
      }
    }

    return { count };
  }
}
