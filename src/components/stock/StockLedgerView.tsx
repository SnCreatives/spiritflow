import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  Search,
  Download,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { SupportedLanguage, StockLedgerRecord } from '../../types';
import { apiGet } from '../../utils/api';
import { translations } from '../../utils/i18n';

interface StockLedgerViewProps {
  language: SupportedLanguage;
}

export const StockLedgerView: React.FC<StockLedgerViewProps> = ({ language }) => {
  const t = translations[language];

  const [ledger, setLedger] = useState<StockLedgerRecord[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ledData, prodData] = await Promise.all([
        apiGet(`/api/inventory/ledger?limit=300${selectedProductId ? `&productId=${selectedProductId}` : ''}`),
        apiGet('/api/products/selection'),
      ]);

      if (ledData.success) {
        setLedger(ledData.data?.ledger || []);
      }
      if (prodData.success) {
        setProducts(prodData.data?.items || []);
      }
    } catch (err: any) {
      console.error('Failed to load stock ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProductId]);

  const exportCSV = () => {
    if (filteredLedger.length === 0) return;
    const headers = ['Date', 'Product', 'Transaction Type', 'Reference #', 'Stock In', 'Stock Out', 'Balance', 'Remarks'];
    const rows = filteredLedger.map(entry => {
      const p = entry.product as any;
      const productName = p?.product_name || p?.name || 'Product';
      return [
        entry.transaction_date?.split('T')[0] || '',
        productName,
        entry.transaction_type || '',
        entry.reference_number || '',
        entry.stock_in || 0,
        entry.stock_out || 0,
        entry.balance || 0,
        entry.remarks || '',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_Ledger_Audited_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredLedger = ledger.filter(item => {
    if (typeFilter !== 'All' && item.transaction_type !== typeFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p = item.product as any;
    const pName = (p?.product_name || p?.name || '').toLowerCase();
    const sku = (p?.sku || '').toLowerCase();
    const ref = (item.reference_number || '').toLowerCase();
    const rem = (item.remarks || '').toLowerCase();
    return pName.includes(q) || sku.includes(q) || ref.includes(q) || rem.includes(q);
  });

  const totalPages = Math.ceil(filteredLedger.length / itemsPerPage) || 1;
  const paginatedLedger = filteredLedger.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Stock Ledger
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Auditable running inventory ledger tracking opening balances, inward consignments, and stock adjustments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search product, ref #, remarks..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Product Filter */}
          <select
            value={selectedProductId}
            onChange={e => {
              setSelectedProductId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-400"
          >
            <option value="">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.display_label || `${p.brand_name || ''} — ${p.product_name || p.name} — ${p.pack_size || ''}`}
              </option>
            ))}
          </select>

          {/* Transaction Type Filter */}
          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-400"
          >
            <option value="All">All Movements</option>
            <option value="OPENING">OPENING</option>
            <option value="PURCHASE">PURCHASE (INWARD)</option>
            <option value="ADJUSTMENT_IN">ADJUSTMENT IN</option>
            <option value="ADJUSTMENT_OUT">ADJUSTMENT OUT</option>
            <option value="RETURN_IN">RETURN IN</option>
            <option value="RETURN_OUT">RETURN OUT</option>
            <option value="CORRECTION">CORRECTION</option>
          </select>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="table-container">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Transaction Type</th>
                <th className="px-4 py-3">Reference #</th>
                <th className="px-4 py-3 text-right">Stock In (+)</th>
                <th className="px-4 py-3 text-right">Stock Out (-)</th>
                <th className="px-4 py-3 text-right font-bold text-white">Running Balance</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {paginatedLedger.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-xs">
                    No stock ledger transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedLedger.map((item: any) => {
                  const p = item.product as any;
                  const isStockIn = Number(item.stock_in || 0) > 0;
                  const isStockOut = Number(item.stock_out || 0) > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {item.transaction_date?.split('T')[0] || '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {p?.product_name || p?.name || 'Product'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            item.transaction_type === 'PURCHASE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.transaction_type === 'OPENING'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : item.transaction_type?.includes('OUT')
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {item.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {item.reference_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-400">
                        {isStockIn ? `+${item.stock_in}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-rose-400">
                        {isStockOut ? `-${item.stock_out}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-white text-sm">
                        {item.balance || 0}
                      </td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                        {item.remarks || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredLedger.length)} of{' '}
            {filteredLedger.length} ledger records
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono text-slate-300 px-1">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
