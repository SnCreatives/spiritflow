import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clipboard,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  Plus,
  ArrowRight,
  Loader2,
  Copy
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { translations } from '../../utils/i18n';
import { parseCsv, parseExcel, parsePaste, ColumnMapping, autoMapColumns } from '../../utils/importUtils';
import { apiGet } from '../../utils/api';

export interface BulkEntryRow {
  rowId: string;
  tpNumber?: string;
  scmCode?: string;
  productType?: string;
  brandName?: string;
  variant?: string;
  bottleSize?: number;
  packaging?: string;
  mrp?: number;
  quantity: number;
  purchaseTpPrice?: number;
  batchNumber?: string;
  remarks?: string;
  matchedProductId?: string;
  matchedProductName?: string;
  status: 'valid' | 'invalid';
  errorMessage?: string;
}

interface UniversalBulkEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: 'purchases' | 'opening-stock' | 'adjustments' | 'sales';
  language: SupportedLanguage;
  onAddRows: (rows: BulkEntryRow[], replace: boolean) => void;
}

export const UniversalBulkEntryModal: React.FC<UniversalBulkEntryModalProps> = ({
  isOpen,
  onClose,
  module,
  language,
  onAddRows,
}) => {
  const t = translations[language] || translations.en;
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'template'>('paste');
  const [pastedText, setPastedText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<BulkEntryRow[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load product catalog for validation & master resolution
  useEffect(() => {
    if (!isOpen) return;
    const fetchCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const res = await apiGet('/api/products/selection');
        if (res.success) {
          setCatalogProducts(res.data?.items || res.data || []);
        }
      } catch (err) {
        console.error('Failed to load product catalog for bulk import:', err);
      } finally {
        setLoadingCatalog(false);
      }
    };
    fetchCatalog();
  }, [isOpen]);

  if (!isOpen) return null;

  // Resolve raw row data against canonical catalog
  const validateAndMapRows = (rawRows: any[], headers: string[]): BulkEntryRow[] => {
    // Helper to find column by aliases
    const findValue = (row: any, keys: string[]) => {
      for (const k of keys) {
        // Direct match
        if (row[k] !== undefined && row[k] !== null && row[k] !== '') return String(row[k]).trim();
        // Case-insensitive match
        const foundKey = Object.keys(row).find(
          pk => pk.toLowerCase().trim().replace(/_/g, ' ') === k.toLowerCase().replace(/_/g, ' ')
        );
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
          return String(row[foundKey]).trim();
        }
      }
      return '';
    };

    return rawRows.map((row, idx) => {
      const tpNumber = findValue(row, ['tp number', 'tp no', 'tp', 'invoice number', 'invoice', 'purchase number']);
      const scmCode = findValue(row, ['scm', 'scm code', 'excise code', 'sku']);
      const brandName = findValue(row, ['brand', 'brand name']);
      const variant = findValue(row, ['variant', 'variant name', 'product', 'product name', 'item']);
      const sizeStr = findValue(row, ['size', 'bottle size', 'pack size', 'volume']);
      const packaging = findValue(row, ['packaging', 'pack type', 'type']) || 'Bottle';
      const mrpStr = findValue(row, ['mrp', 'max retail price']);
      const qtyStr = findValue(row, ['qty', 'quantity', 'opening qty', 'units']);
      const tpPriceStr = findValue(row, ['tp price', 'purchase price', 'cost', 'purchase_tp_price']);
      const batchNo = findValue(row, ['batch', 'batch number', 'lot']);
      const remarks = findValue(row, ['remarks', 'notes', 'comments']);

      const quantity = Number(qtyStr) || 1;
      const bottleSize = Number(sizeStr) || 0;
      const mrp = Number(mrpStr) || 0;
      const purchaseTpPrice = Number(tpPriceStr) || 0;

      let matchedProductId = '';
      let matchedProductName = '';
      let status: 'valid' | 'invalid' = 'valid';
      let errorMessage = '';

      // Match against catalog products
      if (catalogProducts.length > 0) {
        const matched = catalogProducts.find(p => {
          const pBrand = (p.brand?.name || p.brand_name || '').toLowerCase();
          const pVariant = (p.variant || p.product_name || p.name || '').toLowerCase();
          const pSize = Number(p.volume_ml || p.pack_size?.volume_ml || 0);

          const matchBrand = brandName ? pBrand.includes(brandName.toLowerCase()) : true;
          const matchVariant = variant ? pVariant.includes(variant.toLowerCase()) : false;
          const matchSize = bottleSize ? pSize === bottleSize : true;

          return matchVariant && matchBrand && matchSize;
        });

        if (matched) {
          matchedProductId = matched.id;
          matchedProductName = matched.product_name || matched.name;
        } else if (scmCode) {
          const byScm = catalogProducts.find(p => p.sku?.toLowerCase() === scmCode.toLowerCase());
          if (byScm) {
            matchedProductId = byScm.id;
            matchedProductName = byScm.product_name || byScm.name;
          }
        }

        if (!matchedProductId) {
          status = 'invalid';
          errorMessage = variant ? `Product '${variant}' (${brandName || 'Any Brand'}, ${bottleSize}ml) not found in master catalog.` : 'Missing product / variant name.';
        }
      }

      if (quantity <= 0) {
        status = 'invalid';
        errorMessage = errorMessage ? `${errorMessage} Quantity must be > 0.` : 'Quantity must be greater than 0.';
      }

      return {
        rowId: `row-${Date.now()}-${idx}`,
        tpNumber,
        scmCode,
        brandName,
        variant: variant || matchedProductName,
        bottleSize,
        packaging,
        mrp,
        quantity,
        purchaseTpPrice,
        batchNumber: batchNo,
        remarks,
        matchedProductId,
        matchedProductName,
        status,
        errorMessage,
      };
    });
  };

  const handleParsePaste = () => {
    if (!pastedText.trim()) {
      setError('Please paste clipboard text (tab-separated from Excel or Google Sheets).');
      return;
    }
    setError(null);
    try {
      const parsed = parsePaste(pastedText);
      const rows = validateAndMapRows(parsed.data, parsed.headers);
      setParsedRows(rows);
    } catch (err: any) {
      setError(`Failed to parse pasted data: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      let parsed;
      if (file.name.endsWith('.csv')) {
        parsed = await parseCsv(file);
      } else {
        const sheets = await parseExcel(file);
        const sheetNames = Object.keys(sheets);
        if (sheetNames.length > 0) {
          parsed = sheets[sheetNames[0]];
        } else {
          throw new Error('No worksheets found in Excel file.');
        }
      }

      if (parsed && parsed.data) {
        const rows = validateAndMapRows(parsed.data, parsed.headers);
        setParsedRows(rows);
      }
    } catch (err: any) {
      setError(`Failed to read file: ${err.message}`);
    }
  };

  const handleDownloadTemplate = () => {
    let csvContent = '';
    if (module === 'purchases') {
      csvContent = 'TP Number,SCM Code,Brand,Variant,Bottle Size,Packaging,MRP,Quantity,TP Price,Batch,Remarks\n' +
        'TP-2026-001,SCM1001,Royal Stag,Deluxe Whisky,750,Bottle,1200,10,950,BATCH-A,Verified Inward\n' +
        'TP-2026-002,SCM1002,Absolut,Blue Vodka,375,Bottle,850,5,680,BATCH-B,Excise Verified';
    } else if (module === 'opening-stock') {
      csvContent = 'TP Number,SCM Code,Brand,Variant,Bottle Size,Packaging,MRP,Quantity,TP Price,Batch,Remarks\n' +
        'OP-2026-01,SCM2001,Bagpiper,Whisky,750,Bottle,650,25,500,BATCH-1,Opening Stock Audit';
    } else {
      csvContent = 'SCM Code,Brand,Variant,Bottle Size,Quantity,Reason,Remarks\n' +
        'SCM1001,Royal Stag,Deluxe Whisky,750,2,Breakage,Bottle broken during transit';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `liquorflow_${module}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const invalidCount = parsedRows.filter(r => r.status === 'invalid').length;

  const handleConfirmAdd = () => {
    const validRows = parsedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) {
      setError('No valid rows to add. Please correct errors before importing.');
      return;
    }
    onAddRows(validRows, importMode === 'replace');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                Universal Bulk Import / Paste — {module.toUpperCase()}
              </h3>
              <p className="text-xs text-slate-400">
                Copy from Excel / Google Sheets or upload CSV/XLSX with automatic canonical product resolution.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === 'paste'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Clipboard className="w-4 h-4" />
              Clipboard Paste
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === 'upload'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload Excel / CSV
            </button>
            <button
              onClick={() => {
                setActiveTab('template');
                handleDownloadTemplate();
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              Mode:
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="append">Append Rows</option>
                <option value="replace">Replace Existing</option>
              </select>
            </label>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Paste cells directly from Excel, Google Sheets, or LibreOffice (Tab-separated with headers):
                </label>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="TP Number&#9;SCM Code&#9;Brand&#9;Variant&#9;Size&#9;Packaging&#9;MRP&#9;Quantity&#9;TP Price&#9;Batch&#9;Remarks&#10;TP001&#9;SCM101&#9;Royal Stag&#9;Deluxe&#9;750&#9;Bottle&#9;1200&#9;10&#9;950&#9;B1&#9;OK"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleParsePaste}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Clipboard className="w-4 h-4" />
                  Parse & Preview
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4 py-8 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv, .xlsx, .xls"
                className="hidden"
              />
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-medium text-slate-200">Upload Spreadsheet or CSV file</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Supports .xlsx, .xls, and .csv files. Columns will be automatically mapped to canonical master fields.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all inline-flex items-center gap-2"
              >
                Browse File...
              </button>
            </div>
          )}

          {/* Preview Section */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    Paste / Import Preview
                  </h4>
                  <p className="text-xs text-slate-400">
                    Detected {parsedRows.length} rows ({validCount} valid, {invalidCount} invalid)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                    {validCount} Valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-medium border border-rose-500/20">
                      {invalidCount} Invalid
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">TP / Ref</th>
                      <th className="p-3">Brand & Variant</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">MRP</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Issue / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {parsedRows.map((r, i) => (
                      <tr key={r.rowId} className={r.status === 'valid' ? 'hover:bg-slate-800/30' : 'bg-rose-500/5 hover:bg-rose-500/10'}>
                        <td className="p-3">
                          {r.status === 'valid' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-300">{r.tpNumber || '—'}</td>
                        <td className="p-3 text-slate-200 font-medium">
                          {r.brandName} {r.variant}
                        </td>
                        <td className="p-3 text-slate-300">{r.bottleSize ? `${r.bottleSize} ml` : '—'}</td>
                        <td className="p-3 font-mono text-slate-300">₹{r.mrp}</td>
                        <td className="p-3 font-mono text-amber-400 font-semibold">{r.quantity}</td>
                        <td className="p-3 text-rose-300 text-[11px]">{r.errorMessage || 'Ready'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <span className="text-xs text-slate-400">
            {loadingCatalog ? 'Loading master catalog...' : 'Master catalog synchronized.'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAdd}
              disabled={validCount === 0}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              Add {validCount} Valid Rows to Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
