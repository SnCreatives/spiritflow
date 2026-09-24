import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Package, Tag, FileText, ArrowRight, ShieldCheck, RefreshCw, ArrowLeft, ExternalLink } from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { translations } from '../../utils/i18n';

interface SearchResult {
  type: 'product' | 'category' | 'purchase' | 'excise' | 'supplier' | 'batch';
  id: string;
  title: string;
  subtitle: string;
  product_name?: string;
  brand_name?: string;
  category?: string;
  manufacturer?: string;
  pack_size?: string;
  sku?: string;
  current_stock?: number;
  status?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: SupportedLanguage;
  onRouteChange?: (route: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  language,
  onRouteChange,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultItemRefs = useRef<(HTMLButtonElement | HTMLDivElement | null)[]>([]);
  const t = translations[language];

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Max 8 immediate results displayed in dropdown, + 1 slot for "View All" if results > 8
  const displayedResults = results.slice(0, 8);
  const hasMoreResults = results.length > 8;
  const totalSelectableCount = displayedResults.length + (hasMoreResults ? 1 : 0);

  // Auto scroll highlighted item into view
  useEffect(() => {
    if (resultItemRefs.current[selectedIndex]) {
      resultItemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Perform search debounced with AbortController for stale request cancellation
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const storedToken = sessionStorage.getItem('liquorflow_session_token') || localStorage.getItem('liquorflow_session_token');
        const headers: Record<string, string> = {};
        if (storedToken) headers['x-session-token'] = storedToken;

        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
          credentials: 'include',
          headers,
        });

        const data = await res.json();
        if (data.success && data.data?.results) {
          setResults(data.data.results);
          setSelectedIndex(0);
        } else {
          setResults([]);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Handle item selection action
  const handleSelectResult = (item?: SearchResult) => {
    onClose();
    if (!onRouteChange) return;

    if (!item) {
      // "View All" or generic search
      onRouteChange('/inventory');
      return;
    }

    // Direct navigation based on result type
    switch (item.type) {
      case 'product':
        onRouteChange(`/inventory?search=${encodeURIComponent(item.product_name || item.title)}`);
        break;
      case 'category':
        onRouteChange(`/products?categoryId=${item.id}`);
        break;
      case 'purchase':
        onRouteChange('/purchases');
        break;
      case 'supplier':
        onRouteChange('/purchases');
        break;
      case 'batch':
        onRouteChange('/batches');
        break;
      case 'excise':
        onRouteChange('/excise');
        break;
      default:
        onRouteChange('/inventory');
    }
  };

  // Handle keyboard shortcuts (Esc, Arrow keys, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalSelectableCount - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex === displayedResults.length && hasMoreResults) {
          handleSelectResult();
        } else if (displayedResults[selectedIndex]) {
          handleSelectResult(displayedResults[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, displayedResults, selectedIndex, totalSelectableCount, hasMoreResults, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Mobile / Desktop Header & Search Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            if (displayedResults[selectedIndex]) {
              handleSelectResult(displayedResults[selectedIndex]);
            } else {
              handleSelectResult();
            }
          }}
          className="flex items-center px-3.5 py-3 border-b border-slate-800 gap-2 shrink-0 bg-slate-900"
        >
          {/* Mobile Back Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 sm:hidden shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Search className="w-5 h-5 text-amber-400 shrink-0 hidden sm:block" />

          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search complete Product Master (SKU, Brand, etc)..."
            className="w-full bg-transparent text-white placeholder-slate-400 text-sm focus:outline-none py-1.5"
          />

          {loading && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0 mr-1" />}

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                inputRef.current?.focus();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 rounded-lg shrink-0"
          >
            <kbd className="font-mono text-[10px]">ESC</kbd>
          </button>
        </form>

        {/* Results Container */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {loading && displayedResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
              <span>Searching Product Master...</span>
            </div>
          ) : displayedResults.length > 0 ? (
            <>
              {displayedResults.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    ref={el => { resultItemRefs.current[idx] = el; }}
                    onClick={() => handleSelectResult(item)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 min-h-[52px] ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        {item.type === 'product' && <Package className="w-4 h-4 text-emerald-400" />}
                        {item.type === 'category' && <Tag className="w-4 h-4 text-amber-400" />}
                        {item.type === 'purchase' && <FileText className="w-4 h-4 text-sky-400" />}
                        {item.type === 'excise' && <ShieldCheck className="w-4 h-4 text-cyan-400" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white truncate">{item.title}</span>

                          {item.type === 'product' && (
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                (item.current_stock || 0) > 0
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              }`}
                            >
                              Stock: {item.current_stock ?? 0}
                            </span>
                          )}

                          {item.type === 'product' && item.status && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {item.status}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 mt-0.5 truncate">{item.subtitle}</div>
                      </div>
                    </div>

                    <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-amber-400 translate-x-0.5' : 'text-slate-600'}`} />
                  </button>
                );
              })}

              {/* View All Results option if total results > 8 */}
              {hasMoreResults && (
                <button
                  ref={el => { resultItemRefs.current[displayedResults.length] = el; }}
                  onClick={() => handleSelectResult()}
                  className={`w-full text-center py-3 px-4 rounded-xl border border-dashed transition-all flex items-center justify-center gap-2 text-xs font-semibold ${
                    selectedIndex === displayedResults.length
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'border-slate-700 text-amber-400 hover:bg-slate-800/80'
                  }`}
                >
                  <span>View all {results.length} matching products in Product Master</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : query.trim() ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">No matching products found</p>
              <p>No products found in Maharashtra master catalog for "{query}".</p>
            </div>
          ) : (
            <div className="py-8 px-4 text-xs text-slate-400 space-y-2 text-center">
              <p className="font-semibold text-slate-300">Search Product Master</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Type product name (e.g. Royal Stag, Blenders Pride), brand, category, SKU, pack size, or manufacturer.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500 flex-wrap">
                <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">↑↓ Navigate</span>
                <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">Enter Select</span>
                <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">Esc Close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

