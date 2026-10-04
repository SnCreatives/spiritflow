import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  FileSpreadsheet,
  Upload,
  Lock,
  X,
  Trash2,
  Clipboard,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';
import { UniversalBulkEntryModal, BulkEntryRow } from '../common/UniversalBulkEntryModal';

export const OpeningStockView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Single Entry Form State
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductDetail | null>(null);
  const [tpNumber, setTpNumber] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(10);
  const [remarks, setRemarks] = useState<string>('');

  // Multi-row Excel / TSV Paste State
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);

  // Clear operational records on bar switch
  useEffect(() => {
    setRecords([]);
    setSelectedProduct(null);
  }, [selectedBar?.id]);

  const fetchData = useCallback(async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setLoading(true);
    try {
      const recData = await apiGet(`/api/inventory/opening-stock?barId=${encodeURIComponent(selectedBar.id)}`);
      if (recData.success) {
        setRecords(recData.data?.records || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load opening stock records');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler: Single Opening Stock Submit
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar before creating opening stock.');
      return;
    }

    if (!selectedProduct) {
      showError('Please select a valid product using the cascading selector.');
      return;
    }

    if (quantity <= 0) {
      showError('Quantity must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiPost('/api/inventory/opening-stock', {
        barId: selectedBar.id,
        productId: selectedProduct.productId,
        quantity: Number(quantity),
        purchaseTpPrice: Number(selectedProduct.purchaseTpPrice || 0),
        tpPermitReference: tpNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      if (res.success) {
        showSuccess('Opening stock saved successfully.');
        setQuantity(10);
        setTpNumber('');
        setRemarks('');
        fetchData();
      } else {
        throw new Error(res.error?.message || 'Failed to save opening stock.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Universal Bulk Import Add Rows
  const handleAddBulkOpeningStock = async (rows: BulkEntryRow[]) => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setSaving(true);
    try {
      for (const r of rows) {
        if (r.matchedProductId && r.quantity > 0) {
          await apiPost('/api/inventory/opening-stock', {
            barId: selectedBar.id,
            productId: r.matchedProductId,
            quantity: r.quantity,
            tpPermitReference: r.tpNumber || undefined,
            remarks: r.remarks || 'Bulk Import Opening Stock',
          });
        }
      }
      showSuccess(`Successfully saved batch of ${rows.length} opening stock entries.`);
      fetchData();
    } catch (err: any) {
      showError(err.message || 'Batch save failed.');
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      r =>
        r.product?.name?.toLowerCase().includes(q) ||
        r.product?.sku?.toLowerCase().includes(q) ||
        r.product?.brand?.name?.toLowerCase().includes(q) ||
        r.batch_number?.toLowerCase().includes(q)
    );
  }, [records, search]);

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
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <FileInput className="w-4 h-4" />
            Stock Master & Baseline Entry
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Opening Stock & Baseline Quantities
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Bar:{' '}
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {selectedBar.name}
            </span>
          </p>
        </div>

        <button
          onClick={() => setShowPasteModal(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          <Clipboard className="w-4 h-4" />
          📋 Paste / Import / Excel
        </button>
      </div>

      {/* Single Entry Form Card */}
      <form onSubmit={handleSingleSubmit} className="space-y-6">
        <CanonicalProductSelector
          onSelectProduct={prod => setSelectedProduct(prod)}
          selectedProductId={selectedProduct?.productId}
        />

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Opening Stock Entry Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Opening Date *
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Initial Quantity (Bottles/Units) *
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
                TP Number / Reference
              </label>
              <input
                type="text"
                placeholder="e.g. TP-2026-9042"
                value={tpNumber}
                onChange={e => setTpNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Remarks / Notes
              </label>
              <input
                type="text"
                placeholder="Baseline stock verified"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
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
                  Record Opening Stock
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Historical Opening Stock Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search recorded opening stocks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchData}
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
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category / Brand</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3">Reference / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading opening records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No opening stock records found for {selectedBar.name}.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 text-slate-600">
                      {r.created_at?.split('T')[0] || r.transaction_date || 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {r.product?.name || r.product?.product_name || 'Product'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{r.product?.sku || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.product?.category?.name || '-'} • {r.product?.brand?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      +{r.quantity}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.batch_number ? `Batch: ${r.batch_number}` : r.remarks || '-'}
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
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        module="opening-stock"
        language="en"
        onAddRows={(rows) => handleAddBulkOpeningStock(rows)}
      />
    </div>
  );
};
