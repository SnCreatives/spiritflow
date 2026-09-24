import { getSupabaseServiceClient } from '../../lib/supabase/client.ts';
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilterParams,
  PaginatedResult,
} from '../../types/index.ts';
import {
  ProductCreateSchema,
  ProductUpdateSchema,
} from '../../lib/validation/inventory.ts';

export class ProductService {
  /**
   * Fetch paginated products with database-backed search and relational filters.
   */
  static async getProducts(params: ProductFilterParams = {}): Promise<PaginatedResult<Product>> {
    const supabase = getSupabaseServiceClient();
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select(
        `
        id,
        name,
        product_name,
        category_id,
        brand_id,
        pack_size_id,
        sku,
        pack_type,
        purchase_tp_price,
        selling_price,
        mrp_reference,
        status,
        compliance_reference,
        source,
        source_date,
        source_reference,
        created_at,
        updated_at,
        category:categories(id, name, code),
        brand:brands(id, name, brand_name),
        pack_size:pack_sizes(id, name, volume_ml, pack_type),
        inventory:inventory(opening_quantity, current_quantity, purchased_quantity, adjustment_quantity, returned_quantity, stock_value)
      `,
        { count: 'exact' }
      );

    if (params.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }

    if (params.brandId) {
      query = query.eq('brand_id', params.brandId);
    }

    if (params.status && params.status !== 'All') {
      query = query.eq('status', params.status);
    }

    if (params.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,product_name.ilike.%${s}%,compliance_reference.ilike.%${s}%`);
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    const mappedItems: Product[] = ((data as any[]) || []).map((row) => ({
      ...row,
      name: row.name || row.product_name,
      purchase_price: Number(row.purchase_tp_price || 0),
      mrp: Number(row.mrp_reference || 0),
      compliance_ref: row.compliance_reference || row.compliance_ref,
    }));

    const total = count || 0;
    return {
      items: mappedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Fetch single product with complete relationships.
   */
  static async getProductById(id: string): Promise<Product | null> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('products')
      .select(
        `
        id,
        name,
        product_name,
        category_id,
        brand_id,
        pack_size_id,
        sku,
        pack_type,
        purchase_tp_price,
        selling_price,
        mrp_reference,
        status,
        compliance_reference,
        source,
        source_date,
        source_reference,
        created_at,
        updated_at,
        category:categories(id, name, code),
        brand:brands(id, name, brand_name, category_id),
        pack_size:pack_sizes(id, name, volume_ml, pack_type, category_id),
        inventory:inventory(opening_quantity, current_quantity, purchased_quantity, adjustment_quantity, returned_quantity, stock_value)
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch product: ${error.message}`);
    }
    if (!data) return null;

    const row: any = data;
    return {
      ...row,
      name: row.name || row.product_name,
      purchase_price: Number(row.purchase_tp_price || 0),
      mrp: Number(row.mrp_reference || 0),
      compliance_ref: row.compliance_reference || row.compliance_ref,
    };
  }

  /**
   * Create a new product with strict server-side relationship validation
   * and automatic inventory + stock ledger initialization.
   */
  static async createProduct(input: CreateProductInput): Promise<Product> {
    // 1. Validate input types and base constraints
    const validation = ProductCreateSchema.safeParse(input);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message || 'Invalid product parameters');
    }
    const validData = validation.data;

    const supabase = getSupabaseServiceClient();

    // 2. Strict Server-Side Category Validation
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id, name, code')
      .eq('id', validData.categoryId)
      .maybeSingle();

    if (catError || !category) {
      throw new Error('Selected Category does not exist');
    }

    // 3. Strict Server-Side Brand Validation & Category Linkage
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, brand_name, category_id')
      .eq('id', validData.brandId)
      .maybeSingle();

    if (brandError || !brand) {
      throw new Error('Selected Brand does not exist');
    }

    if (brand.category_id !== validData.categoryId) {
      throw new Error(
        `Invalid category-brand combination: Brand "${brand.name || brand.brand_name}" does not belong to category "${category.name}".`
      );
    }

    // 4. Strict Server-Side Pack Size Validation & Category Linkage
    const { data: packSize, error: packError } = await supabase
      .from('pack_sizes')
      .select('id, name, category_id, volume_ml, pack_type')
      .eq('id', validData.packSizeId)
      .maybeSingle();

    if (packError || !packSize) {
      throw new Error('Selected Pack Size does not exist');
    }

    if (packSize.category_id !== validData.categoryId) {
      throw new Error(
        `Invalid category-pack size combination: Pack size "${packSize.name}" does not belong to category "${category.name}".`
      );
    }

    // Strict constraint: Do not allow 500 ml Pint
    if (packSize.volume_ml === 500 && packSize.pack_type?.toLowerCase() === 'pint') {
      throw new Error('Invalid pack specification: 500 ml cannot be classified as Pint.');
    }

    // 5. Generate SKU if missing
    let sku = validData.sku?.trim() || null;
    if (!sku) {
      const bName = brand.name || brand.brand_name || 'PROD';
      const cleanBrand = bName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
      const cleanCat = category.code.substring(0, 3).toUpperCase();
      sku = `${cleanCat}-${cleanBrand}-${packSize.volume_ml}`;
    }

    const packType = validData.packType || packSize.pack_type || 'Bottle';

    // 7. Insert Product Record
    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert({
        name: validData.name,
        product_name: validData.name,
        category_id: validData.categoryId,
        brand_id: validData.brandId,
        pack_size_id: validData.packSizeId,
        sku,
        pack_type: packType,
        purchase_tp_price: validData.purchasePrice || 0,
        selling_price: validData.sellingPrice || 0,
        mrp_reference: validData.mrp || 0,
        status: validData.status,
        compliance_reference: validData.complianceRef || null,
        import_batch_id: (input as any).import_batch_id || null,
        source: 'Verified Source: Maharashtra State Excise',
        source_date: '2025-2026',
        source_reference: 'State Excise Maharashtra Approved Label Catalogue',
      })
      .select('id')
      .single();

    if (insertError || !product) {
      if (insertError?.code === '23505') {
        throw new Error(`A product with SKU "${sku}" already exists.`);
      }
      throw new Error(`Failed to create product: ${insertError?.message || 'Database error'}`);
    }

    // 8. Initialize Inventory Record
    const openingStock = Math.max(0, validData.openingStock || 0);
    const { error: invError } = await supabase.from('inventory').insert({
      product_id: product.id,
      opening_quantity: openingStock,
      current_quantity: openingStock,
      purchased_quantity: 0,
      adjustment_quantity: 0,
      returned_quantity: 0,
      stock_value: openingStock * (validData.purchasePrice || 0),
    });

    if (invError) {
      console.error('Warning: failed to create inventory row:', invError.message);
    }

    // 9. If opening stock > 0, write entry to stock ledger
    if (openingStock > 0) {
      await supabase.from('stock_ledger').insert({
        product_id: product.id,
        transaction_type: 'OPENING',
        reference_type: 'INITIAL_STOCK',
        reference_number: 'OPENING-STOCK',
        stock_in: openingStock,
        stock_out: 0,
        balance_quantity: openingStock,
        unit_price: validData.purchasePrice || 0,
        total_value: openingStock * (validData.purchasePrice || 0),
        remarks: 'Opening stock recorded upon product master registration',
        import_batch_id: (input as any).import_batch_id || null,
      });
    }

    return (await this.getProductById(product.id))!;
  }

  /**
   * Bulk Create or Import Products with Validation & Deduplication
   */
  static async bulkCreateProducts(
    items: Array<{
      name: string;
      category_id: string;
      brand_id: string;
      pack_size_id: string;
      sku?: string;
      pack_type?: string;
      purchase_price?: number;
      selling_price?: number;
      mrp?: number;
      opening_quantity?: number;
    }>
  ): Promise<{
    successCount: number;
    failedCount: number;
    items: any[];
    errors: Array<{ index: number; row: any; error: string }>;
  }> {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const inserted: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        if (!row.name || !row.category_id || !row.brand_id || !row.pack_size_id) {
          throw new Error('Missing mandatory fields (Name, Category, Brand, Pack Size)');
        }

        const product = await this.createProduct({
          name: row.name,
          categoryId: row.category_id,
          brandId: row.brand_id,
          packSizeId: row.pack_size_id,
          sku: row.sku,
          packType: row.pack_type,
          purchasePrice: Number(row.purchase_price) || 0,
          sellingPrice: Number(row.selling_price) || 0,
          mrp: Number(row.mrp) || 0,
          openingStock: row.opening_quantity,
          status: 'Active',
          import_batch_id: (row as any).import_batch_id,
        });

        inserted.push(product);
      } catch (err: any) {
        errors.push({
          index: i,
          row,
          error: err.message || 'Failed to import row',
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

  /**
   * Update an existing product with server-side validations.
   */
  static async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    const validation = ProductUpdateSchema.safeParse(input);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message || 'Invalid update parameters');
    }
    const validData = validation.data;

    const existingProduct = await this.getProductById(id);
    if (!existingProduct) {
      throw new Error('Product not found');
    }

    const supabase = getSupabaseServiceClient();

    const targetCategoryId = validData.categoryId || existingProduct.category_id;
    const targetBrandId = validData.brandId || existingProduct.brand_id;
    const targetPackSizeId = validData.packSizeId || existingProduct.pack_size_id;

    // Validate relationships if changed
    if (validData.categoryId || validData.brandId) {
      const { data: brand } = await supabase
        .from('brands')
        .select('category_id, name, brand_name')
        .eq('id', targetBrandId)
        .maybeSingle();

      if (brand && brand.category_id !== targetCategoryId) {
        throw new Error(
          `Invalid category-brand combination: Brand does not belong to the selected category.`
        );
      }
    }

    if (validData.categoryId || validData.packSizeId) {
      const { data: packSize } = await supabase
        .from('pack_sizes')
        .select('category_id, name, volume_ml, pack_type')
        .eq('id', targetPackSizeId)
        .maybeSingle();

      if (packSize && packSize.category_id !== targetCategoryId) {
        throw new Error(
          `Invalid category-pack size combination: Pack size does not belong to the selected category.`
        );
      }
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (validData.name !== undefined) {
      updatePayload.name = validData.name;
      updatePayload.product_name = validData.name;
    }
    if (validData.categoryId !== undefined) updatePayload.category_id = validData.categoryId;
    if (validData.brandId !== undefined) updatePayload.brand_id = validData.brandId;
    if (validData.packSizeId !== undefined) updatePayload.pack_size_id = validData.packSizeId;
    if (validData.sku !== undefined) updatePayload.sku = validData.sku;
    if (validData.packType !== undefined) updatePayload.pack_type = validData.packType;
    if (validData.purchasePrice !== undefined) updatePayload.purchase_tp_price = validData.purchasePrice;
    if (validData.sellingPrice !== undefined) updatePayload.selling_price = validData.sellingPrice;
    if (validData.mrp !== undefined) updatePayload.mrp_reference = validData.mrp;
    if (validData.status !== undefined) updatePayload.status = validData.status;
    if (validData.complianceRef !== undefined) updatePayload.compliance_reference = validData.complianceRef;

    const { error: updateError } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to update product: ${updateError.message}`);
    }

    return (await this.getProductById(id))!;
  }

  /**
   * Toggle Active / Inactive status.
   */
  static async toggleProductStatus(id: string, status: 'Active' | 'Inactive'): Promise<Product> {
    return this.updateProduct(id, { status });
  }

  /**
   * Delete product if no transactions exist.
   * Requirement: Do not physically delete products referenced by transactions.
   */
  static async deleteProduct(id: string): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabaseServiceClient();

    // Check purchases
    const { count: purchaseCount } = await supabase
      .from('purchase_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    if (purchaseCount && purchaseCount > 0) {
      throw new Error(
        'Cannot delete product: Historical inward purchase records reference this product. Mark as "Inactive" instead.'
      );
    }

    // Check stock ledger
    const { count: ledgerCount } = await supabase
      .from('stock_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    if (ledgerCount && ledgerCount > 0) {
      throw new Error(
        'Cannot delete product: Stock ledger entries exist. Deactivate this product instead to maintain audit trails.'
      );
    }

    // Clean up inventory row
    await supabase.from('inventory').delete().eq('product_id', id);

    // Delete product
    const { error: delError } = await supabase.from('products').delete().eq('id', id);
    if (delError) {
      throw new Error(`Failed to delete product: ${delError.message}`);
    }

    return {
      success: true,
      message: 'Product deleted successfully',
    };
  }

  /**
   * Reusable server-side lookup for active products ordered by Brand -> Product Name -> Pack Size.
   */
  static async getActiveProductsForSelection(): Promise<any[]> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        product_name,
        sku,
        status,
        category_id,
        brand_id,
        pack_size_id,
        category:categories(id, name, code),
        brand:brands(id, name, brand_name, registration_reference),
        pack_size:pack_sizes(id, name, volume_ml, pack_type)
      `)
      .eq('status', 'Active');

    if (error) {
      throw new Error(`Failed to fetch active products for selection: ${error.message}`);
    }

    const items = (data || []).map((row: any) => ({
      id: row.id,
      product_name: row.product_name || row.name,
      name: row.name || row.product_name,
      sku: row.sku,
      status: row.status,
      category_id: row.category_id,
      category_name: row.category?.name || 'Uncategorized',
      brand_id: row.brand_id,
      brand_name: row.brand?.name || row.brand?.brand_name || 'Unbranded',
      brand_code: row.brand?.registration_reference || '',
      pack_size_id: row.pack_size_id,
      pack_size: row.pack_size ? `${row.pack_size.name} (${row.pack_size.volume_ml}ml)` : 'Standard',
      display_label: `${row.brand?.name || row.brand?.brand_name || 'Unbranded'} — ${row.product_name || row.name} — ${row.pack_size ? `${row.pack_size.name} (${row.pack_size.volume_ml}ml)` : 'Standard'}`,
    }));

    // Sort by brand_name -> product_name -> pack_size
    items.sort((a, b) => {
      const cmpBrand = a.brand_name.localeCompare(b.brand_name);
      if (cmpBrand !== 0) return cmpBrand;
      const cmpProd = a.product_name.localeCompare(b.product_name);
      if (cmpProd !== 0) return cmpProd;
      return a.pack_size.localeCompare(b.pack_size);
    });

    return items;
  }
}
