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
import { validateBrandsSchemaAndMapping } from '../../utils/brandValidation';
import { translations } from '../../utils/i18n';
import { BulkImportDialog } from '../common/BulkImportDialog';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { compareCanonicalBrands } from '../../utils/canonicalBrands';
import { useToast } from '../../lib/contexts/ToastContext';
import { useFormMutation } from '../../hooks/useFormMutation';
import { ModalShell } from '../common/ModalShell';
import { CategorySelector, BrandSelector } from '../common/MasterDataSelectors';
import { useCategories, clearBrandsCache } from '../../hooks/useMasterData';

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
  const { showToast } = useToast();

  // Data states
  const [brands, setBrands] = useState<Brand[]>([]);
  const { categories } = useCategories();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  // Bulk Selection & Batch Action States
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<string>>(new Set());
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState(false);
  const [targetBatchCategoryId, setTargetBatchCategoryId] = useState('');
  const [isBatchActionRunning, setIsBatchActionRunning] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [brandToEdit, setBrandToEdit] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [maharashtraStatus, setMaharashtraStatus] = useState('Approved');
  const [registrationRef, setRegistrationRef] = useState('');
  const [active, setActive] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set<string>();
      brands.forEach(b => allIds.add(b.id));
      setSelectedBrandIds(allIds);
    } else {
      setSelectedBrandIds(new Set());
    }
  };

  const handleToggleSelectBrand = (id: string) => {
    const next = new Set(selectedBrandIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedBrandIds(next);
  };

  const handleBatchDelete = async () => {
    if (selectedBrandIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedBrandIds.size} selected brand(s)?`)) return;

    setIsBatchActionRunning(true);
    try {
      let successCount = 0;
      for (const id of Array.from(selectedBrandIds)) {
        try {
          await apiDelete(`/api/brands/${id}`);
          successCount++;
        } catch (e) {
          console.error(`Failed to delete brand ${id}:`, e);
        }
      }
      showToast(`Successfully deleted ${successCount} brand(s).`, 'success');
      setSelectedBrandIds(new Set());
      fetchBrands();
    } catch (err: any) {
      showToast(err.message || 'Batch delete failed', 'error');
    } finally {
      setIsBatchActionRunning(false);
    }
  };

  const handleBatchReassignCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBatchCategoryId || selectedBrandIds.size === 0) {
      showToast('Please select a target category.', 'error');
      return;
    }

    setIsBatchActionRunning(true);
    try {
      let successCount = 0;
      for (const id of Array.from(selectedBrandIds)) {
        const brandObj = brands.find(b => b.id === id);
        if (brandObj) {
          try {
            await apiPut(`/api/brands/${id}`, {
              name: brandObj.name,
              categoryId: targetBatchCategoryId,
              maharashtraStatus: brandObj.maharashtra_status || 'Approved',
              registrationRef: brandObj.registration_ref || null,
              active: brandObj.active,
            });
            successCount++;
          } catch (e) {
            console.error(`Failed to reassign brand ${id}:`, e);
          }
        }
      }
      showToast(`Successfully reassigned ${successCount} brand(s) to new category.`, 'success');
      setSelectedBrandIds(new Set());
      setIsBatchCategoryModalOpen(false);
      setTargetBatchCategoryId('');
      fetchBrands();
    } catch (err: any) {
      showToast(err.message || 'Batch category reassignment failed', 'error');
    } finally {
      setIsBatchActionRunning(false);
    }
  };

  // Fetch Brands with global error handling and schema validation
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

      const items = data.data.items || [];
      
      // Validate schema and category_id mapping
      const validation = validateBrandsSchemaAndMapping(items, selectedCategory || undefined);
      if (!validation.isValid && validation.errors.length > 0) {
        console.warn('⚠️ [BrandMasterView Schema Warning]:', validation.errors);
      }

      if (items.length === 0 && selectedCategory) {
        showToast('No existing brand records found for this category.', 'info');
      }

      setBrands(items);
    } catch (err: any) {
      const errorMsg = err.message || 'Error fetching brands';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, showToast]);

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
      let catBrands = brands
        .filter(b => b.category_id === cat.id)
        .sort((a, b) => compareCanonicalBrands(a.name, b.name));

      if (selectedBrandId) {
        catBrands = catBrands.filter(b => b.id === selectedBrandId);
      }

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
        if (selectedBrandId && b.id !== selectedBrandId) return;
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
  }, [brands, sortedCategories, selectedBrandId]);

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

  const { mutate: submitBrand, isSaving: isSubmitting } = useFormMutation(
    async (payload: any) => {
      const url = brandToEdit ? `/api/brands/${brandToEdit.id}` : '/api/brands';
      return brandToEdit ? apiPut(url, payload) : apiPost(url, payload);
    },
    {
      successMessage: () => brandToEdit ? `Brand "${name}" updated successfully!` : `Brand "${name}" added successfully!`,
      invalidateQueries: () => {
        clearBrandsCache();
        fetchBrands();
      },
      closeModal: () => setIsModalOpen(false),
      onError: (err) => setModalError(err.message),
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) {
      setModalError('Brand name and Category are required');
      return;
    }

    setModalError(null);
    submitBrand({
      name: name.trim(),
      categoryId,
      maharashtraStatus,
      registrationRef: registrationRef.trim() || null,
      active,
    });
  };

  const { mutate: executeDelete } = useFormMutation(
    async (brand: Brand) => apiDelete(`/api/brands/${brand.id}`),
    {
      successMessage: (data, brand) => `Brand "${brand.name}" deleted.`,
      invalidateQueries: () => {
        clearBrandsCache();
        fetchBrands();
      },
    }
  );

  const handleDelete = async (brand: Brand) => {
    if (
      !confirm(
        `Are you sure you want to delete brand "${brand.name}"? If products reference it, deletion will be rejected.`
      )
    ) {
      return;
    }

    executeDelete(brand);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 2. SIMPLE PAGE STRUCTURE: Page Title, Short description, Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.brandsTitle}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered excise liquor and beer brands classified by category ({brands.length} Brands)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addBrand}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t.searchBrands}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <CategorySelector
              value={selectedCategory}
              onChange={catId => {
                setSelectedCategory(catId);
                setSelectedBrandId('');
              }}
              includeAllOption={true}
              allLabel={t.allCategories}
              theme="light"
            />
          </div>

          <div>
            <BrandSelector
              categoryId={selectedCategory || undefined}
              value={selectedBrandId}
              onChange={setSelectedBrandId}
              includeAllOption={true}
              allLabel="All Brands"
              theme="light"
            />
          </div>
        </div>

        {/* Quick Category Filter Pills */}
        {sortedCategories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('');
                setSelectedBrandId('');
              }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === ''
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {sortedCategories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedBrandId('');
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category-Grouped Brands Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={brands.length > 0 && selectedBrandIds.size === brands.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer"
                    title="Select All Brands"
                  />
                </th>
                <th className="py-2.5 px-4">{t.brandName}</th>
                <th className="py-2.5 px-3">{t.category}</th>
                <th className="py-2.5 px-3">{t.maharashtraStatus}</th>
                <th className="py-2.5 px-3 text-center">{t.status}</th>
                <th className="py-2.5 px-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-500 mx-auto mb-2" />
                    <span>{t.loading}</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-rose-600">
                    <AlertCircle className="w-5 h-5 mx-auto mb-2" />
                    <span>{error}</span>
                  </td>
                </tr>
              ) : groupedBrands.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="font-medium text-slate-700">{t.noDataFound}</p>
                  </td>
                </tr>
              ) : (
                groupedBrands.map(group => (
                  <React.Fragment key={group.categoryId}>
                    {/* Distinct Category Group Header Row */}
                    <tr className="bg-slate-100/70 border-y border-slate-200">
                      <td
                        colSpan={6}
                        className="py-1.5 px-4 text-[11px] font-bold tracking-wider uppercase text-slate-800"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>{group.icon}</span>
                            <span>{group.categoryName}</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {group.brands.length} Brands
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Brands in this Category */}
                    {group.brands.map(brand => (
                      <tr key={brand.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedBrandIds.has(brand.id)}
                            onChange={() => handleToggleSelectBrand(brand.id)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {brand.name}
                          {brand.registration_ref && (
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              Ref: {brand.registration_ref}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {brand.category?.name || group.categoryName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {brand.maharashtra_status || 'Approved'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              brand.active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {brand.active ? t.active : t.inactive}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(brand)}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                              title={t.editBrand}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(brand)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title={t.close}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            {t.showing} {brands.length} {t.of} {brands.length} Brands across {groupedBrands.length} Categories
          </span>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={brandToEdit ? t.editBrand : t.addBrand}
        icon={<Tag className="w-5 h-5 text-amber-600" />}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              form="brand-form"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-md shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{brandToEdit ? t.save : t.addBrand}</span>
              )}
            </button>
          </div>
        }
      >
        <form id="brand-form" onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.brandName} <span className="text-amber-600">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Royal Stag"
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.category} <span className="text-amber-600">*</span>
            </label>
            <CategorySelector
              value={categoryId}
              onChange={setCategoryId}
              required={true}
              placeholder="-- Select Category --"
              theme="light"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.maharashtraStatus}
              </label>
              <select
                value={maharashtraStatus}
                onChange={e => setMaharashtraStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="Approved">Approved</option>
                <option value="Registered">Registered</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.regReference}
              </label>
              <input
                type="text"
                value={registrationRef}
                onChange={e => setRegistrationRef(e.target.value)}
                placeholder="e.g. MH-BR-2026"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <input
              type="checkbox"
              id="brandActive"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="brandActive" className="text-xs text-slate-700 cursor-pointer select-none">
              {t.active} (Available for product registration)
            </label>
          </div>
        </form>
      </ModalShell>

      <BulkImportDialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="brands"
        language={language}
        onSuccess={() => {
          fetchBrands();
          showToast('Bulk brands processed and linked to audit trail.', 'success');
        }}
      />
    </div>
  );
};
