import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowDownToLine,
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
  Truck,
  Trash2,
  Eye,
  FileEdit,
  X,
  Lock,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';

export const PurchasesView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Inward Purchase Form State
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tpNumber, setTpNumber] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductDetail | null>(null);
  const [quantity, setQuantity] = useState<number>(12);
  const [purchaseTpPrice, setPurchaseTpPrice] = useState<number>(0);
  const [mrpReference, setMrpReference] = useState<number>(0);
  const [excisePassRef, setExcisePassRef] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Modals State
  const [viewingPurchase, setViewingPurchase] = useState<any | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [editRemarks, setEditRemarks] = useState<string>('');

  // Clear component state on bar change
  useEffect(() => {
    setPurchases([]);
    setSelectedProduct(null);
  }, [selectedBar?.id]);

  const fetchPurchases = useCallback(async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setLoading(true);
    try {
      const res = await apiGet(`/api/inventory/purchases?barId=${encodeURIComponent(selectedBar.id)}&limit=150`);
      if (res.success) {
        setPurchases(res.data?.purchases || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load received inward purchases.');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, showError]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // Update default pricing on product selection
  useEffect(() => {
    if (selectedProduct) {
      setPurchaseTpPrice(selectedProduct.purchaseTpPrice || 0);
      setMrpReference(selectedProduct.mrp || 0);
    }
  }, [selectedProduct]);

  // Handler: Record Inward Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar before creating this transaction.');
      return;
    }

    if (!selectedProduct) {
      showError('Please select a product using the cascading selector.');
      return;
    }

    if (quantity <= 0) {
      showError('Quantity must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const generatedPo = `TP-INW-${Date.now().toString().slice(-6)}`;
      const res = await apiPost('/api/inventory/purchases', {
        barId: selectedBar.id,
        purchaseNumber: generatedPo,
        purchaseDate,
        tpPermitReference: tpNumber.trim() || undefined,
        exciseReference: excisePassRef.trim() || undefined,
        documentReference: supplierName.trim() ? `Supplier: ${supplierName.trim()}` : undefined,
        remarks: remarks.trim() || undefined,
        items: [
          {
            productId: selectedProduct.productId,
            quantity: Number(quantity),
            purchaseTpPrice: Number(purchaseTpPrice),
            mrpReference: Number(mrpReference),
          },
        ],
      });

      if (res.success) {
        showSuccess('Received stock added successfully.');
        // Reset inputs
        setQuantity(12);
        setTpNumber('');
        setSupplierName('');
        setExcisePassRef('');
        setRemarks('');
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Failed to record received stock.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Delete Purchase
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this received stock entry? Associated stock will be reverted.')) {
      return;
    }
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      const res = await apiDelete(`/api/inventory/purchases/${id}?barId=${encodeURIComponent(selectedBar.id)}`);
      if (res.success) {
        showSuccess('Received purchase deleted successfully.');
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Failed to delete purchase.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to delete purchase.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Update Purchase Remarks
  const handleUpdate = async () => {
    if (!editingPurchase || !selectedBar?.id) return;
    setSaving(true);
    try {
      const res = await apiPut(`/api/inventory/purchases/${editingPurchase.id}`, {
        barId: selectedBar.id,
        remarks: editRemarks,
      });

      if (res.success) {
        showSuccess('Changes updated successfully.');
        setEditingPurchase(null);
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Failed to update purchase.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (purchases.length === 0 || !selectedBar) return;
    const barName = selectedBar.name;
    let csv = `Selected Bar: ${barName}\nExport Date: ${new Date().toISOString()}\n\n`;
    csv += `Purchase #,Date,TP Number,Excise Pass,Supplier/Ref,Total Value (INR),Remarks\n`;
    purchases.forEach(p => {
      csv += `"${p.purchase_number}","${p.purchase_date}","${p.tp_permit_reference || ''}","${p.excise_reference || ''}","${p.document_reference || ''}",${p.total_value},"${p.remarks || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LiquorFlow_ReceivedStock_${barName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showSuccess('Export generated.');
  };

  const filteredPurchases = useMemo(() => {
    if (!search.trim()) return purchases;
    const q = search.toLowerCase();
    return purchases.filter(
      p =>
        p.purchase_number?.toLowerCase().includes(q) ||
        p.tp_permit_reference?.toLowerCase().includes(q) ||
        p.excise_reference?.toLowerCase().includes(q) ||
        p.document_reference?.toLowerCase().includes(q)
    );
  }, [purchases, search]);

  if (!selectedBar || selectedBar.id === 'ALL_BARS') {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-10 max-w-4xl mx-auto">
        <div className="p-8 text-center bg-white border border-amber-200 rounded-2xl shadow-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-700">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Specific Bar Selection Required</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Select a specific bar to create or modify operational transactions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <Truck className="w-4 h-4" />
            Stock Inward & Consignments
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Received Stock / Transport Permit (TP) Inward
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Bar:{' '}
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {selectedBar.name}
            </span>
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={purchases.length === 0}
          className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export Inward Register
        </button>
      </div>

      {/* Inward Form Card */}
      <form onSubmit={handleSubmitPurchase} className="space-y-6">
        <CanonicalProductSelector
          onSelectProduct={prod => setSelectedProduct(prod)}
          selectedProductId={selectedProduct?.productId}
        />

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Inward Consignment & Permit Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Inward Date *
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                TP Number *
              </label>
              <input
                type="text"
                placeholder="e.g. TP-MH-2026-8802"
                value={tpNumber}
                onChange={e => setTpNumber(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-medium font-mono rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Supplier / Distillery Name
              </label>
              <input
                type="text"
                placeholder="e.g. United Spirits Ltd / Allied Distilleries"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Excise Pass / Reference
              </label>
              <input
                type="text"
                placeholder="e.g. EX-PASS-9901"
                value={excisePassRef}
                onChange={e => setExcisePassRef(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium font-mono rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Received Quantity (Units) *
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Purchase TP Cost (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchaseTpPrice}
                onChange={e => setPurchaseTpPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Retail MRP (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={mrpReference}
                onChange={e => setMrpReference(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Remarks
              </label>
              <input
                type="text"
                placeholder="Consignment verified & stamped"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-600">
              Total Consignment Cost:{' '}
              <strong className="text-base font-black text-slate-900">
                ₹{Number(quantity * purchaseTpPrice).toFixed(2)}
              </strong>
            </div>

            <button
              type="submit"
              disabled={saving || !selectedProduct}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Record Received Stock
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Received Purchases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search TP #, PO #, or Supplier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchPurchases}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">TP Number / Permit</th>
                <th className="px-4 py-3">Supplier / Ref</th>
                <th className="px-4 py-3">Items Received</th>
                <th className="px-4 py-3 text-right">Inward Value (₹)</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading received stock consignments...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No received stock records found for {selectedBar.name}.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {p.purchase_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.purchase_date}</td>
                    <td className="px-4 py-3 font-mono text-amber-700">
                      {p.tp_permit_reference || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.document_reference || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {(p.items || []).map((item: any, idx: number) => (
                        <div key={idx}>
                          {item.product?.name || item.product?.product_name || 'Item'} x
                          <strong>{item.quantity}</strong>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      ₹{Number(p.total_value || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewingPurchase(p)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPurchase(p);
                            setEditRemarks(p.remarks || '');
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Edit Remarks"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Inward Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Consignment Details: {viewingPurchase.purchase_number}
              </h3>
              <button
                onClick={() => setViewingPurchase(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p>
                <strong>Date:</strong> {viewingPurchase.purchase_date}
              </p>
              <p>
                <strong>TP Number:</strong> {viewingPurchase.tp_permit_reference || 'N/A'}
              </p>
              <p>
                <strong>Excise Pass:</strong> {viewingPurchase.excise_reference || 'N/A'}
              </p>
              <p>
                <strong>Supplier/Ref:</strong> {viewingPurchase.document_reference || 'N/A'}
              </p>
              <p>
                <strong>Total Inward Value:</strong> ₹{viewingPurchase.total_value}
              </p>
              <p>
                <strong>Remarks:</strong> {viewingPurchase.remarks || 'None'}
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Remarks Modal */}
      {editingPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Update Inward Remarks: {editingPurchase.purchase_number}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Updated Remarks
              </label>
              <textarea
                rows={3}
                value={editRemarks}
                onChange={e => setEditRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPurchase(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Update Remarks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
