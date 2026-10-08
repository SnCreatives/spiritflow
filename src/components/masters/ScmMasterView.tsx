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
  Download,
  Upload,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';
import { ScmBulkImportModal } from './ScmBulkImportModal';
import { ModalShell } from '../common/ModalShell';

export const ScmMasterView: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
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

  // Bulk Import State
  const [showImportModal, setShowImportModal] = useState(false);

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
    setSaveStatus('saving');
    try {
      const res = await apiPost('/api/scm-codes', {
        productId: selectedProduct.productId,
        scmCode: cleanScm,
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || undefined,
        description: description.trim() || undefined,
      });

      if (res.success) {
        setSaveStatus('saved');
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
      setSaveStatus('idle');
    } finally {
      setSubmitting(false);
      setTimeout(() => setSaveStatus('idle'), 1500);
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

  const handleExport = (type: 'csv' | 'excel') => {
    if (scmCodes.length === 0) {
      showError('No data to export.');
      return;
    }

    const data = scmCodes.map(row => ({
      'SCM Code': row.scm_code,
      'Product Name': row.product?.name || row.product?.product_name || '-',
      'SKU': row.product?.sku || '-',
      'Category': row.product?.category?.name || '-',
      'Brand': row.product?.brand?.name || row.product?.brand?.brand_name || '-',
      'Effective From': row.effective_from,
      'Effective To': row.effective_to || 'Present',
      'Status': row.is_active ? 'Active' : 'Inactive',
      'Notes': row.description || row.source_reference || '-'
    }));

    if (type === 'csv') {
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `LiquorFlow_SCM_Export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SCM Codes');
      XLSX.writeFile(wb, `LiquorFlow_SCM_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
    showSuccess(`${type.toUpperCase()} Export started.`);
  };

  return (
    <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* 2. SIMPLE PAGE STRUCTURE: Page Title, Short description, Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">SCM Codes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maharashtra State Excise regulatory codes mapped to canonical liquor products.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import</span>
          </button>

          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Add SCM Code</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search SCM Code or Product..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 w-64 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <label htmlFor="activeOnly" className="flex items-center gap-2 text-xs text-slate-700 select-none cursor-pointer">
            <input
              type="checkbox"
              id="activeOnly"
              checked={filterActiveOnly}
              onChange={e => setFilterActiveOnly(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-0"
            />
            <span>Active Mappings Only</span>
          </label>
        </div>

        <button
          onClick={fetchScmCodes}
          disabled={loading}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* SCM Code Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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
      <ModalShell
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Assign SCM Code to Product"
        icon={<ShieldCheck className="w-5 h-5" />}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer transition-colors border border-slate-300"
            >
              Cancel
            </button>
            <button
              form="scm-form"
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Product Selector */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <CanonicalProductSelector
              onSelectProduct={prod => setSelectedProduct(prod)}
              selectedProductId={selectedProduct?.productId}
            />
          </div>

          <form id="scm-form" onSubmit={handleCreateScm} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official SCM Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SCM-MH-1004"
                  value={newScmCode}
                  onChange={e => setNewScmCode(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-md border border-slate-300 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Effective From Date *
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Effective To Date (Optional)
                </label>
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={e => setEffectiveTo(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Regulatory Reference / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra Gazette 2026 Notification"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </form>
        </div>
      </ModalShell>

      {/* History Modal */}
      <ModalShell
        isOpen={!!viewingHistoryProduct}
        onClose={() => setViewingHistoryProduct(null)}
        title="SCM Code Audit History"
        subtitle={viewingHistoryProduct ? `Product: ${viewingHistoryProduct.name || viewingHistoryProduct.product_name}` : ''}
        icon={<History className="w-5 h-5" />}
        maxWidth="max-w-xl"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => setViewingHistoryProduct(null)}
              className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="divide-y divide-slate-100">
          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />
              <p className="text-sm font-medium">Loading historical audit records...</p>
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No historical SCM versions recorded for this product.</p>
            </div>
          ) : (
            historyRecords.map(h => (
              <div key={h.id} className="py-4 flex items-center justify-between group">
                <div>
                  <span className="text-sm font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                    {h.scm_code}
                  </span>
                  <span className="text-xs text-slate-500 block mt-1.5 font-medium">
                    {h.description || 'Regulatory SCM assignment'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono text-slate-600 block mb-1">
                    {h.effective_from || 'Start'} → {h.effective_to || 'Present'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      h.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {h.is_active ? 'Active' : 'Superceded'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ModalShell>

      {/* Bulk Import Modal */}
      <ScmBulkImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={fetchScmCodes}
      />
    </div>
  );
};
