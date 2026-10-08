import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  X,
  File,
  ChevronRight,
  Info
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost } from '../../utils/api';
import { ModalShell } from '../common/ModalShell';

interface ValidationSummary {
  barName: string;
  barId: string;
  backupDate: string;
  sheetsFound: string[];
  recordCounts: Record<string, number>;
  validationErrors: string[];
}

export const BackupRestoreView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState<string | null>(null);

  // Handler: Download Excel Backup
  const handleDownloadBackup = async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar before exporting backup.');
      return;
    }

    setLoading(true);
    try {
      // Use direct fetch for binary download
      const response = await fetch(`/api/backup/excel/download?barId=${encodeURIComponent(selectedBar.id)}`, {
        headers: {
          'x-session-token': localStorage.getItem('liquorflow_session_token') || '',
          'x-bar-id': selectedBar.id
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to download backup.');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = `LiquorFlow_${selectedBar.name.replace(/\s+/g, '_')}_Backup.xlsx`;
      
      if (contentDisposition && contentDisposition.includes('filename=')) {
        fileName = contentDisposition.split('filename=')[1].split(';')[0];
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setLastBackupInfo(new Date().toLocaleString());
      showSuccess('Excel backup generated and downloaded successfully.');
    } catch (err: any) {
      showError(err.message || 'Unable to export backup.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx')) {
        showError('Invalid file format. Please select an .xlsx Excel file.');
        return;
      }
      setSelectedFile(file);
      setValidationSummary(null);
    }
  };

  // Handler: Validate Backup
  const handleValidateBackup = async () => {
    if (!selectedFile || !selectedBar?.id) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('barId', selectedBar.id);

      // We use fetch directly for multipart form data
      const response = await fetch('/api/backup/excel/validate', {
        method: 'POST',
        headers: {
          'x-session-token': localStorage.getItem('liquorflow_session_token') || '',
          'x-bar-id': selectedBar.id
        },
        body: formData
      });

      const res = await response.json();

      if (res.success && res.data) {
        setValidationSummary(res.data);
        showSuccess('Backup file validated successfully.');
      } else {
        throw new Error(res.error?.message || 'Validation failed.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to validate backup.');
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Execute Restore
  const handleExecuteRestore = async () => {
    if (!selectedFile || !selectedBar?.id || !validationSummary) return;
    
    setIsRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('barId', selectedBar.id);

      const response = await fetch('/api/backup/excel/restore', {
        method: 'POST',
        headers: {
          'x-session-token': localStorage.getItem('liquorflow_session_token') || '',
          'x-bar-id': selectedBar.id
        },
        body: formData
      });

      const res = await response.json();

      if (res.success) {
        showSuccess('Restoration complete. Your data has been merged successfully.');
        setValidationSummary(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        throw new Error(res.error?.message || 'Restoration failed.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to restore backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  if (!selectedBar || selectedBar.id === 'ALL_BARS') {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-10 max-w-4xl mx-auto">
        <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl shadow-sm">
          <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">Specific Bar Selection Required</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Please select a specific authorized bar outlet to perform operational data backup and restoration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto space-y-8 font-sans text-slate-700">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
            <span>Settings</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-indigo-600">Backup & Restore</span>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Enterprise Data Registry</h1>
          <p className="mt-2 text-slate-500 max-w-2xl text-sm leading-relaxed">
            Manage your operational data with business-friendly Excel backups. Export entire datasets or restore validated records into <span className="font-bold text-slate-900">{selectedBar.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-tight">
            Authorized Context: {selectedBar.name}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* BACKUP SECTION */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Backup</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Export Multi-Sheet Excel Workbook</p>
              </div>
            </div>
          </div>
          
          <div className="p-8 flex-1 space-y-6">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                Backup Coverage
              </h3>
              <ul className="text-xs text-slate-600 space-y-2 font-medium">
                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Bar Profile & Settings</li>
                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Canonical Master Products & Brands</li>
                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Maharashtra Excise SCM Mappings</li>
                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Full Transactional History (Sales, Inward, Adjustment)</li>
                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Real-time Inventory & Stock Ledger</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={handleDownloadBackup}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5" />
                )}
                Download Excel Backup (.xlsx)
              </button>
              {lastBackupInfo && (
                <p className="mt-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Last Backup: {lastBackupInfo}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* RESTORE SECTION */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Restore</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Import & Reconcile Data Registry</p>
              </div>
            </div>
          </div>

          <div className="p-8 flex-1 space-y-6">
            <div className="space-y-4">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Select Backup File</label>
              
              {!selectedFile ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                  <Upload className="w-10 h-10 text-slate-300 group-hover:text-indigo-500 mx-auto mb-4 transition-colors" />
                  <p className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Click to browse Excel backup</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-tighter">Only .xlsx files are supported</p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 truncate max-w-[180px] sm:max-w-xs">{selectedFile.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{(selectedFile.size / 1024).toFixed(1)} KB — Ready for validation</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setSelectedFile(null); setValidationSummary(null); }}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx" 
                className="hidden" 
              />
            </div>

            {selectedFile && !validationSummary && (
              <button
                onClick={handleValidateBackup}
                disabled={loading}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Validate Backup Integrity
              </button>
            )}

            {validationSummary && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-emerald-900 uppercase tracking-tight">Validation Passed</h3>
                    <div className="px-2.5 py-1 bg-emerald-600 text-[10px] font-bold text-white rounded-lg uppercase">Secure Match</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-[11px] mb-6">
                    <div>
                      <p className="text-emerald-600 font-bold uppercase tracking-tighter mb-0.5">Origin Bar</p>
                      <p className="text-emerald-900 font-black truncate">{validationSummary.barName}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600 font-bold uppercase tracking-tighter mb-0.5">Backup Date</p>
                      <p className="text-emerald-900 font-black">{new Date(validationSummary.backupDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2">Record Summary</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(validationSummary.recordCounts).map(([sheet, count]) => (
                        <div key={sheet} className="px-2 py-1 bg-white/60 rounded-md border border-emerald-200 text-[10px] font-bold text-emerald-800">
                          {sheet}: {count}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-amber-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
                >
                  {isRestoring ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  Execute Restore & Merge
                </button>
                
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-amber-800 font-bold uppercase tracking-tight">
                    Restoration will merge records using canonical IDs. Existing transactions with matching IDs will be updated. This action cannot be undone.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Safety Modal for Restore */}
      <ModalShell
        isOpen={isRestoring}
        onClose={() => {}}
        title="Restoration in Progress"
        subtitle="Critical Database Operation"
        icon={<RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />}
        showCloseButton={false}
      >
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Database className="w-10 h-10 text-indigo-600 animate-pulse" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Syncing Registry</h3>
          <p className="text-sm text-slate-500 leading-relaxed font-medium mb-4">
            LiquorFlow is currently reconciling your backup records with the production database. 
            Please do not refresh or close this window.
          </p>
          <div className="max-w-xs mx-auto bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full w-2/3 animate-[shimmer_2s_infinite]" />
          </div>
        </div>
      </ModalShell>
    </div>
  );
};
