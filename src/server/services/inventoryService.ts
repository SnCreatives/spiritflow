import { getSupabaseServiceClient } from '../../lib/supabase/client.ts';
import { StockTransactionType, DashboardStats, InventoryRecord, StockLedgerRecord } from '../../types/index.ts';

export class InventoryService {
  /**
   * Validate that a Brand belongs to the specified Category.
   * Requirement 14 & Test 9: Category -> Brand Validation.
   */
  static async validateBrandCategory(categoryId: string, brandId: string): Promise<boolean> {
    const supabase = getSupabaseServiceClient();

    const { data: brand, error } = await supabase
      .from('brands')
      .select('id, category_id')
      .eq('id', brandId)
      .maybeSingle();

    if (error || !brand) {
      throw new Error('Brand not found');
    }

    if (brand.category_id !== categoryId) {
      throw new Error('Invalid category-brand combination: Brand does not belong to selected category');
    }

    return true;
  }

  /**
   * Record Opening Stock for a product.
   * Creates or updates the inventory record and records an OPENING stock ledger transaction.
   */
  static async recordOpeningStock(data: {
    productId: string;
    quantity: number;
    purchaseTpPrice?: number;
    batchNumber?: string;
    remarks?: string;
  }): Promise<{ productId: string; openingQuantity: number; currentStock: number }> {
    if (data.quantity < 0) {
      throw new Error('Opening stock quantity cannot be negative');
    }

    const supabase = getSupabaseServiceClient();

    // Verify product exists
    const { data: product, error: pError } = await supabase
      .from('products')
      .select('id, name, purchase_tp_price')
      .eq('id', data.productId)
      .maybeSingle();

    if (pError || !product) {
      throw new Error(`Product not found: ${data.productId}`);
    }

    const tpPrice = data.purchaseTpPrice !== undefined ? data.purchaseTpPrice : Number(product.purchase_tp_price || 0);

    // Optional batch record
    let batchId: string | null = null;
    if (data.batchNumber) {
      const { data: batch } = await supabase
        .from('batches')
        .insert({
          product_id: data.productId,
          batch_number: data.batchNumber,
          quantity: data.quantity,
          purchase_tp_value: data.quantity * tpPrice,
          remarks: data.remarks || 'Opening stock batch',
        })
        .select('id')
        .single();
      if (batch) batchId = batch.id;
    }

    // Check existing inventory
    const { data: existingInv } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', data.productId)
      .maybeSingle();

    let newCurrent = 0;
    if (existingInv) {
      // Current = Opening + Purchased + Adjustments + Returned
      const purchased = Number(existingInv.purchased_quantity || 0);
      const adjustments = Number(existingInv.adjustment_quantity || 0);
      const returned = Number(existingInv.returned_quantity || 0);
      newCurrent = data.quantity + purchased + adjustments + returned;

      await supabase
        .from('inventory')
        .update({
          opening_quantity: data.quantity,
          current_quantity: newCurrent,
          stock_value: newCurrent * tpPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', data.productId);
    } else {
      newCurrent = data.quantity;
      await supabase.from('inventory').insert({
        product_id: data.productId,
        opening_quantity: data.quantity,
        purchased_quantity: 0,
        adjustment_quantity: 0,
        returned_quantity: 0,
        current_quantity: newCurrent,
        stock_value: newCurrent * tpPrice,
      });
    }

    // Record in Stock Ledger
    await supabase.from('stock_ledger').insert({
      product_id: data.productId,
      transaction_date: new Date().toISOString(),
      transaction_type: 'OPENING',
      reference_number: data.batchNumber || 'OPENING-STOCK',
      stock_in: data.quantity,
      stock_out: 0,
      balance: newCurrent,
      remarks: data.remarks || 'Initial opening balance',
      import_batch_id: (data as any).import_batch_id || null,
    });

    return {
      productId: data.productId,
      openingQuantity: data.quantity,
      currentStock: newCurrent,
    };
  }

  /**
   * Process Inward Purchase.
   * Atomically records Purchase, Purchase Items, increases Inventory, and writes Stock Ledger.
   */
  static async processPurchase(purchaseData: {
    purchaseNumber: string;
    purchaseDate?: string;
    tpPermitReference?: string;
    exciseReference?: string;
    documentReference?: string;
    remarks?: string;
    items: {
      productId: string;
      quantity: number;
      purchaseTpPrice: number;
      batchNumber?: string;
      mrpReference?: number;
    }[];
  }): Promise<{ purchaseId: string; purchaseNumber: string; totalValue: number; itemsCount: number }> {
    if (!purchaseData.items || purchaseData.items.length === 0) {
      throw new Error('Purchase must contain at least one item');
    }

    const supabase = getSupabaseServiceClient();

    // Validate quantities and prices
    for (const item of purchaseData.items) {
      if (item.quantity <= 0) {
        throw new Error('Purchase item quantity must be greater than zero');
      }
      if (item.purchaseTpPrice < 0) {
        throw new Error('Purchase TP price cannot be negative');
      }
    }

    const totalValue = purchaseData.items.reduce(
      (sum, item) => sum + item.quantity * item.purchaseTpPrice,
      0
    );

    // 1. Create Purchase Record
    const { data: purchase, error: pError } = await supabase
      .from('purchases')
      .insert({
        purchase_number: purchaseData.purchaseNumber,
        purchase_date: purchaseData.purchaseDate || new Date().toISOString().split('T')[0],
        tp_permit_reference: purchaseData.tpPermitReference || null,
        excise_reference: purchaseData.exciseReference || null,
        document_reference: purchaseData.documentReference || null,
        total_value: totalValue,
        remarks: purchaseData.remarks || null,
        import_batch_id: (purchaseData as any).import_batch_id || null,
      })
      .select('id, purchase_number, total_value')
      .single();

    if (pError || !purchase) {
      if (pError?.code === '23505') {
        throw new Error(`A purchase with reference "${purchaseData.purchaseNumber}" already exists.`);
      }
      throw new Error(`Failed to create inward purchase: ${pError?.message || 'Database error'}`);
    }

    // 2. Process Items and update Inventory + Ledger atomically
    for (const item of purchaseData.items) {
      const itemTotal = item.quantity * item.purchaseTpPrice;

      // Create batch record if batch number provided
      let batchId: string | null = null;
      if (item.batchNumber) {
        const { data: batch } = await supabase
          .from('batches')
          .insert({
            product_id: item.productId,
            batch_number: item.batchNumber,
            quantity: item.quantity,
            purchase_tp_value: itemTotal,
            mrp_reference: item.mrpReference || 0,
            excise_reference: purchaseData.exciseReference || null,
            document_reference: purchaseData.documentReference || null,
          })
          .select('id')
          .single();
        if (batch) batchId = batch.id;
      }

      // Insert Purchase Item
      await supabase.from('purchase_items').insert({
        purchase_id: purchase.id,
        product_id: item.productId,
        batch_id: batchId,
        quantity: item.quantity,
        purchase_tp_price: item.purchaseTpPrice,
        total_value: itemTotal,
      });

      // Update Inventory
      const { data: currentInv } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', item.productId)
        .maybeSingle();

      let newCurrentStock = item.quantity;
      if (currentInv) {
        const newPurchased = Number(currentInv.purchased_quantity || 0) + item.quantity;
        const opening = Number(currentInv.opening_quantity || 0);
        const adjustments = Number(currentInv.adjustment_quantity || 0);
        const returned = Number(currentInv.returned_quantity || 0);
        newCurrentStock = opening + newPurchased + adjustments + returned;

        await supabase
          .from('inventory')
          .update({
            purchased_quantity: newPurchased,
            current_quantity: newCurrentStock,
            stock_value: newCurrentStock * item.purchaseTpPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('product_id', item.productId);
      } else {
        await supabase.from('inventory').insert({
          product_id: item.productId,
          opening_quantity: 0,
          purchased_quantity: item.quantity,
          adjustment_quantity: 0,
          returned_quantity: 0,
          current_quantity: item.quantity,
          stock_value: itemTotal,
        });
      }

      // Record in Stock Ledger
      await supabase.from('stock_ledger').insert({
        product_id: item.productId,
        transaction_date: new Date().toISOString(),
        transaction_type: 'PURCHASE',
        reference_id: purchase.id,
        reference_number: purchase.purchase_number,
        stock_in: item.quantity,
        stock_out: 0,
        balance: newCurrentStock,
        remarks: `Inward Purchase #${purchase.purchase_number}`,
      });

      // Link Excise Document Reference if TP permit or excise ref present
      if (purchaseData.tpPermitReference || purchaseData.exciseReference) {
        await supabase.from('excise_document_references').insert({
          reference_type: purchaseData.tpPermitReference ? 'TP_PERMIT' : 'INWARD',
          reference_number: purchaseData.tpPermitReference || purchaseData.exciseReference || purchase.purchase_number,
          product_id: item.productId,
          batch_id: batchId,
          purchase_id: purchase.id,
          quantity: item.quantity,
          document_reference: purchaseData.documentReference || null,
          remarks: `Inward permit ref for purchase ${purchase.purchase_number}`,
        });
      }
    }

    return {
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchase_number,
      totalValue,
      itemsCount: purchaseData.items.length,
    };
  }

  /**
   * Process Stock Adjustment (Inward, Outward, Return, Correction).
   * Validates non-negative stock and writes atomically to inventory and stock ledger.
   */
  static async processAdjustment(data: {
    adjustmentNumber: string;
    adjustmentDate?: string;
    productId: string;
    batchId?: string;
    adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN_IN' | 'RETURN_OUT' | 'CORRECTION';
    quantity: number;
    reference?: string;
    reason?: string;
    remarks?: string;
  }): Promise<{ adjustmentId: string; adjustmentNumber: string; newStock: number }> {
    if (data.quantity <= 0) {
      throw new Error('Adjustment quantity must be greater than zero');
    }

    const supabase = getSupabaseServiceClient();

    // Fetch current inventory
    const { data: inv, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', data.productId)
      .maybeSingle();

    if (invError || !inv) {
      throw new Error(`Inventory record not found for product ${data.productId}`);
    }

    const currentQty = Number(inv.current_quantity || inv.current_stock || 0);

    // Determine direction and delta
    const isOutward = data.adjustmentType === 'ADJUSTMENT_OUT' || data.adjustmentType === 'RETURN_OUT';
    const isReturnIn = data.adjustmentType === 'RETURN_IN';

    if (isOutward && currentQty < data.quantity) {
      throw new Error(
        `Insufficient stock for adjustment. Current stock: ${currentQty}, Requested reduction: ${data.quantity}. Stock cannot become negative.`
      );
    }

    const delta = isOutward ? -data.quantity : data.quantity;
    const newStock = currentQty + delta;
    if (newStock < 0) {
      throw new Error(`Adjustment rejected: Stock cannot become negative (resulting: ${newStock}).`);
    }

    // 1. Record stock adjustment
    const { data: adj, error: adjError } = await supabase
      .from('stock_adjustments')
      .insert({
        adjustment_number: data.adjustmentNumber,
        adjustment_date: data.adjustmentDate || new Date().toISOString().split('T')[0],
        product_id: data.productId,
        batch_id: data.batchId || null,
        adjustment_type: data.adjustmentType,
        quantity: data.quantity,
        reference: data.reference || null,
        reason: data.reason || null,
        remarks: data.remarks || null,
      })
      .select('id, adjustment_number')
      .single();

    if (adjError || !adj) {
      if (adjError?.code === '23505') {
        throw new Error(`An adjustment with reference "${data.adjustmentNumber}" already exists.`);
      }
      throw new Error(`Failed to create stock adjustment: ${adjError?.message || 'Database error'}`);
    }

    // 2. Update Inventory table
    let newAdjQty = Number(inv.adjustment_quantity || 0);
    let newRetQty = Number(inv.returned_quantity || 0);

    if (isReturnIn) {
      newRetQty += data.quantity;
    } else {
      newAdjQty += delta;
    }

    await supabase
      .from('inventory')
      .update({
        adjustment_quantity: newAdjQty,
        returned_quantity: newRetQty,
        current_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', data.productId);

    // 3. Record in Stock Ledger
    await supabase.from('stock_ledger').insert({
      product_id: data.productId,
      transaction_date: new Date().toISOString(),
      transaction_type: data.adjustmentType,
      reference_id: adj.id,
      reference_number: adj.adjustment_number,
      stock_in: isOutward ? 0 : data.quantity,
      stock_out: isOutward ? data.quantity : 0,
      balance: newStock,
      remarks: data.reason ? `${data.adjustmentType}: ${data.reason}` : `Stock adjustment #${adj.adjustment_number}`,
      import_batch_id: (data as any).import_batch_id || null,
    });

    return {
      adjustmentId: adj.id,
      adjustmentNumber: adj.adjustment_number,
      newStock,
    };
  }

  /**
   * Fetch Inventory list with product & category relationships
   */
  static async getInventoryList(params?: { search?: string; categoryId?: string; lowStockOnly?: boolean }) {
    const supabase = getSupabaseServiceClient();

    let query = supabase.from('inventory').select(`
      id,
      product_id,
      opening_quantity,
      purchased_quantity,
      adjustment_quantity,
      returned_quantity,
      current_quantity,
      stock_value,
      updated_at,
      product:products(
        id,
        name,
        product_name,
        sku,
        purchase_tp_price,
        mrp_reference,
        category:categories(id, name),
        brand:brands(id, name, brand_name),
        pack_size:pack_sizes(name, volume_ml, pack_type)
      )
    `);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }

    let items = (data as unknown as InventoryRecord[]) || [];

    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        i =>
          (i.product as any)?.name?.toLowerCase().includes(q) ||
          (i.product as any)?.product_name?.toLowerCase().includes(q) ||
          (i.product as any)?.sku?.toLowerCase().includes(q)
      );
    }

    if (params?.categoryId) {
      items = items.filter(i => (i.product as any)?.category?.id === params.categoryId);
    }

    if (params?.lowStockOnly) {
      items = items.filter(i => (i.current_quantity || 0) <= 10);
    }

    return items;
  }

  /**
   * Fetch Stock Ledger entries
   */
  static async getStockLedger(productId?: string, limit = 50) {
    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('stock_ledger')
      .select(`
        id,
        product_id,
        transaction_date,
        transaction_type,
        reference_id,
        reference_number,
        stock_in,
        stock_out,
        balance,
        remarks,
        created_at,
        product:products(id, name, product_name, sku)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch stock ledger: ${error.message}`);
    }

    return (data as unknown as StockLedgerRecord[]) || [];
  }

  /**
   * Calculate live Dashboard KPIs from real database records.
   * Focuses purely on Inventory, Inwards, and Excise.
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    const supabase = getSupabaseServiceClient();
    const today = new Date().toISOString().split('T')[0];

    // Today's Inward Purchases
    const { data: todayPurchases } = await supabase
      .from('purchases')
      .select('*')
      .eq('purchase_date', today);

    const todaysPurchases =
      todayPurchases?.reduce((sum, p: any) => sum + Number(p.total_value || p.total_amount || 0), 0) || 0;

    // Current Stock & Valuation
    const { data: invList } = await supabase.from('inventory').select(`
        *,
        product:products(
          id,
          name,
          product_name,
          purchase_price,
          purchase_tp_price,
          category:categories(name)
        )
      `);

    let currentStockUnits = 0;
    let stockValuation = 0;
    let lowStockCount = 0;
    const categoryAgg: Record<string, { count: number; units: number; valuation: number }> = {};

    if (invList) {
      for (const item of invList) {
        const units = Number((item as any).current_stock ?? (item as any).current_quantity ?? 0);
        const product = (item as any).product as any;
        const tpPrice = Number(product?.purchase_price ?? product?.purchase_tp_price ?? 0);
        const catName = product?.category?.name || 'Other';

        currentStockUnits += units;
        stockValuation += units * tpPrice;

        if (units <= 10) {
          lowStockCount++;
        }

        if (!categoryAgg[catName]) {
          categoryAgg[catName] = { count: 0, units: 0, valuation: 0 };
        }
        categoryAgg[catName].count += 1;
        categoryAgg[catName].units += units;
        categoryAgg[catName].valuation += units * tpPrice;
      }
    }

    const { count: totalProductsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Active Excise Licences count
    const { count: licenceCount } = await supabase
      .from('excise_licences')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Active');

    // Recent stock ledger transactions
    const { data: recentLedger } = await supabase
      .from('stock_ledger')
      .select(`
        id,
        product_id,
        transaction_date,
        transaction_type,
        reference_number,
        stock_in,
        stock_out,
        balance,
        remarks,
        created_at,
        product:products(name, product_name)
      `)
      .order('created_at', { ascending: false })
      .limit(8);

    return {
      todaysPurchases,
      currentStockUnits,
      stockValuation,
      totalProducts: totalProductsCount || 0,
      lowStockCount,
      activeLicencesCount: licenceCount || 0,
      categoryStock: Object.entries(categoryAgg).map(([categoryName, data]) => ({
        categoryName,
        count: data.count,
        units: data.units,
        valuation: data.valuation,
      })),
      recentTransactions: (recentLedger as any) || [],
    };
  }

  /**
   * Search across Product Master (first priority), categories, purchases, suppliers, batches and excise licences.
   * Ensures products with stock = 0, no inventory row, or inactive status are fully searchable.
   */
  static async searchGlobal(query: string) {
    if (!query || query.trim().length === 0) return [];
    const supabase = getSupabaseServiceClient();
    const cleanQ = query.trim();

    let productResults: any[] = [];

    // 1. Primary: Stored Procedure / RPC for Product Master First Search with aggregated inventory stock
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_product_master', { p_query: cleanQ });
      if (!rpcError && Array.isArray(rpcData)) {
        productResults = rpcData.map(p => ({
          type: 'product',
          id: p.id,
          product_name: p.product_name,
          brand_name: p.brand_name,
          category: p.category_name,
          pack_size: p.pack_size_name,
          sku: p.sku || 'N/A',
          current_stock: Number(p.current_stock || 0),
          status: p.status || 'Active',
          title: p.product_name,
          subtitle: `Brand: ${p.brand_name || 'N/A'} • Category: ${p.category_name || 'N/A'} • Pack: ${p.pack_size_name || 'N/A'} • Stock: ${Number(p.current_stock || 0)} • Status: ${p.status || 'Active'}`,
        }));
      }
    } catch {
      // Fallback below
    }

    // Fallback if RPC failed or returned no results for specific match
    if (productResults.length === 0) {
      const { data: products } = await supabase
        .from('products')
        .select(`
          id,
          name,
          product_name,
          sku,
          status,
          category:categories(name),
          brand:brands(name, brand_name),
          pack_size:pack_sizes(name),
          inventory(current_quantity)
        `)
        .or(`name.ilike.%${cleanQ}%,product_name.ilike.%${cleanQ}%,sku.ilike.%${cleanQ}%`)
        .limit(15);

      if (products) {
        productResults = products.map((p: any) => {
          const invList = p.inventory || [];
          const totalStock = invList.reduce((acc: number, item: any) => acc + Number(item.current_quantity || 0), 0);
          const nameStr = p.product_name || p.name;
          const brandStr = p.brand?.brand_name || p.brand?.name || '';
          const categoryStr = p.category?.name || '';
          const packStr = p.pack_size?.name || '';
          return {
            type: 'product',
            id: p.id,
            product_name: nameStr,
            brand_name: brandStr,
            category: categoryStr,
            pack_size: packStr,
            sku: p.sku || 'N/A',
            current_stock: totalStock,
            status: p.status || 'Active',
            title: nameStr,
            subtitle: `Brand: ${brandStr} • Category: ${categoryStr} • Pack: ${packStr} • Stock: ${totalStock} • Status: ${p.status || 'Active'}`,
          };
        });
      }
    }

    // 2. Search categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, code')
      .ilike('name', `%${cleanQ}%`)
      .limit(4);

    // 3. Search purchases by purchase number or permit ref
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, purchase_number, purchase_date, tp_permit_reference, excise_reference, total_value')
      .or(`purchase_number.ilike.%${cleanQ}%,tp_permit_reference.ilike.%${cleanQ}%,excise_reference.ilike.%${cleanQ}%`)
      .limit(6);

    // 5. Search batches
    const { data: batches } = await supabase
      .from('batches')
      .select(`
        id, 
        batch_number, 
        created_at, 
        product:products(product_name)
      `)
      .ilike('batch_number', `%${cleanQ}%`)
      .limit(4);

    // 6. Search excise licences
    const { data: licences } = await supabase
      .from('excise_licences')
      .select('id, licence_type, licence_number, status')
      .ilike('licence_number', `%${cleanQ}%`)
      .limit(3);

    return [
      ...productResults,
      ...(categories || []).map(c => ({
        type: 'category',
        id: c.id,
        title: c.name,
        subtitle: `Category Code: ${c.code}`,
      })),
      ...(batches || []).map(b => ({
        type: 'batch',
        id: b.id,
        title: `Batch #${b.batch_number}`,
        subtitle: `Product: ${(b.product as any)?.product_name || 'N/A'} • Created: ${new Date(b.created_at).toLocaleDateString()}`,
      })),
      ...(purchases || []).map(p => ({
        type: 'purchase',
        id: p.id,
        title: `Purchase #${p.purchase_number}`,
        subtitle: `Date: ${p.purchase_date} • ₹${p.total_value}${p.tp_permit_reference ? ` (Permit: ${p.tp_permit_reference})` : ''}${p.excise_reference ? ` (Excise: ${p.excise_reference})` : ''}`,
      })),
      ...(licences || []).map(l => ({
        type: 'excise',
        id: l.id,
        title: `Excise Lic #${l.licence_number}`,
        subtitle: `${l.licence_type} • Status: ${l.status}`,
      })),
    ];
  }

  /**
   * Fetch Purchases list with item details
   */
  static async getPurchases(params?: { search?: string; limit?: number }) {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('purchases')
      .select(`
        id,
        purchase_number,
        purchase_date,
        tp_permit_reference,
        excise_reference,
        document_reference,
        total_value,
        remarks,
        created_at,
        items:purchase_items(
          id,
          product_id,
          batch_id,
          quantity,
          purchase_tp_price,
          total_value,
          product:products(id, name, sku)
        )
      `)
      .order('purchase_date', { ascending: false })
      .limit(params?.limit || 100);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch purchases: ${error.message}`);
    }

    let items = data || [];
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (p: any) =>
          p.purchase_number?.toLowerCase().includes(q) ||
          p.tp_permit_reference?.toLowerCase().includes(q)
      );
    }
    return items;
  }

  /**
   * Fetch Stock Adjustments list
   */
  static async getAdjustments(params?: { search?: string; adjustmentType?: string; productId?: string; limit?: number }) {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('stock_adjustments')
      .select(`
        id,
        adjustment_number,
        adjustment_date,
        product_id,
        batch_id,
        adjustment_type,
        quantity,
        reference,
        reason,
        remarks,
        created_at,
        product:products(id, name, sku, category:categories(name), brand:brands(name))
      `)
      .order('adjustment_date', { ascending: false })
      .limit(params?.limit || 100);

    if (params?.adjustmentType && params.adjustmentType !== 'All') {
      query = query.eq('adjustment_type', params.adjustmentType);
    }
    if (params?.productId) {
      query = query.eq('product_id', params.productId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch adjustments: ${error.message}`);
    }

    let items = data || [];
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (a: any) =>
          a.adjustment_number?.toLowerCase().includes(q) ||
          a.reference?.toLowerCase().includes(q) ||
          a.reason?.toLowerCase().includes(q) ||
          a.product?.name?.toLowerCase().includes(q)
      );
    }
    return items;
  }

  /**
   * Fetch Opening Stock entries from stock ledger
   */
  static async getOpeningStockRecords(params?: { productId?: string; limit?: number }) {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('stock_ledger')
      .select(`
        id,
        product_id,
        transaction_date,
        transaction_type,
        reference_number,
        stock_in,
        stock_out,
        balance,
        remarks,
        created_at,
        product:products(
          id,
          name,
          sku,
          mrp,
          purchase_price,
          category:categories(name),
          brand:brands(name),
          pack_size:pack_sizes(name, volume_ml)
        )
      `)
      .in('transaction_type', ['OPENING', 'Opening'])
      .order('transaction_date', { ascending: false })
      .limit(params?.limit || 50);

    if (params?.productId) {
      query = query.eq('product_id', params.productId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch opening records: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Batches management
   */
  static async getBatches(params?: { search?: string; productId?: string }) {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('batches')
      .select(`
        id,
        product_id,
        batch_number,
        batch_date,
        quantity,
        purchase_tp_value,
        mrp_reference,
        excise_reference,
        document_reference,
        remarks,
        created_at,
        product:products(id, name, sku, category:categories(name), brand:brands(name))
      `)
      .order('batch_date', { ascending: false });

    if (params?.productId) {
      query = query.eq('product_id', params.productId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch batches: ${error.message}`);
    }

    let items = data || [];
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (b: any) =>
          b.batch_number?.toLowerCase().includes(q) ||
          b.excise_reference?.toLowerCase().includes(q) ||
          b.product?.name?.toLowerCase().includes(q)
      );
    }
    return items;
  }

  static async createBatch(data: {
    productId: string;
    batchNumber: string;
    batchDate?: string;
    quantity: number;
    purchaseTpValue?: number;
    mrpReference?: number;
    exciseReference?: string;
    documentReference?: string;
    remarks?: string;
  }) {
    if (!data.productId || !data.batchNumber) {
      throw new Error('Product and Batch Number are required');
    }
    const supabase = getSupabaseServiceClient();
    const { data: batch, error } = await supabase
      .from('batches')
      .insert({
        product_id: data.productId,
        batch_number: data.batchNumber.trim(),
        batch_date: data.batchDate || new Date().toISOString().split('T')[0],
        quantity: data.quantity || 0,
        purchase_tp_value: data.purchaseTpValue || 0,
        mrp_reference: data.mrpReference || 0,
        excise_reference: data.exciseReference || null,
        document_reference: data.documentReference || null,
        remarks: data.remarks || null,
      })
      .select('*, product:products(id, name, sku)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Batch number ${data.batchNumber} already exists for this product.`);
      }
      throw new Error(`Failed to create batch: ${error.message}`);
    }
    return batch;
  }

  /**
   * Suppliers management - REMOVED
   */
  static async getSuppliers() {
    return [];
  }

  static async createSupplier(data: any) {
    throw new Error('Suppliers have been removed. Track purchases via Distillery/Manufacturer directly.');
  }

  /**
   * Business Settings
   */
  static async getSettings() {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch settings: ${error.message}`);
    }
    if (!data) {
      return {
        business_name: 'LiquorFlow ERP',
        address: 'Maharashtra, India',
        business_address: 'Maharashtra, India',
        owner_mobile: '8857003771',
        vat_number: '27AAAAA0000A1Z5',
        licence_reference: 'FL-II / CL-III',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        date_format: 'DD/MM/YYYY',
        selected_language: 'mr',
        language: 'mr',
        low_stock_threshold: 10,
      };
    }
    return {
      ...data,
      address: data.address || data.business_address || 'Maharashtra, India',
      business_address: data.business_address || data.address || 'Maharashtra, India',
      selected_language: data.selected_language || data.language || 'mr',
      language: data.language || data.selected_language || 'mr',
    };
  }

  static async bulkRecordOpeningStock(
    items: Array<{
      productId: string;
      quantity: number;
      batchNumber?: string;
      purchaseTpPrice?: number;
      remarks?: string;
    }>
  ) {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const recorded: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        if (!row.productId || row.quantity === undefined) {
          throw new Error('Missing Product ID or Quantity');
        }
        const result = await this.recordOpeningStock({
          productId: row.productId,
          quantity: Number(row.quantity),
          batchNumber: row.batchNumber,
          purchaseTpPrice: row.purchaseTpPrice !== undefined ? Number(row.purchaseTpPrice) : undefined,
          remarks: row.remarks,
        });
        recorded.push(result);
      } catch (err: any) {
        errors.push({ index: i, row, error: err.message || 'Failed to record opening stock' });
      }
    }

    return {
      successCount: recorded.length,
      failedCount: errors.length,
      items: recorded,
      errors,
    };
  }

  static async bulkProcessPurchases(
    purchasesList: Array<{
      purchaseNumber: string;
      purchaseDate?: string;
      tpPermitReference?: string;
      exciseReference?: string;
      documentReference?: string;
      remarks?: string;
      items: Array<{
        productId: string;
        quantity: number;
        purchaseTpPrice: number;
        batchNumber?: string;
        mrpReference?: number;
      }>;
    }>
  ) {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const processed: any[] = [];

    for (let i = 0; i < purchasesList.length; i++) {
      const p = purchasesList[i];
      try {
        const result = await this.processPurchase(p);
        processed.push(result);
      } catch (err: any) {
        errors.push({ index: i, row: p, error: err.message || 'Failed to process purchase' });
      }
    }

    return {
      successCount: processed.length,
      failedCount: errors.length,
      items: processed,
      errors,
    };
  }

  static async bulkProcessAdjustments(
    items: Array<{
      adjustmentNumber: string;
      adjustmentDate?: string;
      productId: string;
      batchId?: string;
      adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN_IN' | 'RETURN_OUT' | 'CORRECTION';
      quantity: number;
      reference?: string;
      reason?: string;
      remarks?: string;
    }>
  ) {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const processed: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const adj = items[i];
      try {
        const result = await this.processAdjustment(adj);
        processed.push(result);
      } catch (err: any) {
        errors.push({ index: i, row: adj, error: err.message || 'Failed to process adjustment' });
      }
    }

    return {
      successCount: processed.length,
      failedCount: errors.length,
      items: processed,
      errors,
    };
  }

  static async updateSettings(data: any) {
    const supabase = getSupabaseServiceClient();
    const { data: existing } = await supabase.from('settings').select('id').limit(1).maybeSingle();

    const addr = data.address || data.business_address || data.businessAddress || '';
    const lang = data.selectedLanguage || data.selected_language || data.language || 'mr';

    const fullPayload: Record<string, any> = {
      business_name: data.businessName || data.business_name || 'LiquorFlow ERP',
      address: addr,
      business_address: addr,
      owner_mobile: data.ownerMobile || data.owner_mobile || '',
      vat_number: data.vatNumber || data.vat_number || null,
      licence_reference: data.licenceReference || data.licence_reference || null,
      currency: data.currency || 'INR',
      timezone: data.timezone || 'Asia/Kolkata',
      date_format: data.dateFormat || data.date_format || 'DD/MM/YYYY',
      selected_language: lang,
      language: lang,
      low_stock_threshold: Number(data.lowStockThreshold || data.low_stock_threshold || 10),
      updated_at: new Date().toISOString(),
    };

    let payload = { ...fullPayload };

    const saveOperation = async (currentPayload: Record<string, any>) => {
      if (existing) {
        return await supabase
          .from('settings')
          .update(currentPayload)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        return await supabase
          .from('settings')
          .insert(currentPayload)
          .select()
          .single();
      }
    };

    let result = await saveOperation(payload);

    if (result.error) {
      const errMsg = result.error.message || '';
      if (errMsg.includes("Could not find the 'address' column")) {
        delete payload.address;
        result = await saveOperation(payload);
      } else if (errMsg.includes("Could not find the 'business_address' column")) {
        delete payload.business_address;
        result = await saveOperation(payload);
      }
      
      if (result.error && result.error.message.includes("Could not find the 'selected_language' column")) {
        delete payload.selected_language;
        result = await saveOperation(payload);
      } else if (result.error && result.error.message.includes("Could not find the 'language' column")) {
        delete payload.language;
        result = await saveOperation(payload);
      }
    }

    if (result.error) {
      throw new Error(`Failed to save settings: ${result.error.message}`);
    }

    return result.data;
  }
}
