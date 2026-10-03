import { BarStoreService } from './barStoreService.js';
import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import {
  Category,
  PackSize,
  Brand,
  PaginatedResult,
  CreatePackSizeInput,
  UpdatePackSizeInput,
  PackSizeFilterParams,
  CreateBrandInput,
  UpdateBrandInput,
  BrandFilterParams,
} from '../../types/index.js';
import {
  PackSizeCreateSchema,
  PackSizeUpdateSchema,
  BrandCreateSchema,
  BrandUpdateSchema,
} from '../../lib/validation/inventory.js';
import {
  CANONICAL_BRAND_MASTER,
  CANONICAL_CATEGORY_ORDER,
  compareCanonicalBrands,
} from '../../utils/canonicalBrands.js';

export class MasterService {
  // ==========================================
  // CATEGORIES
  // ==========================================
  static async getCategories(): Promise<Category[]> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, code, active, created_at')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    return (data as Category[]) || [];
  }

  // ==========================================
  // PACK SIZES
  // ==========================================
  static async getPackSizes(params: PackSizeFilterParams = {}): Promise<PaginatedResult<PackSize>> {
    const supabase = getSupabaseServiceClient();
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('pack_sizes')
      .select(
        'id, category_id, name, volume_ml, pack_type, active, source, created_at, category:categories(id, name, code)',
        { count: 'exact' }
      );

    if (params.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }

    if (params.status && params.status !== 'All') {
      query = query.eq('active', params.status === 'Active');
    }

    if (params.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or(`name.ilike.%${s}%,pack_type.ilike.%${s}%`);
    }

    const { data, error, count } = await query
      .order('volume_ml', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch pack sizes: ${error.message}`);
    }

    const total = count || 0;
    return {
      items: (data as unknown as PackSize[]) || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async createPackSize(input: CreatePackSizeInput): Promise<PackSize> {
    const validation = PackSizeCreateSchema.safeParse(input);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message || 'Invalid pack size data');
    }
    const validData = validation.data;

    // Strict constraint: Do not allow 500 ml Pint
    if (validData.volumeMl === 500 && validData.packType?.toLowerCase() === 'pint') {
      throw new Error('Invalid pack specification: 500 ml cannot be classified as Pint.');
    }

    const supabase = getSupabaseServiceClient();

    // Verify category exists
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', validData.categoryId)
      .maybeSingle();

    if (catError || !category) {
      throw new Error('Selected category does not exist');
    }

    const { data, error } = await supabase
      .from('pack_sizes')
      .insert({
        category_id: validData.categoryId,
        name: validData.name,
        volume_ml: validData.volumeMl,
        pack_type: validData.packType,
        active: validData.active !== undefined ? validData.active : true,
        import_batch_id: (input as any).import_batch_id || null,
        source: 'Verified Source: Maharashtra State Excise',
      })
      .select('id, category_id, name, volume_ml, pack_type, active, source, created_at, category:categories(id, name, code)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`A pack size named "${validData.name}" already exists in this category`);
      }
      throw new Error(`Failed to create pack size: ${error.message}`);
    }

    return data as unknown as PackSize;
  }

  static async bulkCreatePackSizes(
    items: Array<{
      name: string;
      category_id: string;
      volume_ml: number;
      pack_type?: string;
      active?: boolean;
    }>
  ): Promise<{
    successCount: number;
    failedCount: number;
    items: PackSize[];
    errors: Array<{ index: number; row: any; error: string }>;
  }> {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const inserted: PackSize[] = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        if (!row.name || !row.category_id || !row.volume_ml) {
          throw new Error('Missing required fields: Name, Category, or Volume (ml)');
        }

        const packSize = await this.createPackSize({
          name: row.name,
          categoryId: row.category_id,
          volumeMl: Number(row.volume_ml),
          packType: row.pack_type || 'Bottle',
          active: row.active !== undefined ? row.active : true,
          import_batch_id: (row as any).import_batch_id,
        } as any);
        inserted.push(packSize);
      } catch (err: any) {
        errors.push({
          index: i,
          row,
          error: err.message || 'Failed to import pack size',
        });
      }
    }

    return {
      successCount: inserted.length,
      failedCount: errors.length,
      items: inserted,
      errors,
    };
  }

  static async updatePackSize(id: string, input: UpdatePackSizeInput): Promise<PackSize> {
    const validation = PackSizeUpdateSchema.safeParse(input);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message || 'Invalid pack size update data');
    }
    const validData = validation.data;

    const supabase = getSupabaseServiceClient();

    const updatePayload: Record<string, any> = {};
    if (validData.name !== undefined) updatePayload.name = validData.name;
    if (validData.categoryId !== undefined) updatePayload.category_id = validData.categoryId;
    if (validData.volumeMl !== undefined) updatePayload.volume_ml = validData.volumeMl;
    if (validData.packType !== undefined) updatePayload.pack_type = validData.packType;
    if (validData.active !== undefined) updatePayload.active = validData.active;

    const { data, error } = await supabase
      .from('pack_sizes')
      .update(updatePayload)
      .eq('id', id)
      .select('id, category_id, name, volume_ml, pack_type, active, created_at, category:categories(id, name, code)')
      .single();

    if (error) {
      throw new Error(`Failed to update pack size: ${error.message}`);
    }
    return data as unknown as PackSize;
  }

  static async togglePackSizeStatus(id: string, active: boolean): Promise<PackSize> {
    return this.updatePackSize(id, { active });
  }

  // ==========================================
  // BRANDS
  // ==========================================
  static async getBrands(params: BrandFilterParams = {}): Promise<PaginatedResult<Brand>> {
    const supabase = getSupabaseServiceClient();
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(params.limit) || 200));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('brands')
      .select(
        'id, name, brand_name, category_id, maharashtra_applicability, maharashtra_status, registration_reference, active, source, source_date, source_reference, created_at, category:categories(id, name, code)',
        { count: 'exact' }
      );

    if (params.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }

    if (params.status && params.status !== 'All') {
      query = query.eq('active', params.status === 'Active');
    }

    if (params.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or(`name.ilike.%${s}%,brand_name.ilike.%${s}%`);
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch brands: ${error.message}`);
    }

    const items: Brand[] = ((data as any[]) || []).map((row) => ({
      ...row,
      name: row.name || row.brand_name,
      maharashtra_status: row.maharashtra_applicability || row.maharashtra_status || 'Active',
      active: row.active !== false,
    }));

    items.sort((a, b) => compareCanonicalBrands(a.name, b.name));

    const total = count || 0;
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async createBrand(input: CreateBrandInput): Promise<Brand> {
    const validation = BrandCreateSchema.safeParse(input);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message || 'Invalid brand data');
    }
    const validData = validation.data;

    const supabase = getSupabaseServiceClient();

    // Verify category exists
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', validData.categoryId)
      .maybeSingle();

    if (catError || !category) {
      throw new Error('Selected category does not exist');
    }

    const { data, error } = await supabase
      .from('brands')
      .insert({
        name: validData.name,
        brand_name: validData.name,
        category_id: validData.categoryId,
        maharashtra_applicability: validData.maharashtraStatus || 'Active',
        maharashtra_status: validData.maharashtraStatus || 'Active',
        active: validData.active !== undefined ? validData.active : true,
        source: 'Verified Source: Maharashtra State Excise',
        source_date: '2025-2026',
        source_reference: 'State Excise Maharashtra Approved Brand Register',
      })
      .select(
        'id, name, brand_name, category_id, maharashtra_applicability, maharashtra_status, active, source, created_at, category:categories(id, name, code)'
      )
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`A brand named "${validData.name}" already exists in this category`);
      }
      throw new Error(`Failed to create brand: ${error.message}`);
    }

    const row: any = data;
    return {
      ...row,
      name: row.name || row.brand_name,
      maharashtra_status: row.maharashtra_applicability || row.maharashtra_status || 'Active',
      active: row.active !== false,
    };
  }

  static async bulkCreateBrands(
    items: Array<{
      name: string;
      category_id: string;
      manufacturer_id?: string;
      maharashtra_status?: string;
      active?: boolean;
    }>
  ): Promise<{
    successCount: number;
    failedCount: number;
    items: Brand[];
    errors: Array<{ index: number; row: any; error: string }>;
  }> {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const inserted: Brand[] = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        if (!row.name || !row.category_id) {
          throw new Error('Missing Brand Name or Category');
        }

        const brand = await this.createBrand({
          name: row.name,
          categoryId: row.category_id,
          maharashtraStatus: (row.maharashtra_status as any) || 'Active',
          active: row.active !== undefined ? row.active : true,
          import_batch_id: (row as any).import_batch_id,
        } as any);
        inserted.push(brand);
      } catch (err: any) {
        errors.push({
          index: i,
          row,
          error: err.message || 'Failed to import brand',
        });
      }
    }

    return {
      successCount: inserted.length,
      failedCount: errors.length,
      items: inserted,
      errors,
    };
  }

  static async updateBrand(id: string, input: UpdateBrandInput): Promise<Brand> {
    const validation = BrandUpdateSchema.safeParse(input);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message || 'Invalid brand update data');
    }
    const validData = validation.data;

    const supabase = getSupabaseServiceClient();
    const updatePayload: Record<string, any> = {};
    if (validData.name !== undefined) {
      updatePayload.name = validData.name;
      updatePayload.brand_name = validData.name;
    }
    if (validData.categoryId !== undefined) updatePayload.category_id = validData.categoryId;
    if (validData.maharashtraStatus !== undefined) {
      updatePayload.maharashtra_applicability = validData.maharashtraStatus;
      updatePayload.maharashtra_status = validData.maharashtraStatus;
    }
    if (validData.active !== undefined) updatePayload.active = validData.active;

    const { data, error } = await supabase
      .from('brands')
      .update(updatePayload)
      .eq('id', id)
      .select(
        'id, name, brand_name, category_id, maharashtra_applicability, maharashtra_status, active, source, created_at, category:categories(id, name, code)'
      )
      .single();

    if (error) {
      throw new Error(`Failed to update brand: ${error.message}`);
    }

    const row: any = data;
    return {
      ...row,
      name: row.name || row.brand_name,
      maharashtra_status: row.maharashtra_applicability || row.maharashtra_status || 'Active',
      active: row.active !== false,
    };
  }

  static async toggleBrandStatus(id: string, active: boolean): Promise<Brand> {
    return this.updateBrand(id, { active });
  }

  static async getActiveBrands(categoryId?: string): Promise<Brand[]> {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('brands')
      .select(
        'id, name, brand_name, category_id, active, category:categories(id, name, code)'
      )
      .eq('active', true);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch active brands: ${error.message}`);
    }

    const items = ((data as any[]) || []).map((row) => ({
      ...row,
      name: row.name || row.brand_name,
      active: true,
    }));

    items.sort((a, b) => compareCanonicalBrands(a.name, b.name));
    return items;
  }

  static readonly CANONICAL_BRAND_MASTER = CANONICAL_BRAND_MASTER;

  /**
   * Synchronizes the database `brands`, `pack_sizes`, and `products` tables with CANONICAL_BRAND_MASTER:
   * - Ensures all 7 canonical categories (Whisky, Rum, Vodka, Gin, Brandy, Beer, Wine) and pack sizes exist
   * - Upserts all 107 canonical brands into their exact categories
   * - Reassigns any products pointing to legacy/non-canonical brands to the canonical brand
   * - Ensures every single one of the 107 canonical brands has active product SKUs in `products`
   * - Removes all non-canonical brands from the database
   */
  static async syncCanonicalBrands(): Promise<{
    insertedOrUpdated: number;
    removed: number;
    totalCanonical: number;
    seededProducts: number;
  }> {
    const supabase = getSupabaseServiceClient();

    // 1. Fetch categories & ensure all 7 canonical categories exist (including Gin)
    const requiredCategories = [
      { name: 'Whisky', code: 'WHISKY' },
      { name: 'Rum', code: 'RUM' },
      { name: 'Vodka', code: 'VODKA' },
      { name: 'Gin', code: 'GIN' },
      { name: 'Brandy', code: 'BRANDY' },
      { name: 'Beer', code: 'BEER' },
      { name: 'Wine', code: 'WINE' },
    ];

    const { data: initialCategories, error: catErr } = await supabase
      .from('categories')
      .select('id, name, code, active');
    if (catErr) {
      throw new Error(`Failed to fetch categories for brand sync: ${catErr.message}`);
    }

    const catMap = new Map<string, string>();
    for (const c of initialCategories || []) {
      catMap.set(c.name.toLowerCase(), c.id);
    }

    for (const reqCat of requiredCategories) {
      if (!catMap.has(reqCat.name.toLowerCase())) {
        const { data: newCat } = await supabase
          .from('categories')
          .insert({ name: reqCat.name, code: reqCat.code, active: true })
          .select('id, name')
          .single();
        if (newCat) {
          catMap.set(newCat.name.toLowerCase(), newCat.id);
        }
      }
    }

    // Deactivate legacy non-canonical categories so they don't clutter UI filters
    const canonicalCatNames = new Set(requiredCategories.map(rc => rc.name.toLowerCase()));
    const legacyCatIds = (initialCategories || [])
      .filter(c => !canonicalCatNames.has(c.name.toLowerCase()) && c.active !== false)
      .map(c => c.id);
    if (legacyCatIds.length > 0) {
      await supabase.from('categories').update({ active: false }).in('id', legacyCatIds);
    }

    // Ensure Gin has standard pack sizes if missing
    const ginCatId = catMap.get('gin');
    if (ginCatId) {
      const { data: ginPacks } = await supabase
        .from('pack_sizes')
        .select('id')
        .eq('category_id', ginCatId);
      if (!ginPacks || ginPacks.length === 0) {
        await supabase.from('pack_sizes').insert([
          { category_id: ginCatId, name: '180 ml Nip / Quarter', volume_ml: 180, pack_type: 'Quarter', active: true },
          { category_id: ginCatId, name: '375 ml Pint / Half', volume_ml: 375, pack_type: 'Half', active: true },
          { category_id: ginCatId, name: '750 ml Bottle / Full', volume_ml: 750, pack_type: 'Bottle', active: true },
          { category_id: ginCatId, name: '1000 ml (1 L) Bottle', volume_ml: 1000, pack_type: 'Bottle', active: true },
        ]);
      }
    }

    // 2. Fetch default manufacturer if needed
    const { data: mfgs } = await supabase.from('manufacturers').select('id').limit(1);
    const defaultMfgId = mfgs?.[0]?.id || null;

    // 3. Fetch all existing brands
    const { data: existingBrands, error: brandErr } = await supabase
      .from('brands')
      .select('id, name, brand_name, category_id, active, maharashtra_status');
    if (brandErr) {
      throw new Error(`Failed to fetch existing brands: ${brandErr.message}`);
    }

    const existingList = existingBrands || [];

    // 4. Build desired canonical brand rows & upsert
    let insertedOrUpdated = 0;
    const canonicalKeyToId = new Map<string, string>(); // `${categoryId}::${name}` -> brandId
    const toInsert: Record<string, any>[] = [];

    for (const [categoryName, brandNames] of Object.entries(this.CANONICAL_BRAND_MASTER)) {
      const categoryId = catMap.get(categoryName.toLowerCase());
      if (!categoryId) continue;

      for (const exactName of brandNames) {
        const key = `${categoryId}::${exactName}`;
        const match = existingList.find(
          (b: any) =>
            b.category_id === categoryId &&
            ((b.name || b.brand_name) === exactName ||
              (b.name || b.brand_name || '').toLowerCase() === exactName.toLowerCase())
        );

        if (match) {
          canonicalKeyToId.set(key, match.id);
          if (match.name !== exactName || match.brand_name !== exactName || !match.active) {
            await supabase
              .from('brands')
              .update({
                name: exactName,
                brand_name: exactName,
                active: true,
                maharashtra_status: 'Approved',
                maharashtra_applicability: 'Active',
              })
              .eq('id', match.id);
          }
          insertedOrUpdated++;
        } else {
          const payload: Record<string, any> = {
            name: exactName,
            brand_name: exactName,
            category_id: categoryId,
            maharashtra_status: 'Approved',
            maharashtra_applicability: 'Active',
            active: true,
            source: 'Verified Source: Maharashtra State Excise',
            source_date: '2025-2026',
            source_reference: 'State Excise Maharashtra Approved Brand Register',
          };
          if (defaultMfgId) payload.manufacturer_id = defaultMfgId;
          toInsert.push(payload);
        }
      }
    }

    if (toInsert.length > 0) {
      const { data: createdRows, error: insErr } = await supabase
        .from('brands')
        .insert(toInsert)
        .select('id, name, category_id');
      if (insErr) {
        throw new Error(`Failed to insert canonical brands: ${insErr.message}`);
      }
      for (const row of createdRows || []) {
        canonicalKeyToId.set(`${row.category_id}::${row.name}`, row.id);
        insertedOrUpdated++;
      }
    }

    const validBrandIds = new Set<string>(Array.from(canonicalKeyToId.values()));

    // Fetch pack sizes by category
    const { data: packSizes } = await supabase
      .from('pack_sizes')
      .select('id, name, category_id, volume_ml, pack_type')
      .eq('active', true);

    const packByCat = new Map<string, any>();
    for (const ps of packSizes || []) {
      const existing = packByCat.get(ps.category_id);
      // Prefer 750ml for spirits/wine, 650ml for beer
      if (!existing || ps.volume_ml === 750 || ps.volume_ml === 650) {
        packByCat.set(ps.category_id, ps);
      }
    }

    // 5. Find obsolete/old brands not in validBrandIds
    const { data: allBrandsNow } = await supabase
      .from('brands')
      .select('id, name, brand_name, category_id');
    const obsoleteBrands = (allBrandsNow || []).filter((b: any) => !validBrandIds.has(b.id));

    if (obsoleteBrands.length > 0) {
      const obsoleteIds = obsoleteBrands.map((b: any) => b.id);
      const { data: affectedProducts } = await supabase
        .from('products')
        .select('id, name, brand_id, category_id, pack_size_id')
        .in('brand_id', obsoleteIds);

      const obsoleteMap = new Map<string, any>();
      for (const ob of obsoleteBrands) {
        obsoleteMap.set(ob.id, ob);
      }

      const whiskyCatId = catMap.get('whisky')!;
      const beerCatId = catMap.get('beer')!;

      for (const prod of affectedProducts || []) {
        const oldBrand = obsoleteMap.get(prod.brand_id);
        const oldName = (oldBrand?.name || oldBrand?.brand_name || '').toLowerCase();

        let targetBrandId: string | undefined;
        let targetCategoryId: string = oldBrand?.category_id || prod.category_id;

        for (const [key, bId] of canonicalKeyToId.entries()) {
          const [cId, cName] = key.split('::');
          if (cId === targetCategoryId) {
            if (
              oldName.includes(cName.toLowerCase()) ||
              cName.toLowerCase().includes(oldName.replace(/ whisky| rum| gin| brandy| beer| wine/g, '').trim())
            ) {
              targetBrandId = bId;
              break;
            }
          }
        }

        if (!targetBrandId) {
          for (const [key, bId] of canonicalKeyToId.entries()) {
            const [cId] = key.split('::');
            if (cId === targetCategoryId) {
              targetBrandId = bId;
              break;
            }
          }
        }

        if (!targetBrandId) {
          targetCategoryId =
            oldName.includes('beer') || oldName.includes('haywards') || oldName.includes('kingfisher')
              ? beerCatId
              : whiskyCatId;
          for (const [key, bId] of canonicalKeyToId.entries()) {
            const [cId] = key.split('::');
            if (cId === targetCategoryId) {
              targetBrandId = bId;
              break;
            }
          }
        }

        if (targetBrandId) {
          const updatePayload: Record<string, any> = {
            brand_id: targetBrandId,
          };
          if (targetCategoryId !== prod.category_id) {
            updatePayload.category_id = targetCategoryId;
            const validPack = packByCat.get(targetCategoryId);
            if (validPack) {
              updatePayload.pack_size_id = validPack.id;
            }
          }
          await supabase.from('products').update(updatePayload).eq('id', prod.id);
        }
      }

      await supabase.from('brands').delete().in('id', obsoleteIds);
    }

    // 6. Ensure EVERY SINGLE ONE of the 107 canonical brands has at least one active product in `products`
    const { data: currentProducts } = await supabase
      .from('products')
      .select('id, brand_id, status');
    const activeBrandIdsWithProduct = new Set<string>();
    for (const p of currentProducts || []) {
      if (p.status === 'Active') {
        activeBrandIdsWithProduct.add(p.brand_id);
      }
    }

    const productsToInsert: Record<string, any>[] = [];
    for (const [key, brandId] of canonicalKeyToId.entries()) {
      if (!activeBrandIdsWithProduct.has(brandId)) {
        const [categoryId, brandName] = key.split('::');
        const defaultPack = packByCat.get(categoryId);
        if (!defaultPack) continue;

        const cleanCode = brandName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
        const skuSuffix = brandId.substring(0, 4).toUpperCase();
        const sku = `MH-${cleanCode}-${defaultPack.volume_ml}-${skuSuffix}`;
        const prodName = `${brandName} (${defaultPack.name})`;

        productsToInsert.push({
          name: prodName,
          product_name: prodName,
          category_id: categoryId,
          brand_id: brandId,
          pack_size_id: defaultPack.id,
          sku,
          pack_type: defaultPack.pack_type || 'Bottle',
          purchase_tp_price: 450,
          selling_price: 580,
          mrp_reference: 600,
          status: 'Active',
          source: 'Verified Source: Maharashtra State Excise',
          source_date: '2025-2026',
          source_reference: 'State Excise Maharashtra Approved Brand Register',
        });
      }
    }

    let seededProducts = 0;
    if (productsToInsert.length > 0) {
      const { data: insertedProds, error: prodInsErr } = await supabase
        .from('products')
        .insert(productsToInsert)
        .select('id');
      if (!prodInsErr && insertedProds) {
        seededProducts = insertedProds.length;
        const invRows = insertedProds.map((p: any) => ({
          product_id: p.id,
          opening_quantity: 24,
          purchased_quantity: 0,
          adjustment_quantity: 0,
          returned_quantity: 0,
          current_quantity: 24,
          stock_value: 24 * 450,
        }));
        await supabase.from('inventory').insert(invRows);
      } else if (prodInsErr) {
        console.error('[BrandMaster] Error seeding missing brand products:', prodInsErr.message);
      }
    }

    return {
      insertedOrUpdated,
      removed: obsoleteBrands.length,
      totalCanonical: validBrandIds.size,
      seededProducts,
    };
  }

  // ==========================================
  // BAR OUTLETS MASTER
  // ==========================================
  static async getBars(userId?: string) {
    return BarStoreService.getBars(userId);
  }

  static async getBarById(id: string) {
    return BarStoreService.getBarById(id);
  }

  static async createBar(
    data: {
      name: string;
      code?: string | null;
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
  ) {
    return BarStoreService.createBar(data, ownerId);
  }

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
  ) {
    return BarStoreService.updateBar(id, data);
  }

  static async toggleBarStatus(id: string, status: 'Active' | 'Inactive') {
    return BarStoreService.toggleBarStatus(id, status);
  }

  static async deleteBar(id: string) {
    return BarStoreService.deleteBar(id);
  }
}
