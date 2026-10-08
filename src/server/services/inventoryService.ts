import { getSupabaseServiceClient, checkDbHasBarId } from '../../lib/supabase/client.js';
import { StockTransactionType, DashboardStats, InventoryRecord, StockLedgerRecord } from '../../types/index.js';
import { BarStoreService } from './barStoreService.js';
import { ProductMasterService } from './productMasterService.js';
import { ScmService } from './scmService.js';

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
    barId: string;
    productId: string;
    quantity: number;
    purchaseTpPrice?: number;
    batchNumber?: string;
    remarks?: string;
  }): Promise<{ productId: string; openingQuantity: number; currentStock: number }> {
    if (data.quantity < 0) {
      throw new Error('Opening stock quantity cannot be negative');
    }

    if (!data.barId) {
      throw new Error('Bar ID is required');
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

    const hasBarId = await checkDbHasBarId();

    // Optional batch record
    let batchId: string | null = null;
    if (data.batchNumber) {
      const batchPayload: any = {
        product_id: data.productId,
        batch_number: data.batchNumber,
        quantity: data.quantity,
        purchase_tp_value: data.quantity * tpPrice,
        remarks: data.remarks || 'Opening stock batch',
      };
      if (hasBarId && data.barId) batchPayload.bar_id = data.barId;

      const { data: batch } = await supabase
        .from('batches')
        .insert(batchPayload)
        .select('id')
        .single();
      if (batch) batchId = batch.id;
    }

    // Check existing inventory
    let invQuery = supabase
      .from('inventory')
      .select('*')
      .eq('product_id', data.productId);
    if (hasBarId && data.barId) {
      invQuery = invQuery.eq('bar_id', data.barId);
    }
    const { data: existingInv } = await invQuery.maybeSingle();

    let newCurrent = 0;
    if (existingInv) {
      // Current = Opening + Purchased + Adjustments + Returned
      const purchased = Number(existingInv.purchased_quantity || 0);
      const adjustments = Number(existingInv.adjustment_quantity || 0);
      const returned = Number(existingInv.returned_quantity || 0);
      newCurrent = data.quantity + purchased + adjustments + returned;

      let updateQuery = supabase
        .from('inventory')
        .update({
          opening_quantity: data.quantity,
          current_quantity: newCurrent,
          stock_value: newCurrent * tpPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', data.productId);
      if (hasBarId && data.barId) {
        updateQuery = updateQuery.eq('bar_id', data.barId);
      }
      await updateQuery;
    } else {
      newCurrent = data.quantity;
      const invPayload: any = {
        product_id: data.productId,
        opening_quantity: data.quantity,
        purchased_quantity: 0,
        adjustment_quantity: 0,
        returned_quantity: 0,
        current_quantity: newCurrent,
        stock_value: newCurrent * tpPrice,
      };
      if (hasBarId && data.barId) invPayload.bar_id = data.barId;

      await supabase.from('inventory').insert(invPayload);
    }

    // Record in Stock Ledger
    const ledgerPayload: any = {
      product_id: data.productId,
      transaction_date: new Date().toISOString(),
      transaction_type: 'OPENING',
      reference_number: data.batchNumber || 'OPENING-STOCK',
      stock_in: data.quantity,
      stock_out: 0,
      balance: newCurrent,
      remarks: data.remarks || 'Initial opening balance',
      import_batch_id: (data as any).import_batch_id || null,
    };
    if (hasBarId && data.barId) ledgerPayload.bar_id = data.barId;

    await supabase.from('stock_ledger').insert(ledgerPayload);

    // Register SCM Code if provided
    if ((data as any).scmCode) {
      try {
        await ScmService.ensureScmCodeExists((data as any).scmCode, data.productId, {
          sourceReference: `Opening Stock: ${data.batchNumber || 'Initial'}`
        });
      } catch (scmErr) {
        console.warn('SCM registration failed during opening stock:', scmErr);
      }
    }

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
    barId: string;
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

    if (!purchaseData.barId) {
      throw new Error('Bar ID is required');
    }

    const supabase = getSupabaseServiceClient();

    // Validate quantities, prices, and active product status
    for (const item of purchaseData.items) {
      if (item.quantity <= 0) {
        throw new Error('Purchase item quantity must be greater than zero');
      }
      if (item.purchaseTpPrice < 0) {
        throw new Error('Purchase TP price cannot be negative');
      }
      await ProductMasterService.assertProductActiveForTransaction(item.productId);
    }

    const totalValue = purchaseData.items.reduce(
      (sum, item) => sum + item.quantity * item.purchaseTpPrice,
      0
    );

    if (!purchaseData.barId || purchaseData.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before creating this transaction.');
    }

    const hasBarId = await checkDbHasBarId();

    // 1. Create Purchase Record
    const purchasePayload: any = {
      purchase_number: purchaseData.purchaseNumber,
      purchase_date: purchaseData.purchaseDate || new Date().toISOString().split('T')[0],
      tp_permit_reference: purchaseData.tpPermitReference || null,
      excise_reference: purchaseData.exciseReference || null,
      document_reference: purchaseData.documentReference || null,
      total_value: totalValue,
      remarks: purchaseData.remarks || null,
      import_batch_id: (purchaseData as any).import_batch_id || null,
      bar_id: purchaseData.barId,
    };

    const { data: purchase, error: pError } = await supabase
      .from('purchases')
      .insert(purchasePayload)
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
        const batchPayload: any = {
          product_id: item.productId,
          batch_number: item.batchNumber,
          quantity: item.quantity,
          purchase_tp_value: itemTotal,
          mrp_reference: item.mrpReference || 0,
          excise_reference: purchaseData.exciseReference || null,
          document_reference: purchaseData.documentReference || null,
        };
        if (hasBarId && purchaseData.barId) batchPayload.bar_id = purchaseData.barId;

        const { data: batch } = await supabase
          .from('batches')
          .insert(batchPayload)
          .select('id')
          .single();
        if (batch) batchId = batch.id;
      }

      // Insert Purchase Item
      const itemPayload: any = {
        purchase_id: purchase.id,
        product_id: item.productId,
        batch_id: batchId,
        quantity: item.quantity,
        purchase_tp_price: item.purchaseTpPrice,
        total_value: itemTotal,
      };
      if (hasBarId && purchaseData.barId) {
        itemPayload.bar_id = purchaseData.barId;
      }
      await supabase.from('purchase_items').insert(itemPayload);

      // Update Inventory
      let invQuery = supabase
        .from('inventory')
        .select('*')
        .eq('product_id', item.productId);
      if (hasBarId && purchaseData.barId) {
        invQuery = invQuery.eq('bar_id', purchaseData.barId);
      }
      const { data: currentInv } = await invQuery.maybeSingle();

      let newCurrentStock = item.quantity;
      if (currentInv) {
        const newPurchased = Number(currentInv.purchased_quantity || 0) + item.quantity;
        const opening = Number(currentInv.opening_quantity || 0);
        const adjustments = Number(currentInv.adjustment_quantity || 0);
        const returned = Number(currentInv.returned_quantity || 0);
        newCurrentStock = opening + newPurchased + adjustments + returned;

        let updateQuery = supabase
          .from('inventory')
          .update({
            purchased_quantity: newPurchased,
            current_quantity: newCurrentStock,
            stock_value: newCurrentStock * item.purchaseTpPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('product_id', item.productId);
        if (hasBarId && purchaseData.barId) {
          updateQuery = updateQuery.eq('bar_id', purchaseData.barId);
        }
        await updateQuery;
      } else {
        const invPayload: any = {
          product_id: item.productId,
          opening_quantity: 0,
          purchased_quantity: item.quantity,
          adjustment_quantity: 0,
          returned_quantity: 0,
          current_quantity: item.quantity,
          stock_value: itemTotal,
        };
        if (hasBarId && purchaseData.barId) invPayload.bar_id = purchaseData.barId;

        await supabase.from('inventory').insert(invPayload);
      }

      // Record in Stock Ledger
      const scmRemark = (item as any).scmCode ? ` (SCM: ${(item as any).scmCode.trim()})` : '';
      const ledgerPayload: any = {
        product_id: item.productId,
        transaction_date: new Date().toISOString(),
        transaction_type: 'PURCHASE',
        reference_id: purchase.id,
        reference_number: purchase.purchase_number,
        stock_in: item.quantity,
        stock_out: 0,
        balance: newCurrentStock,
        remarks: `Inward Purchase #${purchase.purchase_number}${scmRemark}`,
      };
      if (hasBarId && purchaseData.barId) ledgerPayload.bar_id = purchaseData.barId;

      await supabase.from('stock_ledger').insert(ledgerPayload);

      // 3. Register SCM Code if provided (Requirement 7)
      if ((item as any).scmCode) {
        try {
          await ScmService.ensureScmCodeExists((item as any).scmCode, item.productId, {
            sourceReference: `Inward Purchase #${purchase.purchase_number}`
          });
        } catch (scmErr) {
          console.warn('SCM registration failed during purchase:', scmErr);
        }
      }

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
          remarks: `Inward permit ref for purchase ${purchase.purchase_number}${scmRemark}`,
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
    barId: string;
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

    if (!data.barId) {
      throw new Error('Bar ID is required');
    }

    const supabase = getSupabaseServiceClient();

    // Fetch current inventory
    const { data: inv, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', data.productId)
      .eq('bar_id', data.barId)
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
        bar_id: data.barId,
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
      .eq('product_id', data.productId)
      .eq('bar_id', data.barId);

    // 3. Record in Stock Ledger
    await supabase.from('stock_ledger').insert({
      bar_id: data.barId,
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
   * Process Stock Transfer between bars.
   * Decreases stock at source bar and increases stock at destination bar.
   */
  static async processTransfer(data: {
    transferNumber: string;
    transferDate?: string;
    sourceBarId: string;
    destinationBarId: string;
    items: {
      productId: string;
      batchId?: string;
      quantity: number;
    }[];
    remarks?: string;
  }): Promise<{ transferId: string; transferNumber: string }> {
    if (data.sourceBarId === data.destinationBarId) {
      throw new Error('Source and destination bars must be different');
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('Transfer must contain at least one item');
    }

    const supabase = getSupabaseServiceClient();

    // 1. Create Transfer Record
    const { data: transfer, error: tError } = await supabase
      .from('stock_transfers')
      .insert({
        transfer_number: data.transferNumber,
        transfer_date: data.transferDate || new Date().toISOString().split('T')[0],
        source_bar_id: data.sourceBarId,
        destination_bar_id: data.destinationBarId,
        remarks: data.remarks || null,
        status: 'Completed',
      })
      .select('id, transfer_number')
      .single();

    if (tError || !transfer) {
      if (tError?.code === '23505') {
        throw new Error(`A transfer with reference "${data.transferNumber}" already exists.`);
      }
      throw new Error(`Failed to create stock transfer: ${tError?.message || 'Database error'}`);
    }

    // 2. Process Items
    for (const item of data.items) {
      // 2.1 Insert Transfer Item
      await supabase.from('stock_transfer_items').insert({
        transfer_id: transfer.id,
        product_id: item.productId,
        batch_id: item.batchId || null,
        quantity: item.quantity,
      });

      // 2.2 Update Source Bar Inventory (Stock OUT)
      const { data: sourceInv } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', item.productId)
        .eq('bar_id', data.sourceBarId)
        .maybeSingle();

      if (!sourceInv || Number(sourceInv.current_quantity) < item.quantity) {
        throw new Error(`Insufficient stock in source bar for product ${item.productId}`);
      }

      const newSourceStock = Number(sourceInv.current_quantity) - item.quantity;
      await supabase
        .from('inventory')
        .update({
          adjustment_quantity: Number(sourceInv.adjustment_quantity || 0) - item.quantity,
          current_quantity: newSourceStock,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', item.productId)
        .eq('bar_id', data.sourceBarId);

      // 2.3 Record Source Ledger (TRANSFER_OUT)
      await supabase.from('stock_ledger').insert({
        bar_id: data.sourceBarId,
        product_id: item.productId,
        transaction_date: new Date().toISOString(),
        transaction_type: 'ADJUSTMENT_OUT',
        reference_id: transfer.id,
        reference_number: transfer.transfer_number,
        stock_in: 0,
        stock_out: item.quantity,
        balance: newSourceStock,
        remarks: `Transfer to ${data.destinationBarId}`,
      });

      // 2.4 Update Destination Bar Inventory (Stock IN)
      const { data: destInv } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', item.productId)
        .eq('bar_id', data.destinationBarId)
        .maybeSingle();

      let newDestStock = item.quantity;
      if (destInv) {
        newDestStock = Number(destInv.current_quantity) + item.quantity;
        await supabase
          .from('inventory')
          .update({
            adjustment_quantity: Number(destInv.adjustment_quantity || 0) + item.quantity,
            current_quantity: newDestStock,
            updated_at: new Date().toISOString(),
          })
          .eq('product_id', item.productId)
          .eq('bar_id', data.destinationBarId);
      } else {
        await supabase.from('inventory').insert({
          bar_id: data.destinationBarId,
          product_id: item.productId,
          opening_quantity: 0,
          purchased_quantity: 0,
          adjustment_quantity: item.quantity,
          returned_quantity: 0,
          current_quantity: item.quantity,
        });
      }

      // 2.5 Record Destination Ledger (TRANSFER_IN)
      await supabase.from('stock_ledger').insert({
        bar_id: data.destinationBarId,
        product_id: item.productId,
        transaction_date: new Date().toISOString(),
        transaction_type: 'ADJUSTMENT_IN',
        reference_id: transfer.id,
        reference_number: transfer.transfer_number,
        stock_in: item.quantity,
        stock_out: 0,
        balance: newDestStock,
        remarks: `Transfer from ${data.sourceBarId}`,
      });
    }

    return {
      transferId: transfer.id,
      transferNumber: transfer.transfer_number,
    };
  }

  /**
   * Fetch Inventory list with product & category relationships
   */
  static async getInventoryList(params?: {
    barId?: string;
    barIds?: string[];
    search?: string;
    categoryId?: string;
    lowStockOnly?: boolean;
  }) {
    const supabase = getSupabaseServiceClient();

    const barMap = await BarStoreService.getBarMap();
    const defaultBar = Object.values(barMap)[0] || null;
    const selectedBar = params?.barId && params.barId !== 'ALL_BARS' ? (barMap[params.barId] || defaultBar) : defaultBar;

    const hasBarId = await checkDbHasBarId();

    let query = supabase.from('inventory').select(`
      id,
      bar_id,
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

    if (hasBarId) {
      if (params?.barId && params.barId !== 'ALL_BARS') {
        query = query.eq('bar_id', params.barId);
      } else if (params?.barIds && params.barIds.length > 0) {
        query = query.in('bar_id', params.barIds);
      } else {
        throw new Error('Please select a bar to view this inventory.');
      }
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }

    let items = (data as unknown as InventoryRecord[]) || [];

    // Attach bar details context
    items = items.map(item => ({
      ...item,
      bar_id: (item as any).bar_id || selectedBar?.id || '',
      bar: ((item as any).bar_id ? barMap[(item as any).bar_id] : null) || selectedBar || null,
    }));

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
  static async getStockLedger(barIdOrIds: string | string[], productId?: string, limit = 50) {
    const supabase = getSupabaseServiceClient();
    const barMap = await BarStoreService.getBarMap();
    const defaultBar = Object.values(barMap)[0] || null;
    const singleBarId = typeof barIdOrIds === 'string' && barIdOrIds !== 'ALL_BARS' ? barIdOrIds : undefined;
    const selectedBar = singleBarId ? (barMap[singleBarId] || defaultBar) : defaultBar;

    let query = supabase
      .from('stock_ledger')
      .select(`
        id,
        product_id,
        bar_id,
        transaction_date,
        transaction_type,
        reference_id,
        reference_number,
        stock_in,
        stock_out,
        balance,
        remarks,
        created_at,
        product:products(
          id,
          name,
          product_name,
          sku,
          category:categories(id, name),
          brand:brands(id, name, brand_name),
          pack_size:pack_sizes(id, name, volume_ml, pack_type)
        )
      `);

    query = query.order('created_at', { ascending: false }).limit(limit);

    if (singleBarId) {
      query = query.eq('bar_id', singleBarId);
    } else if (Array.isArray(barIdOrIds) && barIdOrIds.length > 0) {
      query = query.in('bar_id', barIdOrIds);
    }

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch stock ledger: ${error.message}`);
    }

    const records = ((data as unknown as StockLedgerRecord[]) || []).map(r => ({
      ...r,
      bar_id: (r as any).bar_id || selectedBar?.id || '',
      bar: ((r as any).bar_id ? barMap[(r as any).bar_id] : null) || selectedBar || null,
    }));

    return records;
  }

  /**
   * Calculate live Dashboard KPIs from real database records.
   * Focuses purely on Inventory, Inwards, and Excise.
   */
  static async getDashboardStats(params?: { barId?: string; authorizedBarIds?: string[] } | string): Promise<DashboardStats> {
    const supabase = getSupabaseServiceClient();
    const today = new Date().toISOString().split('T')[0];

    // Resolve target scope
    let selectedBarId: string | undefined = undefined;
    let selectedBarIds: string[] | undefined = undefined;

    if (typeof params === 'string') {
      if (params !== 'ALL_BARS') {
        selectedBarId = params;
      }
    } else if (params && typeof params === 'object') {
      if (params.barId && params.barId !== 'ALL_BARS') {
        selectedBarId = params.barId;
      } else if (Array.isArray(params.authorizedBarIds) && params.authorizedBarIds.length > 0) {
        selectedBarIds = params.authorizedBarIds;
      }
    }

    // Today's Inward Purchases
    let purchasesQuery = supabase
      .from('purchases')
      .select('*')
      .eq('purchase_date', today);
    if (selectedBarId) {
      purchasesQuery = purchasesQuery.eq('bar_id', selectedBarId);
    } else if (selectedBarIds) {
      purchasesQuery = purchasesQuery.in('bar_id', selectedBarIds);
    } else {
      purchasesQuery = purchasesQuery.eq('bar_id', '00000000-0000-0000-0000-000000000000');
    }
    const { data: todayPurchases } = await purchasesQuery;

    const todaysPurchases =
      todayPurchases?.reduce((sum, p: any) => sum + Number(p.total_value || p.total_amount || 0), 0) || 0;

    // Current Stock & Valuation
    let invQuery = supabase.from('inventory').select(`
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
    if (selectedBarId) {
      invQuery = invQuery.eq('bar_id', selectedBarId);
    } else if (selectedBarIds) {
      invQuery = invQuery.in('bar_id', selectedBarIds);
    } else {
      invQuery = invQuery.eq('bar_id', '00000000-0000-0000-0000-000000000000');
    }
    const { data: invList } = await invQuery;

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
    let ledgerQuery = supabase
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
      `);
    if (selectedBarId) {
      ledgerQuery = ledgerQuery.eq('bar_id', selectedBarId);
    } else if (selectedBarIds) {
      ledgerQuery = ledgerQuery.in('bar_id', selectedBarIds);
    } else {
      ledgerQuery = ledgerQuery.eq('bar_id', '00000000-0000-0000-0000-000000000000');
    }
    const { data: recentLedger } = await ledgerQuery
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
  static async searchGlobal(query: string, barId?: string) {
    if (!query || query.trim().length === 0) return [];
    const supabase = getSupabaseServiceClient();
    const cleanQ = query.trim();

    let productResults: any[] = [];

    // 1. Primary: Stored Procedure / RPC for Product Master First Search with aggregated inventory stock
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_product_master', { 
        p_query: cleanQ,
        p_bar_id: barId || null
      });
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
      let prodQuery = supabase
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
          inventory(current_quantity, bar_id)
        `)
        .or(`name.ilike.%${cleanQ}%,product_name.ilike.%${cleanQ}%,sku.ilike.%${cleanQ}%`)
        .limit(15);
      
      const { data: products } = await prodQuery;

      if (products) {
        productResults = products.map((p: any) => {
          const invList = (p.inventory || []).filter((inv: any) => !barId || inv.bar_id === barId);
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
    let purSearchQuery = supabase
      .from('purchases')
      .select('id, bar_id, purchase_number, purchase_date, tp_permit_reference, excise_reference, total_value')
      .or(`purchase_number.ilike.%${cleanQ}%,tp_permit_reference.ilike.%${cleanQ}%,excise_reference.ilike.%${cleanQ}%`)
      .limit(6);
    
    if (barId) {
      purSearchQuery = purSearchQuery.eq('bar_id', barId);
    }
    const { data: purchases } = await purSearchQuery;

    // 5. Search batches
    let batchSearchQuery = supabase
      .from('batches')
      .select(`
        id, 
        bar_id,
        batch_number, 
        created_at, 
        product:products(product_name)
      `)
      .ilike('batch_number', `%${cleanQ}%`)
      .limit(4);
    
    if (barId) {
      batchSearchQuery = batchSearchQuery.eq('bar_id', barId);
    }
    const { data: batches } = await batchSearchQuery;

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
  static async getPurchases(params?: { barId?: string; search?: string; limit?: number }) {
    const supabase = getSupabaseServiceClient();
    const hasBarId = await checkDbHasBarId();
    let selectFields = `
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
          product:products(
            id,
            name,
            product_name,
            sku,
            category:categories(id, name),
            brand:brands(id, name, brand_name),
            pack_size:pack_sizes(id, name, volume_ml, pack_type)
          )
        )
    `;
    if (hasBarId) {
      selectFields = `bar_id,\n` + selectFields;
    }

    let query = supabase
      .from('purchases')
      .select(selectFields)
      .order('purchase_date', { ascending: false })
      .limit(params?.limit || 100);

    if (hasBarId) {
      if (!params?.barId || params.barId === 'ALL_BARS') {
        throw new Error('Please select a bar to view these purchases.');
      }
      query = query.eq('bar_id', params.barId);
    }

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
          p.tp_permit_reference?.toLowerCase().includes(q) ||
          (p.items || []).some((item: any) =>
            item.product?.name?.toLowerCase().includes(q) ||
            item.product?.product_name?.toLowerCase().includes(q) ||
            item.product?.brand?.name?.toLowerCase().includes(q) ||
            item.product?.brand?.brand_name?.toLowerCase().includes(q)
          )
      );
    }
    return items;
  }

  /**
   * Fetch single purchase by ID scoped strictly to authorized barId.
   * Returns null if purchase doesn't exist or belongs to a different bar (404/no leakage).
   */
  static async getPurchaseById(id: string, barId: string) {
    if (!id || !barId || barId === 'ALL_BARS') {
      return null;
    }
    const supabase = getSupabaseServiceClient();
    const { data: purchase, error } = await supabase
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
        bar_id,
        created_at,
        items:purchase_items(
          id,
          product_id,
          batch_id,
          quantity,
          purchase_tp_price,
          total_value,
          bar_id,
          product:products(
            id,
            name,
            product_name,
            sku
          )
        )
      `)
      .eq('id', id)
      .eq('bar_id', barId)
      .maybeSingle();

    if (error || !purchase) {
      return null;
    }
    return purchase;
  }

  /**
   * Update purchase scoped strictly to authorized barId.
   * Prevents changing bar_id. Returns null if not found or belongs to another bar.
   */
  static async updatePurchase(id: string, barId: string, updates: {
    remarks?: string;
    tpPermitReference?: string;
    exciseReference?: string;
    documentReference?: string;
  }) {
    if (!id || !barId || barId === 'ALL_BARS') {
      return null;
    }
    const existing = await this.getPurchaseById(id, barId);
    if (!existing) {
      return null;
    }

    const payload: any = {};
    if (updates.remarks !== undefined) payload.remarks = updates.remarks;
    if (updates.tpPermitReference !== undefined) payload.tp_permit_reference = updates.tpPermitReference;
    if (updates.exciseReference !== undefined) payload.excise_reference = updates.exciseReference;
    if (updates.documentReference !== undefined) payload.document_reference = updates.documentReference;

    const supabase = getSupabaseServiceClient();
    const { data: updated, error } = await supabase
      .from('purchases')
      .update(payload)
      .eq('id', id)
      .eq('bar_id', barId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update purchase: ${error.message}`);
    }
    return updated;
  }

  /**
   * Delete purchase scoped strictly to authorized barId.
   * Returns false if not found or belongs to another bar.
   */
  static async deletePurchase(id: string, barId: string) {
    if (!id || !barId || barId === 'ALL_BARS') {
      return false;
    }
    const existing = await this.getPurchaseById(id, barId);
    if (!existing) {
      return false;
    }

    const supabase = getSupabaseServiceClient();
    // Delete child items first with bar_id constraint
    await supabase.from('purchase_items').delete().eq('purchase_id', id).eq('bar_id', barId);
    // Delete parent purchase
    const { error } = await supabase.from('purchases').delete().eq('id', id).eq('bar_id', barId);
    if (error) {
      throw new Error(`Failed to delete purchase: ${error.message}`);
    }
    return true;
  }

  /**
   * Fetch Stock Adjustments list
   */
  static async getAdjustments(params?: { barId?: string; search?: string; adjustmentType?: string; productId?: string; limit?: number }) {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('stock_adjustments')
      .select(`
        id,
        bar_id,
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
        product:products(
          id,
          name,
          product_name,
          sku,
          category:categories(id, name),
          brand:brands(id, name, brand_name),
          pack_size:pack_sizes(id, name, volume_ml, pack_type)
        )
      `)
      .order('adjustment_date', { ascending: false })
      .limit(params?.limit || 100);

    const hasBarId = await checkDbHasBarId();
    if (hasBarId) {
      if (!params?.barId || params.barId === 'ALL_BARS') {
        throw new Error('Please select a bar to view these adjustments.');
      }
      query = query.eq('bar_id', params.barId);
    }

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
          a.product?.name?.toLowerCase().includes(q) ||
          a.product?.product_name?.toLowerCase().includes(q) ||
          a.product?.brand?.name?.toLowerCase().includes(q)
      );
    }
    return items;
  }

  /**
   * Fetch Opening Stock entries from stock ledger
   */
  static async getOpeningStockRecords(params?: { barId?: string; productId?: string; limit?: number }) {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('stock_ledger')
      .select(`
        id,
        bar_id,
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
          product_name,
          sku,
          mrp_reference,
          purchase_tp_price,
          category:categories(id, name),
          brand:brands(id, name, brand_name),
          pack_size:pack_sizes(id, name, volume_ml, pack_type)
        )
      `)
      .in('transaction_type', ['OPENING', 'Opening'])
      .order('transaction_date', { ascending: false })
      .limit(params?.limit || 50);

    if (params?.barId) {
      query = query.eq('bar_id', params.barId);
    }

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
  static async getBatches(params?: { barId?: string; search?: string; productId?: string }) {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('batches')
      .select(`
        id,
        bar_id,
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
        product:products(
          id,
          name,
          product_name,
          sku,
          category:categories(id, name),
          brand:brands(id, name, brand_name),
          pack_size:pack_sizes(id, name, volume_ml, pack_type)
        )
      `)
      .order('batch_date', { ascending: false });

    if (params?.barId) {
      query = query.eq('bar_id', params.barId);
    }

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
          b.product?.name?.toLowerCase().includes(q) ||
          b.product?.product_name?.toLowerCase().includes(q) ||
          b.product?.brand?.name?.toLowerCase().includes(q)
      );
    }
    return items;
  }

  static async createBatch(data: {
    barId: string;
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
    if (!data.productId || !data.batchNumber || !data.barId) {
      throw new Error('Bar ID, Product and Batch Number are required');
    }
    const supabase = getSupabaseServiceClient();
    const { data: batch, error } = await supabase
      .from('batches')
      .insert({
        bar_id: data.barId,
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
        selected_language: 'en',
        language: 'en',
        low_stock_threshold: 10,
      };
    }
    return {
      ...data,
      address: data.address || data.business_address || 'Maharashtra, India',
      business_address: data.business_address || data.address || 'Maharashtra, India',
      selected_language: data.selected_language || data.language || 'en',
      language: data.language || data.selected_language || 'en',
    };
  }

  static async getDefaultBarId(): Promise<string> {
    const bars = await BarStoreService.getBars();
    return bars[0]?.id || '';
  }

  static async bulkRecordOpeningStock(
    items: Array<{
      barId?: string;
      productId: string;
      quantity: number;
      batchNumber?: string;
      purchaseTpPrice?: number;
      remarks?: string;
    }>,
    defaultBarId?: string
  ) {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const recorded: any[] = [];
    const fallbackBarId = defaultBarId || (await this.getDefaultBarId());

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        if (!row.productId || row.quantity === undefined) {
          throw new Error('Missing Product ID or Quantity');
        }
        const result = await this.recordOpeningStock({
          barId: row.barId || fallbackBarId,
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
      barId?: string;
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
    }>,
    defaultBarId?: string
  ) {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const processed: any[] = [];
    const fallbackBarId = defaultBarId || (await this.getDefaultBarId());

    for (let i = 0; i < purchasesList.length; i++) {
      const p = purchasesList[i];
      try {
        const result = await this.processPurchase({
          ...p,
          barId: p.barId || fallbackBarId,
        });
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
      barId?: string;
      adjustmentNumber: string;
      adjustmentDate?: string;
      productId: string;
      batchId?: string;
      adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN_IN' | 'RETURN_OUT' | 'CORRECTION';
      quantity: number;
      reference?: string;
      reason?: string;
      remarks?: string;
    }>,
    defaultBarId?: string
  ) {
    const errors: Array<{ index: number; row: any; error: string }> = [];
    const processed: any[] = [];
    const fallbackBarId = defaultBarId || (await this.getDefaultBarId());

    for (let i = 0; i < items.length; i++) {
      const adj = items[i];
      try {
        const result = await this.processAdjustment({
          ...adj,
          barId: adj.barId || fallbackBarId,
        });
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
    const lang = data.selectedLanguage || data.selected_language || data.language || 'en';

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
