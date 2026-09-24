import { getSupabaseServiceClient } from '../../lib/supabase/client.ts';
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
} from '../../types/index.ts';
import {
  PackSizeCreateSchema,
  PackSizeUpdateSchema,
  BrandCreateSchema,
  BrandUpdateSchema,
} from '../../lib/validation/inventory.ts';

export class MasterService {
  // ==========================================
  // CATEGORIES
  // ==========================================
  static async getCategories(): Promise<Category[]> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, code, active, created_at')
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
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
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
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
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

  static async getActiveBrands(): Promise<Brand[]> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('brands')
      .select(
        'id, name, brand_name, category_id, active, category:categories(id, name, code)'
      )
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active brands: ${error.message}`);
    }

    return (data as any[] || []).map((row) => ({
      ...row,
      name: row.name || row.brand_name,
      active: true,
    }));
  }
}
