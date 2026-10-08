import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Tag, Package, Box, Loader2 } from 'lucide-react';
import { useMasterData } from '../../hooks/useMasterData';
import { CategorySelector } from './MasterDataSelectors';
import { apiGet } from '../../utils/api';

import { SearchableSelect } from './SearchableSelect';

interface ProductPackSizeSelectorProps {
  value: string; // product_id
  onChange: (productId: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const ProductPackSizeSelector: React.FC<ProductPackSizeSelectorProps> = ({
  value,
  onChange,
  required = false,
  disabled = false,
  label = 'Product / Brand Selection',
  className = '',
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');

  const {
    categories,
    brands,
    variants,
    products,
    loading,
  } = useMasterData({
    categoryId: selectedCategoryId,
    brandId: selectedBrandId,
    variant: selectedVariant,
  });

  const currentProduct = useMemo(() => products.find(p => p.id === value), [products, value]);

  // Sync state when external value changes (edit mode or initial load)
  useEffect(() => {
    if (currentProduct) {
      setSelectedCategoryId(currentProduct.category_id || (currentProduct as any).categoryId || '');
      setSelectedBrandId(currentProduct.brand_id || (currentProduct as any).brandId || '');
      setSelectedVariant(currentProduct.variant || '');
    } else if (value && !selectedBrandId) {
      // Direct lookup if value is set externally
      apiGet(`/api/products/${value}`).then((res: any) => {
        if (res.success && res.data) {
          const p = res.data;
          setSelectedCategoryId(p.category_id || p.categoryId || '');
          setSelectedBrandId(p.brand_id || p.brandId || '');
          setSelectedVariant(p.variant || '');
        }
      }).catch(() => {});
    }
  }, [currentProduct, value, selectedBrandId]);

  // Auto-select variant if only 1 exists
  useEffect(() => {
    if (variants.length === 1 && !selectedVariant) {
      setSelectedVariant(variants[0]);
    }
  }, [variants, selectedVariant]);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    setSelectedBrandId('');
    setSelectedVariant('');
    onChange('');
  };

  const handleBrandChange = (bId: string) => {
    setSelectedBrandId(bId);
    setSelectedVariant('');
    onChange('');

    // If category was not selected, auto-resolve category from brand
    if (bId && !selectedCategoryId) {
      const matchBrand = brands.find(b => b.id === bId);
      const bCatId = matchBrand?.category_id || (matchBrand as any)?.categoryId;
      if (bCatId) {
        setSelectedCategoryId(bCatId);
      }
    }
  };

  const handleVariantChange = (v: string) => {
    setSelectedVariant(v);
    onChange('');
  };

  const handleProductChange = (pid: string) => {
    onChange(pid);
  };

  // Products to display in Tier 4
  const displayProducts = useMemo(() => {
    if (selectedVariant) {
      const filtered = products.filter(p => (p.variant || (p as any).product_name || p.name) === selectedVariant);
      if (filtered.length > 0) return filtered;
    }
    return products;
  }, [products, selectedVariant]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-300">
          {label} {required && <span className="text-amber-400">*</span>}
        </label>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 shadow-inner">
        {/* Tier 1: Category */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" />
            <span>1. Category</span>
          </label>
          <CategorySelector
            value={selectedCategoryId}
            onChange={handleCategoryChange}
            disabled={disabled}
            placeholder="Select Category..."
            theme="dark"
            className="w-full px-2.5 py-2 text-xs"
          />
        </div>

        {/* Tier 2: Brand */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Tag className="w-3 h-3 text-cyan-400" />
            <span>2. Brand</span>
          </label>
          <SearchableSelect
            options={brands.map(b => ({ id: b.id, name: b.name || (b as any).brand_name }))}
            value={selectedBrandId}
            onChange={handleBrandChange}
            disabled={disabled}
            placeholder={brands.length === 0 ? 'Loading Brands...' : 'Select Brand'}
          />
        </div>

        {/* Tier 3: Variant */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Package className="w-3 h-3 text-emerald-400" />
            <span>3. Variant</span>
          </label>
          <SearchableSelect
            options={variants.map(v => ({ id: v, name: v }))}
            value={selectedVariant}
            onChange={handleVariantChange}
            disabled={disabled || !selectedBrandId}
            placeholder={!selectedBrandId ? 'Select Brand first' : variants.length === 0 ? 'Standard' : 'All Variants'}
          />
        </div>

        {/* Tier 4: Product (Pack Size) */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Box className="w-3 h-3 text-purple-400" />
            <span>4. Pack Size & MRP</span>
          </label>
          <SearchableSelect
            options={displayProducts.map(p => ({
              id: p.id,
              name: `${p.name || (p as any).product_name || p.variant} ${p.mrp ? `• MRP ₹${p.mrp}` : ''}`
            }))}
            value={value}
            onChange={handleProductChange}
            disabled={disabled || !selectedBrandId}
            placeholder={!selectedBrandId ? 'Select Brand first' : displayProducts.length === 0 ? 'No products' : 'Select Pack Size'}
          />
        </div>
      </div>
    </div>
  );
};
