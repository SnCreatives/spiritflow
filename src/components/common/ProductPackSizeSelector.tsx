import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { compareCanonicalBrands } from '../../utils/canonicalBrands';

interface ProductPackSizeSelectorProps {
  products: any[];
  value: string; // product_id
  onChange: (productId: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

const CATEGORY_ORDER = [
  'whisky',
  'rum',
  'vodka',
  'gin',
  'brandy',
  'beer',
  'wine',
  'country liquor',
  'rtd',
  'pre-mixed',
];

const CATEGORY_ICONS: Record<string, string> = {
  whisky: '🥃',
  rum: '🍹',
  vodka: '🍸',
  gin: '🌿',
  brandy: '🍷',
  beer: '🍺',
  wine: '🍇',
  'country liquor': '🏺',
  rtd: '🥤',
};

export const ProductPackSizeSelector: React.FC<ProductPackSizeSelectorProps> = ({
  products = [],
  value,
  onChange,
  required = false,
  disabled = false,
  label = 'Product / Brand',
  className = '',
}) => {
  const currentProduct = products.find(p => p.id === value);
  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    currentProduct?.brand_id || ''
  );

  const [searchText, setSearchText] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Unique brands list from available products
  const allBrands = useMemo(() => {
    const brandMap = new Map<
      string,
      { brand_id: string; brand_name: string; brand_code: string; category_name: string }
    >();
    products.forEach(p => {
      if (p.brand_id && !brandMap.has(p.brand_id)) {
        brandMap.set(p.brand_id, {
          brand_id: p.brand_id,
          brand_name: p.brand_name || p.brand?.name || 'Unbranded',
          brand_code: p.brand_code || '',
          category_name: p.category_name || p.category?.name || 'Other',
        });
      }
    });
    return Array.from(brandMap.values()).sort((a, b) =>
      a.brand_name.localeCompare(b.brand_name, undefined, { sensitivity: 'base' })
    );
  }, [products]);

  const selectedBrand = allBrands.find(b => b.brand_id === selectedBrandId);

  useEffect(() => {
    if (currentProduct) {
      if (currentProduct.brand_id !== selectedBrandId) {
        setSelectedBrandId(currentProduct.brand_id);
      }
    } else if (!value) {
      setSelectedBrandId('');
      setSearchText('');
    }
  }, [value, products]);

  // Sync search text when selected brand changes externally
  useEffect(() => {
    if (selectedBrand) {
      setSearchText(
        `${selectedBrand.brand_name}${
          selectedBrand.brand_code ? ` [Code: ${selectedBrand.brand_code}]` : ''
        }`
      );
    } else if (!value) {
      setSearchText('');
    }
  }, [selectedBrandId, value, selectedBrand]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedBrand) {
          setSearchText(
            `${selectedBrand.brand_name}${
              selectedBrand.brand_code ? ` [Code: ${selectedBrand.brand_code}]` : ''
            }`
          );
        } else if (!value) {
          setSearchText('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedBrand, value]);

  // Filtered & Category-Grouped brands
  const groupedBrands = useMemo(() => {
    const rawQuery = searchText.toLowerCase().trim();
    const isExactSelectedText =
      selectedBrand &&
      rawQuery ===
        `${selectedBrand.brand_name}${
          selectedBrand.brand_code ? ` [Code: ${selectedBrand.brand_code}]` : ''
        }`.toLowerCase();
    const query = isExactSelectedText ? '' : rawQuery;

    const filtered = allBrands.filter(b => {
      if (!query) return true;
      const nameMatch = b.brand_name.toLowerCase().includes(query);
      const codeMatch = b.brand_code.toLowerCase().includes(query);
      const catMatch = b.category_name.toLowerCase().includes(query);
      return nameMatch || codeMatch || catMatch;
    });

    const catGroups = new Map<
      string,
      Array<{ brand_id: string; brand_name: string; brand_code: string; category_name: string }>
    >();

    filtered.forEach(b => {
      const cat = b.category_name || 'Other';
      if (!catGroups.has(cat)) {
        catGroups.set(cat, []);
      }
      catGroups.get(cat)!.push(b);
    });

    const result = Array.from(catGroups.entries()).map(([categoryName, list]) => {
      list.sort((a, b) => compareCanonicalBrands(a.brand_name, b.brand_name));
      const lower = categoryName.toLowerCase();
      const iconKey = Object.keys(CATEGORY_ICONS).find(k => lower.includes(k));
      return {
        categoryName,
        icon: iconKey ? CATEGORY_ICONS[iconKey] : '🏷️',
        brands: list,
      };
    });

    result.sort((g1, g2) => {
      const idx1 = CATEGORY_ORDER.findIndex(k => g1.categoryName.toLowerCase().includes(k));
      const idx2 = CATEGORY_ORDER.findIndex(k => g2.categoryName.toLowerCase().includes(k));
      if (idx1 !== -1 && idx2 !== -1) return idx1 - idx2;
      if (idx1 !== -1) return -1;
      if (idx2 !== -1) return 1;
      return g1.categoryName.localeCompare(g2.categoryName);
    });

    return result;
  }, [allBrands, searchText, selectedBrand]);

  // Products belonging to selected brand
  const brandProducts = products.filter(p => p.brand_id === selectedBrandId);

  const handleBrandSelect = (brand: {
    brand_id: string;
    brand_name: string;
    brand_code: string;
  }) => {
    setSelectedBrandId(brand.brand_id);
    setSearchText(
      `${brand.brand_name}${brand.brand_code ? ` [Code: ${brand.brand_code}]` : ''}`
    );
    setIsOpen(false);

    const matching = products.filter(p => p.brand_id === brand.brand_id);
    if (matching.length > 0) {
      onChange(matching[0].id);
    } else {
      onChange('');
    }
  };

  const handlePackSizeSelect = (productId: string) => {
    onChange(productId);
  };

  return (
    <div className={`space-y-3 ${className}`} ref={containerRef}>
      {/* Searchable Category-Grouped Brand Dropdown */}
      <div className="relative">
        <label className="block text-xs font-medium text-slate-400 mb-1">
          {label} {required && <span className="text-red-400">*</span>}
        </label>

        <div className="relative">
          <input
            type="text"
            placeholder={
              products.length === 0
                ? 'No products available'
                : 'Search brand (e.g. Royal Stag, Kingfisher, Sula)...'
            }
            value={searchText}
            onChange={e => {
              setSearchText(e.target.value);
              setIsOpen(true);
              if (!e.target.value.trim()) {
                setSelectedBrandId('');
                onChange('');
              }
            }}
            onFocus={() => setIsOpen(true)}
            disabled={disabled || products.length === 0}
            className="w-full pl-9 pr-14 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <div className="absolute right-2 top-2 flex items-center space-x-1">
            {searchText && (
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchText('');
                  setSelectedBrandId('');
                  onChange('');
                  setIsOpen(false);
                }}
                className="text-slate-400 hover:text-white p-0.5 bg-slate-800/50 hover:bg-slate-800 rounded"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => !disabled && setIsOpen(!isOpen)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-2">
            {groupedBrands.length === 0 ? (
              <div className="px-4 py-4 text-xs text-slate-400 text-center">
                No brands found
              </div>
            ) : (
              groupedBrands.map(group => (
                <div key={group.categoryName} className="space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase sticky top-0 z-10 bg-slate-950/95 text-amber-400 border-y border-slate-800 flex items-center justify-between select-none">
                    <span>
                      {group.icon} {group.categoryName.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {group.brands.length}
                    </span>
                  </div>
                  {group.brands.map(b => (
                    <div
                      key={b.brand_id}
                      onClick={() => handleBrandSelect(b)}
                      className={`pl-6 pr-3 py-2 text-xs rounded-lg cursor-pointer flex items-center justify-between hover:bg-slate-800 ${
                        selectedBrandId === b.brand_id
                          ? 'bg-amber-500/15 text-amber-400 font-semibold'
                          : 'text-white'
                      }`}
                    >
                      <div>
                        <span className="font-medium">{b.brand_name}</span>
                        {b.brand_code && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-slate-800 text-amber-300 rounded border border-slate-700">
                            Code: {b.brand_code}
                          </span>
                        )}
                      </div>
                      {selectedBrandId === b.brand_id && (
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Pack Size / Variant Dropdown */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Bottle / Pack Size <span className="text-red-400">*</span>
        </label>
        <select
          value={value}
          onChange={e => handlePackSizeSelect(e.target.value)}
          disabled={disabled || !selectedBrandId || brandProducts.length === 0}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
        >
          <option value="">
            {!selectedBrandId
              ? 'Select brand first...'
              : brandProducts.length === 0
              ? 'No pack sizes configured for this product'
              : 'Select Pack Size...'}
          </option>
          {brandProducts.map(p => (
            <option key={p.id} value={p.id}>
              {p.pack_size || p.name || 'Standard'} {p.mrp ? `• MRP ₹${p.mrp}` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
