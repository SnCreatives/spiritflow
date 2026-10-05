import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  Clipboard,
  Check,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { apiPost } from '../../utils/api';
import { useToast } from '../../lib/contexts/ToastContext';
import { ModalShell } from '../common/ModalShell';

interface ScmBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'completed';

const COLUMN_ALIASES: Record<string, string[]> = {
  scm_code: ['scm code', 'scm', 'scm no', 'scm number', 'scm_code', 'excise code', 'sku'],
  product: ['product', 'product name', 'product id', 'item', 'product_name'],
  brand: ['brand', 'brand name', 'manufacturer'],
  variant: ['variant', 'variant name', 'flavor'],
  product_type: ['product type', 'type', 'category type'],
  bottle_size: ['bottle size', 'size', 'pack size', 'volume', 'capacity'],
  packaging_type: ['packaging', 'pack type'],
  effective_from: ['effective from', 'effective date', 'from date', 'start date'],
  effective_to: ['effective to', 'to date', 'end date'],
  status: ['status', 'active', 'is active'],
  supplier_item_code: ['supplier code', 'internal code', 'ref code'],
  excise_reference: ['excise ref', 'reference', 'notes', 'regulatory note', 'description'],
};

export const ScmBulkImportModal: React.FC<ScmBulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [step, setStep] = useState<ImportStep>('upload');
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, valid: 0, invalid: 0, duplicate: 0 });
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);
  const [pastedText, setPastedText] = useState('');
  
  // Excel Sheet Selection
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStep('upload');
    setRawRows([]);
    setHeaders([]);
    setMapping({});
    setValidatedRows([]);
    setImportResults(null);
    setPastedText('');
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processRawData(results.data, results.meta.fields || []);
        },
        error: (err) => {
          showError(`CSV Parse Error: ${err.message}`);
          setLoading(false);
        }
      });
    } else {
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          setWorkbook(wb);
          setSheetNames(wb.SheetNames);
          if (wb.SheetNames.length === 1) {
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);
            const cols = data.length > 0 ? Object.keys(data[0] as object) : [];
            processRawData(data, cols);
          } else {
            setStep('upload'); // Stay on upload but show sheet picker
            setLoading(false);
          }
        } catch (err: any) {
          showError(`Excel Parse Error: ${err.message}`);
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleSheetSelect = (sheetName: string) => {
    if (!workbook) return;
    setSelectedSheet(sheetName);
    const ws = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws);
    const cols = data.length > 0 ? Object.keys(data[0] as object) : [];
    processRawData(data, cols);
  };

  const handlePaste = () => {
    if (!pastedText.trim()) return;
    setLoading(true);
    try {
      const rows = pastedText.split('\n').map(r => r.split('\t'));
      if (rows.length < 2) throw new Error('Insufficient data pasted. Header + at least one row required.');
      
      const cols = rows[0].map(c => c.trim());
      const data = rows.slice(1).map(r => {
        const obj: any = {};
        cols.forEach((c, i) => {
          obj[c] = r[i]?.trim();
        });
        return obj;
      });

      processRawData(data, cols);
    } catch (err: any) {
      showError(err.message);
      setLoading(false);
    }
  };

  const processRawData = (data: any[], cols: string[]) => {
    setRawRows(data);
    setHeaders(cols);
    
    // Auto-map
    const newMapping: Record<string, string> = {};
    Object.entries(COLUMN_ALIASES).forEach(([key, aliases]) => {
      const match = cols.find(c => aliases.includes(c.toLowerCase().trim()));
      if (match) newMapping[key] = match;
    });
    setMapping(newMapping);
    
    setStep('mapping');
    setLoading(false);
  };

  const startPreview = async () => {
    setLoading(true);
    try {
      // Re-map rows to canonical fields
      const mappedRows = rawRows.map(r => {
        const obj: any = {};
        Object.entries(mapping).forEach(([canonical, source]) => {
          obj[canonical] = r[source];
        });
        // Include non-mapped fields as raw for context if needed
        return obj;
      });

      const res = await apiPost('/api/scm/import-preview', { rows: mappedRows });
      if (res.success) {
        setValidatedRows(res.data.validatedRows);
        setSummary(res.data.summary);
        setStep('preview');
      } else {
        throw new Error(res.error?.message || 'Validation failed');
      }
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async () => {
    setLoading(true);
    setStep('importing');
    try {
      // Only send valid rows
      const rowsToImport = validatedRows.filter(r => r.status === 'VALID' || r.status === 'WARNING');
      const res = await apiPost('/api/scm/import-execute', { rows: rowsToImport });
      
      if (res.success) {
        setImportResults({
          success: res.data.count,
          failed: validatedRows.length - res.data.count
        });
        showSuccess(`Successfully imported ${res.data.count} SCM records.`);
        onSuccess();
        // Auto-close modal after successful import
        setTimeout(() => {
          onClose();
        }, 1500);
        setStep('completed');
      } else {
        throw new Error(res.error?.message || 'Import failed');
      }
    } catch (err: any) {
      showError(err.message);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const downloadErrorReport = () => {
    const invalidRows = validatedRows.filter(r => r.status === 'INVALID' || r.status === 'DUPLICATE');
    const csvRows = invalidRows.map(r => ({
      ...r,
      errors: r.errors.join('; ')
    }));
    
    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'scm_import_errors.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTemplate = () => {
    const headers = [
      'SCM Code', 'Product Name', 'Brand', 'Variant', 'Product Type', 'Bottle Size', 'Packaging', 
      'Effective From', 'Effective To', 'Status', 'Supplier Code', 'Notes'
    ];
    const data = [
      ['SCM-MH-1001', 'Royal Stag Deluxe', 'Royal Stag', 'Deluxe', 'Spirit', '750 ml', 'Bottle', '2026-01-01', '', 'Active', 'RS750', 'Excise Approved'],
      ['SCM-MH-1002', 'Absolut Blue', 'Absolut', 'Blue', 'Spirit', '375 ml', 'Bottle', '2026-01-01', '', 'Active', 'AB375', '']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SCM Template');
    XLSX.writeFile(wb, 'LiquorFlow_SCM_Template.xlsx');
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk SCM Code Import"
      subtitle={step === 'upload' ? 'Standardized bulk data entry with audit trail' : `Step: ${step.toUpperCase()}`}
      icon={<FileSpreadsheet className="w-5 h-5" />}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {step !== 'upload' && step !== 'importing' && step !== 'completed' ? (
            <button
              onClick={() => step === 'mapping' ? setStep('upload') : setStep('mapping')}
              className="px-6 py-2 text-slate-600 font-bold text-xs hover:bg-slate-100 rounded-xl transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {step === 'upload' && (
              <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 text-amber-700 hover:bg-amber-50 rounded-xl text-xs font-bold transition-all"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            )}
            
            {step === 'mapping' && (
              <button 
                onClick={startPreview} 
                disabled={!mapping.scm_code || (!mapping.product && !mapping.sku) || loading}
                className="px-8 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Continue to Preview'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 'preview' && (
              <button 
                onClick={executeImport} 
                disabled={summary.valid === 0 || loading}
                className="px-8 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : `Import ${summary.valid} Valid Rows`}
              </button>
            )}

            {(step === 'completed' || step === 'upload') && (
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                {step === 'completed' ? 'Done' : 'Close'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <StepIndicator current={step} />
        </div>

        {step === 'upload' && (
          <div className="space-y-6">
            {sheetNames.length > 1 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center animate-in slide-in-from-top-4 duration-300">
                <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-emerald-900 mb-1">Multiple Sheets Detected</h4>
                <p className="text-xs text-emerald-700 mb-4">Please select the worksheet containing SCM Code data:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {sheetNames.map(name => (
                    <button
                      key={name}
                      onClick={() => handleSheetSelect(name)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        selectedSheet === name 
                          ? 'bg-emerald-600 text-white border-emerald-600' 
                          : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Upload */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-amber-400 transition-colors bg-slate-50/50 flex flex-col items-center justify-center min-h-[240px]">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls" className="hidden" />
                <Upload className="w-10 h-10 text-slate-300 mb-4" />
                <h4 className="text-sm font-bold text-slate-700 mb-2">Upload Spreadsheet</h4>
                <p className="text-xs text-slate-500 mb-6">Supports .xlsx, .xls and .csv files</p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                >
                  {workbook ? 'Change File' : 'Select File'}
                </button>
              </div>

              {/* Paste Area */}
              <div className="flex flex-col h-full border border-slate-200 rounded-2xl p-6 bg-slate-50/50 min-h-[240px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clipboard className="w-4 h-4 text-amber-600" />
                    <h4 className="text-sm font-bold text-slate-700">Paste from Excel</h4>
                  </div>
                </div>
                <textarea
                  className="flex-1 w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Copy cells in Excel and paste them here... (Include header row)"
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                />
                <button 
                  onClick={handlePaste}
                  disabled={!pastedText.trim() || loading}
                  className="mt-4 px-6 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Process Clipboard'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Ensure your file has a header row for accurate mapping. For best results, use the official LiquorFlow SCM template.
              </p>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-800">Map Columns</h4>
                <p className="text-xs text-amber-700">We've attempted to automatically map your columns. Please verify and adjust if needed.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(COLUMN_ALIASES).map(canonicalKey => (
                <div key={canonicalKey} className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    {canonicalKey.replace(/_/g, ' ')} {['scm_code', 'product'].includes(canonicalKey) && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={mapping[canonicalKey] || ''}
                    onChange={e => setMapping(prev => ({ ...prev, [canonicalKey]: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- Ignore --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Total" value={summary.total} color="slate" />
              <StatCard label="Valid" value={summary.valid} color="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
              <StatCard label="Errors" value={summary.invalid} color="rose" icon={<AlertCircle className="w-4 h-4" />} />
              <StatCard label="Duplicates" value={summary.duplicate} color="amber" icon={<RefreshCw className="w-4 h-4" />} />
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Row</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">SCM Code</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Brand/Size</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Error / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validatedRows.map((r, i) => (
                      <tr key={i} className={`hover:bg-slate-50 transition-colors ${r.status !== 'VALID' ? 'bg-rose-50/30' : ''}`}>
                        <td className="px-4 py-3 text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.scm_code}</td>
                        <td className="px-4 py-3">
                           <div className="font-bold">{r.product_display || r.product || '-'}</div>
                           <div className="text-[10px] text-slate-500 font-mono uppercase">{r.variant}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.brand || '-'} <br/> {r.bottle_size || '-'}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">{r.effective_from}</td>
                        <td className="px-4 py-3 text-rose-600 font-medium whitespace-pre-wrap">
                          {r.errors.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {summary.invalid > 0 && (
              <div className="flex justify-start">
                <button 
                  onClick={downloadErrorReport}
                  className="flex items-center gap-2 px-4 py-2 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  Download Error Report (CSV)
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="py-20 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-amber-600 animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">Processing Import...</h3>
            <p className="text-sm text-slate-500">Writing validated SCM codes to database and updating effective dates.</p>
          </div>
        )}

        {step === 'completed' && (
          <div className="py-12 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Import Completed!</h3>
              <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm font-medium">
                The SCM master records have been updated successfully.
              </p>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-8 max-w-sm mx-auto grid grid-cols-2 gap-4 border border-slate-100">
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-600">{importResults?.success}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Imported</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-rose-400">{importResults?.failed}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Rejected</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".csv,.xlsx,.xls"
      />
    </ModalShell>
  );
};

const StepIndicator = ({ current }: { current: ImportStep }) => {
  const steps: ImportStep[] = ['upload', 'mapping', 'preview', 'importing', 'completed'];
  const currentIndex = steps.indexOf(current);
  
  return (
    <div className="flex items-center gap-1.5">
      {steps.filter(s => s !== 'importing').map((s, i) => {
        const stepIndex = steps.indexOf(s);
        const isActive = currentIndex === stepIndex;
        const isPast = currentIndex > stepIndex;
        
        return (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${isActive ? 'bg-amber-100 text-amber-700' : isPast ? 'text-emerald-600' : 'text-slate-300'}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-amber-600 text-white' : isPast ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {isPast ? <Check className="w-2.5 h-2.5" /> : i + 1}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider capitalize">{s}</span>
            </div>
            {i < 3 && <ChevronRight className="w-3 h-3 text-slate-300" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const StatCard = ({ label, value, color, icon }: { label: string, value: number, color: string, icon?: React.ReactNode }) => {
  const colors: any = {
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100'
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} shadow-sm`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
        {icon} {label}
      </div>
      <div className="text-2xl font-black">{value}</div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'VALID':
      return <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-widest">✓ Valid</span>;
    case 'DUPLICATE':
      return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-widest">↺ Duplicate</span>;
    case 'WARNING':
      return <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold uppercase tracking-widest">⚠ Warning</span>;
    case 'INVALID':
    default:
      return <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-widest">✕ Invalid</span>;
  }
};
