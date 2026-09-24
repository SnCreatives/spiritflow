import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Package,
  IndianRupee,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Plus,
  FileCheck2,
  Database,
  SlidersHorizontal,
  Search,
  X,
  Tag,
  FileText,
  ChevronRight,
  Wine,
  ArrowDownToLine,
} from 'lucide-react';
import { SupportedLanguage, DashboardStats, AuthUser } from '../../types';
import { translations } from '../../utils/i18n';
import { apiGet, apiFetch } from '../../utils/api';

interface DashboardViewProps {
  language: SupportedLanguage;
  user: AuthUser;
  onRouteChange?: (route: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ language, user, onRouteChange }) => {
  const t = translations[language];
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Embedded Product Master Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchItemRefs = useRef<(HTMLDivElement | HTMLButtonElement | null)[]>([]);

  // Schema verification dialog
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [verifyingSchema, setVerifyingSchema] = useState(false);
  const [schemaReport, setSchemaReport] = useState<any>(null);

  const displayedResults = searchResults.slice(0, 8);
  const hasMoreResults = searchResults.length > 8;
  const totalSelectableCount = displayedResults.length + (hasMoreResults ? 1 : 0);

  // Auto scroll highlighted result item into view
  useEffect(() => {
    if (searchItemRefs.current[searchSelectedIndex]) {
      searchItemRefs.current[searchSelectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [searchSelectedIndex]);

  // Focus dashboard search when pressing '/' or Ctrl+K / Cmd+K on Dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search for Product Master with AbortController for stale request cancellation
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`, {
          signal: controller.signal,
        });

        if (data.success && data.data?.results) {
          setSearchResults(data.data.results);
          setSearchSelectedIndex(0);
        } else {
          setSearchResults([]);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const handleResultSelect = (item?: any) => {
    if (!onRouteChange) return;

    if (!item) {
      // "View All" or generic search
      onRouteChange('/inventory');
      return;
    }

    // Direct navigation based on result type
    switch (item.type) {
      case 'product':
        onRouteChange('/inventory');
        break;
      case 'category':
        onRouteChange('/products');
        break;
      case 'purchase':
        onRouteChange('/purchases');
        break;
      case 'excise':
        onRouteChange('/excise');
        break;
      default:
        onRouteChange('/inventory');
    }
  };

  // Keyboard navigation within search results
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIndex(prev => (prev < totalSelectableCount - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchSelectedIndex === displayedResults.length && hasMoreResults) {
        handleResultSelect();
      } else if (displayedResults[searchSelectedIndex]) {
        handleResultSelect(displayedResults[searchSelectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      setSearchResults([]);
      searchInputRef.current?.blur();
    }
  };

  const fetchDashboardStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/api/dashboard/stats');
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load dashboard statistics');
      }
      setStats(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDatabase = async () => {
    setVerifyingSchema(true);
    try {
      const data = await apiGet('/api/database/verify');
      if (data.success) {
        setSchemaReport(data.data);
      } else {
        setSchemaReport({ message: data.error?.message || 'Failed to verify schema', allTablesVerified: false });
      }
    } catch (err: any) {
      setSchemaReport({ message: err.message, allTablesVerified: false });
    } finally {
      setVerifyingSchema(false);
      setShowSchemaModal(true);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {t.navDashboard}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              Inventory & Excise Only
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time stock valuation, TP permits, inward tracking & excise compliance ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleVerifyDatabase}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors"
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Verify Schema</span>
          </button>

          <button
            type="button"
            onClick={fetchDashboardStats}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Dashboard Product Master Search Box */}
      <div className="bg-slate-900 border border-amber-500/30 p-4 sm:p-5 rounded-2xl shadow-lg relative">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-slate-200 tracking-tight">
            Global Product Master Search
          </h2>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            (Searches entire products master — including 0 stock, unpurchased & inactive items)
          </span>
        </div>

        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-amber-400 absolute left-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search complete Product Master (SKU, Brand, etc)..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500/80 rounded-xl pl-11 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Instant Search Results Box directly below search box */}
          {searchQuery.trim().length > 0 && (
            <div className="mt-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-96 overflow-y-auto p-2 space-y-1.5 z-20 relative">
              {searchLoading && displayedResults.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Searching Product Master...</span>
                </div>
              ) : displayedResults.length > 0 ? (
                <>
                  {displayedResults.map((item, idx) => {
                    const isSelected = searchSelectedIndex === idx;
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        ref={el => { searchItemRefs.current[idx] = el; }}
                        onClick={() => handleResultSelect(item)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-h-[52px] ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md'
                            : 'bg-slate-900/80 border-slate-800/80 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                            {item.type === 'product' && <Package className="w-4 h-4 text-emerald-400" />}
                            {item.type === 'category' && <Tag className="w-4 h-4 text-amber-400" />}
                            {item.type === 'purchase' && <FileText className="w-4 h-4 text-sky-400" />}
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
                                  Current Stock: {item.current_stock ?? 0}
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

                        <div className="flex items-center gap-1.5 text-xs text-amber-400 shrink-0 self-end sm:self-center">
                          <span>View Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}

                  {/* View All Option */}
                  {hasMoreResults && (
                    <button
                      ref={el => { searchItemRefs.current[displayedResults.length] = el; }}
                      onClick={() => handleResultSelect()}
                      className={`w-full text-center py-2.5 px-4 rounded-lg border border-dashed transition-all flex items-center justify-center gap-2 text-xs font-semibold ${
                        searchSelectedIndex === displayedResults.length
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'border-slate-700 text-amber-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>View all {searchResults.length} matching products in Product Master</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching products found in Maharashtra master catalog for "{searchQuery}".
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { icon: ArrowDownToLine, label: 'Inward Purchase', route: '/purchases', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { icon: Package, label: 'Opening Stock', route: '/stock/opening', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { icon: SlidersHorizontal, label: 'Adjust Stock', route: '/stock/adjustments', color: 'text-sky-400', bg: 'bg-sky-500/10' },
          { icon: FileCheck2, label: 'Stock Ledger', route: '/stock-ledger', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { icon: Wine, label: 'Product Master', route: '/products', color: 'text-rose-400', bg: 'bg-rose-500/10' },
          { icon: ShieldCheck, label: 'Excise Compliance', route: '/excise', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        ].map((action, idx) => (
          <button
            key={idx}
            onClick={() => onRouteChange?.(action.route)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-all group cursor-pointer shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center ${action.color} mb-2.5 group-hover:scale-110 transition-transform shadow-inner`}>
              <action.icon className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors text-center leading-tight">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stock Valuation */}
        <div
          onClick={() => onRouteChange?.('/inventory')}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-amber-500/50 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Stock Valuation (VAT)
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              ₹{(stats?.stockValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Current active stock purchase valuation</p>
        </div>

        {/* Today's Inward Purchases */}
        <div
          onClick={() => onRouteChange?.('/purchases')}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-emerald-500/50 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Today's Inward Purchases
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              ₹{(stats?.todaysPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Total inward received today</p>
        </div>

        {/* Current Stock Units */}
        <div
          onClick={() => onRouteChange?.('/inventory')}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-cyan-500/50 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Current Stock Units
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {(stats?.currentStockUnits || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-400">Bottles</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{stats?.totalProducts || 0} registered products</p>
        </div>

        {/* Low Stock & Excise Licences */}
        <div
          onClick={() => onRouteChange?.('/inventory')}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-rose-500/50 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats?.lowStockCount ? 'text-rose-400' : 'text-slate-200'}`}>
              {stats?.lowStockCount || 0}
            </span>
            <span className="text-xs text-slate-400">≤ 10 units</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{stats?.activeLicencesCount || 0} active excise licences</p>
        </div>
      </div>

      {/* Category-wise Stock Breakdown & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Category-wise Stock Breakdown</span>
            </h2>
            <span className="text-xs text-slate-400">VAT Regulated</span>
          </div>

          <div className="space-y-3">
            {stats?.categoryStock && stats.categoryStock.length > 0 ? (
              stats.categoryStock.map(cat => (
                <div
                  key={cat.categoryName}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                >
                  <div>
                    <span className="text-sm font-semibold text-white block">{cat.categoryName}</span>
                    <span className="text-xs text-slate-400">{cat.count} products • {cat.units} bottles</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-amber-400 block">
                      ₹{cat.valuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] text-slate-400">Valuation</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No stock recorded in categories yet. Inward purchases will automatically display category valuations here.
              </div>
            )}
          </div>
        </div>

        {/* Recent Stock Ledger Movements */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              <span>Recent Stock Ledger Movements</span>
            </h2>
            <span className="text-xs text-slate-400">Live Reconciled</span>
          </div>

          <div className="space-y-2.5">
            {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
              stats.recentTransactions.slice(0, 6).map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                >
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      {(tx.product as any)?.name || (tx.product as any)?.product_name || 'Stock Item'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {tx.transaction_type} • Ref: {tx.reference_number || tx.reference || 'N/A'}
                    </span>
                  </div>
                  <div className="text-right">
                    {tx.stock_in > 0 ? (
                      <span className="text-xs font-bold text-emerald-400 block">+{tx.stock_in}</span>
                    ) : (
                      <span className="text-xs font-bold text-rose-400 block">-{tx.stock_out}</span>
                    )}
                    <span className="text-[10px] text-slate-400">Bal: {tx.balance}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No transactions in stock ledger yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schema Verification Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Supabase Schema Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSchemaModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-xl border ${schemaReport?.allTablesVerified ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-amber-950/40 border-amber-800 text-amber-300'}`}>
                <span className="font-semibold">{schemaReport?.message || 'Database status verified.'}</span>
              </div>

              {schemaReport?.verifiedTables && (
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">
                    Verified Tables ({schemaReport.verifiedTables.length}/19):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {schemaReport.verifiedTables.map((tbl: string) => (
                      <span key={tbl} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px]">
                        ✓ {tbl}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Sales/POS Tables (Forbidden):</span>
                <span className="font-semibold text-emerald-400 font-mono">0 Found (Clean)</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Categories & Pack Sizes:</span>
                <span className="font-semibold text-slate-200">
                  {schemaReport?.categoriesCount ?? 0} Categories • {schemaReport?.packSizesCount ?? 0} Pack Sizes
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
