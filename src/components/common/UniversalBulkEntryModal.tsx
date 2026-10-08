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
import {
  parseCsv,
  parseExcel,
  parsePaste,
  ColumnMapping,
  autoMapColumns,
  resolveCanonicalProduct,
  parseVolumeMl,
} from '../../utils/importUtils';
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
  
  // Resolved Canonical IDs
  matchedProductId?: string;
  matchedProductName?: string;
  brandId?: string;
  variantId?: string;
  categoryId?: string;
  packSizeId?: string;
  categoryName?: string;
  scmMasterId?: string;
  
  status: 'valid' | 'invalid';
  errorMessage?: string;
  // Preserved invoice fields
  itemName?: string;
  qtyCases?: number;
  qtyBottles?: number;
  totalBottles?: number;
  autoBatch?: string;
  mfgMonth?: string;
  bulkLitres?: number;
  strengthVv?: number;
}

interface UniversalBulkEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: 'purchases' | 'opening-stock' | 'adjustments' | 'sales';
  language: SupportedLanguage;
  onAddRows: (rows: BulkEntryRow[], replace: boolean, metadata?: any) => void;
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
  const [parsedMetadata, setParsedMetadata] = useState<any>(null);
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
      const tpNumber = findValue(row, ['tp number', 'tp no', 'tp', 'invoice number', 'invoice', 'purchase number', 'purchase no', 'ref no']);
      let scmCode = findValue(row, ['scm code', 'scm', 'scmcode', 'excise code', 'sku', 'product code']);
      let brandName = findValue(row, ['brand', 'brand name', 'brandname']);
      let itemName = findValue(row, ['itemname', 'item name', 'item', 'product name', 'product', 'variant', 'variant name', 'description', 'name']);
      const sizeStr = findValue(row, ['size', 'bottle size', 'pack size', 'volume', 'packsize']);
      let packaging = findValue(row, ['packaging', 'pack type', 'type']) || 'Bottle';
      const mrpStr = findValue(row, ['mrp', 'max retail price', 'maximum retail price', 'price']);
      const qtyCasesStr = findValue(row, ['qty (cases)', 'qty cases', 'cases', 'cases qty']);
      const qtyBottlesStr = findValue(row, ['qty (bottles)', 'qty bottles', 'bottles', 'bottles qty']);
      const totBottStr = findValue(row, ['tot. bott.', 'tot. bott', 'tot bott', 'total bottles', 'tot.bott.', 'tot.bott', 'total qty']);
      const qtyStr = findValue(row, ['qty', 'quantity', 'opening qty', 'units']);
      const tpPriceStr = findValue(row, ['tp price', 'purchase price', 'cost', 'purchase_tp_price']);
      const batchNo = findValue(row, ['batch no', 'batch no.', 'batch', 'batch number', 'lot']);
      const autoBatch = findValue(row, ['auto batch', 'autobatch']);
      const mfgMonth = findValue(row, ['mfg. month', 'mfg month', 'mfg date', 'manufacturing month']);
      const blStr = findValue(row, ['b.l.', 'b.l', 'bl', 'bulk litres', 'bulk litre']);
      const vvStr = findValue(row, ['v/v (%)', 'v/v%', 'v/v', 'strength', 'abv']);
      const remarks = findValue(row, ['remarks', 'notes', 'comments']);

      // Check if SCM code is embedded in itemName
      if (!scmCode && itemName) {
        const scmMatch = itemName.match(/(?:scm\s*code\s*[:\-\s]?\s*|scm\s*[:\-\s]?\s*)([a-z0-9_\-]+)/i);
        if (scmMatch) {
          scmCode = scmMatch[1];
          itemName = itemName.replace(/(?:scm\s*code\s*[:\-\s]?\s*|scm\s*[:\-\s]?\s*)[a-z0-9_\-]+/i, '').trim();
        }
      }

      const bottleSize = parseVolumeMl(sizeStr);
      const qtyCases = Number(qtyCasesStr) || 0;
      const qtyBottles = Number(qtyBottlesStr) || 0;
      const totalBottles = Number(totBottStr) || 0;
      // If cases are explicitly entered, prioritize cases for purchases/inward quantity
      const quantity = qtyCases > 0 ? qtyCases : (totalBottles > 0 ? totalBottles : (Number(qtyStr) || 1));
      const mrp = Number(mrpStr) || 0;
      const purchaseTpPrice = Number(tpPriceStr) || 0;
      const bulkLitres = Number(blStr) || 0;
      const strengthVv = Number(vvStr) || 0;

      let matchedProductId = '';
      let matchedProductName = '';
      let brandId = '';
      let categoryId = '';
      let packSizeId = '';
      let categoryName = '';
      let status: 'valid' | 'invalid' = 'valid';
      let errorMessage = '';

      // Hierarchical Canonical Resolution Chain:
      // 1. SCM Code lookup when available
      // 2. Product lookup
      // 3. Brand -> Variant -> Bottle Size -> Packaging
      const canonicalMatch = resolveCanonicalProduct({
        itemName,
        scmCode,
        brandName,
        size: bottleSize,
        packaging,
        catalogProducts,
      });

      if (canonicalMatch) {
        matchedProductId = canonicalMatch.productId;
        matchedProductName = canonicalMatch.productName;
        brandName = canonicalMatch.brandName;
        brandId = canonicalMatch.brandId;
        categoryId = canonicalMatch.categoryId;
        packSizeId = canonicalMatch.packSizeId;
        categoryName = canonicalMatch.categoryName;
        // CORE RULE: Never replace user-pasted SCM Code with catalog product sku!
        scmCode = scmCode?.trim() || canonicalMatch.sku || '';
        packaging = canonicalMatch.packType || packaging;
        
        if (canonicalMatch.isAmbiguous) {
          status = 'invalid';
          errorMessage = `Ambiguous match. Potential choices: ${canonicalMatch.potentialMatches?.map(m => m.productName).join(', ')}`;
        }
      } else {
        status = 'invalid';
        errorMessage = itemName
          ? `Product '${itemName}' (${brandName || 'Any Brand'}, ${bottleSize}ml) not found in master catalog.`
          : 'Missing product / variant name.';
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
        variant: canonicalMatch?.variant || matchedProductName || itemName,
        bottleSize: canonicalMatch?.volumeMl || bottleSize,
        packaging: canonicalMatch?.packType || packaging,
        mrp: mrp || canonicalMatch?.mrp || 0,
        quantity,
        purchaseTpPrice: purchaseTpPrice || canonicalMatch?.purchasePrice || 0,
        batchNumber: batchNo,
        remarks,
        matchedProductId,
        matchedProductName,
        brandId,
        categoryId,
        packSizeId,
        categoryName,
        status,
        errorMessage,
        itemName,
        qtyCases,
        qtyBottles,
        totalBottles,
        autoBatch,
        mfgMonth,
        bulkLitres,
        strengthVv,
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
      setParsedMetadata(parsed.metadata || null);
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
    onAddRows(validRows, importMode === 'replace', parsedMetadata);
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Bulk Import Registry — ${module.toUpperCase()}`}
      subtitle="Canonical Master Data Resolution & Verification"
      icon={<FileSpreadsheet className="w-5 h-5" />}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-6 rounded-full ${loadingCatalog ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {loadingCatalog ? 'Syncing catalog...' : 'Master catalog synchronized'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-black uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAdd}
              disabled={validCount === 0}
              className="px-10 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              Add {validCount} Verified Rows
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Tabs & Mode Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
          <div className="flex items-center gap-1 p-1 bg-slate-200/50 rounded-xl border border-slate-200/50">
            {[
              { id: 'paste', label: 'Paste Data', icon: Clipboard },
              { id: 'upload', label: 'Upload File', icon: Upload },
              { id: 'template', label: 'Template', icon: Download },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.id === 'template' ? handleDownloadTemplate() : setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 px-1">
            <span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Conflict Strategy:</span>
            <div className="relative">
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none cursor-pointer shadow-xs"
              >
                <option value="append">Append Rows</option>
                <option value="replace">Replace Existing</option>
              </select>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 rotate-90" />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3.5 text-rose-700 text-xs font-bold shadow-sm animate-in shake-in duration-300">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-widest">Parsing Warning</span>
              <span className="font-medium text-rose-600">{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {activeTab === 'paste' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="relative">
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                  Clipboard Data (TSV Format)
                </label>
                <div className="absolute top-10 right-4 flex items-center gap-2 pointer-events-none">
                   <div className="px-2 py-1 bg-slate-900/5 backdrop-blur-xs rounded font-mono text-[10px] text-slate-500">Excel / Sheets Format Supported</div>
                </div>
                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="SrNo   ItemName   Size   Qty(Cases)   BatchNo   MRP..."
                  className="w-full bg-white border border-slate-200 rounded-2xl p-5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder-slate-300 shadow-inner transition-all"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleParsePaste}
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2.5 cursor-pointer shadow-lg shadow-slate-900/10 active:scale-95"
                >
                  <Clipboard className="w-4 h-4 text-amber-500" />
                  <span>Parse Registry Data</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="animate-in fade-in duration-300">
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 hover:bg-white hover:border-amber-400 transition-all group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                />
                <div className="mx-auto w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-500 group-hover:scale-110 transition-all shadow-sm mb-4">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Upload Master Registry</h4>
                <p className="text-[11px] text-slate-500 font-medium max-w-xs mx-auto mt-2 uppercase tracking-wide">
                  CSV, XLSX, or XLS files. Column headers will be automatically mapped.
                </p>
                <div className="mt-6 px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-black shadow-sm group-hover:border-amber-200 inline-flex items-center gap-2">
                  <span>Browse Files...</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-100 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                    Verification Preview
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Detected {parsedRows.length} Total Ledger Rows
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100 uppercase tracking-tight">
                    {validCount} Verified
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black border border-rose-100 uppercase tracking-tight">
                      {invalidCount} Resolution Required
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-inner">
                <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-400 uppercase text-[9px] font-black tracking-[0.2em] sticky top-0 border-b border-slate-100 backdrop-blur-xs">
                      <tr>
                        <th className="px-5 py-3.5 w-12">#</th>
                        <th className="px-5 py-3.5">Ref / ID</th>
                        <th className="px-5 py-3.5">Master Resolution</th>
                        <th className="px-5 py-3.5 text-right">Qty</th>
                        <th className="px-5 py-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium">
                      {parsedRows.map((r, i) => (
                        <tr key={r.rowId} className={`hover:bg-slate-50/50 transition-colors ${r.status !== 'valid' ? 'bg-rose-50/30' : ''}`}>
                          <td className="px-5 py-3.5 text-slate-300 font-mono text-[10px]">{i + 1}</td>
                          <td className="px-5 py-3.5 font-mono text-slate-500 font-bold tracking-tighter">{r.tpNumber || '—'}</td>
                          <td className="px-5 py-3.5">
                            <div className="font-black text-slate-900 uppercase tracking-tight">{r.brandName} {r.variant}</div>
                            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                               {r.bottleSize ? `${r.bottleSize} ml` : ''} {r.scmCode ? `• SCM: ${r.scmCode}` : ''}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                             <span className="px-2 py-0.5 bg-slate-100 text-slate-900 rounded font-mono font-black">{r.quantity}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {r.status === 'valid' ? (
                              <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verified</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5 text-rose-500 font-black text-[10px] uppercase tracking-widest group relative">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[120px]">{r.errorMessage}</span>
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-rose-900 text-white p-2 rounded shadow-xl z-50 text-[9px] w-48 text-center capitalize">
                                   {r.errorMessage}
                                </div>
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
