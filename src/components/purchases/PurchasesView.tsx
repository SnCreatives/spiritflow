import React, { useState, useEffect } from 'react';
import {
  ArrowDownToLine,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Building,
  Layers,
  FileText,
  IndianRupee,
  ShieldCheck,
  Truck,
  Trash2,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { apiGet, apiPost } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { BulkImportDialog } from '../common/BulkImportDialog';
import { ProductPackSizeSelector } from '../common/ProductPackSizeSelector';

interface PurchasesViewProps {
  language: SupportedLanguage;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ language }) => {
  const t = translations[language];

  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bulk import state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Inward Purchase form state
  const [formData, setFormData] = useState({
    purchaseNumber: `PUR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
    purchaseDate: new Date().toISOString().split('T')[0],
    tpPermitReference: '',
    exciseReference: '',
    documentReference: '',
    productId: '',
    batchNumber: '',
    quantity: 12,
    purchaseTpPrice: 500,
    mrpReference: 650,
    remarks: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purData, prodData] = await Promise.all([
        apiGet('/api/inventory/purchases'),
        apiGet('/api/products/selection'),
      ]);

      if (purData.success) {
        setPurchases(purData.data?.purchases || []);
      }
      if (prodData.success) {
        const prodItems = prodData.data?.items || [];
        setProducts(prodItems);
        if (prodItems.length > 0 && !formData.productId) {
          const p = prodItems[0];
          setFormData(prev => ({
            ...prev,
            productId: p.id,
            purchaseTpPrice: Number(p.purchase_price || 500),
            mrpReference: Number(p.mrp || 650),
          }));
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load purchases' });
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
      setFeedback({ type: 'error', message: 'Please select product and a valid quantity.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await apiPost('/api/inventory/purchases', {
        purchaseNumber: formData.purchaseNumber,
        purchaseDate: formData.purchaseDate,
        tpPermitReference: formData.tpPermitReference || undefined,
        exciseReference: formData.exciseReference || undefined,
        documentReference: formData.documentReference || undefined,
        remarks: formData.remarks || undefined,
        items: [
          {
            productId: formData.productId,
            quantity: Number(formData.quantity),
            purchaseTpPrice: Number(formData.purchaseTpPrice),
            batchNumber: formData.batchNumber || undefined,
            mrpReference: Number(formData.mrpReference),
          },
        ],
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to record inward purchase');
      }

      setFeedback({ type: 'success', message: `Inward Purchase #${formData.purchaseNumber} recorded successfully!` });
      setFormData(prev => ({
        ...prev,
        purchaseNumber: `PUR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        batchNumber: '',
        tpPermitReference: '',
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
    if (purchases.length === 0) return;
    const headers = ['Purchase Number', 'Date', 'TP Permit / Ref', 'Total Value (₹)', 'Items Count', 'Remarks'];
    const rows = purchases.map(p => [
      p.purchase_number || '',
      p.purchase_date || '',
      p.tp_permit_reference || p.excise_reference || '',
      p.total_value || 0,
      p.items?.length || 1,
      p.remarks || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Purchases_Inward_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredPurchases = purchases.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.purchase_number?.toLowerCase().includes(q) ||
      p.tp_permit_reference?.toLowerCase().includes(q)
    );
  });

  const totalCalculated = formData.quantity * formData.purchaseTpPrice;

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Purchase / Inward
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Record verified wholesale inward liquor consignments, TP permits, and stock receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4 text-amber-400" />
            <span>Paste Inward Purchases from Excel</span>
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

      {/* Inward Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-400" />
          <span>Record Inward Consignment</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Purchase Number */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Purchase / Inward Ref <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.purchaseNumber}
                onChange={e => setFormData({ ...formData, purchaseNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.purchaseDate}
                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* TP Permit Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                TP Permit / Pass Ref
              </label>
              <input
                type="text"
                placeholder="e.g. TP-MH-2026-981"
                value={formData.tpPermitReference}
                onChange={e => setFormData({ ...formData, tpPermitReference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
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
                Batch Number
              </label>
              <input
                type="text"
                placeholder="e.g. BATCH-L908"
                value={formData.batchNumber}
                onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Inward Quantity */}
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

            {/* TP / Purchase Price */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Purchase / TP Rate (₹) <span className="text-amber-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.purchaseTpPrice}
                onChange={e => setFormData({ ...formData, purchaseTpPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* Total Inward Value (Read only) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Total Value (₹)
              </label>
              <div className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-emerald-400 text-xs font-bold font-mono">
                ₹{totalCalculated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Excise Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Excise Reference
              </label>
              <input
                type="text"
                placeholder="e.g. EXC-MAH-401"
                value={formData.exciseReference}
                onChange={e => setFormData({ ...formData, exciseReference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Document Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Invoice / Challan Reference
              </label>
              <input
                type="text"
                placeholder="e.g. INV-90210"
                value={formData.documentReference}
                onChange={e => setFormData({ ...formData, documentReference: e.target.value })}
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
                placeholder="e.g. Received via Transport Permit #887"
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
              className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{saving ? 'Processing Inward...' : 'Confirm Inward Consignment'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Purchase History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Purchase / Inward History</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {filteredPurchases.length} consignments
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search purchase or TP ref..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Inward #</th>
                <th className="px-4 py-3">TP Permit / Ref</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Total (₹)</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                    No inward purchase consignments found. Record your first purchase above.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {p.purchase_date}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-amber-300">
                      {p.purchase_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-400">
                      {p.tp_permit_reference || p.excise_reference || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {p.items && p.items.length > 0 ? (
                        <div>
                          <span className="font-semibold">{p.items[0]?.product?.name || 'Product'}</span>
                          <span className="text-[11px] text-slate-400 ml-1 font-mono">
                            ({p.items[0]?.quantity} @ ₹{p.items[0]?.purchase_tp_price})
                          </span>
                        </div>
                      ) : (
                        '1 item'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400 font-mono">
                      ₹{Number(p.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                      {p.remarks || '-'}
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
        module="purchases"
        language={language}
        onSuccess={() => {
          fetchData();
          setFeedback({
            type: 'success',
            message: 'Bulk inward purchases processed and linked to audit trail.',
          });
        }}
      />
    </div>
  );
};
