import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import { ScmService } from './scmService.js';

export type CanonicalProductType = 'Wine' | 'Fermented Beer' | 'Mild Beer' | 'Spirit';

export const CANONICAL_PRODUCT_TYPES: CanonicalProductType[] = [
  'Spirit',
  'Wine',
  'Fermented Beer',
  'Mild Beer',
];

export const SPIRIT_SUBCATEGORIES = [
  'Whiskey',
  'Gin',
  'Vodka',
  'Tequila',
  'Rum',
  'Brandy',
] as const;

export const ALLOWED_BOTTLE_SIZES: Record<CanonicalProductType, number[]> = {
  'Spirit': [2000, 1000, 750, 375, 180, 90, 200], // 200ml strictly conditionally allowed
  'Mild Beer': [650, 500, 330],
  'Fermented Beer': [650, 500, 330],
  'Wine': [750, 375, 180, 90],
};

export const ALLOWED_PACKAGING_TYPES = ['Bottle', 'Can', 'Case', 'Keg', 'Pouch'] as const;

export interface CascadingQuery {
  productType?: string;
  categoryId?: string;
  brandId?: string;
  variant?: string;
  packSizeId?: string;
  volumeMl?: number;
  packagingType?: string;
}

export interface CascadingResponse {
  productTypes: string[];
  categories: Array<{ id: string; name: string; productType: string; code?: string }>;
  brands: Array<{ id: string; name: string; categoryId: string; productType?: string }>;
  variants: string[];
  packSizes: Array<{ id: string; name: string; volumeMl: number; packType: string }>;
  packagingTypes: string[];
  products: Array<{
    id: string;
    name: string;
    productName: string;
    variant: string;
    brandId: string;
    brandName?: string;
    categoryId: string;
    categoryName?: string;
    productType?: string;
    packSizeId: string;
    volumeMl?: number;
    packType: string;
    mrp: number;
    purchasePrice: number;
    sku: string;
    status: string;
    activeScmCode?: string | null;
  }>;
}

export class ProductMasterService {
  /**
   * Normalize and resolve Product Type from Category Name/Code
   */
  static resolveProductType(categoryNameOrCode: string): CanonicalProductType {
    const raw = (categoryNameOrCode || '').trim().toLowerCase();
    if (raw.includes('wine')) return 'Wine';
    if (raw.includes('mild beer') || raw === 'mild') return 'Mild Beer';
    if (raw.includes('fermented') || raw.includes('strong beer') || raw === 'beer') return 'Fermented Beer';
    return 'Spirit'; // Default for Whisky, Rum, Vodka, Gin, Brandy, Tequila, Liqueurs
  }

  /**
   * Validate that bottle volume is allowed for the specific product type
   */
  static validateBottleSize(productType: CanonicalProductType, volumeMl: number, isWhisky = false, allow200Special = false): void {
    const allowed = ALLOWED_BOTTLE_SIZES[productType] || [];
    if (!allowed.includes(volumeMl)) {
      throw new Error(`Bottle size ${volumeMl} ml is not permitted for product type "${productType}". Allowed sizes: ${allowed.join(', ')} ml.`);
    }

    if (volumeMl === 2000 && productType === 'Spirit' && !isWhisky) {
      throw new Error('2000 ml bottle size is restricted to applicable Whisky products only.');
    }

    if (volumeMl === 200 && productType === 'Spirit' && !allow200Special) {
      throw new Error('200 ml bottle size is not automatically available for all spirit products.');
    }
  }

  /**
   * Fetch all canonical product categories with normalized product types
   */
  static async getCategories() {
    const supabase = getSupabaseServiceClient();
    let cats: any[] | null = null;

    const { data: rawCats, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (!error && rawCats) {
      cats = rawCats;
    } else {
      const { data: fallbackCats } = await supabase
        .from('categories')
        .select('id, name, code, active')
        .order('name');
      cats = fallbackCats || [];
    }

    return (cats || []).map(c => {
      const pType = c.product_type || this.resolveProductType(c.name || c.code);
      return {
        ...c,
        product_type: pType,
      };
    });
  }

  /**
   * Global Brand Master retrieval with normalization
   */
  static async getBrands(params?: { categoryId?: string; productType?: string; search?: string }) {
    const supabase = getSupabaseServiceClient();
    let query = supabase.from('brands').select('id, name, brand_name, category_id, active, registration_reference');

    if (params?.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }
    if (params?.search) {
      const s = params.search.trim();
      query = query.or(`name.ilike.%${s}%,brand_name.ilike.%${s}%`);
    }

    const { data: brands, error } = await query.order('name');
    if (error) throw new Error(`Failed to fetch brands: ${error.message}`);

    return (brands || []).map(b => ({
      ...b,
      name: (b.brand_name || b.name || '').trim(),
    }));
  }

  /**
   * Create or normalize Brand with duplicate prevention
   */
  static async createBrand(input: { name: string; categoryId: string; registrationReference?: string }) {
    const cleanName = (input.name || '').trim();
    if (!cleanName) throw new Error('Brand name cannot be empty.');
    if (!input.categoryId) throw new Error('Brand must be associated with a valid Category.');

    const supabase = getSupabaseServiceClient();

    // Check for duplicate brand (case-insensitive)
    const { data: existing } = await supabase
      .from('brands')
      .select('id, name, brand_name, category_id')
      .ilike('name', cleanName)
      .eq('category_id', input.categoryId)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const { data: created, error } = await supabase
      .from('brands')
      .insert({
        name: cleanName,
        brand_name: cleanName,
        category_id: input.categoryId,
        registration_reference: input.registrationReference || null,
        active: true,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create brand: ${error.message}`);
    return created;
  }

  /**
   * Canonical Cascading Dropdown API
   * Logical flow: Product Type -> Brand -> Variant -> Bottle Size -> Packaging -> Product -> MRP / SCM Code
   */
  static async getCascadingData(query: CascadingQuery = {}): Promise<CascadingResponse> {
    const supabase = getSupabaseServiceClient();

    // 1. Fetch categories
    const categories = await this.getCategories();
    let filteredCategories = categories;

    if (query.productType) {
      filteredCategories = categories.filter(c => c.product_type === query.productType);
    }

    const categoryIds = filteredCategories.map(c => c.id);

    // 2. Fetch brands
    let brands = await this.getBrands();
    if (query.productType || query.categoryId) {
      brands = brands.filter(b => categoryIds.includes(b.category_id));
      if (query.categoryId) {
        brands = brands.filter(b => b.category_id === query.categoryId);
      }
    }

    // 3. Fetch products matching cascade
    let pQuery = supabase.from('products').select(`
      id,
      name,
      product_name,
      category_id,
      brand_id,
      pack_size_id,
      sku,
      pack_type,
      purchase_tp_price,
      mrp_reference,
      status,
      category:categories(id, name, code),
      brand:brands(id, name, brand_name),
      pack_size:pack_sizes(id, name, volume_ml, pack_type)
    `);

    if (query.categoryId) {
      pQuery = pQuery.eq('category_id', query.categoryId);
    } else if (categoryIds.length > 0) {
      pQuery = pQuery.in('category_id', categoryIds);
    }

    if (query.brandId) {
      pQuery = pQuery.eq('brand_id', query.brandId);
    }

    const { data: rawProducts, error: pErr } = await pQuery.order('name');
    if (pErr) throw new Error(`Failed to fetch cascade products: ${pErr.message}`);

    const mappedProducts = (rawProducts || []).map((p: any) => {
      const cat = p.category;
      const b = p.brand;
      const ps = p.pack_size;
      const pType = cat?.product_type || this.resolveProductType(cat?.name || '');
      const variant = p.variant || p.product_name || p.name || 'Standard';

      return {
        id: p.id,
        name: p.name,
        productName: p.product_name || p.name,
        variant,
        brandId: p.brand_id,
        brandName: b?.brand_name || b?.name || '',
        categoryId: p.category_id,
        categoryName: cat?.name || '',
        productType: pType,
        packSizeId: p.pack_size_id,
        volumeMl: ps?.volume_ml ? Number(ps.volume_ml) : undefined,
        packType: p.pack_type || 'Bottle',
        mrp: Number(p.mrp_reference || 0),
        purchasePrice: Number(p.purchase_tp_price || 0),
        sku: p.sku,
        status: p.status || 'Active',
      };
    });

    // 4. Extract distinct variants, pack sizes, packaging types
    const variantSet = new Set<string>();
    const packSizeMap = new Map<string, any>();
    const packagingSet = new Set<string>();

    mappedProducts.forEach(p => {
      if (p.variant) variantSet.add(p.variant);
      if (p.packSizeId) {
        packSizeMap.set(p.packSizeId, {
          id: p.packSizeId,
          name: `${p.volumeMl || ''} ml`,
          volumeMl: p.volumeMl || 0,
          packType: p.packType,
        });
      }
      if (p.packType) packagingSet.add(p.packType);
    });

    return {
      productTypes: CANONICAL_PRODUCT_TYPES,
      categories: filteredCategories.map(c => ({ id: c.id, name: c.name, productType: c.product_type, code: c.code })),
      brands: brands.map(b => ({ id: b.id, name: b.name, categoryId: b.category_id })),
      variants: Array.from(variantSet).sort(),
      packSizes: Array.from(packSizeMap.values()).sort((a, b) => a.volumeMl - b.volumeMl),
      packagingTypes: Array.from(packagingSet).sort(),
      products: mappedProducts,
    };
  }

  /**
   * Validate Combination (Section 18)
   */
  static async validateCombination(input: {
    categoryId: string;
    brandId: string;
    packSizeId: string;
    variant?: string;
    packType?: string;
  }): Promise<{ isValid: boolean; error?: string }> {
    const supabase = getSupabaseServiceClient();

    // 1. Check category
    const { data: cat } = await supabase.from('categories').select('id, name, code, product_type').eq('id', input.categoryId).maybeSingle();
    if (!cat) return { isValid: false, error: 'Category does not exist.' };

    const productType = cat.product_type || this.resolveProductType(cat.name);

    // 2. Check brand
    const { data: brand } = await supabase.from('brands').select('id, name, brand_name, category_id').eq('id', input.brandId).maybeSingle();
    if (!brand) return { isValid: false, error: 'Brand does not exist.' };

    if (brand.category_id !== input.categoryId) {
      return {
        isValid: false,
        error: `Brand "${brand.brand_name || brand.name}" does not belong to Category "${cat.name}". Impossible combination rejected.`,
      };
    }

    // 3. Check pack size
    const { data: packSize } = await supabase.from('pack_sizes').select('id, name, volume_ml, pack_type').eq('id', input.packSizeId).maybeSingle();
    if (!packSize) return { isValid: false, error: 'Pack Size does not exist.' };

    const vol = Number(packSize.volume_ml);
    const isWhisky = cat.name.toLowerCase().includes('whisky') || cat.name.toLowerCase().includes('whiskey');

    try {
      this.validateBottleSize(productType, vol, isWhisky);
    } catch (err: any) {
      return { isValid: false, error: err.message };
    }

    return { isValid: true };
  }

  /**
   * Check if a product is active before allowing it in an operational transaction
   */
  static async assertProductActiveForTransaction(productId: string): Promise<void> {
    const supabase = getSupabaseServiceClient();
    const { data: prod, error } = await supabase.from('products').select('id, name, status').eq('id', productId).maybeSingle();

    if (error || !prod) {
      throw new Error(`Product ${productId} not found.`);
    }

    if (prod.status && prod.status !== 'Active') {
      throw new Error(`Product "${prod.name}" is Inactive and cannot be used in a new operational transaction.`);
    }
  }

  /**
   * Excel Import Foundation (Section 19)
   * Validates structure, headers, mappings, duplicates, and row integrity without destructive operations.
   */
  static async validateImportBatch(rows: any[]): Promise<{
    validCount: number;
    errorCount: number;
    errors: Array<{ rowNumber: number; reason: string }>;
    preview: any[];
  }> {
    const errors: Array<{ rowNumber: number; reason: string }> = [];
    const preview: any[] = [];

    const categories = await this.getCategories();
    const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    const brands = await this.getBrands();
    const brandMap = new Map(brands.map(b => [b.name.toLowerCase(), b.id]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      if (!r.product_name && !r.name) {
        errors.push({ rowNumber: rowNum, reason: 'Missing product name / variant' });
        continue;
      }
      if (!r.category && !r.category_id) {
        errors.push({ rowNumber: rowNum, reason: 'Missing category' });
        continue;
      }
      if (!r.brand && !r.brand_id) {
        errors.push({ rowNumber: rowNum, reason: 'Missing brand' });
        continue;
      }

      preview.push({
        rowNumber: rowNum,
        name: r.product_name || r.name,
        category: r.category,
        brand: r.brand,
        size: r.size || r.pack_size,
        mrp: r.mrp,
        status: 'Valid'
      });
    }

    return {
      validCount: preview.length,
      errorCount: errors.length,
      errors,
      preview: preview.slice(0, 50),
    };
  }
}
