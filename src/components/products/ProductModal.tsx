import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Package, Layers, Tag, RefreshCw } from 'lucide-react';
import { Product, Category, Brand, PackSize, CreateProductInput, UpdateProductInput, SupportedLanguage } from '../../types';
import { translations } from '../../utils/i18n';
import { apiGet, apiPost, apiPut } from '../../utils/api';
import { UnifiedBrandSelector } from '../common/UnifiedBrandSelector';
import { CategorySelector } from '../common/MasterDataSelectors';
import { useToast } from '../../lib/contexts/ToastContext';
import { useFormMutation } from '../../hooks/useFormMutation';
import { ModalShell } from '../common/ModalShell';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: Product | null;
  categories: Category[];
  language: SupportedLanguage;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
  categories,
  language,
}) => {
  const t = translations[language];
  const { showToast } = useToast();

  // Form states
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [packSizeId, setPackSizeId] = useState('');
  const [sku, setSku] = useState('');
  const [packType, setPackType] = useState('Bottle');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [mrp, setMrp] = useState<number | ''>('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [complianceRef, setComplianceRef] = useState('');
  const [openingStock, setOpeningStock] = useState<number>(0);

  // Available dependent options
  const [brands, setBrands] = useState<Brand[]>([]);
  const [packSizes, setPackSizes] = useState<PackSize[]>([]);

  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Initialize form when editing or opening
  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setCategoryId(productToEdit.category_id || '');
      setBrandId(productToEdit.brand_id || '');
      setPackSizeId(productToEdit.pack_size_id || '');
      setSku(productToEdit.sku || '');
      setPackType(productToEdit.pack_type || 'Bottle');
      setPurchasePrice(productToEdit.purchase_price ?? '');
      setSellingPrice(productToEdit.selling_price ?? '');
      setMrp(productToEdit.mrp ?? '');
      setStatus(productToEdit.status || 'Active');
      setComplianceRef(productToEdit.compliance_ref || '');
      setOpeningStock(productToEdit.inventory?.opening_stock || 0);
    } else {
      setName('');
      setCategoryId(categories[0]?.id || '');
      setBrandId('');
      setPackSizeId('');
      setSku('');
      setPackType('Bottle');
      setPurchasePrice('');
      setSellingPrice('');
      setMrp('');
      setStatus('Active');
      setComplianceRef('');
      setOpeningStock(0);
    }
    setClientErrors({});
    setServerError(null);
  }, [productToEdit, isOpen, categories]);

  // Load category-dependent brands & pack sizes whenever categoryId changes
  useEffect(() => {
    if (!categoryId) {
      setBrands([]);
      setPackSizes([]);
      return;
    }

    async function loadCategoryDependencies() {
      setLoadingDependencies(true);
      try {
        const [brandData, packData] = await Promise.all([
          apiGet(`/api/brands?categoryId=${categoryId}&limit=500&activeOnly=true`),
          apiGet(`/api/pack-sizes?categoryId=${categoryId}&limit=500&activeOnly=true`),
        ]);

        if (brandData.success && brandData.data?.items) {
          setBrands(brandData.data.items);
          // Only reset brandId if current brandId does not belong to new category
          setBrandId(prev => {
            if (prev && brandData.data.items.some((b: Brand) => b.id === prev)) {
              return prev;
            }
            return !productToEdit && brandData.data.items.length > 0 ? brandData.data.items[0].id : prev;
          });
        }

        if (packData.success && packData.data?.items) {
          // Strictly exclude 500 ml Pint if any exists
          const validPacks = packData.data.items.filter(
            (p: PackSize) => !(p.volume_ml === 500 && p.pack_type.toLowerCase() === 'pint')
          );
          setPackSizes(validPacks);
          if (!productToEdit && validPacks.length > 0) {
            setPackSizeId(validPacks[0].id);
            setPackType(validPacks[0].pack_type);
          }
        }
      } catch (err) {
        console.error('Failed to load category dependencies:', err);
      } finally {
        setLoadingDependencies(false);
      }
    }

    loadCategoryDependencies();
  }, [categoryId, productToEdit]);

  // Handle Brand selection (also sync category if brand belongs to another category)
  const handleBrandChange = (selectedBrandId: string, selectedBrand?: Brand) => {
    setBrandId(selectedBrandId);
    if (selectedBrand?.category_id && selectedBrand.category_id !== categoryId) {
      setCategoryId(selectedBrand.category_id);
    }
  };

  // Auto-set pack type when Pack Size is chosen
  const handlePackSizeChange = (selectedPackSizeId: string) => {
    setPackSizeId(selectedPackSizeId);
    const chosenPack = packSizes.find(p => p.id === selectedPackSizeId);
    if (chosenPack) {
      setPackType(chosenPack.pack_type);
    }
  };

  // Auto-generate SKU preview
  useEffect(() => {
    if (!productToEdit && !sku && brandId && packSizeId) {
      const chosenCat = categories.find(c => c.id === categoryId);
      const chosenBrand = brands.find(b => b.id === brandId);
      const chosenPack = packSizes.find(p => p.id === packSizeId);

      if (chosenCat && chosenBrand && chosenPack) {
        const catCode = (chosenCat.code || chosenCat.name).substring(0, 3).toUpperCase();
        const brandCode = chosenBrand.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
        setSku(`${catCode}-${brandCode}-${chosenPack.volume_ml}`);
      }
    }
  }, [categoryId, brandId, packSizeId, categories, brands, packSizes, productToEdit, sku]);

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = 'Product name is required';
    if (!categoryId) errors.categoryId = 'Category selection is required';
    if (!brandId) errors.brandId = 'Brand selection is required';
    if (!packSizeId) errors.packSizeId = 'Pack Size selection is required';

    const pPrice = Number(purchasePrice);
    const sPrice = Number(sellingPrice);
    const mPrice = Number(mrp);

    if (purchasePrice === '' || isNaN(pPrice) || pPrice < 0) {
      errors.purchasePrice = 'Purchase price must be a valid positive amount';
    }
    if (sellingPrice === '' || isNaN(sPrice) || sPrice < 0) {
      errors.sellingPrice = 'Selling price must be a valid positive amount';
    }
    if (mrp === '' || isNaN(mPrice) || mPrice < 0) {
      errors.mrp = 'MRP must be a valid positive amount';
    }

    // Crucial rule: Selling price cannot exceed MRP
    if (sPrice > mPrice && mPrice > 0) {
      errors.sellingPrice = 'Selling price cannot exceed Maximum Retail Price (MRP)';
    }

    // Constraint: 500 ml Pint forbidden
    const chosenPack = packSizes.find(p => p.id === packSizeId);
    if (chosenPack && chosenPack.volume_ml === 500 && chosenPack.pack_type.toLowerCase() === 'pint') {
      errors.packSizeId = '500 ml Pint is invalid. Pints are 330 ml or 375 ml, and 500 ml is Can.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const { mutate: submitProduct, isSaving: isSubmitting } = useFormMutation(
    async (payload: any) => {
      const url = productToEdit ? `/api/products/${productToEdit.id}` : '/api/products';
      return productToEdit ? apiPut(url, payload) : apiPost(url, payload);
    },
    {
      successMessage: () => `Product "${name}" saved successfully!`,
      onSuccess: () => {
        onSuccess();
        onClose();
      },
      onError: (err) => setServerError(err.message),
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) return;

    setServerError(null);

    submitProduct({
      name: name.trim(),
      categoryId,
      brandId,
      packSizeId,
      sku: sku.trim() || undefined,
      packType,
      purchasePrice: Number(purchasePrice),
      sellingPrice: Number(sellingPrice),
      mrp: Number(mrp),
      status,
      complianceRef: complianceRef.trim() || null,
      ...(!productToEdit ? { openingStock: Number(openingStock) || 0 } : {}),
    });
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? t.editProduct : t.addProduct}
      subtitle={productToEdit ? `Product ID: ${productToEdit.id.substring(0, 8)}...` : 'Register new SKU in Excise Inventory Master'}
      icon={<Package className="w-5 h-5" />}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
          >
            {t.cancel}
          </button>
          <button
            form="product-form"
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{productToEdit ? t.save : t.addProduct}</span>
            )}
          </button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
        {serverError && (
          <div className="p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Section 1: Classification & Relations */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            <span>Category & Brand Hierarchy (Relational Dependency)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.category} <span className="text-amber-400">*</span>
              </label>
              <CategorySelector
                value={categoryId}
                onChange={setCategoryId}
                required={true}
                placeholder="-- Select Category --"
                theme="dark"
              />
              {clientErrors.categoryId && (
                <p className="text-xs text-rose-400 mt-1">{clientErrors.categoryId}</p>
              )}
            </div>

            {/* Brand (Category-Grouped Unified Selector) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.brand} <span className="text-amber-400">*</span>
              </label>
              <UnifiedBrandSelector
                value={brandId}
                onChange={(id, brand) => handleBrandChange(id, brand)}
                categories={categories}
                categoryId={categoryId || undefined}
                placeholder="-- Select Brand --"
              />
              {clientErrors.brandId && (
                <p className="text-xs text-rose-400 mt-1">{clientErrors.brandId}</p>
              )}
            </div>

            {/* Pack Size (Category-Dependent) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.packSize} <span className="text-amber-400">*</span>
              </label>
              <select
                value={packSizeId}
                onChange={e => handlePackSizeChange(e.target.value)}
                disabled={!categoryId || loadingDependencies}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
              >
                <option value="">
                  {!categoryId ? 'Select Category First' : packSizes.length === 0 ? 'No pack sizes configured' : '-- Select Pack Size --'}
                </option>
                {packSizes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.volume_ml} ml - {p.pack_type})
                  </option>
                ))}
              </select>
              {clientErrors.packSizeId && (
                <p className="text-xs text-rose-400 mt-1">{clientErrors.packSizeId}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Product Name & SKU */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.productName} <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Royal Stag Deluxe Whisky 750ml"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              {clientErrors.name && (
                <p className="text-xs text-rose-400 mt-1">{clientErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.sku}
              </label>
              <input
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value.toUpperCase())}
                placeholder="Auto-generated if blank"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm uppercase focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Pricing & Inventory */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <Tag className="w-4 h-4" />
            <span>Pricing (Strict Non-Floating Point Numeric) & Stock</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Purchase / TP Price */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.purchasePrice} <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
              {clientErrors.purchasePrice && (
                <p className="text-xs text-rose-400 mt-1">{clientErrors.purchasePrice}</p>
              )}
            </div>

            {/* MRP */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.mrp} <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={mrp}
                  onChange={e => setMrp(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
              {clientErrors.mrp && (
                <p className="text-xs text-rose-400 mt-1">{clientErrors.mrp}</p>
              )}
            </div>

            {/* Selling Price */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.sellingPrice} <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={sellingPrice}
                  onChange={e => setSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className={`w-full pl-7 pr-3 py-2 bg-slate-950 border rounded-xl text-white font-mono text-sm focus:outline-none transition-colors ${
                    Number(sellingPrice) > Number(mrp) && Number(mrp) > 0
                      ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
                  }`}
                />
              </div>
              {clientErrors.sellingPrice && (
                <p className="text-xs text-rose-400 mt-1">{clientErrors.sellingPrice}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.status}
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              >
                <option value="Active">Active (Available for Sale)</option>
                <option value="Inactive">Inactive (Disabled from Sale)</option>
              </select>
            </div>

            {/* Opening Stock (Only on creation) */}
            {!productToEdit && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.openingStock} (Units)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={openingStock}
                  onChange={e => setOpeningStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            )}

            {/* Compliance Ref */}
            <div className={productToEdit ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.complianceRef}
              </label>
              <input
                type="text"
                value={complianceRef}
                onChange={e => setComplianceRef(e.target.value)}
                placeholder="e.g. MH-EXC-2026-B"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};
