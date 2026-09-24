import React, { useState, useEffect } from 'react';
import {
  FileInput,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Layers,
  FileText,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { translations } from '../../utils/i18n';
import { BulkImportDialog } from '../common/BulkImportDialog';
import { ProductPackSizeSelector } from '../common/ProductPackSizeSelector';
import { apiGet, apiPost } from '../../utils/api';

interface OpeningStockViewProps {
  language: SupportedLanguage;
}

export const OpeningStockView: React.FC<OpeningStockViewProps> = ({ language }) => {
  const t = translations[language];

  const [records, setRecords] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  // Bulk import state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    productId: '',
    batchNumber: '',
    quantity: 10,
    purchaseTpPrice: 0,
    mrpReference: 0,
    exciseReference: '',
    documentReference: '',
    remarks: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recData, prodData] = await Promise.all([
        apiGet('/api/inventory/opening-stock'),
        apiGet('/api/products/selection'),
      ]);

      if (recData.success) {
        setRecords(recData.data?.records || []);
      }
      if (prodData.success) {
        const prodItems = prodData.data?.items || [];
        setProducts(prodItems);
        if (prodItems.length > 0 && !formData.productId) {
          const first = prodItems[0];
          setFormData(prev => ({
            ...prev,
            productId: first.id,
            purchaseTpPrice: Number(first.purchase_price || 0),
            mrpReference: Number(first.mrp || 0),
          }));
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load opening stock records' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProductChange = (productId: string) => {
    const selected = products.find(p => p.id === productId);
    setFormData(prev => ({
      ...prev,
      productId,
      purchaseTpPrice: selected ? Number(selected.purchase_price || 0) : prev.purchaseTpPrice,
      mrpReference: selected ? Number(selected.mrp || 0) : prev.mrpReference,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || formData.quantity <= 0) {
      setFeedback({ type: 'error', message: 'Please select a valid product and enter a positive quantity.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await apiPost('/api/inventory/opening-stock', {
        productId: formData.productId,
        quantity: Number(formData.quantity),
        purchaseTpPrice: Number(formData.purchaseTpPrice),
        batchNumber: formData.batchNumber || undefined,
        remarks: formData.remarks || undefined,
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to record opening stock');
      }

      setFeedback({ type: 'success', message: 'Opening stock recorded successfully in inventory and ledger!' });
      setFormData(prev => ({
        ...prev,
        quantity: 10,
        batchNumber: '',
        remarks: '',
      }));
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = ['Date', 'Product', 'SKU', 'Batch/Ref', 'Quantity', 'Balance', 'Remarks'];
    const rows = records.map(r => [
      r.transaction_date?.split('T')[0] || '',
      r.product?.name || '',
      r.product?.sku || '',
      r.reference_number || '',
      r.stock_in || 0,
      r.balance || 0,
      r.remarks || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Opening_Stock_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredRecords = records.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.product?.name?.toLowerCase().includes(q) ||
      r.product?.sku?.toLowerCase().includes(q) ||
      r.reference_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileInput className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Opening / TP Stock
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Initialize baseline inventory quantities, TP valuation, and audit ledger balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <FileInput className="w-4 h-4 text-amber-400" />
            <span>Paste Opening Stock from Excel</span>
          </button>
          <button
            type="button"
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Opening Stock Entry Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Record Opening Stock</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Product & Pack Size Selector */}
            <div className="col-span-1 sm:col-span-2">
              <ProductPackSizeSelector
                products={products}
                value={formData.productId}
                onChange={handleProductChange}
                required
              />
            </div>

            {/* Batch Number */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Batch Number / Ref
              </label>
              <input
                type="text"
                placeholder="e.g. BATCH-2026-01"
                value={formData.batchNumber}
                onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Opening Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Opening Quantity (Units) <span className="text-amber-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* TP / Purchase Value */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                TP / Purchase Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.purchaseTpPrice}
                onChange={e => setFormData({ ...formData, purchaseTpPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* MRP Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                MRP Reference (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.mrpReference}
                onChange={e => setFormData({ ...formData, mrpReference: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Excise Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Excise / TP Reference
              </label>
              <input
                type="text"
                placeholder="e.g. EXC-OPENING-2026"
                value={formData.exciseReference}
                onChange={e => setFormData({ ...formData, exciseReference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Document Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Document / Inward Reference
              </label>
              <input
                type="text"
                placeholder="e.g. DOC-REF-99"
                value={formData.documentReference}
                onChange={e => setFormData({ ...formData, documentReference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Initial audited physical verification stock balance"
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{saving ? 'Recording...' : 'Save Opening Stock'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Saved Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Opening Stock Entries</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {filteredRecords.length} records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search opening stock..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Reference / Batch</th>
                <th className="px-4 py-3 text-right">Opening Qty</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-xs">
                    No opening stock records found. Use the form above to record opening balance.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec: any) => (
                  <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {rec.transaction_date?.split('T')[0]}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {rec.product?.name || 'Product'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {rec.product?.sku || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-300">
                      {rec.reference_number || 'OPENING'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400 font-mono">
                      +{rec.stock_in || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white font-mono">
                      {rec.balance || 0}
                    </td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                      {rec.remarks || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BulkImportDialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="opening-stock"
        language={language}
        onSuccess={() => {
          fetchData();
          setFeedback({
            type: 'success',
            message: 'Bulk opening stock processed and linked to audit trail.',
          });
        }}
      />
    </div>
  );
};
