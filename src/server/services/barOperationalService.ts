import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import { BarStoreService } from './barStoreService.js';

export class BarOperationalService {
  // --- Canonical Bar ID Validation ---
  static async validateBarId(barId?: string | null): Promise<string> {
    if (!barId || typeof barId !== 'string' || barId.trim().length === 0) {
      throw new Error('Please select a bar before creating this transaction.');
    }
    const cleanId = barId.trim();
    if (cleanId === 'ALL_BARS') {
      throw new Error('Select a specific bar to create or modify operational transactions.');
    }
    const bar = await BarStoreService.getBarById(cleanId);
    if (!bar) {
      throw new Error(`Invalid bar identifier: "${cleanId}". Bar outlet does not exist.`);
    }
    return cleanId;
  }

  // =========================================================================
  // 1. INWARD & PURCHASES
  // =========================================================================

  static async processPurchase(data: {
    barId: string;
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
  }) {
    const canonicalBarId = await this.validateBarId(data.barId);

    if (!data.items || data.items.length === 0) {
      throw new Error('Purchase must contain at least one item');
    }

    const supabase = getSupabaseServiceClient();

    // 1. Create Purchase record in Supabase
    const { data: purchase, error: pError } = await supabase
      .from('purchases')
      .insert({
        bar_id: canonicalBarId,
        purchase_number: data.purchaseNumber,
        purchase_date: data.purchaseDate || new Date().toISOString().split('T')[0],
        tp_permit_reference: data.tpPermitReference || null,
        excise_reference: data.exciseReference || null,
        document_reference: data.documentReference || null,
        total_value: data.items.reduce((sum, item) => sum + (item.quantity * item.purchaseTpPrice), 0),
        remarks: data.remarks || null
      })
      .select()
      .single();

    if (pError || !purchase) {
      throw new Error(`Failed to create purchase record: ${pError?.message}`);
    }

    // 2. Create items and update inventory
    for (const item of data.items) {
      // Create Purchase Item
      const { error: iError } = await supabase
        .from('purchase_items')
        .insert({
          purchase_id: purchase.id,
          bar_id: canonicalBarId,
          product_id: item.productId,
          quantity: item.quantity,
          purchase_tp_price: item.purchaseTpPrice,
          total_value: item.quantity * item.purchaseTpPrice,
          mrp_reference: item.mrpReference || 0
        });

      if (iError) {
        throw new Error(`Failed to create purchase item for product ${item.productId}: ${iError.message}`);
      }

      // Update Inventory (Atomic increment via RPC or manual check-then-upsert)
      // For now, we use the service logic:
      await this.updateInventoryStock({
        barId: canonicalBarId,
        productId: item.productId,
        quantityDelta: item.quantity,
        type: 'PURCHASE',
        unitPrice: item.purchaseTpPrice
      });

      // Record Ledger
      await this.recordLedgerMovement({
        barId: canonicalBarId,
        productId: item.productId,
        transactionType: 'PURCHASE',
        referenceId: purchase.id,
        referenceNumber: data.purchaseNumber,
        stockIn: item.quantity,
        stockOut: 0,
        remarks: `Inward Purchase #${data.purchaseNumber}`
      });
    }

    return {
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchase_number,
      barId: canonicalBarId
    };
  }

  static async getPurchases(params: { barId: string; search?: string; limit?: number }) {
    const canonicalBarId = await this.validateBarId(params.barId);
    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('purchases')
      .select('*, items:purchase_items(*)')
      .eq('bar_id', canonicalBarId)
      .order('purchase_date', { ascending: false });

    if (params.search) {
      query = query.ilike('purchase_number', `%${params.search}%`);
    }

    if (params.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch purchases: ${error.message}`);
    }

    return data || [];
  }

  // =========================================================================
  // 2. BAR-ISOLATED INVENTORY
  // =========================================================================

  static async updateInventoryStock(params: {
    barId: string;
    productId: string;
    quantityDelta: number;
    type: 'PURCHASE' | 'OPENING' | 'ADJUSTMENT' | 'SALE';
    unitPrice?: number;
  }) {
    const supabase = getSupabaseServiceClient();
    
    // 1. Fetch current inventory for this bar + product
    const { data: existing, error: fetchError } = await supabase
      .from('inventory')
      .select('*')
      .eq('bar_id', params.barId)
      .eq('product_id', params.productId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch inventory: ${fetchError.message}`);
    }

    const now = new Date().toISOString();
    
    if (existing) {
      let purchased = Number(existing.purchased_quantity || 0);
      let opening = Number(existing.opening_quantity || 0);
      let adjustment = Number(existing.adjustment_quantity || 0);

      if (params.type === 'PURCHASE') purchased += params.quantityDelta;
      if (params.type === 'OPENING') opening = params.quantityDelta;
      if (params.type === 'ADJUSTMENT') adjustment += params.quantityDelta;

      const current = opening + purchased + adjustment;

      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          opening_quantity: opening,
          purchased_quantity: purchased,
          adjustment_quantity: adjustment,
          current_quantity: current,
          updated_at: now
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`Failed to update inventory record: ${updateError.message}`);
      }
    } else {
      const opening = params.type === 'OPENING' ? params.quantityDelta : 0;
      const purchased = params.type === 'PURCHASE' ? params.quantityDelta : 0;
      const adjustment = params.type === 'ADJUSTMENT' ? params.quantityDelta : 0;
      const current = opening + purchased + adjustment;

      const { error: insertError } = await supabase
        .from('inventory')
        .insert({
          bar_id: params.barId,
          product_id: params.productId,
          opening_quantity: opening,
          purchased_quantity: purchased,
          adjustment_quantity: adjustment,
          current_quantity: current,
          updated_at: now
        });

      if (insertError) {
        throw new Error(`Failed to create inventory record: ${insertError.message}`);
      }
    }
  }

  static async getInventoryList(params: { barId: string; categoryId?: string }) {
    const canonicalBarId = await this.validateBarId(params.barId);
    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('inventory')
      .select('*, product:products(*, category:categories(*), brand:brands(*), pack_size:pack_sizes(*))')
      .eq('bar_id', canonicalBarId);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }

    return data || [];
  }

  static async getBarProductStock(barId: string, productId: string): Promise<number> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('inventory')
      .select('current_quantity')
      .eq('bar_id', barId)
      .eq('product_id', productId)
      .maybeSingle();
    if (error || !data) return 0;
    return Number(data.current_quantity || 0);
  }

  // =========================================================================
  // 3. BAR-ISOLATED STOCK LEDGER
  // =========================================================================

  private static async recordLedgerMovement(entry: {
    barId: string;
    productId: string;
    transactionType: string;
    referenceId: string | null;
    referenceNumber: string;
    stockIn: number;
    stockOut: number;
    remarks: string | null;
  }) {
    const supabase = getSupabaseServiceClient();
    
    // Calculate new balance
    const { data: inv } = await supabase
      .from('inventory')
      .select('current_quantity')
      .eq('bar_id', entry.barId)
      .eq('product_id', entry.productId)
      .maybeSingle();

    const { error } = await supabase
      .from('stock_ledger')
      .insert({
        bar_id: entry.barId,
        product_id: entry.productId,
        transaction_date: new Date().toISOString(),
        transaction_type: entry.transactionType,
        reference_id: entry.referenceId,
        reference_number: entry.referenceNumber,
        stock_in: entry.stockIn,
        stock_out: entry.stockOut,
        balance: inv?.current_quantity || 0,
        remarks: entry.remarks
      });

    if (error) {
      console.warn(`[Ledger] Non-fatal ledger insert warning: ${error.message}`);
    }
  }

  static async getStockLedger(barId: string, productId?: string, limit = 50) {
    const canonicalBarId = barId === 'ALL_BARS' ? null : await this.validateBarId(barId);
    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('stock_ledger')
      .select('*')
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (canonicalBarId) {
      query = query.eq('bar_id', canonicalBarId);
    }
    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch stock ledger: ${error.message}`);
    }

    return data || [];
  }
}

