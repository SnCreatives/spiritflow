import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Brand, Category, SupportedLanguage } from '../../types';
import { translations } from '../../utils/i18n';
import { BulkImportDialog } from '../common/BulkImportDialog';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { compareCanonicalBrands } from '../../utils/canonicalBrands';

interface BrandMasterViewProps {
  language: SupportedLanguage;
}

const CATEGORY_ORDER = [
  'whisky',
  'rum',
  'vodka',
  'gin',
  'brandy',
  'beer',
  'wine',
  'country liquor',
  'rtd',
  'pre-mixed',
];

const CATEGORY_ICONS: Record<string, string> = {
  whisky: '🥃',
  rum: '🍹',
  vodka: '🍸',
  gin: '🌿',
  brandy: '🍷',
  beer: '🍺',
  wine: '🍇',
  'country liquor': '🏺',
  rtd: '🥤',
};

export const BrandMasterView: React.FC<BrandMasterViewProps> = ({ language }) => {
  const t = translations[language];

  // Data states
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [brandToEdit, setBrandToEdit] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [maharashtraStatus, setMaharashtraStatus] = useState('Approved');
  const [registrationRef, setRegistrationRef] = useState('');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Action feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Categories
  useEffect(() => {
    async function loadAuxData() {
      try {
        const catData = await apiGet('/api/categories');
        if (catData.success && catData.data) {
          const list = Array.isArray(catData.data)
            ? catData.data
            : catData.data.categories || catData.data.items || [];
          setCategories(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error('Failed to load auxiliary data for brands:', err);
      }
    }
    loadAuxData();
  }, []);

  // Fetch Brands
  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '500',
      });
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('categoryId', selectedCategory);

      const data = await apiGet(`/api/brands?${params.toString()}`);

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch brands');
      }

      setBrands(data.data.items || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching brands');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const sortedCategories = useMemo(() => {
    const copy = [...categories];
    copy.sort((c1, c2) => {
      const idx1 = CATEGORY_ORDER.findIndex(k => c1.name.toLowerCase().includes(k));
      const idx2 = CATEGORY_ORDER.findIndex(k => c2.name.toLowerCase().includes(k));
      if (idx1 !== -1 && idx2 !== -1) return idx1 - idx2;
      if (idx1 !== -1) return -1;
      if (idx2 !== -1) return 1;
      return c1.name.localeCompare(c2.name);
    });
    return copy;
  }, [categories]);

  const groupedBrands = useMemo(() => {
    const groups: Array<{
      categoryId: string;
      categoryName: string;
      icon: string;
      brands: Brand[];
    }> = [];

    sortedCategories.forEach(cat => {
      const catBrands = brands
        .filter(b => b.category_id === cat.id)
        .sort((a, b) => compareCanonicalBrands(a.name, b.name));

      if (catBrands.length > 0) {
        const lower = cat.name.toLowerCase();
        const iconKey = Object.keys(CATEGORY_ICONS).find(k => lower.includes(k));
        groups.push({
          categoryId: cat.id,
          categoryName: cat.name,
          icon: iconKey ? CATEGORY_ICONS[iconKey] : '🏷️',
          brands: catBrands,
        });
      }
    });

    // Fallback if categories haven't loaded yet
    if (groups.length === 0 && brands.length > 0) {
      const mapByCat = new Map<string, { name: string; list: Brand[] }>();
      brands.forEach(b => {
        const cId = b.category_id || 'other';
        const cName = b.category?.name || 'Brands';
        if (!mapByCat.has(cId)) {
          mapByCat.set(cId, { name: cName, list: [] });
        }
        mapByCat.get(cId)!.list.push(b);
      });
      Array.from(mapByCat.entries()).forEach(([cId, info]) => {
        info.list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        const lower = info.name.toLowerCase();
        const iconKey = Object.keys(CATEGORY_ICONS).find(k => lower.includes(k));
        groups.push({
          categoryId: cId,
          categoryName: info.name,
          icon: iconKey ? CATEGORY_ICONS[iconKey] : '🏷️',
          brands: info.list,
        });
      });
    }

    return groups;
  }, [brands, sortedCategories]);

  const handleOpenAdd = () => {
    setBrandToEdit(null);
    setName('');
    setCategoryId(sortedCategories[0]?.id || '');
    setMaharashtraStatus('Approved');
    setRegistrationRef('');
    setActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (brand: Brand) => {
    setBrandToEdit(brand);
    setName(brand.name);
    setCategoryId(brand.category_id);
    setMaharashtraStatus(brand.maharashtra_status || 'Approved');
    setRegistrationRef(brand.registration_ref || '');
    setActive(brand.active);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) {
      setModalError('Brand name and Category are required');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload = {
        name: name.trim(),
        categoryId,
        maharashtraStatus,
        registrationRef: registrationRef.trim() || null,
        active,
      };

      const url = brandToEdit ? `/api/brands/${brandToEdit.id}` : '/api/brands';

      const data = brandToEdit
        ? await apiPut(url, payload)
        : await apiPost(url, payload);

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to save brand');
      }

      setIsModalOpen(false);
      setFeedback({ type: 'success', text: `Brand "${name}" saved successfully!` });
      fetchBrands();
    } catch (err: any) {
      setModalError(err.message || 'Error saving brand');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (brand: Brand) => {
    if (
      !confirm(
        `Are you sure you want to delete brand "${brand.name}"? If products reference it, deletion will be rejected.`
      )
    ) {
      return;
    }

    try {
      const data = await apiDelete(`/api/brands/${brand.id}`);
      if (!data.success) {
        throw new Error(data.error?.message || 'Cannot delete brand referenced by products');
      }
      setFeedback({ type: 'success', text: `Brand "${brand.name}" deleted.` });
      fetchBrands();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to delete brand' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-amber-400" />
            <span>{t.brandsTitle}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registered excise liquor and beer brands classified by category ({brands.length} Brands)
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
            <span>{t.addBrand}</span>
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
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white ml-4">
            ×
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t.searchBrands}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            >
              <option value="">{t.allCategories}</option>
              {sortedCategories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Category Filter Pills */}
        {sortedCategories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === ''
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              All
            </button>
            {sortedCategories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category-Grouped Brands Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="table-container">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">{t.brandName}</th>
                <th className="py-3.5 px-3">{t.category}</th>
                <th className="py-3.5 px-3">{t.maharashtraStatus}</th>
                <th className="py-3.5 px-3 text-center">{t.status}</th>
                <th className="py-3.5 px-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
                    <span>{t.loading}</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-rose-400">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                    <span>{error}</span>
                  </td>
                </tr>
              ) : groupedBrands.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-medium text-slate-300">{t.noDataFound}</p>
                  </td>
                </tr>
              ) : (
                groupedBrands.map(group => (
                  <React.Fragment key={group.categoryId}>
                    {/* Distinct Category Group Header Row */}
                    <tr className="bg-slate-950/90 border-y border-slate-800">
                      <td
                        colSpan={5}
                        className="py-2.5 px-4 text-xs font-bold tracking-widest uppercase text-amber-400"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span>{group.icon}</span>
                            <span>{group.categoryName.toUpperCase()}</span>
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {group.brands.length} Brands
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Brands in this Category */}
                    {group.brands.map(brand => (
                      <tr key={brand.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 pl-7 font-semibold text-white">
                          {brand.name}
                          {brand.registration_ref && (
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              Ref: {brand.registration_ref}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {brand.category?.name || group.categoryName}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-950/70 text-blue-400 border border-blue-800">
                            {brand.maharashtra_status || 'Approved'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              brand.active
                                ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {brand.active ? t.active : t.inactive}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(brand)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title={t.editBrand}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(brand)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title={t.close}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            {t.showing} {brands.length} {t.of} {brands.length} Brands across {groupedBrands.length} Categories
          </span>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <span>{brandToEdit ? t.editBrand : t.addBrand}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.brandName} <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Royal Stag"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

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
                  {sortedCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.maharashtraStatus}
                  </label>
                  <select
                    value={maharashtraStatus}
                    onChange={e => setMaharashtraStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400"
                  >
                    <option value="Approved">Approved</option>
                    <option value="Registered">Registered</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.regReference}
                  </label>
                  <input
                    type="text"
                    value={registrationRef}
                    onChange={e => setRegistrationRef(e.target.value)}
                    placeholder="e.g. MH-BR-2026"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="brandActive"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="brandActive" className="text-xs text-slate-300">
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
                  <span>{brandToEdit ? t.save : t.addBrand}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BulkImportDialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="brands"
        language={language}
        onSuccess={() => {
          fetchBrands();
          setFeedback({
            type: 'success',
            text: 'Bulk brands processed and linked to audit trail.',
          });
        }}
      />
    </div>
  );
};
