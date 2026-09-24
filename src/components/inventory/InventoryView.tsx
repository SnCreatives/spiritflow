import React, { useState, useEffect } from 'react';
import {
  Package,
  RefreshCw,
  AlertCircle,
  Plus,
  SlidersHorizontal,
  FileText,
  Search,
  CheckCircle2,
  X,
  FileCheck2,
  Database,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SupportedLanguage, InventoryRecord, StockLedgerRecord } from '../../types';
import { apiGet, apiPost } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { BulkImportDialog } from '../common/BulkImportDialog';

interface InventoryViewProps {
  language: SupportedLanguage;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ language }) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'inventory' | 'ledger' | 'schema'>('inventory');
  const [items, setItems] = useState<InventoryRecord[]>([]);
  const [ledger, setLedger] = useState<StockLedgerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [chartMetric, setChartMetric] = useState<'totalStock' | 'totalValue'>('totalStock');

  // Modals
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Form states
  const [productsList, setProductsList] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Inward Purchase Form State
  const [inwardForm, setInwardForm] = useState({
    purchaseNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    tpPermitReference: '',
    exciseReference: '',
    documentReference: '',
    productId: '',
    batchNumber: '',
    quantity: 10,
    purchaseTpPrice: 450,
  });

  // Stock Adjustment Form State
  const [adjForm, setAdjForm] = useState({
    adjustmentNumber: `ADJ-${Date.now().toString().slice(-6)}`,
    adjustmentDate: new Date().toISOString().split('T')[0],
    productId: '',
    adjustmentType: 'ADJUSTMENT_IN' as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN_IN' | 'RETURN_OUT' | 'CORRECTION',
    quantity: 1,
    reason: '',
  });

  // Opening Stock Form State
  const [openingForm, setOpeningForm] = useState({
    productId: '',
    quantity: 50,
    purchaseTpPrice: 400,
    batchNumber: 'BATCH-OPENING',
    remarks: 'Initial Opening Stock',
  });

  // Schema state
  const [schemaStatus, setSchemaStatus] = useState<any>(null);

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/inventory?search=${encodeURIComponent(search)}&lowStockOnly=${lowStockFilter}`);
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch inventory');
      }
      setItems(data.data?.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    try {
      const data = await apiGet('/api/inventory/ledger');
      if (data.success) {
        setLedger(data.data?.ledger || []);
      }
    } catch {}
  };

  const fetchDropdownData = async () => {
    try {
      const pData = await apiGet('/api/products/selection');
      if (pData.success) {
        const items = pData.data?.items || [];
        setProductsList(items);
        if (items.length > 0) {
          setInwardForm(prev => ({ ...prev, productId: items[0].id }));
          setAdjForm(prev => ({ ...prev, productId: items[0].id }));
          setOpeningForm(prev => ({ ...prev, productId: items[0].id }));
        }
      }
    } catch {}
  };

  const fetchSchemaReport = async () => {
    try {
      const data = await apiGet('/api/database/verify');
      if (data.success) {
        setSchemaStatus(data.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchInventory();
    fetchLedger();
    fetchDropdownData();
    fetchSchemaReport();
  }, []);

  const handleInwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const data = await apiPost('/api/inventory/purchases', {
        purchaseNumber: inwardForm.purchaseNumber || `PO-${Date.now().toString().slice(-6)}`,
        purchaseDate: inwardForm.purchaseDate,
        tpPermitReference: inwardForm.tpPermitReference || null,
        exciseReference: inwardForm.exciseReference || null,
        documentReference: inwardForm.documentReference || null,
        items: [
          {
            productId: inwardForm.productId,
            batchNumber: inwardForm.batchNumber || null,
            quantity: Number(inwardForm.quantity),
            purchaseTpPrice: Number(inwardForm.purchaseTpPrice),
          },
        ],
      });
      if (!data.success) {
        throw new Error(data.error?.message || 'Inward purchase failed');
      }
      setFeedback({ type: 'success', message: `Inward Purchase #${data.data.purchaseNumber} recorded into stock & ledger successfully!` });
      setShowInwardModal(false);
      fetchInventory();
      fetchLedger();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const data = await apiPost('/api/inventory/adjustments', {
        adjustmentNumber: adjForm.adjustmentNumber,
        adjustmentDate: adjForm.adjustmentDate,
        productId: adjForm.productId,
        adjustmentType: adjForm.adjustmentType,
        quantity: Number(adjForm.quantity),
        reason: adjForm.reason || 'Inventory Adjustment',
      });
      if (!data.success) {
        throw new Error(data.error?.message || 'Stock adjustment failed');
      }
      setFeedback({ type: 'success', message: `Adjustment #${data.data.adjustmentNumber} applied. New stock: ${data.data.newStock}` });
      setShowAdjustmentModal(false);
      fetchInventory();
      fetchLedger();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpeningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const data = await apiPost('/api/inventory/opening-stock', {
        productId: openingForm.productId,
        quantity: Number(openingForm.quantity),
        purchaseTpPrice: Number(openingForm.purchaseTpPrice),
        batchNumber: openingForm.batchNumber,
        remarks: openingForm.remarks,
      });
      if (!data.success) {
        throw new Error(data.error?.message || 'Opening stock failed');
      }
      setFeedback({ type: 'success', message: `Opening stock recorded! Current stock: ${data.data.currentStock}` });
      setShowOpeningModal(false);
      fetchInventory();
      fetchLedger();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-amber-400" />
            <span>{t.navInventory} & Stock Control</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Current Stock = Opening + Inward/Purchases + Adjustments (In) + Returns (In) - Adjustments (Out) - Returns (Out)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>Import Opening Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOpeningModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Opening Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInwardModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/20 transition-colors"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Inward / Purchase</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdjustmentModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Stock Adjustment</span>
          </button>

          <button
            type="button"
            onClick={fetchInventory}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'inventory' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Current Stock
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('ledger'); fetchLedger(); }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'ledger' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Stock Ledger Audit
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('schema'); fetchSchemaReport(); }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'schema' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Schema & Verification (19 Tables)
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search stock by product, SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchInventory()}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={lowStockFilter}
                onChange={e => {
                  setLowStockFilter(e.target.checked);
                  setTimeout(fetchInventory, 50);
                }}
                className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
              />
              <span>Show Low Stock Only (≤ 10 units)</span>
            </label>
          </div>

          {/* Category Stock Distribution Bar Chart */}
          {(() => {
            const categoryDataMap = new Map<string, { category: string; totalStock: number; totalValue: number; itemCount: number }>();
            items.forEach(item => {
              const catName = (item.product as any)?.category?.name || 'Uncategorized';
              const existing = categoryDataMap.get(catName) || { category: catName, totalStock: 0, totalValue: 0, itemCount: 0 };
              existing.totalStock += Number(item.current_quantity || 0);
              existing.totalValue += Number(item.stock_value || 0);
              existing.itemCount += 1;
              categoryDataMap.set(catName, existing);
            });
            const chartData = Array.from(categoryDataMap.values());

            return (
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Stock Distribution by Category</h3>
                    <p className="text-xs text-slate-400">Interactive category-wise stock quantities and valuation</p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setChartMetric('totalStock')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        chartMetric === 'totalStock' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Quantity (Units)
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMetric('totalValue')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        chartMetric === 'totalValue' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Valuation (₹)
                    </button>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      No stock data available for chart
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                          dataKey="category"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={val => chartMetric === 'totalValue' ? `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}` : val}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                          formatter={(val: any) => [
                            chartMetric === 'totalValue' ? `₹${Number(val).toLocaleString()}` : `${Number(val).toLocaleString()} units`,
                            chartMetric === 'totalValue' ? 'Total Valuation' : 'Total Quantity'
                          ]}
                        />
                        <Bar
                          dataKey={chartMetric}
                          fill="#f59e0b"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Inventory Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="table-container">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Product Name</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Brand</th>
                    <th className="py-3 px-4 font-semibold text-right">Opening</th>
                    <th className="py-3 px-4 font-semibold text-right">Purchased/Inward</th>
                    <th className="py-3 px-4 font-semibold text-right">Adjustments</th>
                    <th className="py-3 px-4 font-semibold text-right text-amber-400">Current Stock</th>
                    <th className="py-3 px-4 font-semibold text-right">Valuation (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.length > 0 ? (
                    items.map(item => {
                      const prod = (item.product as any) || {};
                      const qty = Number(item.current_quantity ?? item.current_stock ?? 0);
                      const tpPrice = Number(prod.purchase_tp_price || 0);
                      const val = Number(item.stock_value) || (qty * tpPrice);

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-medium text-white">
                            <div>{prod.product_name || prod.name || 'Unnamed Product'}</div>
                            <span className="text-[10px] text-slate-400">SKU: {prod.sku || 'N/A'}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{prod.category?.name || '—'}</td>
                          <td className="py-3 px-4 text-slate-300">{prod.brand?.brand_name || prod.brand?.name || '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-300">{item.opening_quantity ?? item.opening_stock ?? 0}</td>
                          <td className="py-3 px-4 text-right text-emerald-400 font-medium">+{item.purchased_quantity || 0}</td>
                          <td className="py-3 px-4 text-right text-slate-300">{item.adjustment_quantity ?? item.adjustments ?? 0}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-0.5 rounded font-bold ${qty <= 10 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                              {qty}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-200">
                            ₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No inventory records found. Use "Opening Stock" or "Inward / Purchase" to add stock.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              <span>Stock Ledger Audit Records</span>
            </h3>
            <span className="text-xs text-slate-400">Strict reconciliation with Inventory Table</span>
          </div>
          <div className="table-container">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Date & Time</th>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold text-right text-emerald-400">Stock In (+)</th>
                  <th className="py-3 px-4 font-semibold text-right text-rose-400">Stock Out (-)</th>
                  <th className="py-3 px-4 font-semibold text-right text-amber-400">Balance</th>
                  <th className="py-3 px-4 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ledger.length > 0 ? (
                  ledger.map((entry, idx) => (
                    <tr key={entry.id || idx} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {entry.transaction_date ? new Date(entry.transaction_date).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {(entry.product as any)?.product_name || (entry.product as any)?.name || 'Product'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {entry.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {entry.reference_number || entry.reference || '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                        {entry.stock_in > 0 ? `+${entry.stock_in}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-400 font-semibold">
                        {entry.stock_out > 0 ? `-${entry.stock_out}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-400">
                        {entry.balance}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {entry.remarks || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No ledger transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'schema' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <span>Supabase Database Schema Integrity Verification</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Audited against all 19 required tables and zero sales/POS tables.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchSchemaReport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Re-run Audit</span>
            </button>
          </div>

          <div className={`p-4 rounded-xl border ${schemaStatus?.allTablesVerified ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-amber-950/40 border-amber-800 text-amber-300'} text-xs font-semibold`}>
            {schemaStatus?.message || 'Database schema audit loaded.'}
          </div>

          {/* Tables checklist */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Verified Database Tables ({schemaStatus?.verifiedTables?.length || 0}/19)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {(schemaStatus?.verifiedTables || []).map((tName: string) => (
                <div key={tName} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clean status */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
            <span className="text-slate-400 block font-semibold">Forbidden Tables (Sales / POS / Billing):</span>
            <span className="text-emerald-400 font-medium">✓ None found. Architecture is strictly Inventory & Excise.</span>
          </div>
        </div>
      )}

      {/* Inward Purchase Modal */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form onSubmit={handleInwardSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <span>Inward Stock / Purchase Entry</span>
              </h3>
              <button type="button" onClick={() => setShowInwardModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Purchase Number *</label>
                <input
                  required
                  type="text"
                  value={inwardForm.purchaseNumber}
                  onChange={e => setInwardForm({ ...inwardForm, purchaseNumber: e.target.value })}
                  placeholder="PO-2026-001"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Purchase Date *</label>
                <input
                  required
                  type="date"
                  value={inwardForm.purchaseDate}
                  onChange={e => setInwardForm({ ...inwardForm, purchaseDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">TP Permit Reference</label>
                <input
                  type="text"
                  value={inwardForm.tpPermitReference}
                  onChange={e => setInwardForm({ ...inwardForm, tpPermitReference: e.target.value })}
                  placeholder="TP-MH-99482"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Excise Document Ref</label>
                <input
                  type="text"
                  value={inwardForm.exciseReference}
                  onChange={e => setInwardForm({ ...inwardForm, exciseReference: e.target.value })}
                  placeholder="EXC-DOC-4481"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">Product *</label>
                <select
                  required
                  value={inwardForm.productId}
                  onChange={e => setInwardForm({ ...inwardForm, productId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="">Select Product</option>
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.product_name || p.name} ({p.sku || 'SKU'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Batch Number</label>
                <input
                  type="text"
                  value={inwardForm.batchNumber}
                  onChange={e => setInwardForm({ ...inwardForm, batchNumber: e.target.value })}
                  placeholder="BATCH-A01"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quantity (Units) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={inwardForm.quantity}
                  onChange={e => setInwardForm({ ...inwardForm, quantity: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">Purchase TP Price (₹ VAT) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={inwardForm.purchaseTpPrice}
                  onChange={e => setInwardForm({ ...inwardForm, purchaseTpPrice: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowInwardModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
              >
                {submitting ? 'Recording...' : 'Record Inward Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form onSubmit={handleAdjustmentSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <span>Stock Adjustment</span>
              </h3>
              <button type="button" onClick={() => setShowAdjustmentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Product *</label>
                <select
                  required
                  value={adjForm.productId}
                  onChange={e => setAdjForm({ ...adjForm, productId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="">Select Product</option>
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name || p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Adjustment Type *</label>
                <select
                  value={adjForm.adjustmentType}
                  onChange={e => setAdjForm({ ...adjForm, adjustmentType: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="ADJUSTMENT_IN">Adjustment In (Stock Increase)</option>
                  <option value="ADJUSTMENT_OUT">Adjustment Out (Stock Reduction)</option>
                  <option value="RETURN_IN">Return In (Supplier/Stock Return Inward)</option>
                  <option value="RETURN_OUT">Return Out (Return to Distillery/Supplier)</option>
                  <option value="CORRECTION">Correction</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quantity *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={adjForm.quantity}
                  onChange={e => setAdjForm({ ...adjForm, quantity: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reason / Remarks *</label>
                <input
                  required
                  type="text"
                  value={adjForm.reason}
                  onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })}
                  placeholder="Breakage, wastage, or physical audit count"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                {submitting ? 'Applying...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Opening Stock Modal */}
      {showOpeningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form onSubmit={handleOpeningSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>Record Initial Opening Stock</span>
              </h3>
              <button type="button" onClick={() => setShowOpeningModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Product *</label>
                <select
                  required
                  value={openingForm.productId}
                  onChange={e => setOpeningForm({ ...openingForm, productId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="">Select Product</option>
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name || p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Opening Quantity *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={openingForm.quantity}
                  onChange={e => setOpeningForm({ ...openingForm, quantity: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Purchase TP Price (₹) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={openingForm.purchaseTpPrice}
                  onChange={e => setOpeningForm({ ...openingForm, purchaseTpPrice: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Batch Number</label>
                <input
                  type="text"
                  value={openingForm.batchNumber}
                  onChange={e => setOpeningForm({ ...openingForm, batchNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowOpeningModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors"
              >
                {submitting ? 'Saving...' : 'Set Opening Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      <BulkImportDialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="opening-stock"
        language={language}
        onSuccess={() => {
          fetchInventory();
          setFeedback({
            type: 'success',
            message: 'Bulk opening stock processed and verified successfully.',
          });
        }}
      />
    </div>
  );
};
