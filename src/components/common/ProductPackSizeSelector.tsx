import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Tag, Package, Box } from 'lucide-react';
import { compareCanonicalBrands } from '../../utils/canonicalBrands';
import { apiGet } from '../../utils/api';

interface ProductPackSizeSelectorProps {
  products: any[];
  value: string; // product_id
  onChange: (productId: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const ProductPackSizeSelector: React.FC<ProductPackSizeSelectorProps> = ({
  products = [],
  value,
  onChange,
  required = false,
  disabled = false,
  label = 'Product / Brand Selection',
  className = '',
}) => {
  const currentProduct = useMemo(() => products.find(p => p.id === value), [products, value]);

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedVariantName, setSelectedVariantName] = useState<string>('');

  // 1. Fetch Categories from canonical Category Master API on mount
  useEffect(() => {
    let mounted = true;
    async function loadCategories() {
      try {
        const res = await apiGet('/api/categories');
        if (!mounted) return;
        if (res && res.success && Array.isArray(res.data)) {
          setCategories(res.data.map((c: any) => ({ id: c.id, name: c.name })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
        } else if (Array.isArray(res)) {
          setCategories(res.map((c: any) => ({ id: c.id, name: c.name })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
        } else {
          extractCategoriesFromProducts();
        }
      } catch {
        if (mounted) extractCategoriesFromProducts();
      }
    }
    loadCategories();
    return () => { mounted = false; };
  }, [products]);

  const extractCategoriesFromProducts = () => {
    const map = new Map<string, { id: string; name: string }>();
    products.forEach(p => {
      const catId = p.category_id || p.category?.id;
      const catName = p.category_name || p.category?.name || 'Uncategorized';
      if (catId && !map.has(catId)) {
        map.set(catId, { id: catId, name: catName });
      }
    });
    setCategories(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
  };

  // 2. Fetch Brands when selectedCategoryId changes
  useEffect(() => {
    let mounted = true;
    async function loadBrands() {
      if (!selectedCategoryId) {
        setBrands([]);
        return;
      }
      try {
        const res = await apiGet(`/api/brands?categoryId=${selectedCategoryId}&limit=500&activeOnly=true`);
        if (!mounted) return;
        const brandList = res?.success && res.data ? (Array.isArray(res.data) ? res.data : res.data.items || res.data.brands || []) : [];
        if (brandList.length > 0) {
          const mapped = brandList.map((b: any) => ({
            id: b.id,
            name: b.brand_name || b.name,
            code: b.registration_reference || '',
          })).sort((a: any, b: any) => compareCanonicalBrands(a.name, b.name));
          setBrands(mapped);
        } else {
          extractBrandsFromProducts();
        }
      } catch {
        if (mounted) extractBrandsFromProducts();
      }
    }
    loadBrands();
    return () => { mounted = false; };
  }, [selectedCategoryId, products]);

  const extractBrandsFromProducts = () => {
    if (!selectedCategoryId) {
      setBrands([]);
      return;
    }
    const map = new Map<string, { id: string; name: string; code: string }>();
    products.forEach(p => {
      const catId = p.category_id || p.category?.id;
      if (catId === selectedCategoryId) {
        const bId = p.brand_id || p.brand?.id;
        const bName = p.brand_name || p.brand?.brand_name || p.brand?.name || 'Unbranded';
        const bCode = p.brand_code || p.brand?.registration_reference || '';
        if (bId && !map.has(bId)) {
          map.set(bId, { id: bId, name: bName, code: bCode });
        }
      }
    });
    setBrands(Array.from(map.values()).sort((a, b) => compareCanonicalBrands(a.name, b.name)));
  };

  // Sync state when external value changes (edit mode or initial load)
  useEffect(() => {
    if (currentProduct) {
      const catId = currentProduct.category_id || currentProduct.category?.id || '';
      const bId = currentProduct.brand_id || currentProduct.brand?.id || '';
      const vName = currentProduct.product_name || currentProduct.name || '';

      setSelectedCategoryId(catId);
      setSelectedBrandId(bId);
      setSelectedVariantName(vName);
    } else if (!value) {
      setSelectedCategoryId('');
      setSelectedBrandId('');
      setSelectedVariantName('');
    }
  }, [value, currentProduct]);

  // 3. Variants / Product Names List (filtered by selected Category & Brand)
  const variants = useMemo(() => {
    if (!selectedCategoryId || !selectedBrandId) return [];
    const set = new Set<string>();
    products.forEach(p => {
      const catId = p.category_id || p.category?.id;
      const bId = p.brand_id || p.brand?.id;
      if (catId === selectedCategoryId && bId === selectedBrandId) {
        const vName = p.product_name || p.name;
        if (vName) set.add(vName);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, selectedCategoryId, selectedBrandId]);

  // 4. Pack Sizes List (filtered by selected Category, Brand, & Variant Name)
  const packSizes = useMemo(() => {
    if (!selectedCategoryId || !selectedBrandId || !selectedVariantName) return [];
    return products.filter(p => {
      const catId = p.category_id || p.category?.id;
      const bId = p.brand_id || p.brand?.id;
      const vName = p.product_name || p.name;
      return catId === selectedCategoryId && bId === selectedBrandId && vName === selectedVariantName;
    }).sort((a, b) => (a.pack_size || '').localeCompare(b.pack_size || ''));
  }, [products, selectedCategoryId, selectedBrandId, selectedVariantName]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catId = e.target.value;
    setSelectedCategoryId(catId);
    setSelectedBrandId('');
    setSelectedVariantName('');
    onChange('');
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bId = e.target.value;
    setSelectedBrandId(bId);
    setSelectedVariantName('');
    onChange('');
  };

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vName = e.target.value;
    setSelectedVariantName(vName);
    
    const matchingPackSizes = products.filter(p => {
      const catId = p.category_id || p.category?.id;
      const bId = p.brand_id || p.brand?.id;
      const v = p.product_name || p.name;
      return catId === selectedCategoryId && bId === selectedBrandId && v === vName;
    });

    if (matchingPackSizes.length === 1) {
      onChange(matchingPackSizes[0].id);
    } else {
      onChange('');
    }
  };

  const handlePackSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    onChange(pId);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-xs font-semibold text-slate-300">
        {label} {required && <span className="text-amber-400">*</span>}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 shadow-inner">
        {/* Tier 1: Category */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" />
            <span>1. Category</span>
          </label>
          <select
            value={selectedCategoryId}
            onChange={handleCategoryChange}
            disabled={disabled || categories.length === 0}
            className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
          >
            <option value="">Select Category...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tier 2: Brand */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Tag className="w-3 h-3 text-cyan-400" />
            <span>2. Brand</span>
          </label>
          <select
            value={selectedBrandId}
            onChange={handleBrandChange}
            disabled={disabled || !selectedCategoryId || brands.length === 0}
            className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 disabled:opacity-50"
          >
            <option value="">{!selectedCategoryId ? 'Select Category first' : 'Select Brand...'}</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} {b.code ? `[${b.code}]` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Tier 3: Variant / Product Name */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Package className="w-3 h-3 text-emerald-400" />
            <span>3. Variant / Product</span>
          </label>
          <select
            value={selectedVariantName}
            onChange={handleVariantChange}
            disabled={disabled || !selectedBrandId || variants.length === 0}
            className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 disabled:opacity-50"
          >
            <option value="">{!selectedBrandId ? 'Select Brand first' : 'Select Variant...'}</option>
            {variants.map((vName, idx) => (
              <option key={idx} value={vName}>
                {vName}
              </option>
            ))}
          </select>
        </div>

        {/* Tier 4: Pack Size & Pricing */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Box className="w-3 h-3 text-purple-400" />
            <span>4. Pack Size & MRP</span>
          </label>
          <select
            value={value}
            onChange={handlePackSizeChange}
            disabled={disabled || !selectedVariantName || packSizes.length === 0}
            className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 disabled:opacity-50 font-medium text-amber-300"
          >
            <option value="">{!selectedVariantName ? 'Select Variant first' : 'Select Pack Size...'}</option>
            {packSizes.map(p => (
              <option key={p.id} value={p.id}>
                {p.pack_size || 'Standard'} {p.mrp ? `• MRP ₹${p.mrp}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
