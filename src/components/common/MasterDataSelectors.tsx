import React from 'react';
import { useCategories, useBrands, useVariants, useProducts, useMasterData } from '../../hooks/useMasterData';
import { Category, Brand, Product } from '../../types';

import { SearchableSelect } from './SearchableSelect';

export interface SelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  theme?: 'light' | 'dark';
}

export interface CategorySelectorProps extends SelectorProps {
  includeAllOption?: boolean;
  allLabel?: string;
  showProductTypeGroups?: boolean;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  value,
  onChange,
  disabled,
  className = '',
  placeholder = '-- Select Category --',
  required,
  includeAllOption = false,
  allLabel = 'All Categories',
  theme = 'light',
  showProductTypeGroups = true,
}) => {
  const { categories, loading } = useCategories();

  const themeClasses =
    theme === 'dark'
      ? 'bg-slate-950 border border-slate-700/80 text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
      : 'bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-amber-500';

  // Group categories by canonical Product Type
  const groupedCategories = React.useMemo(() => {
    if (!showProductTypeGroups) return null;
    const groups: Record<string, Category[]> = {};
    categories.forEach(c => {
      const pType = (c as any).product_type || (c as any).productType || 'Spirit';
      if (!groups[pType]) groups[pType] = [];
      groups[pType].push(c);
    });
    return groups;
  }, [categories, showProductTypeGroups]);

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled || loading}
      required={required}
      className={`w-full px-3 py-2 text-sm rounded-xl focus:outline-none disabled:opacity-50 transition-all ${themeClasses} ${className}`}
    >
      {includeAllOption ? (
        <option value="">{loading ? 'Loading...' : allLabel}</option>
      ) : (
        <option value="">{loading ? 'Loading...' : placeholder}</option>
      )}

      {groupedCategories ? (
        Object.entries(groupedCategories).map(([groupName, groupCats]) => (
          <optgroup key={groupName} label={groupName} className={theme === 'dark' ? 'bg-slate-900 text-amber-400' : 'bg-slate-50 text-slate-800'}>
            {groupCats.map(cat => (
              <option key={cat.id} value={cat.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>
                {cat.name} ({cat.code})
              </option>
            ))}
          </optgroup>
        ))
      ) : (
        categories.map(cat => (
          <option key={cat.id} value={cat.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>
            {cat.name} ({cat.code})
          </option>
        ))
      )}
    </select>
  );
};

export interface BrandSelectorProps extends SelectorProps {
  categoryId?: string;
  includeAllOption?: boolean;
  allLabel?: string;
}

export const BrandSelector: React.FC<BrandSelectorProps> = ({
  value,
  onChange,
  disabled,
  className = '',
  placeholder = '-- Select Brand --',
  required,
  categoryId,
  theme = 'light',
  includeAllOption = false,
  allLabel = 'All Brands',
}) => {
  const { brands, loading } = useBrands(categoryId);

  return (
    <SearchableSelect
      options={brands.map(b => ({ id: b.id, name: b.name || (b as any).brand_name }))}
      value={value}
      onChange={onChange}
      disabled={disabled || (loading && brands.length === 0)}
      placeholder={loading && brands.length === 0 ? 'Loading...' : placeholder}
      className={className}
    />
  );
};

export const VariantSelector: React.FC<SelectorProps & { brandId?: string }> = ({
  value,
  onChange,
  disabled,
  className = '',
  placeholder = '-- Select Variant --',
  required,
  brandId,
  theme = 'light',
}) => {
  const { variants, loading } = useVariants(brandId);

  return (
    <SearchableSelect
      options={variants.map(v => ({ id: v, name: v }))}
      value={value}
      onChange={onChange}
      disabled={disabled || loading || !brandId}
      placeholder={loading ? 'Loading...' : !brandId ? 'Select Brand first' : placeholder}
      className={className}
    />
  );
};

export const ProductSelector: React.FC<SelectorProps & { categoryId?: string; brandId?: string; variant?: string }> = ({
  value,
  onChange,
  disabled,
  className = '',
  placeholder = '-- Select Product --',
  required,
  categoryId,
  brandId,
  variant,
  theme = 'light',
}) => {
  const { products, loading } = useProducts({ categoryId, brandId, variant });

  return (
    <SearchableSelect
      options={products.map(p => ({ 
        id: p.id, 
        name: `${p.name || p.variant} (${p.sku})` 
      }))}
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      placeholder={loading ? 'Loading...' : placeholder}
      className={className}
    />
  );
};

export const ProductTypeSelector: React.FC<SelectorProps> = ({
  value,
  onChange,
  disabled,
  className = '',
  placeholder = '-- Select Product Type --',
  required,
}) => {
  const { productTypes, loading } = useMasterData();

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled || loading}
      required={required}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50 transition-all ${className}`}
    >
      <option value="">{loading ? 'Loading...' : placeholder}</option>
      {productTypes.map(t => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
};
