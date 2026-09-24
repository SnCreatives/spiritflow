import React, { useState, useEffect } from 'react';
import {
  QrCode,
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
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { apiGet, apiPost } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { ProductPackSizeSelector } from '../common/ProductPackSizeSelector';

interface BatchesViewProps {
  language: SupportedLanguage;
}

export const BatchesView: React.FC<BatchesViewProps> = ({ language }) => {
  const t = translations[language];

  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    productId: '',
    batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
    batchDate: new Date().toISOString().split('T')[0],
    quantity: 24,
    purchaseTpValue: 12000,
    mrpReference: 650,
    exciseReference: '',
    documentReference: '',
    remarks: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batData, prodData] = await Promise.all([
        apiGet('/api/batches'),
        apiGet('/api/products/selection'),
      ]);

      if (batData.success) {
        setBatches(batData.data?.batches || []);
      }
      if (prodData.success) {
        const prodItems = prodData.data?.items || [];
        setProducts(prodItems);
        if (prodItems.length > 0 && !formData.productId) {
          const first = prodItems[0];
          setFormData(prev => ({
            ...prev,
            productId: first.id,
            mrpReference: Number(first.mrp || 650),
          }));
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load batches' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || !formData.batchNumber.trim()) {
      setFeedback({ type: 'error', message: 'Please select a product and enter a batch number.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await apiPost('/api/batches', {
        productId: formData.productId,
        batchNumber: formData.batchNumber,
        batchDate: formData.batchDate,
        quantity: Number(formData.quantity),
        purchaseTpValue: Number(formData.purchaseTpValue),
        mrpReference: Number(formData.mrpReference),
        exciseReference: formData.exciseReference || undefined,
        documentReference: formData.documentReference || undefined,
        remarks: formData.remarks || undefined,
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create batch');
      }

      setFeedback({ type: 'success', message: `Batch ${formData.batchNumber} created successfully!` });
      setFormData(prev => ({
        ...prev,
        batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
        quantity: 24,
        exciseReference: '',
        documentReference: '',
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
    if (batches.length === 0) return;
    const headers = ['Batch #', 'Date', 'Product', 'Quantity', 'Purchase / TP Value', 'MRP Ref', 'Excise Ref', 'Remarks'];
    const rows = batches.map(b => [
      b.batch_number || '',
      b.batch_date || '',
      b.product?.name || '',
      b.quantity || 0,
      b.purchase_tp_value || 0,
      b.mrp_reference || 0,
      b.excise_reference || '',
      b.remarks || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Batches_Stock_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredBatches = batches.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.batch_number?.toLowerCase().includes(q) ||
      b.product?.name?.toLowerCase().includes(q) ||
      b.excise_reference?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <QrCode className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Batches & Consignment Lots
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Maintain lot-wise tracking, production batch timestamps, and excise reference numbers.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Batch Creation Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Register New Batch</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Product & Pack Size Selector */}
            <div className="col-span-1 sm:col-span-2">
              <ProductPackSizeSelector
                products={products}
                value={formData.productId}
                onChange={productId => setFormData({ ...formData, productId })}
                required
              />
            </div>

            {/* Batch Number */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Batch Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.batchNumber}
                onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Batch Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.batchDate}
                onChange={e => setFormData({ ...formData, batchDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Batch Quantity (Units) <span className="text-amber-400">*</span>
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
                Total Purchase TP Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.purchaseTpValue}
                onChange={e => setFormData({ ...formData, purchaseTpValue: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
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
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* Excise Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Excise Reference #
              </label>
              <input
                type="text"
                placeholder="e.g. EXC-LOT-500"
                value={formData.exciseReference}
                onChange={e => setFormData({ ...formData, exciseReference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Document Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Document / Challan Ref
              </label>
              <input
                type="text"
                placeholder="e.g. DC-102"
                value={formData.documentReference}
                onChange={e => setFormData({ ...formData, documentReference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{saving ? 'Creating Batch...' : 'Register Batch'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Batches Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Batches List</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {filteredBatches.length} batches
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search batch #, product..."
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
                <th className="px-4 py-3">Batch Number</th>
                <th className="px-4 py-3">Batch Date</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">TP Valuation (₹)</th>
                <th className="px-4 py-3 text-right">MRP Ref (₹)</th>
                <th className="px-4 py-3">Excise Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-xs">
                    No batches found. Register a new batch above.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-amber-300">
                      {b.batch_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {b.batch_date}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {b.product?.name || 'Product'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400 font-mono">
                      {b.quantity || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white font-mono">
                      ₹{Number(b.purchase_tp_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 font-mono">
                      ₹{Number(b.mrp_reference || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-400">
                      {b.excise_reference || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
