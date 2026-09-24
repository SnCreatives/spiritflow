import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

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

  // Unique brands list
  const brandMap = new Map<string, { brand_id: string; brand_name: string; brand_code: string; category_name: string }>();
  products.forEach(p => {
    if (p.brand_id && !brandMap.has(p.brand_id)) {
      brandMap.set(p.brand_id, {
        brand_id: p.brand_id,
        brand_name: p.brand_name || 'Unbranded',
        brand_code: p.brand_code || '',
        category_name: p.category_name || '',
      });
    }
  });
  const allBrands = Array.from(brandMap.values()).sort((a, b) => a.brand_name.localeCompare(b.brand_name));

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
      setSearchText(`${selectedBrand.brand_name}${selectedBrand.brand_code ? ` [Code: ${selectedBrand.brand_code}]` : ''}`);
    } else if (!value) {
      setSearchText('');
    }
  }, [selectedBrandId, value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedBrand) {
          setSearchText(`${selectedBrand.brand_name}${selectedBrand.brand_code ? ` [Code: ${selectedBrand.brand_code}]` : ''}`);
        } else if (!value) {
          setSearchText('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedBrand, value]);

  // Filtered brands according to typing (alphabetical / code match)
  const filteredBrands = allBrands.filter(b => {
    if (!searchText.trim()) return true;
    const query = searchText.toLowerCase().trim();
    const nameMatch = b.brand_name.toLowerCase().includes(query);
    const codeMatch = b.brand_code.toLowerCase().includes(query);
    return nameMatch || codeMatch;
  });

  // Products belonging to selected brand
  const brandProducts = products.filter(p => p.brand_id === selectedBrandId);

  const handleBrandSelect = (brand: { brand_id: string; brand_name: string; brand_code: string }) => {
    setSelectedBrandId(brand.brand_id);
    setSearchText(`${brand.brand_name}${brand.brand_code ? ` [Code: ${brand.brand_code}]` : ''}`);
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
      {/* Searchable Brand Dropdown / Typeahead */}
      <div className="relative">
        <label className="block text-xs font-medium text-slate-400 mb-1">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        
        <div className="relative">
          <input
            type="text"
            placeholder={products.length === 0 ? 'No products available' : 'Type brand name or unique code...'}
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
          <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
            {filteredBrands.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">
                No matching brands found
              </div>
            ) : (
              filteredBrands.map(b => (
                <div
                  key={b.brand_id}
                  onClick={() => handleBrandSelect(b)}
                  className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between hover:bg-slate-800 ${
                    selectedBrandId === b.brand_id ? 'bg-amber-500/10 text-amber-400 font-medium' : 'text-white'
                  }`}
                >
                  <div>
                    <span className="font-semibold">{b.brand_name}</span>
                    {b.brand_code && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-slate-800 text-amber-300 rounded border border-slate-700">
                        Code: {b.brand_code}
                      </span>
                    )}
                    {b.category_name && (
                      <span className="ml-2 text-slate-400 text-[10px]">({b.category_name})</span>
                    )}
                  </div>
                  {selectedBrandId === b.brand_id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Pack Size Dropdown */}
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
