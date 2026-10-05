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
import { ModalShell } from './ModalShell';

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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Universal Bulk Import / Paste — ${module.toUpperCase()}`}
      subtitle="Copy from Excel / Google Sheets or upload CSV/XLSX with automatic canonical product resolution."
      icon={<FileSpreadsheet className="w-5 h-5" />}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            {loadingCatalog ? 'Syncing catalog...' : 'Catalog synchronized'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAdd}
              disabled={validCount === 0}
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center gap-2"
            >
              Add {validCount} Valid Rows
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Tabs & Mode Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 w-fit">
            {[
              { id: 'paste', label: 'Paste', icon: Clipboard },
              { id: 'upload', label: 'Upload', icon: Upload },
              { id: 'template', label: 'Template', icon: Download },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.id === 'template' ? handleDownloadTemplate() : setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Import Mode:</span>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-semibold"
            >
              <option value="append">Append Rows</option>
              <option value="replace">Replace Existing</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-300 text-xs animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {activeTab === 'paste' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Paste Data (Excel / Sheets / TSV)
                </label>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="TP Number&#9;SCM Code&#9;Brand&#9;Variant&#9;Size&#10;TP101&#9;SCM01&#9;Royal Stag&#9;Deluxe&#9;750"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all placeholder-slate-700"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleParsePaste}
                  className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all flex items-center gap-2 border border-slate-700 shadow-sm"
                >
                  <Clipboard className="w-4 h-4 text-amber-500" />
                  Parse Clipboard Data
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="animate-in fade-in duration-300">
              <div className="py-10 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/40 hover:border-amber-500/40 transition-colors group">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                />
                <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">Upload Spreadsheet or CSV</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-2 leading-relaxed">
                  Columns will be automatically mapped to canonical master fields based on recognized aliases.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  Select File...
                </button>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-800 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Data Preview & Validation
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Detected {parsedRows.length} rows ({validCount} valid, {invalidCount} invalid)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <span className="px-3 py-1 rounded-l-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                      {validCount} VALID
                    </span>
                    {invalidCount > 0 && (
                      <span className="px-3 py-1 rounded-r-lg bg-rose-500/10 text-rose-400 text-[10px] font-black border border-rose-500/20">
                        {invalidCount} ERROR
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/80 shadow-inner">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900/90 text-slate-500 font-mono uppercase text-[9px] sticky top-0 border-b border-slate-800 backdrop-blur-sm z-10">
                      <tr>
                        <th className="p-3 w-10">#</th>
                        <th className="p-3">TP / Ref</th>
                        <th className="p-3">Product Identity</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3">Validation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {parsedRows.map((r, i) => (
                        <tr key={r.rowId} className={`transition-colors ${r.status === 'valid' ? 'hover:bg-slate-800/40' : 'bg-rose-950/10 hover:bg-rose-950/20'}`}>
                          <td className="p-3 text-slate-600 font-mono text-[10px]">{i + 1}</td>
                          <td className="p-3 font-mono text-slate-400">{r.tpNumber || '—'}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-200">{r.brandName} {r.variant}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{r.bottleSize ? `${r.bottleSize} ml` : ''} {r.scmCode ? `• SCM: ${r.scmCode}` : ''}</div>
                          </td>
                          <td className="p-3 font-mono text-amber-400 font-black text-right text-sm">
                            {r.quantity}
                          </td>
                          <td className="p-3">
                            {r.status === 'valid' ? (
                              <div className="flex items-center gap-1.5 text-emerald-500 font-bold uppercase text-[9px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verified</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase text-[9px]">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[150px]">{r.errorMessage}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
