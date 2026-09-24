import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Layers,
  FileText,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { apiGet, apiPost } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { BulkImportDialog } from '../common/BulkImportDialog';
import { ProductPackSizeSelector } from '../common/ProductPackSizeSelector';

interface StockAdjustmentsViewProps {
  language: SupportedLanguage;
}

export const StockAdjustmentsView: React.FC<StockAdjustmentsViewProps> = ({ language }) => {
  const t = translations[language];

  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  // Bulk import state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    adjustmentNumber: `ADJ-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
    adjustmentDate: new Date().toISOString().split('T')[0],
    productId: '',
    batchId: '',
    adjustmentType: 'ADJUSTMENT_IN' as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN_IN' | 'RETURN_OUT' | 'CORRECTION',
    quantity: 1,
    reference: '',
    reason: '',
    remarks: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adjData, prodData] = await Promise.all([
        apiGet('/api/inventory/adjustments'),
        apiGet('/api/products/selection'),
      ]);

      if (adjData.success) {
        setAdjustments(adjData.data?.adjustments || []);
      }
      if (prodData.success) {
        const prodItems = prodData.data?.items || [];
        setProducts(prodItems);
        if (prodItems.length > 0 && !formData.productId) {
          setFormData(prev => ({ ...prev, productId: prodItems[0].id }));
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load adjustments' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || formData.quantity <= 0) {
      setFeedback({ type: 'error', message: 'Please select a product and enter a positive quantity.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await apiPost('/api/inventory/adjustments', {
        adjustmentNumber: formData.adjustmentNumber,
        adjustmentDate: formData.adjustmentDate,
        productId: formData.productId,
        batchId: formData.batchId || undefined,
        adjustmentType: formData.adjustmentType,
        quantity: Number(formData.quantity),
        reference: formData.reference || undefined,
        reason: formData.reason || undefined,
        remarks: formData.remarks || undefined,
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to record stock adjustment');
      }

      setFeedback({
        type: 'success',
        message: `Stock adjustment #${formData.adjustmentNumber} processed! New stock: ${result.data?.newStock} units.`,
      });

      setFormData(prev => ({
        ...prev,
        adjustmentNumber: `ADJ-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
        quantity: 1,
        reference: '',
        reason: '',
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
    if (adjustments.length === 0) return;
    const headers = ['Adjustment #', 'Date', 'Product', 'Type', 'Quantity', 'Reference', 'Reason', 'Remarks'];
    const rows = adjustments.map(a => [
      a.adjustment_number || '',
      a.adjustment_date || '',
      a.product?.name || '',
      a.adjustment_type || '',
      a.quantity || 0,
      a.reference || '',
      a.reason || '',
      a.remarks || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_Adjustments_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredAdjustments = adjustments.filter(a => {
    const matchesType = typeFilter === 'All' || a.adjustment_type === typeFilter;
    if (!matchesType) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.adjustment_number?.toLowerCase().includes(q) ||
      a.product?.name?.toLowerCase().includes(q) ||
      a.reference?.toLowerCase().includes(q) ||
      a.reason?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Stock Adjustments
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Perform audited inventory increases, decreases, breakage write-offs, and return inward/outward adjustments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span>Paste Adjustments from Excel</span>
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

      {/* Adjustment Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-400" />
          <span>New Stock Adjustment</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Adjustment Number */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Adjustment # <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.adjustmentNumber}
                onChange={e => setFormData({ ...formData, adjustmentNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.adjustmentDate}
                onChange={e => setFormData({ ...formData, adjustmentDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Product & Pack Size Selector */}
            <div className="col-span-1 sm:col-span-2">
              <ProductPackSizeSelector
                products={products}
                value={formData.productId}
                onChange={productId => setFormData({ ...formData, productId })}
                required
              />
            </div>

            {/* Adjustment Type */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Adjustment Type <span className="text-amber-400">*</span>
              </label>
              <select
                required
                value={formData.adjustmentType}
                onChange={e => setFormData({ ...formData, adjustmentType: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-medium"
              >
                <option value="ADJUSTMENT_IN">Adjustment In (Stock Increase)</option>
                <option value="ADJUSTMENT_OUT">Adjustment Out (Breakage / Wastage)</option>
                <option value="RETURN_IN">Return In (Supplier/Customer Return In)</option>
                <option value="RETURN_OUT">Return Out (Return to Supplier)</option>
                <option value="CORRECTION">Correction (Stock Reconciliation)</option>
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Quantity (Bottles/Units) <span className="text-amber-400">*</span>
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

            {/* Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Reference / Permit #
              </label>
              <input
                type="text"
                placeholder="e.g. BRK-NOTE-102"
                value={formData.reference}
                onChange={e => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Reason / Justification
              </label>
              <input
                type="text"
                placeholder="e.g. Breakage in handling / Stock audit recount"
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. Verified by excise supervisor"
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{saving ? 'Processing...' : 'Apply Stock Adjustment'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Adjustments History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Adjustments History</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {filteredAdjustments.length} records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-400"
            >
              <option value="All">All Types</option>
              <option value="ADJUSTMENT_IN">Adjustment In</option>
              <option value="ADJUSTMENT_OUT">Adjustment Out</option>
              <option value="RETURN_IN">Return In</option>
              <option value="RETURN_OUT">Return Out</option>
              <option value="CORRECTION">Correction</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search adjustment..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Adjustment #</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Reference / Reason</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-xs">
                    No stock adjustments recorded.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((a: any) => {
                  const isOut = a.adjustment_type === 'ADJUSTMENT_OUT' || a.adjustment_type === 'RETURN_OUT';
                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {a.adjustment_date}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300">
                        {a.adjustment_number}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {a.product?.name || 'Product'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOut
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {a.adjustment_type}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold font-mono ${
                          isOut ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isOut ? `-${a.quantity}` : `+${a.quantity}`}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {a.reason || a.reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                        {a.remarks || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BulkImportDialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="adjustments"
        language={language}
        onSuccess={() => {
          fetchData();
          setFeedback({
            type: 'success',
            message: 'Bulk adjustments processed and linked to audit trail.',
          });
        }}
      />
    </div>
  );
};
