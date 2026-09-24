import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  Wine,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { PackSize, Category, SupportedLanguage, PaginationMeta } from '../../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { BulkImportDialog } from '../common/BulkImportDialog';

interface PackSizeMasterViewProps {
  language: SupportedLanguage;
}

export const PackSizeMasterView: React.FC<PackSizeMasterViewProps> = ({ language }) => {
  const t = translations[language];

  const [packSizes, setPackSizes] = useState<PackSize[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [packToEdit, setPackToEdit] = useState<PackSize | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [volumeMl, setVolumeMl] = useState<number | ''>('');
  const [packType, setPackType] = useState('Bottle');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await apiGet('/api/categories');
        if (data.success && data.data) {
          const list = Array.isArray(data.data) ? data.data : (data.data.categories || data.data.items || []);
          setCategories(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCategories();
  }, []);

  const fetchPackSizes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('categoryId', selectedCategory);

      const data = await apiGet(`/api/pack-sizes?${params.toString()}`);

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch pack sizes');
      }

      setPackSizes(data.data.items || []);
      setMeta(data.data.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err: any) {
      setError(err.message || 'Error fetching pack sizes');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, selectedCategory]);

  useEffect(() => {
    fetchPackSizes();
  }, [fetchPackSizes]);

  const handleOpenAdd = () => {
    setPackToEdit(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setVolumeMl('');
    setPackType('Bottle');
    setActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pack: PackSize) => {
    setPackToEdit(pack);
    setName(pack.name);
    setCategoryId(pack.category_id);
    setVolumeMl(pack.volume_ml);
    setPackType(pack.pack_type);
    setActive(pack.active);
    setModalError(null);
    setIsModalOpen(true);
  };

  const validatePackInput = (): boolean => {
    const vol = Number(volumeMl);
    if (!name.trim()) {
      setModalError('Pack size name is required');
      return false;
    }
    if (!categoryId) {
      setModalError('Category selection is required');
      return false;
    }
    if (volumeMl === '' || isNaN(vol) || vol <= 0) {
      setModalError('Volume must be a positive number in ml');
      return false;
    }

    // STRICT CONSTRAINT RULE: "Do not create 500 ml Pint"
    if (vol === 500 && packType.toLowerCase() === 'pint') {
      setModalError('500 ml Pint is invalid. In Indian excise, Pints are 330 ml or 375 ml, while 500 ml is classified as Can.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePackInput()) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload = {
        name: name.trim(),
        categoryId,
        volumeMl: Number(volumeMl),
        packType,
        active,
      };

      const url = packToEdit ? `/api/pack-sizes/${packToEdit.id}` : '/api/pack-sizes';
      const data = packToEdit 
        ? await apiPut(url, payload)
        : await apiPost(url, payload);

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to save pack size');
      }

      setIsModalOpen(false);
      setFeedback({ type: 'success', text: `Pack Size "${name}" saved successfully!` });
      fetchPackSizes();
    } catch (err: any) {
      setModalError(err.message || 'Error saving pack size');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (pack: PackSize) => {
    if (!confirm(`Are you sure you want to delete pack size "${pack.name}"? If products reference it, deletion will be rejected.`)) {
      return;
    }

    try {
      const data = await apiDelete(`/api/pack-sizes/${pack.id}`);
      if (!data.success) {
        throw new Error(data.error?.message || 'Cannot delete pack size referenced by products');
      }
      setFeedback({ type: 'success', text: `Pack Size "${pack.name}" deleted.` });
      fetchPackSizes();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to delete pack size' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-amber-400" />
            <span>{t.packSizesTitle}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Category-aware excise package definitions (Volume in ml, Bottle, Can, Nip, etc.)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Import</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addPackSize}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white ml-4">
            ×
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder={t.searchPackSizes}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            >
              <option value="">{t.allCategories}</option>
              {(Array.isArray(categories) ? categories : []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="table-container">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">{t.packSizeName}</th>
                <th className="py-3.5 px-3">{t.category}</th>
                <th className="py-3.5 px-3 text-right">{t.volumeMl}</th>
                <th className="py-3.5 px-3">{t.packType}</th>
                <th className="py-3.5 px-3 text-center">{t.status}</th>
                <th className="py-3.5 px-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
                    <span>{t.loading}</span>
                  </td>
                </tr>
              ) : packSizes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-medium text-slate-300">{t.noDataFound}</p>
                  </td>
                </tr>
              ) : (
                packSizes.map(pack => (
                  <tr key={pack.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {pack.name}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {pack.category?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                      {pack.volume_ml} ml
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="capitalize text-slate-300">{pack.pack_type}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          pack.active
                            ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {pack.active ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(pack)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title={t.editPackSize}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(pack)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title={t.close}
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

        {/* Pagination */}
        <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            {t.showing} {meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1} -{' '}
            {Math.min(meta.page * meta.limit, meta.total)} {t.of} {meta.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t.previous}</span>
            </button>
            <span className="px-2 font-mono text-slate-300">{meta.page} / {Math.max(1, meta.totalPages)}</span>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            >
              <span>{t.next}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>{packToEdit ? t.editPackSize : t.addPackSize}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.category} <span className="text-amber-400">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.packSizeName} <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Quart (750 ml) or Can (500 ml)"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.volumeMl} <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={volumeMl}
                    onChange={e => setVolumeMl(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="750"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.packType}
                  </label>
                  <select
                    value={packType}
                    onChange={e => setPackType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400"
                  >
                    <option value="Bottle">Bottle</option>
                    <option value="Can">Can</option>
                    <option value="Pint">Pint (330ml / 375ml)</option>
                    <option value="Nip">Nip (180ml)</option>
                    <option value="Keg">Keg (Draught)</option>
                  </select>
                </div>
              </div>

              {Number(volumeMl) === 500 && packType.toLowerCase() === 'pint' && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Reminder: 500 ml must be designated as 'Can' or 'Bottle', never 'Pint'.</span>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="packActive"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="packActive" className="text-xs text-slate-300">
                  {t.active} (Available for product registration)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{packToEdit ? t.save : t.addPackSize}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BulkImportDialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="pack-sizes"
        language={language}
        onSuccess={() => {
          fetchPackSizes();
          setFeedback({
            type: 'success',
            text: 'Bulk pack sizes processed and linked to audit trail.',
          });
        }}
      />
    </div>
  );
};
