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
  Clipboard,
  Copy,
  FileSpreadsheet,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';
import { UniversalBulkEntryModal, BulkEntryRow } from '../common/UniversalBulkEntryModal';

interface PurchaseItemRow {
  rowId: string;
  product: SelectedProductDetail | null;
  quantity: number;
  purchaseTpPrice: number;
  mrpReference: number;
  batchNumber: string;
}

export const PurchasesView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Inward Purchase Consignment Header Form State
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tpNumber, setTpNumber] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [excisePassRef, setExcisePassRef] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Multi-row items table state
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Modals State
  const [viewingPurchase, setViewingPurchase] = useState<any | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [editRemarks, setEditRemarks] = useState<string>('');

  // Clear component state on bar change
  useEffect(() => {
    setPurchases([]);
    setPurchaseItems([]);
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

  // Add empty row
  const handleAddRow = () => {
    setPurchaseItems(prev => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random()}`,
        product: null,
        quantity: 12,
        purchaseTpPrice: 0,
        mrpReference: 0,
        batchNumber: '',
      },
    ]);
  };

  // Duplicate Row
  const handleDuplicateRow = (index: number) => {
    const item = purchaseItems[index];
    if (!item) return;
    const duplicated: PurchaseItemRow = {
      ...item,
      rowId: `row-${Date.now()}-${Math.random()}`,
    };
    const updated = [...purchaseItems];
    updated.splice(index + 1, 0, duplicated);
    setPurchaseItems(updated);
    showSuccess('Row duplicated successfully.');
  };

  // Remove Row
  const handleRemoveRow = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  // Handle Bulk Import / Paste
  const handleAddBulkRows = (rows: BulkEntryRow[], replace: boolean) => {
    const newItems: PurchaseItemRow[] = rows.map((r, i) => ({
      rowId: `bulk-${Date.now()}-${i}`,
      product: r.matchedProductId
        ? {
            productId: r.matchedProductId,
            productName: r.matchedProductName || r.variant || 'Imported Product',
            sku: r.scmCode || '',
            productType: r.productType || 'Spirit',
            categoryId: '',
            categoryName: '',
            brandId: '',
            brandName: r.brandName || '',
            variant: r.variant || '',
            packSizeId: '',
            volumeMl: r.bottleSize || 750,
            packType: r.packaging || 'Bottle',
            mrp: r.mrp || 0,
            purchaseTpPrice: r.purchaseTpPrice || 0,
          }
        : null,
      quantity: r.quantity || 12,
      purchaseTpPrice: r.purchaseTpPrice || 0,
      mrpReference: r.mrp || 0,
      batchNumber: r.batchNumber || '',
    }));

    if (replace) {
      setPurchaseItems(newItems);
    } else {
      setPurchaseItems(prev => [...prev, ...newItems]);
    }
    showSuccess(`Successfully added ${newItems.length} items to form.`);
  };

  // Handler: Record Inward Purchase (Atomic Save)
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar before creating this transaction.');
      return;
    }

    if (purchaseItems.length === 0) {
      showError('Please add at least one purchase item or use Paste / Import.');
      return;
    }

    // Validate items
    for (let i = 0; i < purchaseItems.length; i++) {
      const item = purchaseItems[i];
      if (!item.product) {
        showError(`Row #${i + 1}: Please select a valid product.`);
        return;
      }
      if (item.quantity <= 0) {
        showError(`Row #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
    }

    setSaving(true);
    try {
      const generatedPo = tpNumber.trim() ? `TP-${tpNumber.trim()}` : `TP-INW-${Date.now().toString().slice(-6)}`;
      const res = await apiPost('/api/inventory/purchases', {
        barId: selectedBar.id,
        purchaseNumber: generatedPo,
        purchaseDate,
        tpPermitReference: tpNumber.trim() || undefined,
        exciseReference: excisePassRef.trim() || undefined,
        documentReference: supplierName.trim() ? `Supplier: ${supplierName.trim()}` : undefined,
        remarks: remarks.trim() || undefined,
        items: purchaseItems.map(item => ({
          productId: item.product!.productId,
          quantity: Number(item.quantity),
          purchaseTpPrice: Number(item.purchaseTpPrice),
          mrpReference: Number(item.mrpReference),
          batchNumber: item.batchNumber.trim() || undefined,
        })),
      });

      if (res.success) {
        showSuccess('Received stock consignment saved atomically successfully.');
        // Reset inputs
        setPurchaseItems([]);
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Clipboard className="w-4 h-4" />
            📋 Paste / Import / Excel
          </button>
          <button
            onClick={handleExportCSV}
            disabled={purchases.length === 0}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export Inward Register
          </button>
        </div>
      </div>

      {/* Inward Form Card */}
      <form onSubmit={handleSubmitPurchase} className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Consignment Header Details
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
                placeholder="e.g. United Spirits Ltd"
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
          </div>
        </div>

        {/* Multi-Row Items Table */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Consignment Line Items ({purchaseItems.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Add rows manually, duplicate existing rows, or paste directly from Excel / CSV.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Row
              </button>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <Clipboard className="w-4 h-4" />
                Paste / Import
              </button>
            </div>
          </div>

          {purchaseItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-xs text-slate-600 mb-3">No line items added yet in this consignment.</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-4 py-2 bg-slate-800 text-slate-100 text-xs font-medium rounded-xl hover:bg-slate-700"
                >
                  + Add First Row
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-amber-400"
                >
                  📋 Paste / Import from Excel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {purchaseItems.map((item, index) => (
                <div key={item.rowId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Line #{index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(index)}
                        title="Duplicate Row"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-white transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        title="Remove Row"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-white transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <CanonicalProductSelector
                    onSelectProduct={prod => {
                      const updated = [...purchaseItems];
                      updated[index].product = prod;
                      if (prod) {
                        updated[index].purchaseTpPrice = prod.purchaseTpPrice || 0;
                        updated[index].mrpReference = prod.mrp || 0;
                      }
                      setPurchaseItems(updated);
                    }}
                    selectedProductId={item.product?.productId}
                    compact={true}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setPurchaseItems(updated);
                        }}
                        required
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">TP Price (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.purchaseTpPrice}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].purchaseTpPrice = parseFloat(e.target.value) || 0;
                          setPurchaseItems(updated);
                        }}
                        required
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">MRP (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.mrpReference}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].mrpReference = parseFloat(e.target.value) || 0;
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Batch #</label>
                      <input
                        type="text"
                        placeholder="Optional batch"
                        value={item.batchNumber}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].batchNumber = e.target.value;
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-600">
              Total Consignment Items: <strong className="font-bold text-slate-900">{purchaseItems.length}</strong> | Total Value:{' '}
              <strong className="text-sm font-black text-slate-900">
                ₹{purchaseItems.reduce((acc, cur) => acc + (cur.quantity * cur.purchaseTpPrice), 0).toFixed(2)}
              </strong>
            </div>

            <button
              type="submit"
              disabled={saving || purchaseItems.length === 0}
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
                  Save Consignment Atomically
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
                <th className="px-4 py-3">Total Value</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading received inward purchases...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No received inward purchases recorded for {selectedBar.name}.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.purchase_number}</td>
                    <td className="px-4 py-3 text-slate-600">{p.purchase_date}</td>
                    <td className="px-4 py-3 font-mono text-slate-800">{p.tp_permit_reference || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.document_reference || '—'}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">₹{Number(p.total_value || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500">{p.remarks || '—'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setViewingPurchase(p)}
                        title="View Details"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingPurchase(p);
                          setEditRemarks(p.remarks || '');
                        }}
                        title="Edit Remarks"
                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors inline-flex items-center"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        title="Delete Purchase"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors inline-flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universal Bulk Import Modal */}
      <UniversalBulkEntryModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="purchases"
        language="en"
        onAddRows={handleAddBulkRows}
      />

      {/* View Purchase Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                Consignment Details — #{viewingPurchase.purchase_number}
              </h3>
              <button
                onClick={() => setViewingPurchase(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Date</span>
                  <strong className="text-slate-800">{viewingPurchase.purchase_date}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">TP Number</span>
                  <strong className="text-slate-800 font-mono">{viewingPurchase.tp_permit_reference || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Supplier / Ref</span>
                  <strong className="text-slate-800">{viewingPurchase.document_reference || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Value</span>
                  <strong className="text-emerald-700 font-mono">₹{Number(viewingPurchase.total_value || 0).toFixed(2)}</strong>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase mb-2">Consignment Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Product Name</th>
                        <th className="px-3 py-2">Quantity</th>
                        <th className="px-3 py-2">TP Price</th>
                        <th className="px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingPurchase.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-slate-900">{item.product?.name || item.product_name || 'Product'}</td>
                          <td className="px-3 py-2 font-mono text-slate-800">{item.quantity}</td>
                          <td className="px-3 py-2 font-mono text-slate-800">₹{item.purchase_tp_price}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">₹{item.total_price || (item.quantity * item.purchase_tp_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Remarks Modal */}
      {editingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Edit Purchase Remarks</h3>
              <button
                onClick={() => setEditingPurchase(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Remarks</label>
                <textarea
                  rows={3}
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingPurchase(null)}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
