import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layers, Award, Box, Package, ShieldAlert, CheckCircle2, ChevronDown } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { CategorySelector } from './MasterDataSelectors';

export interface SelectedProductDetail {
  productId: string;
  productName: string;
  sku: string;
  productType: string;
  categoryId: string;
  categoryName: string;
  brandId: string;
  brandName: string;
  variant: string;
  packSizeId: string;
  volumeMl: number;
  packType: string;
  mrp: number;
  purchaseTpPrice: number;
  scmCode?: string;
}

interface CanonicalProductSelectorProps {
  onSelectProduct: (product: SelectedProductDetail | null) => void;
  selectedProductId?: string;
  disabled?: boolean;
  compact?: boolean;
}

export const PRODUCT_TYPES = ['Spirit', 'Mild Beer', 'Fermented Beer', 'Wine'] as const;

export const ALLOWED_SIZES: Record<string, number[]> = {
  Spirit: [2000, 1000, 750, 375, 200, 180, 90],
  'Mild Beer': [650, 500, 330],
  'Fermented Beer': [650, 500, 330],
  Wine: [750, 375, 180, 90],
};

export const CanonicalProductSelector: React.FC<CanonicalProductSelectorProps> = ({
  onSelectProduct,
  selectedProductId,
  disabled = false,
  compact = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [scmMap, setScmMap] = useState<Record<string, string>>({});

  // Selection states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [selectedSizeMl, setSelectedSizeMl] = useState<number | ''>('');
  const [selectedPackaging, setSelectedPackaging] = useState<string>('');
  const [activeProductId, setActiveProductId] = useState<string>(selectedProductId || '');
  const lastSyncedIdRef = useRef<string | undefined>(selectedProductId);

  // Fetch product catalog data once on mount
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      setLoading(true);
      try {
        const [cascadeRes, scmRes] = await Promise.all([
          apiGet('/api/products/cascading'),
          apiGet('/api/scm-codes?limit=500'),
        ]);

        if (isMounted) {
          const data = cascadeRes.data || {};
          setRawProducts(data.products || []);
          setCategories(data.categories || []);
          setBrands(data.brands || []);

          const scms = scmRes.data?.scmCodes || scmRes.data || [];
          const mapping: Record<string, string> = {};
          scms.forEach((s: any) => {
            if (s.product_id && s.scm_code) {
              mapping[s.product_id] = s.scm_code;
            }
          });
          setScmMap(mapping);
        }
      } catch (err) {
        console.error('Failed to load product catalog:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync if external selectedProductId changes
  useEffect(() => {
    if (selectedProductId && rawProducts.length > 0) {
      if (lastSyncedIdRef.current === selectedProductId) {
        return;
      }
      
      const match = rawProducts.find(p => p.id === selectedProductId || p.productId === selectedProductId);
      if (match) {
        lastSyncedIdRef.current = selectedProductId;
        
        // Update all related dropdown states atomically
        const catId = match.category_id || match.categoryId || match.category?.id || '';
        const pType = match.productType || match.product_type || (match.category?.product_type) || 'Spirit';
        const bId = match.brand_id || match.brandId || '';
        const vName = match.variant || match.product_name || match.name || '';
        const vol = match.volume_ml || match.volumeMl || match.pack_size?.volume_ml || '';
        const pkg = match.pack_type || match.packType || 'Bottle';

        setSelectedCategoryId(catId);
        setSelectedType(pType);
        setSelectedBrandId(bId);
        setSelectedVariant(vName);
        setSelectedSizeMl(vol);
        setSelectedPackaging(pkg);
        setActiveProductId(match.id);
      }
    } else if (!selectedProductId && activeProductId && lastSyncedIdRef.current) {
      // Clear if externally cleared
      setActiveProductId('');
      setSelectedBrandId('');
      setSelectedVariant('');
      setSelectedSizeMl('');
      setSelectedCategoryId('');
      setSelectedType('');
      lastSyncedIdRef.current = undefined;
    }
  }, [selectedProductId, rawProducts, activeProductId]);

  // 1. Available Brands for selected Category / Product Type
  const availableBrands = useMemo(() => {
    if (selectedCategoryId) {
      const direct = brands.filter(b => (b.category_id || b.categoryId) === selectedCategoryId);
      if (direct.length > 0) return direct;
      
      const targetCat = categories.find(c => c.id === selectedCategoryId);
      if (targetCat) {
        const lowerName = (targetCat.name || '').toLowerCase();
        const related = brands.filter(b => {
          const bCatId = b.category_id || b.categoryId;
          const bCat = categories.find(c => c.id === bCatId);
          if (!bCat) return false;
          if (lowerName.includes('beer') && bCat.name.toLowerCase().includes('beer')) return true;
          if (lowerName.includes('wine') && bCat.name.toLowerCase().includes('wine')) return true;
          return (bCat.product_type || bCat.productType) === (targetCat.product_type || targetCat.productType);
        });
        if (related.length > 0) return related;
      }
      return brands;
    }
    
    if (!selectedType) return brands;
    const targetType = selectedType.toLowerCase();

    const catIdsForType = categories
      .filter(c => {
        const name = (c.name || '').toLowerCase();
        const rawType = (c.product_type || c.productType || '').toLowerCase();

        if (rawType) {
          if (targetType === 'spirit' && (rawType === 'spirit' || rawType.includes('spirit'))) return true;
          if (targetType === 'wine' && rawType.includes('wine')) return true;
          if (targetType === 'mild beer' && rawType.includes('mild')) return true;
          if (targetType === 'fermented beer' && (rawType.includes('fermented') || rawType.includes('strong') || rawType === 'beer')) return true;
        }

        if (targetType === 'wine') return name.includes('wine');
        if (targetType === 'mild beer') return name.includes('mild beer') || name === 'mild';
        if (targetType === 'fermented beer') return name.includes('fermented') || name.includes('beer');
        if (targetType === 'spirit') {
          return !name.includes('wine') && !name.includes('beer');
        }
        return true;
      })
      .map(c => c.id);

    return brands.filter(b => {
      const bCatId = b.category_id || b.categoryId;
      return !bCatId || catIdsForType.includes(bCatId);
    });
  }, [brands, categories, selectedCategoryId, selectedType]);

  // 2. Filtered products matching Category / Type & Brand
  const matchingProducts = useMemo(() => {
    return rawProducts.filter(p => {
      const catId = p.category_id || p.categoryId || p.category?.id;
      if (selectedCategoryId && catId && catId !== selectedCategoryId) return false;
      
      const pType = p.category?.product_type || p.product_type || p.productType || '';
      if (selectedType && pType.toLowerCase() !== selectedType.toLowerCase() && 
          !(selectedType.toLowerCase().includes('beer') && pType.toLowerCase().includes('beer'))) return false;
          
      const bId = p.brand_id || p.brandId;
      if (selectedBrandId && bId !== selectedBrandId) return false;
      
      return true;
    });
  }, [rawProducts, selectedCategoryId, selectedType, selectedBrandId]);

  // 3. Available Variants
  const availableVariants = useMemo(() => {
    const variants = new Set<string>();
    matchingProducts.forEach(p => {
      const v = p.variant || p.product_name || p.name;
      if (v) variants.add(v);
    });

    if (variants.size === 0 && selectedBrandId) {
      rawProducts.forEach(p => {
        const bId = p.brand_id || p.brandId;
        if (bId === selectedBrandId) {
          const v = p.variant || p.product_name || p.name;
          if (v) variants.add(v);
        }
      });
    }

    return Array.from(variants).sort();
  }, [matchingProducts, rawProducts, selectedBrandId]);

  // 4. Allowed Bottle Sizes according to canonical standard
  const allowedSizesForType = useMemo(() => {
    if (selectedType && ALLOWED_SIZES[selectedType]) {
      return ALLOWED_SIZES[selectedType];
    }
    return [2000, 1000, 750, 650, 500, 375, 330, 200, 180, 90];
  }, [selectedType]);

  // 5. Available sizes present in filtered products
  const availableSizes = useMemo(() => {
    const sizes = new Set<number>();
    matchingProducts.forEach(p => {
      const vol = Number(p.volume_ml || p.volumeMl || p.pack_size?.volume_ml);
      if (vol) sizes.add(vol);
    });
    return Array.from(sizes).sort((a, b) => b - a);
  }, [matchingProducts]);

  // 6. Available Packaging Types
  const availablePackaging = useMemo(() => {
    const pkgs = new Set<string>(['Bottle', 'Can', 'Case']);
    matchingProducts.forEach(p => {
      const pkg = p.pack_type || p.packType;
      if (pkg) pkgs.add(pkg);
    });
    return Array.from(pkgs);
  }, [matchingProducts]);

  // Re-resolve active product whenever cascade values change
  useEffect(() => {
    // Skip if still loading or if nothing is selected yet
    if (loading || !rawProducts.length) return;
    
    // Prevent resolution if we are currently syncing an external selectedProductId
    if (selectedProductId && lastSyncedIdRef.current === selectedProductId && activeProductId === selectedProductId) {
      return;
    }

    if (!selectedBrandId) {
      if (activeProductId && !selectedProductId) {
        setActiveProductId('');
        onSelectProduct(null);
      }
      return;
    }

    const resolved = matchingProducts.find(p => {
      const vol = Number(p.volume_ml || p.volumeMl || p.pack_size?.volume_ml);
      const variant = p.variant || p.product_name || p.name;
      const pkg = p.pack_type || p.packType || 'Bottle';

      const matchVar = !selectedVariant || variant === selectedVariant;
      const matchSize = !selectedSizeMl || vol === Number(selectedSizeMl);
      const matchPkg = !selectedPackaging || pkg.toLowerCase() === selectedPackaging.toLowerCase();

      return matchVar && matchSize && matchPkg;
    });

    if (resolved) {
      if (resolved.id !== activeProductId) {
        setActiveProductId(resolved.id);
        const vol = Number(resolved.volume_ml || resolved.volumeMl || resolved.pack_size?.volume_ml || selectedSizeMl || 750);
        const detail: SelectedProductDetail = {
          productId: resolved.id,
          productName: resolved.name || resolved.product_name || resolved.productName,
          sku: resolved.sku || '',
          productType: selectedType || resolved.productType || resolved.product_type || 'Spirit',
          categoryId: resolved.category_id || resolved.categoryId || '',
          categoryName: resolved.category?.name || resolved.categoryName || '',
          brandId: resolved.brand_id || resolved.brandId || selectedBrandId,
          brandName: resolved.brand?.name || resolved.brand?.brand_name || resolved.brandName || '',
          variant: resolved.variant || resolved.product_name || resolved.name,
          packSizeId: resolved.pack_size_id || resolved.packSizeId || '',
          volumeMl: vol,
          packType: resolved.pack_type || resolved.packType || selectedPackaging || 'Bottle',
          mrp: Number(resolved.mrp_reference || resolved.mrp || 0),
          purchaseTpPrice: Number(resolved.purchase_tp_price || resolved.purchasePrice || 0),
          scmCode: scmMap[resolved.id] || resolved.scm_code || undefined,
        };
        // Only trigger update if this was a user-driven change (not an external sync already in progress)
        if (lastSyncedIdRef.current !== detail.productId) {
          onSelectProduct(detail);
        }
      }
    } else if (matchingProducts.length === 1 && !selectedVariant && !selectedSizeMl) {
      // Auto-select single exact product if variant/size not yet specified
      const sole = matchingProducts[0];
      const vol = Number(sole.volume_ml || sole.volumeMl || sole.pack_size?.volume_ml || 750);
      setSelectedSizeMl(vol);
      setSelectedPackaging(sole.pack_type || sole.packType || 'Bottle');
      setSelectedVariant(sole.variant || sole.product_name || sole.name);
      setActiveProductId(sole.id);
    }
  }, [
    selectedType,
    selectedBrandId,
    selectedVariant,
    selectedSizeMl,
    selectedPackaging,
    matchingProducts,
    scmMap,
    onSelectProduct,
    activeProductId,
    loading,
    rawProducts.length,
    selectedProductId
  ]);

  const activeProduct = useMemo(() => {
    return rawProducts.find(p => p.id === activeProductId);
  }, [rawProducts, activeProductId]);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Canonical Product Master Cascade
          </h4>
        </div>
        {loading && (
          <span className="text-[11px] text-slate-500 font-medium animate-pulse">Loading catalog...</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Step 1: Category */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            1. Category *
          </label>
          <CategorySelector
            value={selectedCategoryId}
            onChange={catId => {
              setSelectedCategoryId(catId);
              const foundCat = categories.find(c => c.id === catId);
              const pType = foundCat?.product_type || foundCat?.productType || '';
              setSelectedType(pType);
              setSelectedBrandId('');
              setSelectedVariant('');
              setSelectedSizeMl('');
              setActiveProductId('');
              onSelectProduct(null);
            }}
            disabled={disabled}
            placeholder="-- Select Category --"
            theme="light"
            className="w-full text-xs font-medium rounded-lg border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all disabled:opacity-50 py-1.5"
          />
        </div>

        {/* Step 2: Brand */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            2. Brand *
          </label>
          <select
            value={selectedBrandId}
            onChange={e => {
              const bId = e.target.value;
              setSelectedBrandId(bId);
              setSelectedVariant('');
              setSelectedSizeMl('');
              if (bId && !selectedCategoryId) {
                const foundBrand = brands.find(b => b.id === bId);
                const bCatId = foundBrand?.category_id || foundBrand?.categoryId;
                if (bCatId) {
                  setSelectedCategoryId(bCatId);
                  const foundCat = categories.find(c => c.id === bCatId);
                  const pType = foundCat?.product_type || foundCat?.productType || 'Spirit';
                  setSelectedType(pType);
                }
              }
            }}
            disabled={disabled}
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all disabled:opacity-50"
          >
            <option value="">-- Select Brand --</option>
            {availableBrands.map(b => (
              <option key={b.id} value={b.id}>
                {b.name || b.brand_name}
              </option>
            ))}
          </select>
        </div>

        {/* Step 3: Variant */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            3. Variant
          </label>
          <select
            value={selectedVariant}
            onChange={e => setSelectedVariant(e.target.value)}
            disabled={disabled || (!selectedBrandId && availableVariants.length === 0)}
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all disabled:opacity-50"
          >
            <option value="">-- All Variants --</option>
            {availableVariants.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Step 4: Bottle Size */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            4. Bottle Size (ml) *
          </label>
          <select
            value={selectedSizeMl}
            onChange={e => setSelectedSizeMl(e.target.value ? Number(e.target.value) : '')}
            disabled={disabled || !selectedType}
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all disabled:opacity-50"
          >
            <option value="">-- Select Size --</option>
            {(availableSizes.length > 0 ? availableSizes : allowedSizesForType).map(s => (
              <option key={s} value={s}>
                {s} ml
              </option>
            ))}
          </select>
        </div>

        {/* Step 5: Packaging */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            5. Packaging
          </label>
          <select
            value={selectedPackaging}
            onChange={e => setSelectedPackaging(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all disabled:opacity-50"
          >
            <option value="">-- All Packaging --</option>
            {availablePackaging.map(pkg => (
              <option key={pkg} value={pkg}>
                {pkg}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Product Identity Badge */}
      {activeProduct && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-amber-50/40 px-3 py-2 rounded-lg border border-amber-200/60">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900">
              {activeProduct.name || activeProduct.product_name}
            </span>
            <span className="text-[11px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              SKU: {activeProduct.sku || 'N/A'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium text-slate-600">
              MRP: <strong className="text-slate-900">₹{activeProduct.mrp_reference || activeProduct.mrp || '0'}</strong>
            </span>
            <span className="font-medium text-slate-600">
              TP Cost: <strong className="text-slate-900">₹{activeProduct.purchase_tp_price || '0'}</strong>
            </span>
            <span className="font-medium text-slate-600">
              SCM Code:{' '}
              <strong className="text-amber-700 font-mono">
                {scmMap[activeProduct.id] || activeProduct.scm_code || 'Pending / Unresolved'}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
