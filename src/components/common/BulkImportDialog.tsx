import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Upload, Clipboard, CheckCircle2, AlertCircle, 
  FileText, Download, ArrowRight, Loader2, FileSpreadsheet, 
  Table, ChevronRight, ChevronLeft, MapPin, Search, Trash2, RotateCcw,
  History
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { translations } from '../../utils/i18n';
import { 
  ImportModule, ColumnMapping, autoMapColumns, 
  parseCsv, parseExcel, parsePaste 
} from '../../utils/importUtils';

interface BulkImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  module: ImportModule;
  language: SupportedLanguage;
  onSuccess: () => void;
}

type Step = 'source' | 'sheet' | 'mapping' | 'preview' | 'executing' | 'summary' | 'history';

const MODULE_LABELS: Record<ImportModule, string> = {
  'products': 'Product Master',
  'brands': 'Brand Master',
  'pack-sizes': 'Pack Size Master',
  'categories': 'Category Master',
  'opening-stock': 'Opening / TP Stock',
  'purchases': 'Purchase / Inward',
  'adjustments': 'Stock Adjustments'
};

const REQUIRED_FIELDS: Record<ImportModule, string[]> = {
  'products': ['product_name', 'category_name', 'brand_name', 'pack_size_name'],
  'brands': ['name', 'category_name'],
  'pack-sizes': ['category_name', 'name', 'volume_ml'],
  'categories': ['name'],
  'opening-stock': ['product_name', 'quantity'],
  'purchases': ['purchase_number', 'product_name', 'quantity', 'purchase_tp_price'],
  'adjustments': ['product_name', 'adjustment_type', 'quantity']
};

const SUPPORTED_FIELDS: Record<ImportModule, { key: string, label: string }[]> = {
  'products': [
    { key: 'product_name', label: 'Product Name' },
    { key: 'brand_name', label: 'Brand Name' },
    { key: 'category_name', label: 'Category Name' },
    { key: 'sku', label: 'SKU / Code' },
    { key: 'pack_size_name', label: 'Pack Size' },
    { key: 'pack_type', label: 'Pack Type' },
    { key: 'purchase_price', label: 'Purchase Price' },
    { key: 'selling_price', label: 'Selling Price' },
    { key: 'mrp', label: 'MRP' },
    { key: 'opening_quantity', label: 'Opening Qty' },
    { key: 'status', label: 'Status' },
    { key: 'compliance_ref', label: 'Excise Ref' },
    { key: 'remarks', label: 'Remarks' }
  ],
  'brands': [
    { key: 'name', label: 'Brand Name' },
    { key: 'category_name', label: 'Category' },
    { key: 'active', label: 'Is Active?' },
    { key: 'registration_reference', label: 'Registration Ref' },
    { key: 'compliance_reference', label: 'Compliance Ref' },
    { key: 'remarks', label: 'Remarks' }
  ],
  'pack-sizes': [
    { key: 'category_name', label: 'Category' },
    { key: 'name', label: 'Size Name' },
    { key: 'volume_ml', label: 'Volume (ml)' },
    { key: 'pack_type', label: 'Pack Type' }
  ],
  'categories': [
    { key: 'name', label: 'Category Name' },
    { key: 'code', label: 'Code' },
    { key: 'active', label: 'Active' }
  ],
  'opening-stock': [
    { key: 'product_name', label: 'Product Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'quantity', label: 'Opening Qty' },
    { key: 'batch_number', label: 'Batch No' },
    { key: 'purchase_tp_price', label: 'TP Price' },
    { key: 'remarks', label: 'Remarks' }
  ],
  'purchases': [
    { key: 'purchase_number', label: 'Invoice No' },
    { key: 'purchase_date', label: 'Date' },
    { key: 'tp_permit_reference', label: 'TP Permit Ref' },
    { key: 'excise_reference', label: 'Excise Ref' },
    { key: 'product_name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'purchase_tp_price', label: 'TP Price' },
    { key: 'batch_number', label: 'Batch' },
    { key: 'mrp_reference', label: 'MRP' },
    { key: 'remarks', label: 'Remarks' }
  ],
  'adjustments': [
    { key: 'product_name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'adjustment_type', label: 'Type (IN/OUT)' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'reference', label: 'Ref No' },
    { key: 'reason', label: 'Reason' },
    { key: 'remarks', label: 'Remarks' }
  ]
};

export const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
  isOpen,
  onClose,
  module,
  language,
  onSuccess
}) => {
  const t = translations[language] || translations.en;
  const [step, setStep] = useState<Step>('source');
  const [sourceType, setSourceType] = useState<'CSV' | 'EXCEL' | 'PASTE' | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[], data: any[] } | null>(null);
  const [excelSheets, setExcelSheets] = useState<Record<string, { headers: string[], data: any[] }> | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSourceSelect = async (type: 'CSV' | 'EXCEL' | 'PASTE') => {
    setSourceType(type);
    setError(null);
    if (type === 'PASTE') {
      setStep('source'); // Stay on source but show paste area
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (sourceType === 'CSV') {
        const result = await parseCsv(file);
        setParsedData(result);
        const autoMap = autoMapColumns(result.headers, SUPPORTED_FIELDS[module].map(f => f.key));
        setMapping(autoMap);
        setStep('mapping');
      } else if (sourceType === 'EXCEL') {
        const sheets = await parseExcel(file);
        setExcelSheets(sheets);
        const sheetNames = Object.keys(sheets);
        if (sheetNames.length === 1) {
          const result = sheets[sheetNames[0]];
          setParsedData(result);
          const autoMap = autoMapColumns(result.headers, SUPPORTED_FIELDS[module].map(f => f.key));
          setMapping(autoMap);
          setStep('mapping');
        } else {
          setStep('sheet');
        }
      }
    } catch (err: any) {
      setError(`Failed to parse file: ${err.message}`);
    }
  };

  const handlePaste = (text: string) => {
    if (!text.trim()) return;
    try {
      const result = parsePaste(text);
      setParsedData(result);
      const autoMap = autoMapColumns(result.headers, SUPPORTED_FIELDS[module].map(f => f.key));
      setMapping(autoMap);
      setStep('mapping');
    } catch (err: any) {
      setError(`Failed to parse paste data: ${err.message}`);
    }
  };

  const handleSheetSelect = (sheetName: string) => {
    if (!excelSheets) return;
    const result = excelSheets[sheetName];
    setParsedData(result);
    const autoMap = autoMapColumns(result.headers, SUPPORTED_FIELDS[module].map(f => f.key));
    setMapping(autoMap);
    setStep('mapping');
  };

  const validateMapping = () => {
    const required = REQUIRED_FIELDS[module];
    const mappedKeys = Object.values(mapping);
    const missing = required.filter(field => !mappedKeys.includes(field));
    if (missing.length > 0) {
      setError(`Required fields missing mapping: ${missing.join(', ')}`);
      return false;
    }
    return true;
  };

  const executeImport = async () => {
    if (!validateMapping() || !parsedData) return;
    
    setIsExecuting(true);
    setStep('executing');
    setError(null);

    try {
      // 1. Init Batch
      const initRes = await fetch('/api/import/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${MODULE_LABELS[module]} Import ${new Date().toLocaleString()}`,
          module,
          sourceType,
          totalRows: parsedData.data.length
        }),
      });
      const initData = await initRes.json();
      if (!initData.success) throw new Error(initData.error?.message || 'Failed to init batch');
      const bId = initData.data.batchId;
      setBatchId(bId);

      // 2. Transform items based on mapping
      const items = parsedData.data.map(row => {
        const item: any = {};
        Object.entries(mapping).forEach(([csvHeader, fieldKey]) => {
          item[fieldKey] = row[csvHeader];
        });
        return item;
      });

      // 3. Execute
      const execRes = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: bId, module, items }),
      });
      const execData = await execRes.json();
      if (!execData.success) throw new Error(execData.error?.message || 'Execution failed');

      setImportResult(execData.data);
      setStep('summary');
      if (execData.data.successCount > 0) onSuccess();
    } catch (err: any) {
      setError(err.message);
      setStep('preview');
    } finally {
      setIsExecuting(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/import/history?module=${module}`);
      const data = await res.json();
      if (data.success) setHistory(data.data.history);
      setStep('history');
    } catch (err) {
      setError('Failed to fetch history');
    }
  };

  const handleRollback = async (id: string) => {
    if (!window.confirm('Are you sure you want to rollback this import? All created records will be deleted or reversed.')) return;
    try {
      const res = await fetch(`/api/import/rollback/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Rollback successful');
        fetchHistory();
        onSuccess();
      } else {
        alert(`Rollback failed: ${data.error?.message}`);
      }
    } catch (err) {
      alert('Rollback failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden my-4 flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-2xl">
              <Upload className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Bulk Import: {MODULE_LABELS[module]}</h2>
              <p className="text-xs text-slate-400 font-medium">Standardized bulk data entry with audit trail</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
            >
              <History className="w-4 h-4" />
              <span>Import History</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'source' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { id: 'CSV', icon: FileText, label: 'CSV File', desc: 'Import from comma separated values (.csv)', color: 'text-blue-400', bg: 'bg-blue-400/10' },
                  { id: 'EXCEL', icon: FileSpreadsheet, label: 'Excel Workbook', desc: 'Import from .xlsx or .xls files', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { id: 'PASTE', icon: Clipboard, label: 'Copy & Paste', desc: 'Paste directly from Excel or Google Sheets', color: 'text-amber-400', bg: 'bg-amber-400/10' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSourceSelect(s.id as any)}
                    className="p-8 rounded-[2rem] border border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-700 transition-all text-left group"
                  >
                    <div className={`p-4 ${s.bg} rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform`}>
                      <s.icon className={`w-8 h-8 ${s.color}`} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{s.label}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">{s.desc}</p>
                  </button>
                ))}
              </div>

              {sourceType === 'PASTE' && (
                <div className="space-y-4 pt-6 border-t border-slate-800 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-200">Paste your table data here (TAB separated):</label>
                    <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Includes headers</span>
                  </div>
                  <textarea
                    rows={8}
                    autoFocus
                    placeholder="Example:
Product Name\tQuantity\tPrice
Kingfisher\t10\t120"
                    onChange={(e) => handlePaste(e.target.value)}
                    className="w-full p-6 bg-slate-950 border border-slate-800 rounded-[2rem] text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              )}

              <div className="p-6 rounded-[2rem] bg-slate-800/30 border border-slate-700/50 space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  Required Columns for {MODULE_LABELS[module]}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_FIELDS[module].map(field => (
                    <div key={field.key} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      REQUIRED_FIELDS[module].includes(field.key) 
                        ? 'bg-amber-400/10 border-amber-400/30 text-amber-300' 
                        : 'bg-slate-700/30 border-slate-600/30 text-slate-400'
                    }`}>
                      {field.label}
                      {REQUIRED_FIELDS[module].includes(field.key) && <span className="ml-1 text-amber-500">*</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'sheet' && excelSheets && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white">Select Worksheet</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.keys(excelSheets).map(name => (
                  <button
                    key={name}
                    onClick={() => handleSheetSelect(name)}
                    className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-left transition-all"
                  >
                    <Table className="w-6 h-6 text-emerald-400 mb-4" />
                    <p className="text-sm font-bold text-white truncate">{name}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{excelSheets[name].data.length} rows detected</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'mapping' && parsedData && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Map Columns</h3>
                <span className="text-xs text-slate-400 font-medium">{parsedData.headers.length} headers detected from source</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                {SUPPORTED_FIELDS[module].map(field => {
                  const isRequired = REQUIRED_FIELDS[module].includes(field.key);
                  const currentMapping = Object.entries(mapping).find(([_, k]) => k === field.key)?.[0] || '';

                  return (
                    <div key={field.key} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-xs font-black text-slate-300 uppercase tracking-wider">
                          {field.label} {isRequired && <span className="text-rose-500">*</span>}
                        </label>
                        {currentMapping && (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Auto-mapped
                          </span>
                        )}
                      </div>
                      <select
                        value={currentMapping}
                        onChange={(e) => {
                          const newHeader = e.target.value;
                          const newMapping = { ...mapping };
                          // Remove old header pointing to this field
                          Object.keys(newMapping).forEach(h => {
                            if (newMapping[h] === field.key) delete newMapping[h];
                          });
                          if (newHeader) newMapping[newHeader] = field.key;
                          setMapping(newMapping);
                        }}
                        className={`w-full px-4 py-3 bg-slate-950 border rounded-2xl text-sm text-slate-200 transition-all focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                          currentMapping ? 'border-emerald-500/50' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <option value="">-- Do not import --</option>
                        {parsedData.headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'executing' && (
            <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-pulse">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
                <Loader2 className="w-24 h-24 text-amber-500 animate-spin relative" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-white mb-2">Importing Data...</h3>
                <p className="text-slate-400 font-medium">Validating relationships and updating inventory ledgers</p>
              </div>
            </div>
          )}

          {step === 'summary' && importResult && (
            <div className="space-y-10 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-4">
                <div className="inline-flex p-4 bg-emerald-500/10 rounded-full mb-4">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                </div>
                <h3 className="text-3xl font-black text-white">Import Process Completed</h3>
                <p className="text-slate-400 max-w-lg mx-auto">
                  Your data has been processed and linked to the unique audit batch 
                  <code className="mx-2 px-2 py-0.5 bg-slate-800 rounded font-bold text-amber-400">
                    {batchId?.substring(0, 8)}
                  </code>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Successfully Imported', count: importResult.successCount, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { label: 'Failed Records', count: importResult.failedCount, color: 'text-rose-400', bg: 'bg-rose-400/10' },
                  { label: 'Skipped (Duplicates)', count: importResult.skippedCount || 0, color: 'text-amber-400', bg: 'bg-amber-400/10' }
                ].map((stat, i) => (
                  <div key={i} className="p-8 rounded-[2.5rem] bg-slate-900 border border-slate-800 text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-2">{stat.label}</p>
                    <p className={`text-5xl font-black ${stat.color}`}>{stat.count}</p>
                  </div>
                ))}
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-rose-400 uppercase tracking-wider">Error Details</h4>
                  <div className="border border-slate-800 rounded-[2rem] overflow-hidden bg-slate-950/50">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 sticky top-0">
                          <tr>
                            <th className="p-4 font-black text-slate-400 border-b border-slate-800">Row</th>
                            <th className="p-4 font-black text-slate-400 border-b border-slate-800">Raw Data Snippet</th>
                            <th className="p-4 font-black text-slate-400 border-b border-slate-800">Error Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 font-medium">
                          {importResult.errors.map((err: any, idx: number) => (
                            <tr key={idx} className="hover:bg-rose-500/[0.02]">
                              <td className="p-4 text-slate-500 font-bold">{err.index + 1}</td>
                              <td className="p-4 text-slate-300 font-mono text-[10px] max-w-xs truncate">
                                {JSON.stringify(err.row).substring(0, 50)}...
                              </td>
                              <td className="p-4 text-rose-400 font-bold">{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'history' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Import History</h3>
                <button onClick={() => setStep('source')} className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Back to Import
                </button>
              </div>

              <div className="border border-slate-800 rounded-[2rem] overflow-hidden bg-slate-950/50">
                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 sticky top-0">
                      <tr>
                        <th className="p-4 font-black text-slate-400 border-b border-slate-800 uppercase tracking-widest">Date & Time</th>
                        <th className="p-4 font-black text-slate-400 border-b border-slate-800 uppercase tracking-widest">Module</th>
                        <th className="p-4 font-black text-slate-400 border-b border-slate-800 uppercase tracking-widest text-center">Rows</th>
                        <th className="p-4 font-black text-slate-400 border-b border-slate-800 uppercase tracking-widest text-center">Status</th>
                        <th className="p-4 font-black text-slate-400 border-b border-slate-800 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-bold">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30">
                          <td className="p-4 text-slate-300">
                            {new Date(item.created_at).toLocaleString()}
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.id.substring(0, 8)}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 font-black uppercase text-[9px]">
                              {item.module}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col">
                              <span className="text-emerald-400">{item.success_count} ✓</span>
                              {item.failed_count > 0 && <span className="text-rose-400 text-[10px]">{item.failed_count} ✗</span>}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                              item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                              item.status === 'ROLLED_BACK' ? 'bg-slate-700 text-slate-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {item.status !== 'ROLLED_BACK' && (
                              <button
                                onClick={() => handleRollback(item.id)}
                                title="Rollback this import batch"
                                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                              >
                                <RotateCcw className="w-5 h-5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-slate-500 font-medium italic">No import history found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between rounded-b-[2.5rem]">
          {step !== 'source' && step !== 'history' && step !== 'summary' ? (
            <button
              onClick={() => step === 'mapping' ? setStep('source') : step === 'sheet' ? setStep('source') : setStep('mapping')}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-black transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div></div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl text-slate-400 hover:text-white text-sm font-bold transition-all"
            >
              Close
            </button>
            {step === 'mapping' && (
              <button
                onClick={executeImport}
                className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-xl shadow-amber-500/20 active:scale-95"
              >
                <span>Process Import</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            {step === 'summary' && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-xl shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Done</span>
              </button>
            )}
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept={sourceType === 'CSV' ? '.csv' : '.xlsx, .xls'}
        />
      </div>
    </div>
  );
};
