import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileInput,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Layers,
  FileSpreadsheet,
  Upload,
  Lock,
  X,
  Trash2,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';

interface ParsedBatchRow {
  rowId: string;
  date: string;
  skuOrName: string;
  brand: string;
  variant: string;
  bottleSize: string;
  packaging: string;
  scmCode: string;
  tpNumber: string;
  quantity: number;
  matchedProductId?: string;
  matchedProductName?: string;
  status: 'valid' | 'invalid';
  errorMessage?: string;
}

export const OpeningStockView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  // Single Entry Form State
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductDetail | null>(null);
  const [tpNumber, setTpNumber] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(10);
  const [remarks, setRemarks] = useState<string>('');

  // Multi-row Excel / TSV Paste State
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedBatchRow[]>([]);
  const [isBatchValid, setIsBatchValid] = useState<boolean>(false);

  // Clear operational records on bar switch
  useEffect(() => {
    setRecords([]);
    setSelectedProduct(null);
  }, [selectedBar?.id]);

  const fetchData = useCallback(async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setLoading(true);
    try {
      const [recData, prodData] = await Promise.all([
        apiGet(`/api/inventory/opening-stock?barId=${encodeURIComponent(selectedBar.id)}`),
        apiGet('/api/products/selection'),
      ]);

      if (recData.success) {
        setRecords(recData.data?.records || []);
      }
      if (prodData.success) {
        setCatalogProducts(prodData.data?.items || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load opening stock records');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler: Single Opening Stock Submit
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar before creating opening stock.');
      return;
    }

    if (!selectedProduct) {
      showError('Please select a valid product using the cascading selector.');
      return;
    }

    if (quantity <= 0) {
      showError('Quantity must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiPost('/api/inventory/opening-stock', {
        barId: selectedBar.id,
        productId: selectedProduct.productId,
        quantity: Number(quantity),
        purchaseTpPrice: Number(selectedProduct.purchaseTpPrice || 0),
        tpPermitReference: tpNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      if (res.success) {
        showSuccess('Opening stock saved successfully.');
        setQuantity(10);
        setTpNumber('');
        setRemarks('');
        fetchData();
      } else {
        throw new Error(res.error?.message || 'Failed to save opening stock.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Parse Excel / TSV Paste
  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      showError('Please paste rows from Excel, TSV, or Google Sheets.');
      return;
    }

    const lines = pastedText.trim().split('\n');
    const rows: ParsedBatchRow[] = [];
    let allValid = true;

    lines.forEach((line, index) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      // Split by tab (Excel/Google sheets default) or comma
      const cols = cleanLine.includes('\t') ? cleanLine.split('\t') : cleanLine.split(',');
      const dateVal = cols[0]?.trim() || new Date().toISOString().split('T')[0];
      const prodOrSku = cols[1]?.trim() || '';
      const brandVal = cols[2]?.trim() || '';
      const variantVal = cols[3]?.trim() || '';
      const sizeVal = cols[4]?.trim() || '';
      const pkgVal = cols[5]?.trim() || 'Bottle';
      const scmVal = cols[6]?.trim() || '';
      const tpVal = cols[7]?.trim() || '';
      const qtyVal = parseInt(cols[8]?.trim() || cols[2]?.trim() || '0', 10);

      // Match against catalog products
      let matched = catalogProducts.find(
        p =>
          (p.sku && p.sku.toLowerCase() === prodOrSku.toLowerCase()) ||
          (p.name && p.name.toLowerCase() === prodOrSku.toLowerCase()) ||
          (p.product_name && p.product_name.toLowerCase() === prodOrSku.toLowerCase())
      );

      if (!matched && brandVal) {
        matched = catalogProducts.find(
          p =>
            (p.brand?.name || '').toLowerCase().includes(brandVal.toLowerCase()) &&
            (!sizeVal || (p.volume_ml && p.volume_ml.toString() === sizeVal.replace(/\D/g, '')))
        );
      }

      const isValidRow = Boolean(matched && qtyVal > 0);
      if (!isValidRow) allValid = false;

      rows.push({
        rowId: `row-${index + 1}`,
        date: dateVal,
        skuOrName: prodOrSku,
        brand: brandVal,
        variant: variantVal,
        bottleSize: sizeVal,
        packaging: pkgVal,
        scmCode: scmVal,
        tpNumber: tpVal,
        quantity: qtyVal,
        matchedProductId: matched?.id,
        matchedProductName: matched?.name || matched?.product_name,
        status: isValidRow ? 'valid' : 'invalid',
        errorMessage: !matched
          ? `Product not found in Product Master: "${prodOrSku}"`
          : qtyVal <= 0
          ? 'Quantity must be > 0'
          : undefined,
      });
    });

    setParsedRows(rows);
    setIsBatchValid(allValid && rows.length > 0);
  };

  // Handler: Save Batch Opening Stock
  const handleSaveBatch = async () => {
    if (!selectedBar?.id || !isBatchValid || parsedRows.length === 0) {
      showError('Please ensure all pasted rows are valid before saving.');
      return;
    }

    setSaving(true);
    try {
      for (const row of parsedRows) {
        if (row.matchedProductId && row.quantity > 0) {
          const res = await apiPost('/api/inventory/opening-stock', {
            barId: selectedBar.id,
            productId: row.matchedProductId,
            quantity: row.quantity,
            tpPermitReference: row.tpNumber || undefined,
            remarks: `Batch Excel Opening Stock - ${row.scmCode ? `SCM: ${row.scmCode}` : ''}`,
          });

          if (!res.success) {
            throw new Error(res.error?.message || `Failed to save row for ${row.matchedProductName}`);
          }
        }
      }

      showSuccess(`Successfully saved batch of ${parsedRows.length} opening stock entries.`);
      setShowPasteModal(false);
      setPastedText('');
      setParsedRows([]);
      fetchData();
    } catch (err: any) {
      showError(err.message || 'Batch save failed.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Records for Display
  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      r =>
        r.product?.name?.toLowerCase().includes(q) ||
        r.product?.sku?.toLowerCase().includes(q) ||
        r.product?.brand?.name?.toLowerCase().includes(q) ||
        r.batch_number?.toLowerCase().includes(q)
    );
  }, [records, search]);

  if (!selectedBar || selectedBar.id === 'ALL_BARS') {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-10 max-w-4xl mx-auto">
        <div className="p-8 text-center bg-white border border-amber-200 rounded-2xl shadow-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-700">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Specific Bar Selection Required</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Select a specific bar to create or modify operational transactions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <FileInput className="w-4 h-4" />
            Stock Master & Baseline Entry
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Opening Stock & Baseline Quantities
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Bar:{' '}
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {selectedBar.name}
            </span>
          </p>
        </div>

        <button
          onClick={() => setShowPasteModal(true)}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-400" />
          Excel / TSV Paste Multi-Row
        </button>
      </div>

      {/* Single Entry Form Card */}
      <form onSubmit={handleSingleSubmit} className="space-y-6">
        <CanonicalProductSelector
          onSelectProduct={prod => setSelectedProduct(prod)}
          selectedProductId={selectedProduct?.productId}
        />

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Opening Stock Entry Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Opening Date *
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Initial Quantity (Bottles/Units) *
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                TP Number / Reference
              </label>
              <input
                type="text"
                placeholder="e.g. TP-2026-9042"
                value={tpNumber}
                onChange={e => setTpNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Remarks / Notes
              </label>
              <input
                type="text"
                placeholder="Baseline stock verified"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || !selectedProduct}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Record Opening Stock
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Historical Opening Stock Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search recorded opening stocks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category / Brand</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3">Reference / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading opening records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No opening stock records found for {selectedBar.name}.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 text-slate-600">
                      {r.created_at?.split('T')[0] || r.transaction_date || 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {r.product?.name || r.product?.product_name || 'Product'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{r.product?.sku || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.product?.category?.name || '-'} • {r.product?.brand?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      +{r.quantity}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.batch_number ? `Batch: ${r.batch_number}` : r.remarks || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel / TSV Multi-Row Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase">
                  Paste Opening Stock from Excel / Google Sheets
                </h3>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <p className="font-bold text-slate-800 mb-1">Supported Paste Columns (Tab or Comma separated):</p>
              <code>Date | Product/SKU | Brand | Variant | Bottle Size | Packaging | SCM | TP Number | Quantity</code>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Paste Raw Spreadsheet Data
              </label>
              <textarea
                rows={5}
                placeholder="Copy cells from Excel or Google Sheets and paste here..."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleParsePastedText}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Parse & Validate Rows
              </button>
            </div>

            {/* Parsed Rows Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">
                    Preview & Row Validation ({parsedRows.length} rows)
                  </h4>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      isBatchValid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isBatchValid ? 'All Rows Validated' : 'Contains Invalid Rows (Highlighted)'}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px] sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Matched Canonical Product</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2">TP / SCM Ref</th>
                        <th className="px-3 py-2">Validation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map(row => (
                        <tr
                          key={row.rowId}
                          className={
                            row.status === 'invalid'
                              ? 'bg-rose-50/80 text-rose-900'
                              : 'hover:bg-slate-50/80'
                          }
                        >
                          <td className="px-3 py-2 font-mono text-slate-500">{row.rowId}</td>
                          <td className="px-3 py-2 text-slate-600">{row.date}</td>
                          <td className="px-3 py-2 font-bold">
                            {row.matchedProductName || (
                              <span className="text-rose-600 italic">
                                Unknown: "{row.skuOrName}"
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{row.quantity}</td>
                          <td className="px-3 py-2 text-slate-500">
                            {row.tpNumber || row.scmCode || '-'}
                          </td>
                          <td className="px-3 py-2">
                            {row.status === 'valid' ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                              </span>
                            ) : (
                              <span className="text-rose-700 font-bold flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> {row.errorMessage}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPasteModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBatch}
                    disabled={saving || !isBatchValid}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {saving ? 'Saving Batch...' : 'Save All Validated Rows'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
