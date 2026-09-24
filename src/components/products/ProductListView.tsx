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
import { apiGet, apiPut, apiDelete } from '../../utils/api';

interface ProductListViewProps {
  language: SupportedLanguage;
}

export const ProductListView: React.FC<ProductListViewProps> = ({ language }) => {
  const t = translations[language];

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
        const url = selectedCategory ? `/api/brands?categoryId=${selectedCategory}&limit=100` : '/api/brands?limit=100';
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
      setMeta(data.data.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
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
      setActionMessage({
        type: 'success',
        text: `Product "${statusConfirmProduct.name}" is now ${newStatus}.`,
      });
      setStatusConfirmProduct(null);
      fetchProducts();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error updating product' });
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
      setActionMessage({
        type: 'success',
        text: `Product "${deleteConfirmProduct.name}" deleted successfully.`,
      });
      setDeleteConfirmProduct(null);
      fetchProducts();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete product' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Package className="w-6 h-6 text-amber-400" />
            <span>{t.productsTitle}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Production SKU register, category-brand relationships, excise pack specifications & pricing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <Tag className="w-4 h-4 text-amber-400" />
            <span>Paste from Excel / Copy-Paste</span>
          </button>
          <button
            onClick={() => {
              setProductToEdit(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addProduct}</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t.searchProducts}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
            />
          </div>

          {/* Category Filter */}
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

          {/* Brand Filter (Dependent on selectedCategory) */}
          <div>
            <select
              value={selectedBrand}
              onChange={e => {
                setSelectedBrand(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            >
              <option value="">{t.allBrands}</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            >
              <option value="all">{t.allStatus}</option>
              <option value="Active">{t.active}</option>
              <option value="Inactive">{t.inactive}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="table-container">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">{t.productName}</th>
                <th className="py-3.5 px-3">{t.category}</th>
                <th className="py-3.5 px-3">{t.brand}</th>
                <th className="py-3.5 px-3">{t.packSize}</th>
                <th className="py-3.5 px-3 text-right">{t.purchasePrice}</th>
                <th className="py-3.5 px-3 text-right">{t.sellingPrice} / MRP</th>
                <th className="py-3.5 px-3 text-center">{t.currentStock}</th>
                <th className="py-3.5 px-3 text-center">{t.status}</th>
                <th className="py-3.5 px-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span>{t.loading}</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-medium text-slate-300">{t.noDataFound}</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting search criteria or add your first product.</p>
                  </td>
                </tr>
              ) : (
                products.map(product => {
                  const isLowStock = (product.inventory?.current_stock ?? 0) <= (product.inventory?.minimum_stock ?? 5);
                  return (
                    <tr key={product.id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Product Name & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                          {product.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                          <span>SKU: {product.sku || 'N/A'}</span>
                          {product.compliance_ref && (
                            <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              {product.compliance_ref}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {product.category?.name || 'N/A'}
                        </span>
                      </td>

                      {/* Brand */}
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-200">{product.brand?.name || 'N/A'}</div>
                      </td>

                      {/* Pack Size & Type */}
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-200">
                          {product.pack_size ? `${product.pack_size.name} (${product.pack_size.volume_ml} ml)` : `${product.pack_type || 'Bottle'}`}
                        </div>
                        <div className="text-xs text-slate-500 capitalize">{product.pack_type}</div>
                      </td>

                      {/* Purchase Price */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                        ₹{Number(product.purchase_price).toFixed(2)}
                      </td>

                      {/* Selling Price / MRP */}
                      <td className="py-3.5 px-3 text-right font-mono">
                        <div className="font-semibold text-amber-400">
                          ₹{Number(product.selling_price).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500">
                          MRP: ₹{Number(product.mrp).toFixed(2)}
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-mono ${
                            isLowStock
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {product.inventory?.current_stock ?? 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            product.status === 'Active'
                              ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {product.status === 'Active' ? t.active : t.inactive}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button
                            onClick={() => {
                              setProductToEdit(product);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title={t.editProduct}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          <button
                            onClick={() => setStatusConfirmProduct(product)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              product.status === 'Active'
                                ? 'text-emerald-400 hover:text-amber-400 hover:bg-slate-800'
                                : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-800'
                            }`}
                            title={product.status === 'Active' ? t.deactivate : t.activate}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteConfirmProduct(product)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title={t.deleteProduct}
                          >
                            <Trash2 className="w-4 h-4" />
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
        <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              {t.showing} {meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1} -{' '}
              {Math.min(meta.page * meta.limit, meta.total)} {t.of} {meta.total}
            </span>
            <span className="text-slate-600">|</span>
            <label className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={e => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-white"
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
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t.previous}</span>
            </button>
            <span className="px-2 font-mono text-slate-300">
              {meta.page} / {Math.max(1, meta.totalPages)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
            >
              <span>{t.next}</span>
              <ChevronRight className="w-4 h-4" />
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
      {statusConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {statusConfirmProduct.status === 'Active' ? t.confirmDeactivateTitle : 'Activate Product?'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {statusConfirmProduct.status === 'Active'
                    ? t.confirmDeactivateMsg
                    : 'Activating this product makes it immediately available in new POS billing sessions.'}
                </p>
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950 font-mono text-xs text-amber-400 border border-slate-800">
                  {statusConfirmProduct.name}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusConfirmProduct(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{statusConfirmProduct.status === 'Active' ? t.deactivate : t.activate}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t.confirmDeleteTitle}</h3>
                <p className="text-xs text-slate-400 mt-1">{t.confirmDeleteMsg}</p>
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950 font-mono text-xs text-rose-300 border border-slate-800">
                  {deleteConfirmProduct.name}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.deleteProduct}</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
