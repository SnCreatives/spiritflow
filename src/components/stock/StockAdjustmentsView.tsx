import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  Download,
  Clipboard,
  X,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { UniversalBulkEntryModal, BulkEntryRow } from '../common/UniversalBulkEntryModal';
import { ModalShell } from '../common/ModalShell';

import { SearchableSelect } from '../common/SearchableSelect';

interface StockAdjustmentsViewProps {
  language?: string;
  selectedBarId?: string | null;
}

export const StockAdjustmentsView: React.FC<StockAdjustmentsViewProps> = ({ selectedBarId }) => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

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

  const activeBarId = selectedBarId || selectedBar?.id;

  const fetchData = async () => {
    if (!activeBarId || activeBarId === 'ALL_BARS') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setAdjustments([]);
    try {
      const adjUrl = `/api/inventory/adjustments?barId=${encodeURIComponent(activeBarId)}`;
      const [adjData, prodData] = await Promise.all([
        apiGet(adjUrl),
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
      showError(err.message || 'Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBarId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || formData.quantity <= 0) {
      showError('Please select a product and enter a positive quantity.');
      return;
    }

    setSaveStatus('saving');
    try {
      const result = await apiPost('/api/inventory/adjustments', {
        barId: activeBarId,
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

      setSaveStatus('saved');
      showSuccess(`Adjustment #${formData.adjustmentNumber} saved successfully.`);
      setShowAddModal(false);
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
      showError(err.message || 'Failed to record stock adjustment');
      setSaveStatus('idle');
    } finally {
      setTimeout(() => setSaveStatus('idle'), 1500);
    }
  };

  const handleBulkAdd = async (rows: BulkEntryRow[]) => {
    if (!activeBarId) return;
    try {
      for (const r of rows) {
        if (r.matchedProductId && r.quantity > 0) {
          await apiPost('/api/inventory/adjustments', {
            barId: activeBarId,
            adjustmentNumber: `ADJ-${Date.now().toString().slice(-5)}`,
            adjustmentDate: new Date().toISOString().split('T')[0],
            productId: r.matchedProductId,
            adjustmentType: 'ADJUSTMENT_IN',
            quantity: r.quantity,
            reason: r.remarks || 'Bulk Import Adjustment',
          });
        }
      }
      showSuccess(`Imported ${rows.length} adjustments.`);
      fetchData();
    } catch (err: any) {
      showError(err.message || 'Bulk adjustment failed.');
    }
  };

  const exportCSV = () => {
    if (adjustments.length === 0) return;
    const headers = ['Adjustment #', 'Date', 'Product', 'Type', 'Quantity', 'Reference', 'Reason', 'Remarks'];
    const rows = adjustments.map(a => [
      a.adjustment_number || '',
      a.adjustment_date || '',
      a.product?.name || a.product?.product_name || '',
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
    a.download = `Stock_Adjustments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showSuccess('Export downloaded.');
  };

  const filteredAdjustments = adjustments.filter(a => {
    const matchesType = typeFilter === 'All' || a.adjustment_type === typeFilter;
    if (!matchesType) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.adjustment_number?.toLowerCase().includes(q) ||
      a.product?.name?.toLowerCase().includes(q) ||
      a.product?.product_name?.toLowerCase().includes(q) ||
      a.reference?.toLowerCase().includes(q) ||
      a.reason?.toLowerCase().includes(q)
    );
  });

  if (!activeBarId || activeBarId === 'ALL_BARS') {
    return (
      <div className="px-4 sm:px-6 py-12 max-w-xl mx-auto text-center">
        <div className="p-8 bg-white border border-slate-200 rounded-xl">
          <h2 className="text-base font-bold text-slate-900 mb-1">Select a Bar</h2>
          <p className="text-xs text-slate-500">
            Please choose a specific bar outlet to record stock adjustments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto space-y-8 font-sans text-slate-700">
      {/* 1. SELECTION CHECK */}
      {!activeBarId || activeBarId === 'ALL_BARS' ? (
        <div className="px-4 sm:px-6 py-12 max-w-xl mx-auto text-center">
          <div className="p-12 bg-white border border-slate-200 rounded-3xl shadow-sm">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sliders className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Select a Bar</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Please choose a specific bar outlet to record stock adjustments.
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
                <span className="text-indigo-600">Stock Adjustments</span>
              </nav>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Stock Adjustments Registry</h1>
              <p className="mt-2 text-slate-500 max-w-2xl text-sm leading-relaxed">
                Audited inventory adjustments for {selectedBar?.name}. Record breakages, write-offs, returns, and inventory corrections with full audit trails.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportCSV}
                disabled={adjustments.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
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
                <span>New Adjustment</span>
              </button>
            </div>
          </div>

          {/* 3. FILTER BAR: Refined search and filters */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search adjustment #, product, reason..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-3 w-full lg:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex-1 lg:flex-none px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer"
              >
                <option value="All">All Adjustment Types</option>
                <option value="ADJUSTMENT_IN">Adjustment In (+)</option>
                <option value="ADJUSTMENT_OUT">Adjustment Out (-)</option>
                <option value="RETURN_IN">Return In (+)</option>
                <option value="RETURN_OUT">Return Out (-)</option>
                <option value="CORRECTION">Correction</option>
              </select>
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* 4. DATA TABLE: Professional ERP Table Layout */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Adjustment #</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product Description</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Reference / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <RefreshCw className="w-10 h-10 mb-3 text-indigo-200 animate-spin" />
                          <p className="text-slate-400 font-medium">Loading adjustments...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center opacity-40">
                          <Sliders className="w-12 h-12 mb-3 text-slate-300" />
                          <p className="text-slate-500 font-medium">No stock adjustments found</p>
                          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or record a new adjustment</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAdjustments.map((a, i) => {
                      const isOut = a.adjustment_type?.includes('OUT');
                      return (
                        <tr key={a.id || i} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-slate-900 uppercase">
                            {a.adjustment_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                            {a.adjustment_date}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900 block">{a.product?.name || a.product?.product_name || 'Item'}</span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">SKU: {a.product?.sku || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isOut ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {a.adjustment_type}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-right font-mono font-bold text-base ${isOut ? 'text-rose-500' : 'text-emerald-600'}`}>
                            {isOut ? `-${a.quantity}` : `+${a.quantity}`}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col max-w-xs">
                              <span className="text-xs font-bold text-slate-700 truncate">{a.reference || 'No Reference'}</span>
                              <span className="text-[11px] text-slate-400 truncate italic">{a.reason || a.remarks || 'No reason provided'}</span>
                            </div>
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
        title="New Stock Adjustment"
        subtitle="Record inventory breakage, return, or correction"
        icon={<Sliders className="w-5 h-5 text-indigo-600" />}
      >
        <form onSubmit={handleSubmit} className="p-1 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Adjustment Number *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formData.adjustmentNumber}
                onChange={e => setFormData({ ...formData, adjustmentNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Date *</label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formData.adjustmentDate}
                onChange={e => setFormData({ ...formData, adjustmentDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-2">Product Selection *</label>
            <SearchableSelect
              options={products.map(p => ({
                id: p.id,
                name: p.display_label || `${p.name} (${p.sku})`
              }))}
              value={formData.productId}
              onChange={val => setFormData({ ...formData, productId: val })}
              placeholder="Select Product"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Adjustment Type *</label>
              <select
                value={formData.adjustmentType}
                onChange={e => setFormData({ ...formData, adjustmentType: e.target.value as any })}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none cursor-pointer"
              >
                <option value="ADJUSTMENT_IN">Adjustment In (+)</option>
                <option value="ADJUSTMENT_OUT">Adjustment Out (-)</option>
                <option value="RETURN_IN">Return In (+)</option>
                <option value="RETURN_OUT">Return Out (-)</option>
                <option value="CORRECTION">Correction</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Quantity (Units) *</label>
              <input
                type="number"
                min="1"
                required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formData.quantity}
                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Reference #</label>
              <input
                type="text"
                placeholder="e.g. BREAKAGE-01"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formData.reference}
                onChange={e => setFormData({ ...formData, reference: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Reason</label>
              <input
                type="text"
                placeholder="e.g. Transit breakage"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
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
              disabled={saveStatus === 'saving'}
              className="px-8 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none cursor-pointer"
            >
              {saveStatus === 'saving' ? 'Processing...' : saveStatus === 'saved' ? 'Adjustment Saved' : 'Save Adjustment'}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Bulk Entry Modal */}
      <UniversalBulkEntryModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="adjustments"
        language="en"
        onAddRows={handleBulkAdd}
      />
    </div>
  );
};
