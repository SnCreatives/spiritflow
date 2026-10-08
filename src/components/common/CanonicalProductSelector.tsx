import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layers, Award, Box, Package, ShieldAlert, CheckCircle2, ChevronDown } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { CategorySelector } from './MasterDataSelectors';
import { SearchableSelect } from './SearchableSelect';

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
  
  // Track the ID that was last synced from props to avoid loops
  const lastPropSyncIdRef = useRef<string | undefined>(undefined);
  // Track if a change is internally driven to avoid redundant updates
  const isInternalChangeRef = useRef<boolean>(false);

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
      if (lastPropSyncIdRef.current === selectedProductId) {
        return;
      }
      
      const match = rawProducts.find(p => p.id === selectedProductId || p.productId === selectedProductId);
      if (match) {
        lastPropSyncIdRef.current = selectedProductId;
        
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
    } else if (!selectedProductId && lastPropSyncIdRef.current) {
      // Clear if externally cleared
      setActiveProductId('');
      setSelectedBrandId('');
      setSelectedVariant('');
      setSelectedSizeMl('');
      setSelectedCategoryId('');
      setSelectedType('');
      lastPropSyncIdRef.current = undefined;
    }
  }, [selectedProductId, rawProducts]);

  // 1. Available Brands for selected Category / Product Type
  const availableBrands = useMemo(() => {
    let filtered = brands;
    if (selectedCategoryId) {
      const direct = brands.filter(b => (b.category_id || b.categoryId) === selectedCategoryId);
      if (direct.length > 0) {
        filtered = direct;
      } else {
        const targetCat = categories.find(c => c.id === selectedCategoryId);
        if (targetCat) {
          const lowerName = (targetCat.name || '').toLowerCase();
          filtered = brands.filter(b => {
            const bCatId = b.category_id || b.categoryId;
            const bCat = categories.find(c => c.id === bCatId);
            if (!bCat) return false;
            if (lowerName.includes('beer') && bCat.name.toLowerCase().includes('beer')) return true;
            if (lowerName.includes('wine') && bCat.name.toLowerCase().includes('wine')) return true;
            return (bCat.product_type || bCat.productType) === (targetCat.product_type || targetCat.productType);
          });
        }
      }
    } else if (selectedType) {
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

      filtered = brands.filter(b => {
        const bCatId = b.category_id || b.categoryId;
        return !bCatId || catIdsForType.includes(bCatId);
      });
    }

    return filtered.map(b => ({
      id: b.id,
      name: b.name || b.brand_name
    }));
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

    return Array.from(variants).sort().map(v => ({ id: v, name: v }));
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
    
    // If this change was triggered by an external prop sync, skip resolution update back to parent
    if (lastPropSyncIdRef.current === activeProductId && !isInternalChangeRef.current) {
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
        
        // Notify parent of change
        onSelectProduct(detail);
        isInternalChangeRef.current = false;
      }
    } else if (matchingProducts.length === 1 && !selectedVariant && !selectedSizeMl && isInternalChangeRef.current) {
      // Auto-select single exact product if variant/size not yet specified AND user just picked brand
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

  return (
    <div className={`transition-all duration-300 ${compact ? 'py-1' : 'bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-4'}`}>
      {!compact && (
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-50">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-500/20">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Master Catalog Selection</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">Select products from canonical excise master</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Brand */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">
            Brand Identity
          </label>
          <SearchableSelect
            options={availableBrands}
            value={selectedBrandId}
            onChange={val => {
              isInternalChangeRef.current = true;
              setSelectedBrandId(val);
              setSelectedVariant('');
              setSelectedSizeMl('');
              if (val && !selectedCategoryId) {
                const foundBrand = brands.find(b => b.id === val);
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
            placeholder="Select Brand"
          />
        </div>

        {/* Variant */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">
            Product Variant
          </label>
          <SearchableSelect
            options={availableVariants}
            value={selectedVariant}
            onChange={val => {
              isInternalChangeRef.current = true;
              setSelectedVariant(val);
            }}
            disabled={disabled || (!selectedBrandId && availableVariants.length === 0)}
            placeholder="Select Variant"
          />
        </div>

        {/* Bottle Size */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">
            Volume (ML)
          </label>
          <SearchableSelect
            options={(availableSizes.length > 0 ? availableSizes : allowedSizesForType).map(s => ({
              id: String(s),
              name: `${s} ml`
            }))}
            value={String(selectedSizeMl)}
            onChange={val => {
              isInternalChangeRef.current = true;
              setSelectedSizeMl(val ? Number(val) : '');
            }}
            disabled={disabled}
            placeholder="Select Size"
          />
        </div>

        {/* Packaging */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 ml-1">
            Package Type
          </label>
          <SearchableSelect
            options={availablePackaging.map(pkg => ({ id: pkg, name: pkg }))}
            value={selectedPackaging}
            onChange={val => {
              isInternalChangeRef.current = true;
              setSelectedPackaging(val);
            }}
            disabled={disabled}
            placeholder="Select Packaging"
          />
        </div>
      </div>
    </div>
  );
};

