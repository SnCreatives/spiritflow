import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  RefreshCw,
  Printer,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  Filter,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react';
import { SupportedLanguage, Category, Brand, Product, PackSize } from '../../types';
import { apiGet } from '../../utils/api';
import { translations } from '../../utils/i18n';

interface MlStockReportViewProps {
  language: SupportedLanguage;
}

export const MlStockReportView: React.FC<MlStockReportViewProps> = ({ language }) => {
  const t = translations[language];

  // Filters
  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [productId, setProductId] = useState('');
  const [packSizeId, setPackSizeId] = useState('');

  // Auxiliary dropdowns
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packSizes, setPackSizes] = useState<PackSize[]>([]);

  // Report Data
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load auxiliary data
  useEffect(() => {
    async function loadAux() {
      try {
        const [cRes, bRes, pRes, psRes] = await Promise.all([
          apiGet('/api/categories'),
          apiGet('/api/brands?limit=200'),
          apiGet('/api/products?limit=500'),
          apiGet('/api/pack-sizes?limit=100'),
        ]);
        if (cRes.success) {
          const list = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.categories || cRes.data?.items || []);
          setCategories(Array.isArray(list) ? list : []);
        }
        if (bRes.success) setBrands(bRes.data?.items || []);
        if (pRes.success) setProducts(pRes.data?.items || []);
        if (psRes.success) setPackSizes(psRes.data?.items || []);
      } catch (err) {
        console.error('Failed to load auxiliary filter data', err);
      }
    }
    loadAux();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (categoryId) params.append('categoryId', categoryId);
      if (brandId) params.append('brandId', brandId);
      if (productId) params.append('productId', productId);
      if (packSizeId) params.append('packSizeId', packSizeId);

      const res = await apiGet(`/api/reports/ml-stock?${params.toString()}`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to generate ML-wise stock report');
      }
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, categoryId, brandId, productId, packSizeId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportCSV = () => {
    if (items.length === 0) return;
    const headers = [
      'Category',
      'Product',
      'Brand',
      'Pack Size',
      'Opening Stock',
      'Inward',
      'Adjustment In',
      'Return In',
      'Stock In',
      'Adjustment Out',
      'Return Out',
      'Correction Out',
      'Stock Out',
      'Closing Stock',
      'Reference Numbers',
    ];
    const rows = items.map(i => [
      i.categoryName,
      i.productName,
      i.brandName,
      i.packSizeName,
      i.openingStock,
      i.inwardQuantity,
      i.adjustmentIn,
      i.returnIn,
      i.stockIn,
      i.adjustmentOut,
      i.returnOut,
      i.correctionOut,
      i.stockOut,
      i.closingStock,
      i.referenceNumbers,
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ML_Wise_Stock_Report_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  const copyTable = () => {
    if (items.length === 0) return;
    const text = items
      .map(
        i =>
          `${i.categoryName}\t${i.productName}\t${i.brandName}\t${i.packSizeName}\t${i.openingStock}\t${i.stockIn}\t${i.stockOut}\t${i.closingStock}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setFeedback('Table copied to clipboard!');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <span>ML-wise Stock Report (Opening, Inward, Outward & Closing Reconciliation)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Reconciles inventory movements from authoritative stock ledger based on strict date filters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchReport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={copyTable}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span>Copy</span>
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV / Excel</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-amber-400" />
          <span>Report Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">From Date (Inclusive)</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">To Date (Inclusive)</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Category / ML Type</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="">All Categories</option>
              {(Array.isArray(categories) ? categories : []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Brand</label>
            <select
              value={brandId}
              onChange={e => setBrandId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="">All Brands</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Product</label>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Pack Size</label>
            <select
              value={packSizeId}
              onChange={e => setPackSizeId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="">All Pack Sizes</option>
              {packSizes.map(ps => (
                <option key={ps.id} value={ps.id}>
                  {ps.name} ({ps.volume_ml}ml)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Report Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="table-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Product / Brand</th>
                <th className="py-3 px-2">Pack Size</th>
                <th className="py-3 px-2 text-center">Opening</th>
                <th className="py-3 px-2 text-center">Inward</th>
                <th className="py-3 px-2 text-center">Adj In</th>
                <th className="py-3 px-2 text-center">Return In</th>
                <th className="py-3 px-2 text-center text-amber-400">Total In</th>
                <th className="py-3 px-2 text-center">Adj Out</th>
                <th className="py-3 px-2 text-center">Return Out</th>
                <th className="py-3 px-2 text-center">Correct Out</th>
                <th className="py-3 px-2 text-center text-rose-400">Total Out</th>
                <th className="py-3 px-3 text-center text-emerald-400 font-bold">Closing</th>
                <th className="py-3 px-3">References</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
                    <span>Calculating ML-wise stock reconciliation...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 font-sans">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-medium text-slate-300">No stock records found for the selected period.</p>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-sans font-medium text-amber-400">{item.categoryName}</td>
                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-white">{item.productName}</div>
                      <div className="text-[11px] text-slate-400">{item.brandName} • SKU: {item.sku || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-2 font-sans">{item.packSizeName}</td>
                    <td className="py-3 px-2 text-center">{item.openingStock}</td>
                    <td className="py-3 px-2 text-center">{item.inwardQuantity}</td>
                    <td className="py-3 px-2 text-center">{item.adjustmentIn}</td>
                    <td className="py-3 px-2 text-center">{item.returnIn}</td>
                    <td className="py-3 px-2 text-center font-bold text-amber-400">{item.stockIn}</td>
                    <td className="py-3 px-2 text-center">{item.adjustmentOut}</td>
                    <td className="py-3 px-2 text-center">{item.returnOut}</td>
                    <td className="py-3 px-2 text-center">{item.correctionOut}</td>
                    <td className="py-3 px-2 text-center font-bold text-rose-400">{item.stockOut}</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-400 text-sm bg-emerald-950/30">
                      {item.closingStock}
                    </td>
                    <td className="py-3 px-3 font-sans text-[11px] text-slate-400 truncate max-w-[150px]">
                      {item.referenceNumbers || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
