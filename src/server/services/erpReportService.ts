import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import { SalesService } from './salesService.js';
import { ProductMasterService } from './productMasterService.js';

export interface ExciseLogBookEntry {
  serialNumber: number;
  date: string;
  spiritImfl: number;
  fermentedBeer: number;
  mildBeer: number;
  wine: number;
  mml: number;
  countryLiquor: number;
  totalUnits: number;
}

export class ErpReportService {
  /**
   * Daily Sales Report
   */
  static async getDailySalesReport(params: { barId: string; date?: string }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

    const date = params.date || new Date().toISOString().split('T')[0];
    const supabase = getSupabaseServiceClient();

    const { data: sales, error } = await supabase
      .from('sales_transactions')
      .select(`
        id,
        invoice_number,
        invoice_date,
        customer_name,
        total_taxable_value,
        total_vat_amount,
        total_invoice_value,
        items:sales_transaction_items(
          id,
          quantity,
          taxable_value,
          vat_rate,
          vat_amount,
          total_value,
          product:products(name, product_name, sku, category:categories(name, code))
        )
      `)
      .eq('bar_id', params.barId)
      .gte('invoice_date', `${date}T00:00:00Z`)
      .lte('invoice_date', `${date}T23:59:59Z`);

    if (error) throw new Error(`Failed to fetch daily sales report: ${error.message}`);

    const totalSalesValue = (sales || []).reduce((sum, s) => sum + Number(s.total_invoice_value || 0), 0);
    const totalVat = (sales || []).reduce((sum, s) => sum + Number(s.total_vat_amount || 0), 0);

    return {
      barId: params.barId,
      reportDate: date,
      transactionsCount: (sales || []).length,
      totalSalesValue,
      totalVat,
      sales: sales || [],
    };
  }

  /**
   * Monthly Sales & Inventory Summary Report
   */
  static async getMonthlyReport(params: { barId: string; month?: string }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

    const currentMonth = params.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-31`;

    const closingStock = await SalesService.calculateClosingStock({
      barId: params.barId,
      startDate,
      endDate,
    });

    const totalValuation = closingStock.reduce((sum, r) => sum + r.stockValuation, 0);

    return {
      barId: params.barId,
      month: currentMonth,
      items: closingStock,
      totalValuation,
    };
  }

  /**
   * Canonical Excise Log Book (Daily/Range breakdown by canonical liquor columns)
   * Exact Columns Required:
   * 1. Serial Number
   * 2. Spirit / IMFL
   * 3. Fermented Beer
   * 4. Mild Beer
   * 5. Wine
   * 6. MML
   * 7. Country Liquor
   */
  static async getExciseLogBook(params: { barId: string; startDate?: string; endDate?: string }): Promise<{
    barId: string;
    startDate: string;
    endDate: string;
    columns: string[];
    entries: ExciseLogBookEntry[];
    totals: {
      spiritImfl: number;
      fermentedBeer: number;
      mildBeer: number;
      wine: number;
      mml: number;
      countryLiquor: number;
      totalUnits: number;
    };
  }> {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

    const startDate = params.startDate || new Date().toISOString().split('T')[0];
    const endDate = params.endDate || new Date().toISOString().split('T')[0];

    const supabase = getSupabaseServiceClient();

    const { data: sales, error } = await supabase
      .from('sales_transactions')
      .select(`
        id,
        invoice_date,
        items:sales_transaction_items(
          quantity,
          product:products(
            name,
            product_name,
            category:categories(name, code)
          )
        )
      `)
      .eq('bar_id', params.barId)
      .gte('invoice_date', `${startDate}T00:00:00Z`)
      .lte('invoice_date', `${endDate}T23:59:59Z`)
      .order('invoice_date', { ascending: true });

    if (error) throw new Error(`Failed to fetch excise log book: ${error.message}`);

    // Group sales by date
    const dateMap: Record<string, {
      spiritImfl: number;
      fermentedBeer: number;
      mildBeer: number;
      wine: number;
      mml: number;
      countryLiquor: number;
    }> = {};

    (sales || []).forEach(sale => {
      const d = sale.invoice_date.split('T')[0];
      if (!dateMap[d]) {
        dateMap[d] = { spiritImfl: 0, fermentedBeer: 0, mildBeer: 0, wine: 0, mml: 0, countryLiquor: 0 };
      }

      (sale.items || []).forEach((item: any) => {
        const p = item.product;
        const cat = p?.category;
        const pType = cat?.product_type || ProductMasterService.resolveProductType(cat?.name || '');
        const catName = (cat?.name || '').toLowerCase();
        const qty = Number(item.quantity || 0);

        if (catName.includes('country') || catName.includes('desi')) {
          dateMap[d].countryLiquor += qty;
        } else if (catName.includes('mml')) {
          dateMap[d].mml += qty;
        } else if (pType === 'Wine') {
          dateMap[d].wine += qty;
        } else if (pType === 'Mild Beer') {
          dateMap[d].mildBeer += qty;
        } else if (pType === 'Fermented Beer') {
          dateMap[d].fermentedBeer += qty;
        } else {
          // Spirit / IMFL (Whiskey, Vodka, Rum, Gin, Brandy, Tequila, etc.)
          dateMap[d].spiritImfl += qty;
        }
      });
    });

    const entries: ExciseLogBookEntry[] = [];
    const sortedDates = Object.keys(dateMap).sort();
    let serial = 1;

    let totSpirit = 0;
    let totFermented = 0;
    let totMild = 0;
    let totWine = 0;
    let totMml = 0;
    let totCountry = 0;

    sortedDates.forEach(d => {
      const data = dateMap[d];
      const rowTotal = data.spiritImfl + data.fermentedBeer + data.mildBeer + data.wine + data.mml + data.countryLiquor;
      totSpirit += data.spiritImfl;
      totFermented += data.fermentedBeer;
      totMild += data.mildBeer;
      totWine += data.wine;
      totMml += data.mml;
      totCountry += data.countryLiquor;

      entries.push({
        serialNumber: serial++,
        date: d,
        spiritImfl: data.spiritImfl,
        fermentedBeer: data.fermentedBeer,
        mildBeer: data.mildBeer,
        wine: data.wine,
        mml: data.mml,
        countryLiquor: data.countryLiquor,
        totalUnits: rowTotal,
      });
    });

    return {
      barId: params.barId,
      startDate,
      endDate,
      columns: [
        'Serial Number',
        'Spirit / IMFL',
        'Fermented Beer',
        'Mild Beer',
        'Wine',
        'MML',
        'Country Liquor',
      ],
      entries,
      totals: {
        spiritImfl: totSpirit,
        fermentedBeer: totFermented,
        mildBeer: totMild,
        wine: totWine,
        mml: totMml,
        countryLiquor: totCountry,
        totalUnits: totSpirit + totFermented + totMild + totWine + totMml + totCountry,
      },
    };
  }

  /**
   * Sales Tax Report (Wine is strictly 0% tax, spirits/beer 5%)
   */
  static async getSalesTaxReport(params: { barId: string; startDate?: string; endDate?: string }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

    const startDate = params.startDate || new Date().toISOString().split('T')[0];
    const endDate = params.endDate || new Date().toISOString().split('T')[0];

    const supabase = getSupabaseServiceClient();

    const { data: sales, error } = await supabase
      .from('sales_transactions')
      .select(`
        id,
        invoice_number,
        invoice_date,
        total_taxable_value,
        total_vat_amount,
        total_invoice_value,
        items:sales_transaction_items(
          quantity,
          taxable_value,
          vat_rate,
          vat_amount,
          total_value,
          product:products(
            name,
            product_name,
            category:categories(name, code)
          )
        )
      `)
      .eq('bar_id', params.barId)
      .gte('invoice_date', `${startDate}T00:00:00Z`)
      .lte('invoice_date', `${endDate}T23:59:59Z`);

    if (error) throw new Error(`Failed to fetch sales tax report: ${error.message}`);

    const categoryBreakdown: Record<string, { taxableValue: number; vatRate: number; vatAmount: number; totalValue: number }> = {};

    (sales || []).forEach(s => {
      (s.items || []).forEach((item: any) => {
        const cat = item.product?.category;
        const pType = cat?.product_type || ProductMasterService.resolveProductType(cat?.name || '');
        const catLabel = pType === 'Wine' ? 'Wine (0% Tax)' : (cat?.name || 'Spirit (5% Tax)');

        if (!categoryBreakdown[catLabel]) {
          categoryBreakdown[catLabel] = { taxableValue: 0, vatRate: Number(item.vat_rate || 0), vatAmount: 0, totalValue: 0 };
        }
        categoryBreakdown[catLabel].taxableValue += Number(item.taxable_value || 0);
        categoryBreakdown[catLabel].vatAmount += Number(item.vat_amount || 0);
        categoryBreakdown[catLabel].totalValue += Number(item.total_value || 0);
      });
    });

    return {
      barId: params.barId,
      startDate,
      endDate,
      categories: Object.entries(categoryBreakdown).map(([category, stats]) => ({
        category,
        taxableValue: Math.round(stats.taxableValue * 100) / 100,
        vatRate: stats.vatRate,
        vatAmount: Math.round(stats.vatAmount * 100) / 100,
        totalValue: Math.round(stats.totalValue * 100) / 100,
      })),
      totalTaxable: (sales || []).reduce((sum, s) => sum + Number(s.total_taxable_value || 0), 0),
      totalVat: (sales || []).reduce((sum, s) => sum + Number(s.total_vat_amount || 0), 0),
      totalInvoice: (sales || []).reduce((sum, s) => sum + Number(s.total_invoice_value || 0), 0),
    };
  }

  /**
   * Received TP (Transport Permit) Inward Report
   */
  static async getReceivedTpReport(params: { barId: string; startDate?: string; endDate?: string }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

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
        items:purchase_items(
          quantity,
          purchase_tp_price,
          total_value,
          product:products(name, product_name, sku, category:categories(name))
        )
      `)
      .eq('bar_id', params.barId);

    if (params.startDate) query = query.gte('purchase_date', params.startDate);
    if (params.endDate) query = query.lte('purchase_date', params.endDate);

    const { data: purchases, error } = await query.order('purchase_date', { ascending: false });
    if (error) throw new Error(`Failed to fetch received TP report: ${error.message}`);

    return {
      barId: params.barId,
      startDate: params.startDate,
      endDate: params.endDate,
      totalValue: (purchases || []).reduce((sum, p) => sum + Number(p.total_value || 0), 0),
      purchases: purchases || [],
    };
  }

  /**
   * Available Stock Status & Valuation
   */
  static async getAvailableStockStatus(params: { barId: string }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

    const supabase = getSupabaseServiceClient();
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select(`
        id,
        product_id,
        opening_quantity,
        purchased_quantity,
        adjustment_quantity,
        current_quantity,
        stock_value,
        product:products(
          name,
          product_name,
          sku,
          purchase_tp_price,
          mrp_reference,
          category:categories(name, code),
          brand:brands(name, brand_name)
        )
      `)
      .eq('bar_id', params.barId)
      .order('current_quantity', { ascending: false });

    if (error) throw new Error(`Failed to fetch available stock status: ${error.message}`);

    const totalStock = (inventory || []).reduce((sum, i) => sum + Number(i.current_quantity || 0), 0);
    const totalValuation = (inventory || []).reduce((sum, i) => sum + Number(i.stock_value || 0), 0);

    return {
      barId: params.barId,
      totalUnits: totalStock,
      totalValuation,
      inventory: inventory || [],
    };
  }

  /**
   * Sales Report Summary (Aggregated by Product, Brand, Category with date filtering)
   */
  static async getSalesReportSummary(params: { barId: string; startDate?: string; endDate?: string }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

    const startDate = params.startDate || new Date().toISOString().split('T')[0];
    const endDate = params.endDate || new Date().toISOString().split('T')[0];
    const supabase = getSupabaseServiceClient();

    const { data: sales, error } = await supabase
      .from('sales_transactions')
      .select(`
        id,
        invoice_number,
        invoice_date,
        total_taxable_value,
        total_vat_amount,
        total_invoice_value,
        items:sales_transaction_items(
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
            category:categories(name, code),
            brand:brands(name, brand_name)
          )
        )
      `)
      .eq('bar_id', params.barId)
      .gte('invoice_date', `${startDate}T00:00:00Z`)
      .lte('invoice_date', `${endDate}T23:59:59Z`);

    if (error) throw new Error(`Failed to fetch sales summary: ${error.message}`);

    const productSummaryMap: Record<string, {
      productId: string;
      productName: string;
      brandName: string;
      categoryName: string;
      totalQuantity: number;
      totalTaxable: number;
      totalVat: number;
      totalValue: number;
    }> = {};

    (sales || []).forEach(s => {
      (s.items || []).forEach((item: any) => {
        const prod = item.product;
        const pId = prod?.id || 'unknown';
        const pName = prod?.name || prod?.product_name || 'Unknown Product';
        const bName = prod?.brand?.name || prod?.brand?.brand_name || '-';
        const cName = prod?.category?.name || '-';

        if (!productSummaryMap[pId]) {
          productSummaryMap[pId] = {
            productId: pId,
            productName: pName,
            brandName: bName,
            categoryName: cName,
            totalQuantity: 0,
            totalTaxable: 0,
            totalVat: 0,
            totalValue: 0,
          };
        }

        productSummaryMap[pId].totalQuantity += Number(item.quantity || 0);
        productSummaryMap[pId].totalTaxable += Number(item.taxable_value || 0);
        productSummaryMap[pId].totalVat += Number(item.vat_amount || 0);
        productSummaryMap[pId].totalValue += Number(item.total_value || 0);
      });
    });

    const summaryItems = Object.values(productSummaryMap).sort((a, b) => b.totalValue - a.totalValue);

    return {
      barId: params.barId,
      startDate,
      endDate,
      totalTransactions: (sales || []).length,
      totalUnitsSold: summaryItems.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalTaxableValue: summaryItems.reduce((sum, item) => sum + item.totalTaxable, 0),
      totalVatAmount: summaryItems.reduce((sum, item) => sum + item.totalVat, 0),
      totalSalesRevenue: summaryItems.reduce((sum, item) => sum + item.totalValue, 0),
      items: summaryItems,
    };
  }

  /**
   * Permit Bills Report
   */
  static async getPermitBills(params: { barId: string; startDate?: string; endDate?: string }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

    const startDate = params.startDate || new Date().toISOString().split('T')[0];
    const endDate = params.endDate || new Date().toISOString().split('T')[0];
    const supabase = getSupabaseServiceClient();

    const { data: sales, error } = await supabase
      .from('sales_transactions')
      .select(`
        id,
        invoice_number,
        invoice_date,
        customer_name,
        vat_number,
        total_taxable_value,
        total_vat_amount,
        total_invoice_value,
        remarks,
        items:sales_transaction_items(
          id,
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
            category:categories(name, code),
            brand:brands(name, brand_name)
          )
        )
      `)
      .eq('bar_id', params.barId)
      .gte('invoice_date', `${startDate}T00:00:00Z`)
      .lte('invoice_date', `${endDate}T23:59:59Z`)
      .order('invoice_date', { ascending: false });

    if (error) throw new Error(`Failed to fetch permit bills: ${error.message}`);

    return {
      barId: params.barId,
      startDate,
      endDate,
      totalBills: (sales || []).length,
      totalValue: (sales || []).reduce((sum, s) => sum + Number(s.total_invoice_value || 0), 0),
      totalVat: (sales || []).reduce((sum, s) => sum + Number(s.total_vat_amount || 0), 0),
      bills: (sales || []).map(s => ({
        id: s.id,
        billNumber: s.invoice_number,
        date: s.invoice_date,
        customerName: s.customer_name || 'Counter Customer',
        permitNumber: s.vat_number || 'N/A',
        taxableValue: Number(s.total_taxable_value || 0),
        vatAmount: Number(s.total_vat_amount || 0),
        totalAmount: Number(s.total_invoice_value || 0),
        paymentMethod: 'Cash',
        itemsCount: (s.items || []).length,
        items: s.items || [],
      })),
    };
  }

  /**
   * Comprehensive Stock Value Report
   */
  static async getStockValueReport(params: { barId: string }) {
    if (!params.barId || params.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before generating reports.');
    }

    const supabase = getSupabaseServiceClient();
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select(`
        id,
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
          category:categories(id, name, code),
          brand:brands(id, name, brand_name)
        )
      `)
      .eq('bar_id', params.barId)
      .order('current_quantity', { ascending: false });

    if (error) throw new Error(`Failed to fetch stock value report: ${error.message}`);

    let totalOpeningQty = 0;
    let totalPurchasedQty = 0;
    let totalAdjustmentQty = 0;
    let totalCurrentQty = 0;
    let totalTpCostValuation = 0;
    let totalMrpValuation = 0;

    const items = (inventory || []).map((i: any) => {
      const p = i.product;
      const curQty = Number(i.current_quantity || 0);
      const tpPrice = Number(p?.purchase_tp_price || 0);
      const mrp = Number(p?.mrp_reference || 0);
      const tpVal = curQty * tpPrice;
      const mrpVal = curQty * mrp;

      totalOpeningQty += Number(i.opening_quantity || 0);
      totalPurchasedQty += Number(i.purchased_quantity || 0);
      totalAdjustmentQty += Number(i.adjustment_quantity || 0);
      totalCurrentQty += curQty;
      totalTpCostValuation += tpVal;
      totalMrpValuation += mrpVal;

      return {
        id: i.id,
        productId: i.product_id,
        productName: p?.name || p?.product_name || 'Unknown',
        sku: p?.sku || '-',
        category: p?.category?.name || 'General',
        brand: p?.brand?.name || p?.brand?.brand_name || 'Standard',
        openingQty: Number(i.opening_quantity || 0),
        purchasedQty: Number(i.purchased_quantity || 0),
        adjustmentQty: Number(i.adjustment_quantity || 0),
        currentQty: curQty,
        purchaseTpPrice: tpPrice,
        mrp: mrp,
        tpCostValue: Math.round(tpVal * 100) / 100,
        mrpTotalValue: Math.round(mrpVal * 100) / 100,
      };
    });

    return {
      barId: params.barId,
      totalItems: items.length,
      totals: {
        openingQty: totalOpeningQty,
        purchasedQty: totalPurchasedQty,
        adjustmentQty: totalAdjustmentQty,
        currentQty: totalCurrentQty,
        tpCostValuation: Math.round(totalTpCostValuation * 100) / 100,
        mrpValuation: Math.round(totalMrpValuation * 100) / 100,
      },
      items,
    };
  }
}
