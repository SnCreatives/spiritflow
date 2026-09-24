import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building,
  Phone,
  FileText,
  ShieldCheck,
  Globe,
  Sliders,
  Zap,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { apiGet, apiPut } from '../../utils/api';
import { translations } from '../../utils/i18n';

interface SettingsViewProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onRestartTutorial?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  onLanguageChange,
  onRestartTutorial,
}) => {
  const t = translations[language];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-save settings state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    return localStorage.getItem('liquorflow_autosave_settings') !== 'false';
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const initialLoadDoneRef = useRef<boolean>(false);
  const isAutoSavingRef = useRef<boolean>(false);

  const [form, setForm] = useState({
    businessName: 'LiquorFlow ERP',
    address: 'Shop No. 4, Main Road, Pune, Maharashtra',
    ownerMobile: '8857003771',
    vatNumber: '27AAAAA0000A1Z5',
    licenceReference: 'FL-II / CL-III (State Excise Maharashtra)',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    selectedLanguage: language,
    lowStockThreshold: 10,
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/settings');
      if (data.success && data.data) {
        const s = data.data;
        setForm({
          businessName: s.business_name || 'LiquorFlow ERP',
          address: s.address || '',
          ownerMobile: s.owner_mobile || '8857003771',
          vatNumber: s.vat_number || '27AAAAA0000A1Z5',
          licenceReference: s.licence_reference || 'FL-II / CL-III',
          currency: s.currency || 'INR',
          timezone: s.timezone || 'Asia/Kolkata',
          dateFormat: s.date_format || 'DD/MM/YYYY',
          selectedLanguage: (s.selected_language as SupportedLanguage) || language,
          lowStockThreshold: Number(s.low_stock_threshold || 10),
        });
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
      setTimeout(() => {
        initialLoadDoneRef.current = true;
      }, 100);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Handle toggle change for Auto Save
  const handleToggleAutoSave = (enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    localStorage.setItem('liquorflow_autosave_settings', enabled ? 'true' : 'false');
  };

  // Debounced Auto-Save effect when form changes
  useEffect(() => {
    if (!initialLoadDoneRef.current || !autoSaveEnabled || loading) return;

    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        isAutoSavingRef.current = true;
        const data = await apiPut('/api/settings', form);
        if (data.success) {
          onLanguageChange(form.selectedLanguage);
          setAutoSaveStatus('saved');
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSavedTime(now);
        } else {
          setAutoSaveStatus('error');
        }
      } catch (err) {
        setAutoSaveStatus('error');
      } finally {
        isAutoSavingRef.current = false;
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [form, autoSaveEnabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const data = await apiPut('/api/settings', form);
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update settings');
      }

      onLanguageChange(form.selectedLanguage);
      setFeedback({ type: 'success', message: 'Settings saved successfully to database!' });
      setAutoSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
      setAutoSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Business & System Settings
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure establishment profile, VAT registrations, excise licence prefixes, and language preferences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Auto-Save Toggle Pill */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800">
            <Zap className={`w-3.5 h-3.5 ${autoSaveEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
            <span className="text-xs font-semibold text-slate-300">Auto-Save:</span>
            <button
              type="button"
              onClick={() => handleToggleAutoSave(!autoSaveEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoSaveEnabled ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                  autoSaveEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            {autoSaveEnabled && (
              <span className="text-[11px] font-medium ml-1">
                {autoSaveStatus === 'saving' && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin inline" /> Saving...
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 inline" /> {lastSavedTime ? `Saved at ${lastSavedTime}` : 'Saved'}
                  </span>
                )}
                {autoSaveStatus === 'idle' && <span className="text-slate-400">Active</span>}
                {autoSaveStatus === 'error' && <span className="text-rose-400">Save failed</span>}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={fetchSettings}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Establishment Details */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-400" />
              <span>Establishment Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Business / Bar Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.businessName}
                  onChange={e => setForm({ ...form, businessName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Owner Mobile Number <span className="text-amber-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={form.ownerMobile}
                  onChange={e => setForm({ ...form, ownerMobile: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Excise & Taxation (VAT only)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  State VAT TIN Number
                </label>
                <input
                  type="text"
                  value={form.vatNumber}
                  onChange={e => setForm({ ...form, vatNumber: e.target.value })}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Excise Licence Reference (FL-II / CL-III)
                </label>
                <input
                  type="text"
                  value={form.licenceReference}
                  onChange={e => setForm({ ...form, licenceReference: e.target.value })}
                  placeholder="e.g. FL-II-PUN-091"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Regional & Inventory Thresholds</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Language
                </label>
                <select
                  value={form.selectedLanguage}
                  onChange={e => setForm({ ...form, selectedLanguage: e.target.value as SupportedLanguage })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-medium"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="mr">मराठी (Marathi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Low Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.lowStockThreshold}
                  onChange={e => setForm({ ...form, lowStockThreshold: parseInt(e.target.value, 10) || 10 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Currency
                </label>
                <input
                  type="text"
                  disabled
                  value="INR (₹)"
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Help & Interactive Tutorial Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <span>Interactive Onboarding & Tutorial</span>
          </h3>
          <p className="text-xs text-slate-400">
            Need a refresher on navigating inventory batches, TP inwards, stock ledger, or Maharashtra excise registers?
          </p>
        </div>

        {onRestartTutorial && (
          <button
            type="button"
            onClick={onRestartTutorial}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-amber-300 font-bold text-xs transition-colors shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <span>Restart Tutorial</span>
          </button>
        )}
      </div>
    </div>
  );
};
