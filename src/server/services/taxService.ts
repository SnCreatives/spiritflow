import { getSupabaseServiceClient } from '../../lib/supabase/client.js';

export interface TaxCalculationResult {
  taxableValue: number;
  vatAmount: number;
  vatRate: number;
  totalValue: number;
}

export class TaxService {
  /**
   * Get VAT/Sales tax rate for a specific product or category.
   * Strict Rule: Wine is 0.00% VAT in Maharashtra.
   */
  static async getTaxRateForCategory(categoryName?: string, productType?: string): Promise<number> {
    const cleanCat = (categoryName || '').trim().toLowerCase();
    const cleanType = (productType || '').trim().toLowerCase();

    // Wine is strictly 0%
    if (cleanCat.includes('wine') || cleanType === 'wine') {
      return 0.0;
    }

    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('tax_rules')
        .select('tax_rate')
        .ilike('category_name', cleanCat)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data && data.tax_rate !== undefined) {
        return Number(data.tax_rate);
      }
    } catch {}

    // Default standard rate for spirits, beer, etc.
    return 5.0;
  }

  /**
   * Calculate line item tax breakdown
   */
  static async calculateItemTax(
    quantity: number,
    unitPrice: number,
    categoryName?: string,
    productType?: string
  ): Promise<TaxCalculationResult> {
    const vatRate = await this.getTaxRateForCategory(categoryName, productType);
    const taxableValue = Math.round(quantity * unitPrice * 100) / 100;
    const vatAmount = Math.round(taxableValue * (vatRate / 100) * 100) / 100;
    const totalValue = Math.round((taxableValue + vatAmount) * 100) / 100;

    return {
      taxableValue,
      vatAmount,
      vatRate,
      totalValue,
    };
  }
}
