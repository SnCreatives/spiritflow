import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, AlertCircle, Loader2, X } from 'lucide-react';
import { Brand, Category } from '../../types';
import { apiGet } from '../../utils/api';
import { useTheme } from '../../utils/ThemeContext';
import { compareCanonicalBrands } from '../../utils/canonicalBrands';

interface UnifiedBrandSelectorProps {
  value: string;
  onChange: (brandId: string, brand?: Brand) => void;
  categories?: Category[];
  categoryId?: string; // Optional external category filter
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  allowClear?: boolean;
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

export const UnifiedBrandSelector: React.FC<UnifiedBrandSelectorProps> = ({
  value,
  onChange,
  categories: propCategories,
  categoryId,
  placeholder = '-- Select Brand --',
  disabled = false,
  className = '',
  allowClear = false,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [brands, setBrands] = useState<Brand[]>([]);
  const [internalCategories, setInternalCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>(categoryId || 'ALL');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    return propCategories && propCategories.length > 0 ? propCategories : internalCategories;
  }, [propCategories, internalCategories]);

  // Sync external categoryId filter when changed
  useEffect(() => {
    setActiveCategoryFilter(categoryId || 'ALL');
  }, [categoryId]);

  // Fetch all active brands from canonical Master API
  useEffect(() => {
    let mounted = true;
    async function fetchAllMasterData() {
      setLoading(true);
      setError(null);
      try {
        const requests: Promise<any>[] = [
          apiGet('/api/brands?limit=500&activeOnly=true'),
        ];
        if (!propCategories || propCategories.length === 0) {
          requests.push(apiGet('/api/categories'));
        }

        const [brandRes, catRes] = await Promise.all(requests);

        if (!mounted) return;

        if (catRes && catRes.success && catRes.data) {
          const catList = Array.isArray(catRes.data)
            ? catRes.data
            : catRes.data.categories || catRes.data.items || [];
          setInternalCategories(Array.isArray(catList) ? catList : []);
        }

        if (brandRes.success && brandRes.data) {
          const list = Array.isArray(brandRes.data)
            ? brandRes.data
            : brandRes.data.items || brandRes.data.brands || [];
          const activeList = (Array.isArray(list) ? list : []).filter(
            (b: Brand) => b.active !== false
          );
          setBrands(activeList);
        } else {
          throw new Error(brandRes.error?.message || 'Failed to load brands');
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Unable to load brands');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    fetchAllMasterData();
    return () => {
      mounted = false;
    };
  }, [propCategories]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Currently selected brand object
  const selectedBrand = useMemo(() => {
    return brands.find(b => b.id === value);
  }, [brands, value]);

  // Sorted categories according to canonical order
  const sortedCategories = useMemo(() => {
    const copy = [...categories];
    copy.sort((c1, c2) => {
      const idx1 = CATEGORY_ORDER.findIndex(k => c1.name.toLowerCase().includes(k));
      const idx2 = CATEGORY_ORDER.findIndex(k => c2.name.toLowerCase().includes(k));
      if (idx1 !== -1 && idx2 !== -1) return idx1 - idx2;
      if (idx1 !== -1) return -1;
      if (idx2 !== -1) return 1;
      return c1.name.localeCompare(c2.name);
    });
    return copy;
  }, [categories]);

  // Group brands by category name & sort alphabetically within each category
  const groupedBrands = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    const filtered = brands.filter(b => {
      if (activeCategoryFilter !== 'ALL' && b.category_id !== activeCategoryFilter) {
        return false;
      }
      if (!query) return true;
      const brandName = (b.name || '').toLowerCase();
      const catName = (
        b.category?.name ||
        categories.find(c => c.id === b.category_id)?.name ||
        ''
      ).toLowerCase();
      return brandName.includes(query) || catName.includes(query);
    });

    const groups: { categoryName: string; categoryId: string; icon: string; brands: Brand[] }[] = [];

    sortedCategories.forEach(cat => {
      if (activeCategoryFilter !== 'ALL' && cat.id !== activeCategoryFilter) {
        return;
      }
      const catBrands = filtered.filter(b => b.category_id === cat.id);
      if (catBrands.length > 0) {
        // Deduplicate by lowercase brand name within category & sort A-Z
        const seen = new Set<string>();
        const uniqueBrands: Brand[] = [];
        catBrands
          .slice()
          .sort((a, b) => compareCanonicalBrands(a.name, b.name))
          .forEach(b => {
            const key = b.name.trim().toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              uniqueBrands.push(b);
            }
          });

        const lowerCat = cat.name.toLowerCase();
        const matchedIconKey = Object.keys(CATEGORY_ICONS).find(k => lowerCat.includes(k));
        groups.push({
          categoryName: cat.name,
          categoryId: cat.id,
          icon: matchedIconKey ? CATEGORY_ICONS[matchedIconKey] : '🏷️',
          brands: uniqueBrands,
        });
      }
    });

    // Fallback if categories list hasn't loaded yet but brands have embedded category
    if (groups.length === 0 && filtered.length > 0) {
      const mapByCat = new Map<string, { name: string; list: Brand[] }>();
      filtered.forEach(b => {
        const cId = b.category_id || 'other';
        const cName = b.category?.name || 'Brands';
        if (!mapByCat.has(cId)) {
          mapByCat.set(cId, { name: cName, list: [] });
        }
        mapByCat.get(cId)!.list.push(b);
      });
      Array.from(mapByCat.entries()).forEach(([cId, info]) => {
        info.list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        const lowerCat = info.name.toLowerCase();
        const matchedIconKey = Object.keys(CATEGORY_ICONS).find(k => lowerCat.includes(k));
        groups.push({
          categoryName: info.name,
          categoryId: cId,
          icon: matchedIconKey ? CATEGORY_ICONS[matchedIconKey] : '🏷️',
          brands: info.list,
        });
      });
    }

    return groups;
  }, [brands, sortedCategories, categories, searchQuery, activeCategoryFilter]);

  const flatSelectableBrands = useMemo(() => {
    return groupedBrands.flatMap(g => g.brands);
  }, [groupedBrands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!disabled) setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev < flatSelectableBrands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev > 0 ? prev - 1 : flatSelectableBrands.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < flatSelectableBrands.length) {
      e.preventDefault();
      const chosen = flatSelectableBrands[highlightedIndex];
      onChange(chosen.id, chosen);
      setIsOpen(false);
    }
  };

  const selectedCategoryName = useMemo(() => {
    if (!selectedBrand) return '';
    return (
      selectedBrand.category?.name ||
      categories.find(c => c.id === selectedBrand.category_id)?.name ||
      ''
    );
  }, [selectedBrand, categories]);

  return (
    <div
      className={`relative ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full px-3.5 py-2 text-sm rounded-xl outline-none transition-all flex items-center justify-between border cursor-pointer ${
          isLight
            ? 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
            : 'bg-slate-950 border-slate-700/80 text-white hover:border-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedBrand ? (
            <>
              <span className="font-medium truncate">{selectedBrand.name}</span>
              {selectedCategoryName && (
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                    isLight
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {selectedCategoryName}
                </span>
              )}
            </>
          ) : (
            <span className={isLight ? 'text-slate-400' : 'text-slate-400'}>
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={e => {
                e.stopPropagation();
                onChange('', undefined);
              }}
              className={`p-0.5 rounded hover:bg-slate-700/40 ${
                isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'
              }`}
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            } ${isLight ? 'text-slate-500' : 'text-slate-400'}`}
          />
        </div>
      </button>

      {/* Dropdown Popup Panel */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 mt-1.5 min-w-[280px] rounded-2xl shadow-2xl border z-50 overflow-hidden flex flex-col max-h-96 transition-all ${
            isLight
              ? 'bg-white border-slate-200 shadow-slate-300/80'
              : 'bg-slate-900 border-slate-700 shadow-black/90'
          }`}
        >
          {/* Search Input */}
          <div
            className={`p-2.5 border-b flex items-center gap-2 ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/90'
            }`}
          >
            <Search className={`w-4 h-4 shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Search brand (e.g. Royal Stag, Kingfisher, Sula)..."
              className={`w-full bg-transparent text-xs outline-none ${
                isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Category Filter Bar */}
          {sortedCategories.length > 0 && (
            <div
              className={`px-2.5 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar ${
                isLight ? 'border-slate-200 bg-slate-100/60' : 'border-slate-800 bg-slate-950/50'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategoryFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : isLight
                    ? 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                All
              </button>
              {sortedCategories.map(cat => {
                const hasBrands = brands.some(b => b.category_id === cat.id);
                if (!hasBrands && activeCategoryFilter !== cat.id) return null;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      activeCategoryFilter === cat.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : isLight
                        ? 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Category-Grouped Brand Options */}
          <div className="overflow-y-auto flex-1 p-1.5 space-y-2.5">
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onChange('', undefined);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  !value
                    ? 'bg-amber-500/15 text-amber-500 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span>{placeholder}</span>
                {!value && <Check className="w-3.5 h-3.5 text-amber-500" />}
              </button>
            )}

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <span>Loading Brand Master...</span>
              </div>
            ) : error ? (
              <div className="py-6 px-4 text-center text-xs text-rose-500 flex flex-col items-center gap-1">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            ) : flatSelectableBrands.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {searchQuery.trim() ? 'No brands found' : 'No brands available'}
              </div>
            ) : (
              groupedBrands.map(group => (
                <div key={group.categoryId} className="space-y-0.5">
                  {/* Non-Selectable Category Header */}
                  <div
                    className={`px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase sticky top-0 z-10 flex items-center justify-between select-none ${
                      isLight
                        ? 'bg-slate-100/95 text-amber-900 border-y border-slate-200'
                        : 'bg-slate-950/95 text-amber-400 border-y border-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{group.icon}</span>
                      <span>{group.categoryName.toUpperCase()}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {group.brands.length}
                    </span>
                  </div>

                  {/* Selectable Brands in Category */}
                  <div className="pt-0.5 space-y-0.5">
                    {group.brands.map(brand => {
                      const isSelected = brand.id === value;
                      const flatIdx = flatSelectableBrands.findIndex(fb => fb.id === brand.id);
                      const isHighlighted = flatIdx === highlightedIndex;

                      return (
                        <button
                          key={brand.id}
                          type="button"
                          onClick={() => {
                            onChange(brand.id, brand);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left pl-6 pr-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? isLight
                                ? 'bg-amber-500/15 text-amber-900 font-semibold'
                                : 'bg-amber-500/20 text-amber-300 font-semibold'
                              : isHighlighted
                              ? isLight
                                ? 'bg-slate-100 text-slate-900'
                                : 'bg-slate-800 text-white'
                              : isLight
                              ? 'text-slate-700 hover:bg-slate-100'
                              : 'text-slate-200 hover:bg-slate-800/70 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{brand.name}</span>
                            {searchQuery.trim() && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                  isLight
                                    ? 'bg-slate-200 text-slate-600'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {group.categoryName}
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
