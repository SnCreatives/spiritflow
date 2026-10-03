import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Award, Box, Package, ShieldAlert, CheckCircle2, ChevronDown } from 'lucide-react';
import { apiGet } from '../../utils/api';

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
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [selectedSizeMl, setSelectedSizeMl] = useState<number | ''>('');
  const [selectedPackaging, setSelectedPackaging] = useState<string>('');
  const [activeProductId, setActiveProductId] = useState<string>(selectedProductId || '');

  // Fetch product catalog data once on mount
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      setLoading(true);
      try {
        const [prodRes, catRes, brandRes, scmRes] = await Promise.all([
          apiGet('/api/products/selection'),
          apiGet('/api/categories'),
          apiGet('/api/brands'),
          apiGet('/api/scm-codes?limit=500'),
        ]);

        if (isMounted) {
          const prods = prodRes.data?.items || prodRes.data || [];
          setRawProducts(prods);

          const cats = catRes.data?.categories || catRes.data || [];
          setCategories(cats);

          const brs = brandRes.data?.brands || brandRes.data?.items || brandRes.data || [];
          setBrands(brs);

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
      const match = rawProducts.find(p => p.id === selectedProductId);
      if (match) {
        setActiveProductId(match.id);
        const pType = match.category?.product_type || match.product_type || 'Spirit';
        setSelectedType(pType);
        setSelectedBrandId(match.brand_id || '');
        setSelectedVariant(match.variant || match.product_name || match.name);
        setSelectedSizeMl(match.volume_ml || match.pack_size?.volume_ml || '');
        setSelectedPackaging(match.pack_type || 'Bottle');
      }
    }
  }, [selectedProductId, rawProducts]);

  // 1. Available Brands for selected Product Type
  const availableBrands = useMemo(() => {
    if (!selectedType) return brands;
    const catIdsForType = categories
      .filter(c => (c.product_type || '').toLowerCase() === selectedType.toLowerCase() || (c.name || '').toLowerCase().includes(selectedType.toLowerCase()))
      .map(c => c.id);

    return brands.filter(b => !b.category_id || catIdsForType.includes(b.category_id));
  }, [brands, categories, selectedType]);

  // 2. Filtered products matching Type & Brand
  const matchingProducts = useMemo(() => {
    return rawProducts.filter(p => {
      const pType = p.category?.product_type || p.product_type || '';
      if (selectedType && pType.toLowerCase() !== selectedType.toLowerCase()) return false;
      if (selectedBrandId && p.brand_id !== selectedBrandId) return false;
      return true;
    });
  }, [rawProducts, selectedType, selectedBrandId]);

  // 3. Available Variants
  const availableVariants = useMemo(() => {
    const variants = new Set<string>();
    matchingProducts.forEach(p => {
      const v = p.variant || p.product_name || p.name;
      if (v) variants.add(v);
    });
    return Array.from(variants);
  }, [matchingProducts]);

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
      const vol = Number(p.volume_ml || p.pack_size?.volume_ml);
      if (vol && allowedSizesForType.includes(vol)) {
        sizes.add(vol);
      }
    });
    return Array.from(sizes).sort((a, b) => b - a);
  }, [matchingProducts, allowedSizesForType]);

  // 6. Available Packaging Types
  const availablePackaging = useMemo(() => {
    const pkgs = new Set<string>(['Bottle', 'Can', 'Case']);
    matchingProducts.forEach(p => {
      if (p.pack_type) pkgs.add(p.pack_type);
    });
    return Array.from(pkgs);
  }, [matchingProducts]);

  // Re-resolve active product whenever cascade values change
  useEffect(() => {
    if (!selectedType || !selectedBrandId) {
      if (activeProductId) {
        setActiveProductId('');
        onSelectProduct(null);
      }
      return;
    }

    const resolved = matchingProducts.find(p => {
      const vol = Number(p.volume_ml || p.pack_size?.volume_ml);
      const variant = p.variant || p.product_name || p.name;
      const pkg = p.pack_type || 'Bottle';

      const matchVar = !selectedVariant || variant === selectedVariant;
      const matchSize = !selectedSizeMl || vol === Number(selectedSizeMl);
      const matchPkg = !selectedPackaging || pkg.toLowerCase() === selectedPackaging.toLowerCase();

      return matchVar && matchSize && matchPkg;
    });

    if (resolved) {
      setActiveProductId(resolved.id);
      const detail: SelectedProductDetail = {
        productId: resolved.id,
        productName: resolved.name || resolved.product_name,
        sku: resolved.sku || '',
        productType: selectedType,
        categoryId: resolved.category_id || '',
        categoryName: resolved.category?.name || '',
        brandId: resolved.brand_id || selectedBrandId,
        brandName: resolved.brand?.name || resolved.brand?.brand_name || '',
        variant: resolved.variant || resolved.name,
        packSizeId: resolved.pack_size_id || '',
        volumeMl: Number(resolved.volume_ml || resolved.pack_size?.volume_ml || selectedSizeMl || 750),
        packType: resolved.pack_type || selectedPackaging || 'Bottle',
        mrp: Number(resolved.mrp_reference || resolved.mrp || 0),
        purchaseTpPrice: Number(resolved.purchase_tp_price || 0),
        scmCode: scmMap[resolved.id] || resolved.scm_code || undefined,
      };
      onSelectProduct(detail);
    } else if (matchingProducts.length === 1 && (!selectedSizeMl || !selectedPackaging)) {
      // Auto-select single exact product
      const sole = matchingProducts[0];
      setActiveProductId(sole.id);
      const vol = Number(sole.volume_ml || sole.pack_size?.volume_ml || 750);
      setSelectedSizeMl(vol);
      setSelectedPackaging(sole.pack_type || 'Bottle');
      setSelectedVariant(sole.variant || sole.product_name || sole.name);

      const detail: SelectedProductDetail = {
        productId: sole.id,
        productName: sole.name || sole.product_name,
        sku: sole.sku || '',
        productType: selectedType,
        categoryId: sole.category_id || '',
        categoryName: sole.category?.name || '',
        brandId: sole.brand_id || selectedBrandId,
        brandName: sole.brand?.name || sole.brand?.brand_name || '',
        variant: sole.variant || sole.name,
        packSizeId: sole.pack_size_id || '',
        volumeMl: vol,
        packType: sole.pack_type || 'Bottle',
        mrp: Number(sole.mrp_reference || sole.mrp || 0),
        purchaseTpPrice: Number(sole.purchase_tp_price || 0),
        scmCode: scmMap[sole.id] || sole.scm_code || undefined,
      };
      onSelectProduct(detail);
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
        {/* Step 1: Product Type */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            1. Product Type *
          </label>
          <div className="relative">
            <select
              value={selectedType}
              onChange={e => {
                setSelectedType(e.target.value);
                setSelectedBrandId('');
                setSelectedVariant('');
                setSelectedSizeMl('');
              }}
              disabled={disabled}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all disabled:opacity-50"
            >
              <option value="">-- Select Type --</option>
              {PRODUCT_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2: Brand */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            2. Brand *
          </label>
          <select
            value={selectedBrandId}
            onChange={e => {
              setSelectedBrandId(e.target.value);
              setSelectedVariant('');
              setSelectedSizeMl('');
            }}
            disabled={disabled || !selectedType}
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
            disabled={disabled || !selectedBrandId}
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
