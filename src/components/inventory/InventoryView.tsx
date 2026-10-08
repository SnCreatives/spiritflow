import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  Download,
} from 'lucide-react';
import { InventoryRecord } from '../../types';
import { apiGet } from '../../utils/api';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';

interface InventoryViewProps {
  language?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = () => {
  const { selectedBar } = useBar();
  const { showError, showSuccess } = useToast();

  const [items, setItems] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const fetchInventory = async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setItems([]);
    try {
      const data = await apiGet(`/api/inventory?barId=${encodeURIComponent(selectedBar.id)}&search=${encodeURIComponent(search)}&lowStockOnly=${lowStockOnly}`);
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch inventory');
      }
      setItems(data.data?.items || []);
    } catch (err: any) {
      showError(err.message || 'Error loading inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedBar?.id, lowStockOnly]);

  const handleExportCSV = () => {
    if (items.length === 0 || !selectedBar) return;
    let csv = `Product Name,SKU,Category,Brand,Opening,Inward (+),Adjustments,Current Stock,Valuation (INR)\n`;
    items.forEach(item => {
      const p = (item.product as any) || {};
      const qty = Number(item.current_quantity ?? item.current_stock ?? 0);
      const val = Number(item.stock_value) || (qty * Number(p.purchase_tp_price || 0));
      csv += `"${p.product_name || p.name || ''}","${p.sku || ''}","${p.category?.name || ''}","${p.brand?.name || p.brand?.brand_name || ''}",${item.opening_quantity ?? item.opening_stock ?? 0},${item.purchased_quantity || 0},${item.adjustment_quantity ?? 0},${qty},${val}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory_${selectedBar.name}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showSuccess('Inventory exported.');
  };

  // Calculations for summary footer
  const totalUnits = items.reduce((sum, item) => sum + Number(item.current_quantity ?? item.current_stock ?? 0), 0);
  const totalValuation = items.reduce((sum, item) => {
    const qty = Number(item.current_quantity ?? item.current_stock ?? 0);
    const p = (item.product as any) || {};
    return sum + (Number(item.stock_value) || (qty * Number(p.purchase_tp_price || 0)));
  }, 0);

  if (!selectedBar || selectedBar.id === 'ALL_BARS') {
    return (
      <div className="px-4 sm:px-6 py-12 max-w-xl mx-auto text-center">
        <div className="p-8 bg-white border border-slate-200 rounded-xl">
          <h2 className="text-base font-bold text-slate-900 mb-1">Select a Bar</h2>
          <p className="text-xs text-slate-500">
            Please choose a specific bar outlet to view live inventory records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto space-y-8 font-sans text-slate-700">
      {/* 2. SIMPLE PAGE STRUCTURE: Page Title, Short description, Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-6 bg-amber-500 rounded-full"></div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Inventory Ledger</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            Live stock balance, inward/outward breakdown, and valuation for <span className="text-slate-900 font-bold">{selectedBar.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Filters / Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search product, SKU, brand, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchInventory()}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium transition-all"
            />
          </div>

          <label className="flex items-center gap-3 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 hover:border-amber-200 transition-all">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={e => setLowStockOnly(e.target.checked)}
              className="w-4 h-4 rounded-md border-slate-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
            />
            <span className="font-bold uppercase tracking-tight">Low Stock Alerts (≤ 10)</span>
          </label>
        </div>

        <button
          type="button"
          onClick={fetchInventory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 w-full md:w-auto justify-center cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>REFRESH STOCK</span>
        </button>
      </div>

      {/* Main Content: Records Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-6 py-4">Product Identity</th>
                <th className="px-6 py-4">SKU / Code</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Opening</th>
                <th className="px-6 py-4 text-right text-emerald-600">Inward (+)</th>
                <th className="px-6 py-4 text-right text-rose-600">Sales (-)</th>
                <th className="px-6 py-4 text-right">Adjust</th>
                <th className="px-6 py-4 text-right font-black text-slate-900 bg-slate-50/30">CURRENT STOCK</th>
                <th className="px-6 py-4 text-right">Valuation (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 text-slate-200 animate-spin" />
                      <span className="text-slate-400 font-bold uppercase tracking-tighter">Syncing physical stock...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200">
                        <RefreshCw className="w-6 h-6" />
                      </div>
                      <div className="text-slate-400 font-medium">No inventory records found for this bar.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const prod = (item.product as any) || {};
                  const qty = Number(item.current_quantity ?? item.current_stock ?? 0);
                  const tpPrice = Number(prod.purchase_tp_price || 0);
                  const val = Number(item.stock_value) || (qty * tpPrice);
                  const isLow = qty <= 10;
                  const salesQty = Number((item as any).sales_quantity || 0);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase tracking-tight">{prod.product_name || prod.name || 'Product'}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{prod.brand?.brand_name || prod.brand?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500 font-medium">{prod.sku || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                          {prod.category?.name || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-400 font-bold">
                        {item.opening_quantity ?? item.opening_stock ?? 0}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-emerald-600">
                        +{item.purchased_quantity || 0}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-rose-500">
                        -{salesQty}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-400">
                        {item.adjustment_quantity ?? 0}
                      </td>
                      <td className="px-6 py-4 text-right font-mono bg-slate-50/30">
                        <span className={`text-sm font-black ${isLow ? 'text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 shadow-sm' : 'text-slate-900'}`}>
                          {qty}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-slate-900">
                        ₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        {items.length > 0 && (
          <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-6">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
              Operational Summary: <strong>{items.length}</strong> SKUs Tracked
            </span>
            <div className="flex items-center gap-8">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Net Load</span>
                <strong className="font-mono text-white text-lg font-black">{totalUnits.toLocaleString('en-IN')}</strong>
              </div>
              <div className="h-4 w-px bg-slate-800"></div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest">Total Valuation</span>
                <strong className="font-mono text-amber-500 text-lg font-black tracking-tighter">₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
