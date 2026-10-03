import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  PlusCircle,
  History,
  Calendar,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';

export const ScmMasterView: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scmCodes, setScmCodes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(true);

  // Add / Update Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductDetail | null>(null);
  const [newScmCode, setNewScmCode] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // History Modal State
  const [viewingHistoryProduct, setViewingHistoryProduct] = useState<any | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const fetchScmCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet(
        `/api/scm-codes?search=${encodeURIComponent(searchQuery)}&activeOnly=${filterActiveOnly}&limit=200`
      );
      if (res.success) {
        setScmCodes(res.data?.scmCodes || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to fetch SCM codes.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterActiveOnly, showError]);

  useEffect(() => {
    fetchScmCodes();
  }, [fetchScmCodes]);

  const handleCreateScm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      showError('Please select a valid canonical product.');
      return;
    }

    const cleanScm = newScmCode.trim();
    if (!cleanScm) {
      showError('Please enter a valid SCM code or reference.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost('/api/scm-codes', {
        productId: selectedProduct.productId,
        scmCode: cleanScm,
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || undefined,
        description: description.trim() || undefined,
      });

      if (res.success) {
        showSuccess('SCM Code assigned successfully.');
        setShowAddModal(false);
        setNewScmCode('');
        setDescription('');
        setSelectedProduct(null);
        fetchScmCodes();
      } else {
        throw new Error(res.error?.message || 'Failed to create SCM code mapping.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHistory = async (product: any) => {
    setViewingHistoryProduct(product);
    setLoadingHistory(true);
    try {
      const res = await apiGet(`/api/scm-codes/history/${product.id}`);
      if (res.success) {
        setHistoryRecords(res.data?.history || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load SCM history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            Maharashtra State Regulatory Master
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Excise SCM Code Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Decoupled regulatory codes mapped to canonical liquor products with temporal versioning.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Assign SCM Code
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search SCM Code or Product..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activeOnly"
              checked={filterActiveOnly}
              onChange={e => setFilterActiveOnly(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="activeOnly" className="text-xs font-bold text-slate-700 select-none">
              Active Mappings Only
            </label>
          </div>
        </div>

        <button
          onClick={fetchScmCodes}
          disabled={loading}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* SCM Code Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">SCM / Excise Code</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Effective Range</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading SCM regulatory codes...
                  </td>
                </tr>
              ) : scmCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No SCM code mappings found matching criteria.
                  </td>
                </tr>
              ) : (
                scmCodes.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-amber-700 text-sm">
                      {row.scm_code}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {row.product?.name || row.product?.product_name || 'Unknown Product'}
                      {row.product?.sku && (
                        <span className="block text-[10px] font-mono text-slate-400 font-normal">
                          SKU: {row.product.sku}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.product?.category?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.product?.brand?.name || row.product?.brand?.brand_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                      {row.effective_from || 'Always'} → {row.effective_to || 'Present'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleOpenHistory(row.product || { id: row.product_id })}
                        className="px-2.5 py-1 text-slate-700 hover:text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add SCM Code Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Assign SCM Code to Product
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Selector */}
            <CanonicalProductSelector
              onSelectProduct={prod => setSelectedProduct(prod)}
              selectedProductId={selectedProduct?.productId}
            />

            <form onSubmit={handleCreateScm} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Official SCM Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SCM-MH-1004"
                    value={newScmCode}
                    onChange={e => setNewScmCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Effective From Date *
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={e => setEffectiveFrom(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Effective To Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={e => setEffectiveTo(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Regulatory Reference / Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra Gazette 2026 Notification"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedProduct}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? 'Saving...' : 'Save SCM Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {viewingHistoryProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase">
                  SCM Code Audit History
                </h3>
                <p className="text-xs text-slate-600">
                  Product: {viewingHistoryProduct.name || viewingHistoryProduct.product_name}
                </p>
              </div>
              <button
                onClick={() => setViewingHistoryProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {loadingHistory ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                  Loading historical audit records...
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No historical SCM versions recorded for this product.
                </div>
              ) : (
                historyRecords.map(h => (
                  <div key={h.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-mono font-bold text-amber-800">
                        {h.scm_code}
                      </span>
                      <span className="text-xs text-slate-500 block">
                        {h.description || 'Regulatory SCM assignment'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono text-slate-600 block">
                        {h.effective_from || 'Start'} → {h.effective_to || 'Present'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          h.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {h.is_active ? 'Active' : 'Superceded'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setViewingHistoryProduct(null)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
