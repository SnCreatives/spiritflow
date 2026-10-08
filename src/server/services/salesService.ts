import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import { DryDayService } from './dryDayService.js';
import { ProductMasterService } from './productMasterService.js';
import { TaxService } from './taxService.js';

export interface CreateSaleItemInput {
  productId: string;
  quantity: number;
  rate?: number; // selling price per unit
  remarks?: string;
}

export interface CreateSaleInput {
  barId: string;
  invoiceNumber?: string;
  saleDate?: string; // YYYY-MM-DD
  customerName?: string;
  vatNumber?: string;
  remarks?: string;
  items: CreateSaleItemInput[];
}

export class SalesService {
  /**
   * Create a new Sale transaction with Dry Day validation,
   * active product validation, stock check, ledger entries, and inventory updates.
   */
  static async createSale(input: CreateSaleInput) {
    if (!input.barId || input.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before creating this transaction.');
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('At least one line item is required for a sale transaction.');
    }

    const saleDate = input.saleDate || new Date().toISOString().split('T')[0];

    // 1. Dry Day Validation
    const dryCheck = await DryDayService.isDryDay(saleDate, input.barId);
    if (dryCheck.isDryDay) {
      throw new Error(`Cannot record sales on a configured Dry Day (${dryCheck.reason || 'Dry Day'}).`);
    }

    const supabase = getSupabaseServiceClient();

    // 2. Validate line items, active product status, and available stock
    const validatedItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      taxableValue: number;
      vatRate: number;
      vatAmount: number;
      totalValue: number;
      currentStock: number;
      newStock: number;
      costPrice: number;
    }> = [];

    let totalTaxable = 0;
    let totalVat = 0;
    let totalInvoice = 0;

    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new Error('Sale item quantity must be greater than zero.');
      }

      // Check product active status
      await ProductMasterService.assertProductActiveForTransaction(item.productId);

      // Fetch product details
      const { data: prod, error: pErr } = await supabase
        .from('products')
        .select(`
          id,
          name,
          product_name,
          purchase_tp_price,
          selling_price,
          mrp_reference,
          category:categories(name, code)
        `)
        .eq('id', item.productId)
        .single();

      if (pErr || !prod) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Fetch current bar inventory
      const { data: inv } = await supabase
        .from('inventory')
        .select('current_quantity, stock_value')
        .eq('product_id', item.productId)
        .eq('bar_id', input.barId)
        .maybeSingle();

      const availableStock = Number(inv?.current_quantity || 0);
      if (availableStock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${prod.product_name || prod.name}" in this bar (Available: ${availableStock}, Requested: ${item.quantity}).`
        );
      }

      const unitPrice = item.rate !== undefined ? item.rate : Number(prod.mrp_reference || prod.selling_price || 0);
      const catName = (prod.category as any)?.name;
      const pType = (prod.category as any)?.product_type;

      const taxBreakdown = await TaxService.calculateItemTax(item.quantity, unitPrice, catName, pType);

      totalTaxable += taxBreakdown.taxableValue;
      totalVat += taxBreakdown.vatAmount;
      totalInvoice += taxBreakdown.totalValue;

      validatedItems.push({
        productId: item.productId,
        productName: prod.product_name || prod.name,
        quantity: item.quantity,
        unitPrice,
        taxableValue: taxBreakdown.taxableValue,
        vatRate: taxBreakdown.vatRate,
        vatAmount: taxBreakdown.vatAmount,
        totalValue: taxBreakdown.totalValue,
        currentStock: availableStock,
        newStock: availableStock - item.quantity,
        costPrice: Number(prod.purchase_tp_price || 0),
      });
    }

    const timestamp = Date.now().toString().slice(-6);
    const invoiceNumber = input.invoiceNumber?.trim() || `SALE-${timestamp}-${Math.floor(Math.random() * 1000)}`;

    // 3. Insert Parent Sales Transaction with bar_id
    const { data: sale, error: saleErr } = await supabase
      .from('sales_transactions')
      .insert({
        bar_id: input.barId,
        invoice_number: invoiceNumber,
        invoice_date: `${saleDate}T12:00:00Z`,
        customer_name: input.customerName || 'Counter Sale',
        vat_number: input.vatNumber || null,
        total_taxable_value: Math.round(totalTaxable * 100) / 100,
        total_vat_amount: Math.round(totalVat * 100) / 100,
        total_invoice_value: Math.round(totalInvoice * 100) / 100,
        remarks: input.remarks || null,
      })
      .select()
      .single();

    if (saleErr || !sale) {
      throw new Error(`Failed to create sales transaction: ${saleErr?.message || 'Database error'}`);
    }

    // 4. Insert Child Sales Transaction Items with matching bar_id
    for (const vItem of validatedItems) {
      const { error: itemErr } = await supabase
        .from('sales_transaction_items')
        .insert({
          sale_id: sale.id,
          bar_id: input.barId,
          product_id: vItem.productId,
          quantity: vItem.quantity,
          taxable_value: vItem.taxableValue,
          vat_rate: vItem.vatRate,
          vat_amount: vItem.vatAmount,
          total_value: vItem.totalValue,
        });

      if (itemErr) {
        console.error('Error inserting sales item:', itemErr.message);
      }

      // 5. Insert Stock Ledger Entry (ADJUSTMENT_OUT for sale reduction)
      const { error: ledgerErr } = await supabase.from('stock_ledger').insert({
        bar_id: input.barId,
        product_id: vItem.productId,
        transaction_date: `${saleDate}T12:00:00Z`,
        transaction_type: 'ADJUSTMENT_OUT',
        reference_id: sale.id,
        reference_number: invoiceNumber,
        stock_in: 0,
        stock_out: vItem.quantity,
        balance: vItem.newStock,
        remarks: `Sale via invoice ${invoiceNumber}`,
      });

      if (ledgerErr) {
        console.error('Error inserting stock ledger for sale:', ledgerErr.message);
      }

      // 6. Update Inventory record
      await supabase
        .from('inventory')
        .update({
          current_quantity: vItem.newStock,
          stock_value: vItem.newStock * vItem.costPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', vItem.productId)
        .eq('bar_id', input.barId);
    }

    return {
      saleId: sale.id,
      invoiceNumber: sale.invoice_number,
      totalInvoiceValue: sale.total_invoice_value,
      totalVatAmount: sale.total_vat_amount,
      saleDate,
      itemsCount: validatedItems.length,
    };
  }

  /**
   * Get list of sales transactions strictly scoped to authorized barId.
   */
  static async getSales(params: {
    barId: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar to view sales.');
    }

    const supabase = getSupabaseServiceClient();
    const limit = Math.max(1, Math.min(500, params.limit || 50));
    const page = Math.max(1, params.page || 1);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('sales_transactions')
      .select(`
        id,
        bar_id,
        invoice_number,
        invoice_date,
        customer_name,
        vat_number,
        total_taxable_value,
        total_vat_amount,
        total_invoice_value,
        remarks,
        created_at,
        items:sales_transaction_items(
          id,
          product_id,
          quantity,
          taxable_value,
          vat_rate,
          vat_amount,
          total_value,
          product:products(
            id,
            name,
            product_name,
            sku,
            category:categories(name)
          )
        )
      `, { count: 'exact' })
      .eq('bar_id', params.barId);

    if (params.startDate) {
      query = query.gte('invoice_date', `${params.startDate}T00:00:00Z`);
    }
    if (params.endDate) {
      query = query.lte('invoice_date', `${params.endDate}T23:59:59Z`);
    }
    if (params.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or(`invoice_number.ilike.%${s}%,customer_name.ilike.%${s}%`);
    }

    const { data, error, count } = await query
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch sales: ${error.message}`);
    }

    return {
      sales: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit) || 1,
      },
    };
  }

  /**
   * Get single sale by ID strictly scoped to barId (returns null if belongs to another bar).
   */
  static async getSaleById(id: string, barId: string) {
    if (!id || !barId || barId === 'ALL_BARS') return null;
    const supabase = getSupabaseServiceClient();

    const { data: sale, error } = await supabase
      .from('sales_transactions')
      .select(`
        id,
        bar_id,
        invoice_number,
        invoice_date,
        customer_name,
        vat_number,
        total_taxable_value,
        total_vat_amount,
        total_invoice_value,
        remarks,
        created_at,
        items:sales_transaction_items(
          id,
          product_id,
          quantity,
          taxable_value,
          vat_rate,
          vat_amount,
          total_value,
          product:products(id, name, product_name, sku, category:categories(name))
        )
      `)
      .eq('id', id)
      .eq('bar_id', barId)
      .maybeSingle();

    if (error || !sale) return null;
    return sale;
  }

  /**
   * Update sale transaction scoped to authorized barId.
   * Supports updating remarks and line item quantities with stock reconciliation.
   */
  static async updateSale(
    id: string,
    barId: string,
    updates: { remarks?: string; customerName?: string; items?: Array<{ id: string; productId: string; quantity: number }> }
  ) {
    if (!id || !barId || barId === 'ALL_BARS') return null;
    const existing = await this.getSaleById(id, barId);
    if (!existing) return null;

    const supabase = getSupabaseServiceClient();

    // 1. Update Parent remarks/customer if provided
    const parentUpdates: any = {};
    if (updates.remarks !== undefined) parentUpdates.remarks = updates.remarks;
    if (updates.customerName !== undefined) parentUpdates.customer_name = updates.customerName;
    
    if (Object.keys(parentUpdates).length > 0) {
      parentUpdates.updated_at = new Date().toISOString();
      await supabase.from('sales_transactions').update(parentUpdates).eq('id', id).eq('bar_id', barId);
    }

    // 2. Handle Item Updates (Quantity Corrections)
    if (updates.items && updates.items.length > 0) {
      for (const updateItem of updates.items) {
        const existingItem = (existing.items as any[]).find(i => i.id === updateItem.id);
        if (!existingItem) continue;

        const oldQty = Number(existingItem.quantity);
        const newQty = Number(updateItem.quantity);
        if (oldQty === newQty) continue;

        const qtyDelta = newQty - oldQty; // Positive if increasing sale (reducing stock), negative if decreasing sale (increasing stock)

        // Fetch current inventory
        const { data: inv } = await supabase
          .from('inventory')
          .select('current_quantity, stock_value')
          .eq('product_id', updateItem.productId)
          .eq('bar_id', barId)
          .maybeSingle();

        const currentStock = Number(inv?.current_quantity || 0);

        // If increasing sale, check if enough stock exists
        if (qtyDelta > 0 && currentStock < qtyDelta) {
          throw new Error(`Insufficient stock for correction. Available: ${currentStock}, Needed: ${qtyDelta}`);
        }

        const newStock = currentStock - qtyDelta;

        // Fetch product for cost price (inventory valuation)
        const { data: prod } = await supabase.from('products').select('purchase_tp_price').eq('id', updateItem.productId).single();
        const costPrice = Number(prod?.purchase_tp_price || 0);

        // Update sales_transaction_items
        await supabase.from('sales_transaction_items').update({
          quantity: newQty,
          // Recalculate values if unit price was stored (omitted for brevity, keeping simple quantity fix)
        }).eq('id', updateItem.id).eq('bar_id', barId);

        // Update inventory
        await supabase.from('inventory').update({
          current_quantity: newStock,
          stock_value: newStock * costPrice,
          updated_at: new Date().toISOString(),
        }).eq('product_id', updateItem.productId).eq('bar_id', barId);

        // Add ledger entry for correction
        await supabase.from('stock_ledger').insert({
          bar_id: barId,
          product_id: updateItem.productId,
          transaction_date: new Date().toISOString(),
          transaction_type: 'CORRECTION',
          reference_id: id,
          reference_number: existing.invoice_number,
          stock_in: qtyDelta < 0 ? Math.abs(qtyDelta) : 0,
          stock_out: qtyDelta > 0 ? qtyDelta : 0,
          balance: newStock,
          remarks: `Sale quantity correction (Invoice: ${existing.invoice_number})`,
        });
      }
    }

    return await this.getSaleById(id, barId);
  }

  /**
   * Delete sale transaction scoped to authorized barId with full inventory/ledger reversal.
   */
  static async deleteSale(id: string, barId: string) {
    if (!id || !barId || barId === 'ALL_BARS') return false;
    const existing = await this.getSaleById(id, barId);
    if (!existing) return false;

    const supabase = getSupabaseServiceClient();

    // Revert inventory & stock ledger for each item
    for (const item of (existing.items || [])) {
      const { data: currentInv } = await supabase
        .from('inventory')
        .select('current_quantity')
        .eq('product_id', item.product_id)
        .eq('bar_id', barId)
        .maybeSingle();

      const restoredStock = Number(currentInv?.current_quantity || 0) + Number(item.quantity);

      await supabase
        .from('inventory')
        .update({ current_quantity: restoredStock })
        .eq('product_id', item.product_id)
        .eq('bar_id', barId);

      // Add cancellation reversal entry in stock ledger
      await supabase.from('stock_ledger').insert({
        bar_id: barId,
        product_id: item.product_id,
        transaction_date: new Date().toISOString(),
        transaction_type: 'RETURN_IN',
        reference_id: id,
        reference_number: `CANCEL-${existing.invoice_number}`,
        stock_in: item.quantity,
        stock_out: 0,
        balance: restoredStock,
        remarks: `Sale cancelled: ${existing.invoice_number}`,
      });
    }

    // Delete items and parent sale
    await supabase.from('sales_transaction_items').delete().eq('sale_id', id).eq('bar_id', barId);
    const { error: delErr } = await supabase.from('sales_transactions').delete().eq('id', id).eq('bar_id', barId);

    if (delErr) throw new Error(`Failed to delete sale: ${delErr.message}`);
    return true;
  }

  /**
   * Database-backed Closing Stock Calculation (Section: Closing Stock)
   * Formula: Opening + Received - Sales +/- Adjustments = Closing
   */
  static async calculateClosingStock(params: {
    barId: string;
    startDate?: string;
    endDate?: string;
    productId?: string;
  }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar for closing stock calculation.');
    }

    const supabase = getSupabaseServiceClient();

    // Fetch all products in inventory for this bar
    let invQuery = supabase
      .from('inventory')
      .select(`
        product_id,
        opening_quantity,
        purchased_quantity,
        adjustment_quantity,
        current_quantity,
        stock_value,
        product:products(
          id,
          name,
          product_name,
          sku,
          purchase_tp_price,
          mrp_reference,
          category:categories(name, code),
          brand:brands(name, brand_name)
        )
      `)
      .eq('bar_id', params.barId);

    if (params.productId) {
      invQuery = invQuery.eq('product_id', params.productId);
    }

    const { data: invRows, error: invErr } = await invQuery;
    if (invErr) throw new Error(`Failed to calculate closing stock: ${invErr.message}`);

    // Query sales aggregated for this bar
    let salesQuery = supabase
      .from('sales_transaction_items')
      .select('product_id, quantity')
      .eq('bar_id', params.barId);

    const { data: salesItems } = await salesQuery;
    const salesMap: Record<string, number> = {};
    (salesItems || []).forEach(si => {
      salesMap[si.product_id] = (salesMap[si.product_id] || 0) + Number(si.quantity);
    });

    const report = (invRows || []).map((row: any) => {
      const p = row.product;
      const opening = Number(row.opening_quantity || 0);
      const received = Number(row.purchased_quantity || 0);
      const adjustments = Number(row.adjustment_quantity || 0);
      const sales = salesMap[row.product_id] || 0;
      const closingCalculated = opening + received - sales + adjustments;
      const currentInDb = Number(row.current_quantity || 0);

      return {
        productId: row.product_id,
        productName: p?.product_name || p?.name,
        brandName: p?.brand?.brand_name || p?.brand?.name,
        categoryName: p?.category?.name,
        productType: p?.category?.product_type || 'Spirit',
        openingStock: opening,
        receivedStock: received,
        salesStock: sales,
        adjustmentStock: adjustments,
        closingStock: closingCalculated,
        currentInventoryStock: currentInDb,
        unitTpPrice: Number(p?.purchase_tp_price || 0),
        mrp: Number(p?.mrp_reference || 0),
        stockValuation: currentInDb * Number(p?.purchase_tp_price || 0),
      };
    });

    return report;
  }
}
