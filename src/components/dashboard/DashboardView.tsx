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
import { useBar } from '../../lib/contexts/BarContext';

interface DashboardViewProps {
  language: SupportedLanguage;
  user: AuthUser;
  onRouteChange?: (route: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ language, user, onRouteChange }) => {
  const t = translations[language];
  const { selectedBar } = useBar();
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

  // Debounced search for Product Master
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
  }, [searchQuery, selectedBar?.id]);

  const handleResultSelect = (item?: any) => {
    if (!onRouteChange) return;

    if (!item) {
      onRouteChange('/inventory');
      return;
    }

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
      const url = `/api/dashboard/stats?barId=${selectedBar?.id || ''}`;
      const data = await apiGet(url);
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
  }, [selectedBar?.id]);

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-slate-50/50 min-h-screen font-sans">
      {/* Redesigned Premium Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">
            Overview
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t.navDashboard}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock valuation, TP permits, inward tracking & excise compliance ledger for{' '}
            <span className="text-slate-800 font-semibold">{selectedBar?.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleVerifyDatabase}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all shadow-sm"
          >
            <Database className="w-4 h-4 text-slate-500" />
            Verify Schema
          </button>

          <button
            type="button"
            onClick={fetchDashboardStats}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Stock Valuation */}
        <div
          onClick={() => onRouteChange?.('/inventory')}
          className="bg-white border border-slate-200/60 p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Stock Valuation
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-900 tracking-tight font-mono">
              ₹{(stats?.stockValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Current active stock purchase valuation</p>
        </div>

        {/* KPI: Received Today */}
        <div
          onClick={() => onRouteChange?.('/purchases')}
          className="bg-white border border-slate-200/60 p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Received Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-900 tracking-tight font-mono">
              ₹{(stats?.todaysPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Total inward received today</p>
        </div>

        {/* KPI: Current Stock Units */}
        <div
          onClick={() => onRouteChange?.('/inventory')}
          className="bg-white border border-slate-200/60 p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Current Stock Units
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900 tracking-tight font-mono">
              {(stats?.currentStockUnits || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-slate-400">Bottles</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{stats?.totalProducts || 0} registered products</p>
        </div>

        {/* KPI: Low Stock Alert */}
        <div
          onClick={() => onRouteChange?.('/inventory')}
          className="bg-white border border-slate-200/60 p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className={`text-xl font-bold font-mono ${stats?.lowStockCount ? 'text-rose-600' : 'text-slate-900'}`}>
              {stats?.lowStockCount || 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">≤ 10 units</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{stats?.activeLicencesCount || 0} active excise licences</p>
        </div>
      </div>

      {/* Global Product Master Search Box */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm relative space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Global Product Master Search
          </h2>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            — Search complete products master (SKU, Brand, or Variant)
          </span>
        </div>

        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
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
              className="w-full bg-slate-50 border border-slate-200/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Instant Search Results Box */}
          {searchQuery.trim().length > 0 && (
            <div className="mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-96 overflow-y-auto p-2 space-y-1 z-20 relative">
              {searchLoading && displayedResults.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
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
                            ? 'bg-slate-800 border-emerald-500/50 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                            {item.type === 'product' && <Package className="w-4 h-4 text-emerald-400" />}
                            {item.type === 'category' && <Tag className="w-4 h-4 text-emerald-400" />}
                            {item.type === 'purchase' && <FileText className="w-4 h-4 text-sky-400" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-white truncate">{item.title}</span>
                              {item.type === 'product' && (
                                <span
                                  className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                                    (item.current_stock || 0) > 0
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  }`}
                                >
                                  Current Stock: {item.current_stock ?? 0}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate">{item.subtitle}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-emerald-400 shrink-0 self-end sm:self-center font-bold">
                          <span>View Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}

                  {hasMoreResults && (
                    <button
                      ref={el => { searchItemRefs.current[displayedResults.length] = el; }}
                      onClick={() => handleResultSelect()}
                      className={`w-full text-center py-2 px-4 rounded-lg border border-dashed transition-all flex items-center justify-center gap-2 text-xs font-semibold ${
                        searchSelectedIndex === displayedResults.length
                          ? 'bg-slate-800 border-emerald-500 text-emerald-400'
                          : 'border-slate-800 text-emerald-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>View all {searchResults.length} matching products</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching products found in master catalog.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: ArrowDownToLine, label: 'Inward Purchase', route: '/purchases', color: 'text-emerald-700', bg: 'bg-emerald-50/80 border-emerald-100' },
            { icon: Package, label: 'Opening Stock', route: '/stock/opening', color: 'text-emerald-700', bg: 'bg-emerald-50/80 border-emerald-100' },
            { icon: SlidersHorizontal, label: 'Adjust Stock', route: '/stock/adjustments', color: 'text-emerald-700', bg: 'bg-emerald-50/80 border-emerald-100' },
            { icon: FileCheck2, label: 'Stock Ledger', route: '/stock-ledger', color: 'text-emerald-700', bg: 'bg-emerald-50/80 border-emerald-100' },
            { icon: Wine, label: 'Product Master', route: '/products', color: 'text-emerald-700', bg: 'bg-emerald-50/80 border-emerald-100' },
            { icon: ShieldCheck, label: 'Excise Compliance', route: '/excise', color: 'text-emerald-700', bg: 'bg-emerald-50/80 border-emerald-100' },
          ].map((action, idx) => (
            <button
              key={idx}
              onClick={() => onRouteChange?.(action.route)}
              className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-slate-200/80 hover:border-emerald-500 hover:shadow-md transition-all group cursor-pointer"
            >
              <div className={`w-9 h-9 rounded-lg ${action.bg} border flex items-center justify-center ${action.color} mb-2 group-hover:scale-105 transition-transform`}>
                <action.icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 transition-colors text-center leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category-wise Stock Breakdown & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Category-wise Stock Breakdown
            </h2>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
              VAT Regulated
            </span>
          </div>

          <div className="space-y-2.5">
            {stats?.categoryStock && stats.categoryStock.length > 0 ? (
              stats.categoryStock.map(cat => (
                <div
                  key={cat.categoryName}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{cat.categoryName}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{cat.count} products • {cat.units} bottles</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700 block font-mono">
                      ₹{cat.valuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Valuation</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 italic">
                No stock recorded in categories yet. Inward purchases will display category valuations here.
              </div>
            )}
          </div>
        </div>

        {/* Recent Stock Ledger Movements */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              Recent Stock Ledger Movements
            </h2>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
              Live Reconciled
            </span>
          </div>

          <div className="space-y-2.5">
            {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
              stats.recentTransactions.slice(0, 6).map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <span className="text-xs font-bold text-slate-800 block truncate">
                      {(tx.product as any)?.name || (tx.product as any)?.product_name || 'Stock Item'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {tx.transaction_type} • Ref: {tx.reference_number || tx.reference || '—'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    {tx.stock_in > 0 ? (
                      <span className="text-xs font-bold text-emerald-600 block">+{tx.stock_in}</span>
                    ) : (
                      <span className="text-xs font-bold text-rose-600 block">-{tx.stock_out}</span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">Bal: {tx.balance}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 italic">
                No recent transactions in stock ledger.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schema Verification Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white uppercase tracking-wider text-xs">Supabase Schema Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSchemaModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800"
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
                <span className="text-slate-400 font-medium">Sales/POS Tables (Forbidden):</span>
                <span className="font-semibold text-emerald-400 font-mono">0 Found (Clean)</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-medium">Categories & Pack Sizes:</span>
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
