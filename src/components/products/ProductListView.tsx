import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Power,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Tag,
  Building,
  RefreshCw,
  Wine,
} from 'lucide-react';
import { Product, Category, Brand, SupportedLanguage, PaginationMeta } from '../../types';
import { translations } from '../../utils/i18n';
import { ProductModal } from './ProductModal';
import { BulkImportDialog } from '../common/BulkImportDialog';
import { UnifiedBrandSelector } from '../common/UnifiedBrandSelector';
import { CategorySelector } from '../common/MasterDataSelectors';
import { apiGet, apiPut, apiDelete } from '../../utils/api';
import { useToast } from '../../lib/contexts/ToastContext';
import { ModalShell } from '../common/ModalShell';

interface ProductListViewProps {
  language: SupportedLanguage;
}

export const ProductListView: React.FC<ProductListViewProps> = ({ language }) => {
  const t = translations[language];
  const { showToast } = useToast();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal & Action states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  // Status toggle confirmation
  const [statusConfirmProduct, setStatusConfirmProduct] = useState<Product | null>(null);
  // Delete confirmation
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load initial categories
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

  // Category-dependent brand loading for filter
  useEffect(() => {
    async function loadBrandsForFilter() {
      try {
        const url = selectedCategory ? `/api/brands?categoryId=${selectedCategory}&limit=500` : '/api/brands?limit=500';
        const data = await apiGet(url);
        if (data.success && data.data?.items) {
          setBrands(data.data.items);
          if (selectedBrand && !data.data.items.some((b: Brand) => b.id === selectedBrand)) {
            setSelectedBrand('');
          }
        }
      } catch (err) {
        console.error('Failed to load filter brands:', err);
      }
    }
    loadBrandsForFilter();
  }, [selectedCategory, selectedBrand]);

  // Fetch products with real-time backend pagination & filtering
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (selectedBrand) params.append('brandId', selectedBrand);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const data = await apiGet(`/api/products?${params.toString()}`);

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch products');
      }

      setProducts(data.data.items || []);
      setMeta(data.data.pagination || data.data.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err: any) {
      setError(err.message || 'Error communicating with database');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedCategory, selectedBrand, selectedStatus]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle status toggle (Active / Inactive)
  const handleToggleStatus = async () => {
    if (!statusConfirmProduct) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const newStatus = statusConfirmProduct.status === 'Active' ? 'Inactive' : 'Active';
      const data = await apiPut(`/api/products/${statusConfirmProduct.id}`, { status: newStatus });
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update status');
      }
      showToast(`Product "${statusConfirmProduct.name}" is now ${newStatus}.`, 'success');
      setStatusConfirmProduct(null);
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || 'Error updating product', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete
  const handleDeleteProduct = async () => {
    if (!deleteConfirmProduct) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const data = await apiDelete(`/api/products/${deleteConfirmProduct.id}`);
      if (!data.success) {
        throw new Error(data.error?.message || 'Cannot delete product referenced in transactions');
      }
      showToast(`Product "${deleteConfirmProduct.name}" deleted successfully.`, 'success');
      setDeleteConfirmProduct(null);
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete product', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 2. SIMPLE PAGE STRUCTURE: Page Title, Short description, Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.productsTitle}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Production SKU register, category-brand relationships, excise pack specifications & pricing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Paste from Excel</span>
          </button>
          <button
            onClick={() => {
              setProductToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addProduct}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t.searchProducts}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <CategorySelector
              value={selectedCategory}
              onChange={id => {
                setSelectedCategory(id);
                setPage(1);
              }}
              includeAllOption={true}
              allLabel={t.allCategories}
              theme="light"
            />
          </div>

          {/* Brand Filter (Category-Grouped Unified Selector) */}
          <div>
            <UnifiedBrandSelector
              value={selectedBrand}
              onChange={(id) => {
                setSelectedBrand(id);
                setPage(1);
              }}
              categories={categories}
              categoryId={selectedCategory || undefined}
              placeholder={t.allBrands}
              allowClear={true}
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
            >
              <option value="all">{t.allStatus}</option>
              <option value="Active">{t.active}</option>
              <option value="Inactive">{t.inactive}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-4">{t.productName}</th>
                <th className="py-2.5 px-3">{t.category}</th>
                <th className="py-2.5 px-3">{t.brand}</th>
                <th className="py-2.5 px-3">{t.packSize}</th>
                <th className="py-2.5 px-3 text-right">{t.purchasePrice}</th>
                <th className="py-2.5 px-3 text-right">{t.sellingPrice} / MRP</th>
                <th className="py-2.5 px-3 text-center">{t.currentStock}</th>
                <th className="py-2.5 px-3 text-center">{t.status}</th>
                <th className="py-2.5 px-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                      <span>{t.loading}</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="font-medium text-slate-700">{t.noDataFound}</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting search criteria or add your first product.</p>
                  </td>
                </tr>
              ) : (
                products.map(product => {
                  const isLowStock = (product.inventory?.current_stock ?? 0) <= (product.inventory?.minimum_stock ?? 5);
                  return (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                      {/* Product Name & SKU */}
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {product.name}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                          <span>SKU: {product.sku || 'N/A'}</span>
                          {product.compliance_ref && (
                            <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-600">
                              {product.compliance_ref}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          {product.category?.name || 'N/A'}
                        </span>
                      </td>

                      {/* Brand */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{product.brand?.name || 'N/A'}</div>
                      </td>

                      {/* Pack Size & Type */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">
                          {product.pack_size ? `${product.pack_size.name} (${product.pack_size.volume_ml} ml)` : `${product.pack_type || 'Bottle'}`}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize">{product.pack_type}</div>
                      </td>

                      {/* Purchase Price */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        ₹{Number(product.purchase_price).toFixed(2)}
                      </td>

                      {/* Selling Price / MRP */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-semibold text-slate-900">
                          ₹{Number(product.selling_price).toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          MRP: ₹{Number(product.mrp).toFixed(2)}
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold ${
                            isLowStock
                              ? 'text-amber-700 bg-amber-50'
                              : 'text-slate-900'
                          }`}
                        >
                          {product.inventory?.current_stock ?? 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            product.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {product.status === 'Active' ? t.active : t.inactive}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <button
                            onClick={() => {
                              setProductToEdit(product);
                              setIsModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                            title={t.editProduct}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          <button
                            onClick={() => setStatusConfirmProduct(product)}
                            className={`p-1 rounded cursor-pointer ${
                              product.status === 'Active'
                                ? 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
                            }`}
                            title={product.status === 'Active' ? t.deactivate : t.activate}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteConfirmProduct(product)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title={t.deleteProduct}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              {t.showing} {meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1} -{' '}
              {Math.min(meta.page * meta.limit, meta.total)} {t.of} {meta.total}
            </span>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={e => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-800"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{t.previous}</span>
            </button>
            <span className="px-2 font-mono text-slate-700">
              {meta.page} / {Math.max(1, meta.totalPages)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <span>{t.next}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setProductToEdit(null);
        }}
        onSuccess={fetchProducts}
        productToEdit={productToEdit}
        categories={categories}
        language={language}
      />

      {/* Deactivate / Status Confirmation Dialog */}
      <ModalShell
        isOpen={!!statusConfirmProduct}
        onClose={() => setStatusConfirmProduct(null)}
        title={statusConfirmProduct?.status === 'Active' ? t.confirmDeactivateTitle : 'Activate Product?'}
        icon={<Power className="w-5 h-5 text-amber-400" />}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setStatusConfirmProduct(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={actionLoading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{statusConfirmProduct?.status === 'Active' ? t.deactivate : t.activate}</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            {statusConfirmProduct?.status === 'Active'
              ? t.confirmDeactivateMsg
              : 'Activating this product makes it immediately available in new POS billing sessions.'}
          </p>
          <div className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-amber-400 border border-slate-800 flex items-center justify-between">
            <span className="truncate">{statusConfirmProduct?.name}</span>
            <span className="shrink-0 text-slate-600 ml-2">ID: {statusConfirmProduct?.id.substring(0, 8)}</span>
          </div>
        </div>
      </ModalShell>

      {/* Delete Confirmation Dialog */}
      <ModalShell
        isOpen={!!deleteConfirmProduct}
        onClose={() => setDeleteConfirmProduct(null)}
        title={t.confirmDeleteTitle}
        icon={<Trash2 className="w-5 h-5 text-rose-400" />}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteConfirmProduct(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleDeleteProduct}
              disabled={actionLoading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{t.deleteProduct}</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            {t.confirmDeleteMsg}
          </p>
          <div className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-rose-300 border border-slate-800 flex items-center justify-between">
            <span className="truncate">{deleteConfirmProduct?.name}</span>
            <span className="shrink-0 text-slate-600 ml-2">ID: {deleteConfirmProduct?.id.substring(0, 8)}</span>
          </div>
        </div>
      </ModalShell>
      <BulkImportDialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="products"
        language={language}
        onSuccess={fetchProducts}
      />
    </div>
  );
};
