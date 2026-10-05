import { apiGet } from './api';

export interface DiagnosticMasterResult {
  brandsResponse: any;
  variantsResponse: any;
  brandsValidation: {
    totalItems: number;
    hasRequiredFields: boolean;
    sample: any;
    fieldsPresent: {
      id: boolean;
      name: boolean;
      category_id: boolean;
    };
  };
  variantsValidation: {
    totalVariants: number;
    totalProducts: number;
    sampleVariant: string | null;
    sampleProduct: any;
  };
}

/**
 * Diagnostic utility function that fetches data from '/api/masters/brands'
 * and '/api/masters/variants' endpoints and logs the raw JSON response,
 * structure, and fields to the console.
 */
export async function runMasterDiagnostics(options: {
  categoryId?: string;
  brandId?: string;
} = {}): Promise<DiagnosticMasterResult> {
  console.group('%c🔍 [Master Diagnostics] Fetching Master Data Endpoints', 'color: #f59e0b; font-weight: bold; font-size: 13px;');

  try {
    // 1. Fetch Brands from /api/masters/brands
    const brandsUrl = options.categoryId
      ? `/api/masters/brands?categoryId=${options.categoryId}&limit=500`
      : '/api/masters/brands?limit=500';

    console.log(`%c📡 [1/2] Requesting Brands from: ${brandsUrl}`, 'color: #38bdf8;');
    const brandsRes = await apiGet(brandsUrl);
    console.log('%c📦 Raw /api/masters/brands Response:', 'color: #a78bfa; font-weight: bold;', brandsRes);

    const brandItems: any[] = Array.isArray(brandsRes.data)
      ? brandsRes.data
      : brandsRes.data?.items || brandsRes.data?.brands || [];

    const sampleBrand = brandItems[0] || null;
    const brandFieldChecks = {
      id: sampleBrand ? !!sampleBrand.id && typeof sampleBrand.id === 'string' : false,
      name: sampleBrand ? !!sampleBrand.name && typeof sampleBrand.name === 'string' : false,
      category_id: sampleBrand ? !!sampleBrand.category_id && typeof sampleBrand.category_id === 'string' : false,
    };

    console.log('%c📊 Brand Items Count:', 'color: #34d399;', brandItems.length);
    console.log('%c🔎 Sample Brand Record Structure:', 'color: #60a5fa;', sampleBrand);
    console.log('%c✅ Brand Field Validation (id, name, category_id):', 'color: #4ade80;', brandFieldChecks);

    // 2. Fetch Variants from /api/masters/variants
    const sampleBrandId = options.brandId || sampleBrand?.id || '';
    const variantsUrl = sampleBrandId
      ? `/api/masters/variants?brandId=${sampleBrandId}`
      : '/api/masters/variants';

    console.log(`%c📡 [2/2] Requesting Variants from: ${variantsUrl}`, 'color: #38bdf8;');
    const variantsRes = await apiGet(variantsUrl);
    console.log('%c📦 Raw /api/masters/variants Response:', 'color: #a78bfa; font-weight: bold;', variantsRes);

    const variantList: string[] = variantsRes.data?.variants || [];
    const productList: any[] = variantsRes.data?.products || [];
    const sampleProduct = productList[0] || null;

    console.log('%c📊 Distinct Variants Count:', 'color: #34d399;', variantList.length);
    console.log('%c🏷️ Variant Names:', 'color: #fbbf24;', variantList);
    console.log('%c🔎 Sample Product Record Structure:', 'color: #60a5fa;', sampleProduct);

    const result: DiagnosticMasterResult = {
      brandsResponse: brandsRes,
      variantsResponse: variantsRes,
      brandsValidation: {
        totalItems: brandItems.length,
        hasRequiredFields: brandFieldChecks.id && brandFieldChecks.name && brandFieldChecks.category_id,
        sample: sampleBrand,
        fieldsPresent: brandFieldChecks,
      },
      variantsValidation: {
        totalVariants: variantList.length,
        totalProducts: productList.length,
        sampleVariant: variantList[0] || null,
        sampleProduct,
      },
    };

    console.log('%c🎉 Master Data Diagnostic Completed Successfully!', 'color: #22c55e; font-weight: bold;');
    console.groupEnd();
    return result;
  } catch (error: any) {
    console.error('%c❌ [Master Diagnostics Error]:', 'color: #ef4444; font-weight: bold;', error);
    console.groupEnd();
    throw error;
  }
}

// Expose globally for instant testing in Browser DevTools Console
if (typeof window !== 'undefined') {
  (window as any).runMasterDiagnostics = runMasterDiagnostics;
}
