import React, { useState } from 'react';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  Layers,
  ArrowDownToLine,
  ShoppingCart,
  Archive,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiPost } from '../../utils/api';

type BackupTab = 'opening-stock' | 'received-stock' | 'sales' | 'available-stock';

export const BackupRestoreView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<BackupTab>('opening-stock');
  const [loading, setLoading] = useState(false);
  const [restoreJson, setRestoreJson] = useState<string>('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [parsedPackage, setParsedPackage] = useState<any | null>(null);

  const getDataTypeParam = (tab: BackupTab): string => {
    switch (tab) {
      case 'opening-stock':
        return 'OPENING_STOCK';
      case 'received-stock':
        return 'PURCHASES';
      case 'sales':
        return 'SALES';
      case 'available-stock':
        return 'INVENTORY';
    }
  };

  // Handler: Export Backup
  const handleExportBackup = async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar before exporting backup.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost('/api/backup/export', {
        barId: selectedBar.id,
        dataType: getDataTypeParam(activeTab),
      });

      if (res.success && res.data) {
        const backupData = res.data;
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: 'application/json;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute(
          'download',
          `LiquorFlow_${activeTab}_${selectedBar.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showSuccess('Backup package exported successfully.');
      } else {
        throw new Error(res.error?.message || 'Failed to export backup package.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to export backup.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Parse and Stage Restore
  const handleStageRestore = () => {
    if (!restoreJson.trim()) {
      showError('Please paste a valid JSON backup package.');
      return;
    }

    try {
      const parsed = JSON.parse(restoreJson);
      if (!parsed.barId && !parsed.targetBarId && !parsed.metadata?.barId) {
        throw new Error('Invalid backup package: Missing originating bar identifier metadata.');
      }

      setParsedPackage(parsed);
      setConfirmModalOpen(true);
    } catch (e: any) {
      showError(`Invalid JSON format: ${e.message}`);
    }
  };

  // Handler: Execute Confirmed Restore
  const handleExecuteRestore = async () => {
    if (!selectedBar?.id || !parsedPackage) return;
    setLoading(true);
    try {
      const res = await apiPost('/api/backup/restore', {
        barId: selectedBar.id,
        backupPackage: parsedPackage,
      });

      if (res.success) {
        showSuccess('Data restored successfully into selected bar.');
        setConfirmModalOpen(false);
        setRestoreJson('');
        setParsedPackage(null);
      } else {
        throw new Error(res.error?.message || 'Restore operation failed.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to restore backup.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedBar || selectedBar.id === 'ALL_BARS') {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-10 max-w-4xl mx-auto">
        <div className="p-8 text-center bg-white border border-amber-200 rounded-2xl shadow-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-700">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Specific Bar Selection Required</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Select a specific authorized bar to perform backup and restore operations.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'opening-stock', label: 'Opening Stock', icon: Layers },
    { id: 'received-stock', label: 'Received Stock', icon: ArrowDownToLine },
    { id: 'sales', label: 'Sales Transactions', icon: ShoppingCart },
    { id: 'available-stock', label: 'Available Stock', icon: Archive },
  ];

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <Database className="w-4 h-4" />
            Bar Data Management
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Backup & Bar-Scoped Data Restore
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Bar:{' '}
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {selectedBar.name}
            </span>
          </p>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as BackupTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Export {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-xs text-slate-500">
                Generate a signed JSON backup package strictly scoped to {selectedBar.name}.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
            <p>
              • Origin Bar: <strong>{selectedBar.name}</strong>
            </p>
            <p>
              • Scope: <strong>{getDataTypeParam(activeTab)}</strong>
            </p>
            <p>• Format: Signed JSON with audit timestamps and ledger hashes.</p>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating Backup...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download JSON Backup
              </>
            )}
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Restore {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-xs text-slate-500">
                Import and reconcile historical records into {selectedBar.name}.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Paste Backup JSON Package
            </label>
            <textarea
              rows={4}
              placeholder="Paste raw JSON backup package content here..."
              value={restoreJson}
              onChange={e => setRestoreJson(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleStageRestore}
            disabled={loading || !restoreJson.trim()}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Review & Restore Data
          </button>
        </div>
      </div>

      {/* Confirm Restore Modal */}
      {confirmModalOpen && parsedPackage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Confirm Bar Data Restore</h3>
            </div>

            <p className="text-xs text-slate-600">
              You are about to restore backup data into <strong>{selectedBar.name}</strong>.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              Target Bar: <strong>{selectedBar.name}</strong> ({selectedBar.id})
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={loading}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? 'Restoring...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
