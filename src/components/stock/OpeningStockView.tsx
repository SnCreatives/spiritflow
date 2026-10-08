import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  Clipboard,
  X,
  Trash2,
  ChevronRight,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';
import { UniversalBulkEntryModal, BulkEntryRow } from '../common/UniversalBulkEntryModal';
import { ModalShell } from '../common/ModalShell';

export const OpeningStockView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  // Form State
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductDetail | null>(null);
  const [tpNumber, setTpNumber] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(10);
  const [remarks, setRemarks] = useState<string>('');

  useEffect(() => {
    setRecords([]);
    setSelectedProduct(null);
    setShowAddModal(false);
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
      showError(err.message || 'Failed to load opening stock records.');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar first.');
      return;
    }

    if (!selectedProduct) {
      showError('Please select a product.');
      return;
    }

    if (quantity <= 0) {
      showError('Quantity must be greater than zero.');
      return;
    }

    setSaveStatus('saving');
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
        setSaveStatus('saved');
        showSuccess('Opening stock saved successfully.');
        setQuantity(10);
        setTpNumber('');
        setRemarks('');
        setSelectedProduct(null);
        setShowAddModal(false);
        fetchData();
      } else {
        throw new Error(res.error?.message || 'Failed to save opening stock.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
      setSaveStatus('idle');
    } finally {
      setTimeout(() => setSaveStatus('idle'), 1500);
    }
  };

  const handleAddBulkOpeningStock = async (rows: BulkEntryRow[]) => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setSaveStatus('saving');
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
      showSuccess(`Successfully saved ${rows.length} opening stock entries.`);
      fetchData();
    } catch (err: any) {
      showError(err.message || 'Batch save failed.');
    } finally {
      setSaveStatus('idle');
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
      <div className="px-4 sm:px-6 py-12 max-w-xl mx-auto text-center">
        <div className="p-8 bg-white border border-slate-200 rounded-xl">
          <h2 className="text-base font-bold text-slate-900 mb-1">Select a Bar</h2>
          <p className="text-xs text-slate-500">
            Please choose a specific bar outlet to record opening stock.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto space-y-8 font-sans text-slate-700">
      {/* 1. SELECTION CHECK */}
      {!selectedBar || selectedBar.id === 'ALL_BARS' ? (
        <div className="px-4 sm:px-6 py-12 max-w-xl mx-auto text-center">
          <div className="p-12 bg-white border border-slate-200 rounded-3xl shadow-sm">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Clipboard className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Select a Bar</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Please choose a specific bar outlet to record opening stock baseline data.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 2. SIMPLE PAGE STRUCTURE: Page Title, Short description, Primary Action */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-8">
            <div>
              <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                <span>Inventory</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-indigo-600">Opening Stock</span>
              </nav>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Opening Stock Registry</h1>
              <p className="mt-2 text-slate-500 max-w-2xl text-sm leading-relaxed">
                Initialize baseline inventory levels for {selectedBar.name}. These records serve as the foundation for all subsequent stock movements and excise calculations.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowPasteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Clipboard className="w-4 h-4 text-slate-400" />
                <span>Paste from Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Opening Stock</span>
              </button>
            </div>
          </div>

          {/* 3. FILTER BAR: Refined search and filters */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by product name, SKU, brand..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              Refresh Data
            </button>
          </div>

          {/* 4. DATA TABLE: Professional ERP Table Layout */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Entry Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Brand / SKU</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Bottle Size</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Qty (Bottles)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">TP / Ref #</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <RefreshCw className="w-10 h-10 mb-3 text-indigo-200 animate-spin" />
                          <p className="text-slate-400 font-medium">Syncing registry records...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center opacity-40">
                          <Clipboard className="w-12 h-12 mb-3 text-slate-300" />
                          <p className="text-slate-500 font-medium">No opening stock records found</p>
                          <p className="text-xs text-slate-400 mt-1">Initialize your baseline inventory to get started</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r, i) => {
                      const p = r.product;
                      const dateStr = r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : '—';
                      return (
                        <tr key={r.id || i} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">
                            {dateStr}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900">{p?.name || p?.product_name || 'Item'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-600 rounded-sm uppercase tracking-tighter w-fit mb-1">
                                {p?.brand?.name || p?.brand_name || 'Generic'}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">SKU: {p?.sku || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-600 font-medium">
                              {p?.pack_size ? `${p.pack_size.volume_ml} ml` : 'Standard'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-mono font-bold text-indigo-600 text-base">
                              {r.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-500 whitespace-nowrap">
                            {r.reference_number || r.batch_number || '—'}
                          </td>
                          <td className="px-6 py-4 text-slate-500 max-w-xs truncate italic text-xs">
                            {r.remarks || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 5. MODALS: Use standardized ModalShell */}
      <ModalShell
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Opening Stock"
        subtitle="Initialize baseline inventory for a specific product"
        icon={<Plus className="w-5 h-5 text-indigo-600" />}
      >
        <form onSubmit={handleSingleSubmit} className="p-1 space-y-6">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Product Selection</label>
            <CanonicalProductSelector
              onSelectProduct={prod => setSelectedProduct(prod)}
              selectedProductId={selectedProduct?.productId}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Opening Date *</label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Initial Quantity (Bottles) *</label>
              <input
                type="number"
                required
                min="1"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">TP # / Reference</label>
              <input
                type="text"
                placeholder="e.g. TP-2026-9042"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={tpNumber}
                onChange={e => setTpNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Remarks</label>
              <input
                type="text"
                placeholder="e.g. Opening stock audit"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveStatus === 'saving' || !selectedProduct}
              className="px-8 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none cursor-pointer"
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Registry Saved' : 'Initialize Stock'}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Bulk Entry Modal */}
      <UniversalBulkEntryModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        module="opening-stock"
        language="en"
        onAddRows={handleAddBulkOpeningStock}
      />
    </div>
  );
};
