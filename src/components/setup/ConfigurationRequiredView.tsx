import React, { useState } from 'react';
import { AlertTriangle, Database, CheckCircle2, Copy, RefreshCw, KeyRound, ExternalLink } from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { translations } from '../../utils/i18n';

interface ConfigurationRequiredViewProps {
  missingVariables: string[];
  onRetryConnection: () => Promise<void>;
  language: SupportedLanguage;
}

export const ConfigurationRequiredView: React.FC<ConfigurationRequiredViewProps> = ({
  missingVariables,
  onRetryConnection,
  language,
}) => {
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'env' | 'sql'>('env');
  const t = translations[language];

  const handleTestConnection = async () => {
    setChecking(true);
    try {
      await onRetryConnection();
    } finally {
      setChecking(false);
    }
  };

  const sampleEnv = `# LiquorFlow Production Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
SESSION_SECRET="${Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)}"`;

  const copyEnv = () => {
    navigator.clipboard.writeText(sampleEnv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Header Alert */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {t.configErrorHeading}
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              {t.configErrorSubheading}
            </p>
          </div>
        </div>

        {/* Missing Variables List */}
        <div className="bg-slate-950 border border-rose-900/50 rounded-xl p-4 mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-2">
            {t.missingVariablesNotice}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(missingVariables.length > 0
              ? missingVariables
              : ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET']
            ).map(varName => (
              <div
                key={varName}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs font-mono"
              >
                <KeyRound className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{varName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-800 mb-4">
          <button
            onClick={() => setActiveTab('env')}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'env'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Environment Setup (.env)
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sql'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Database Schema (Supabase SQL)
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'env' ? (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Open your project <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs">.env</code> file or the platform Settings menu and define your Supabase project parameters:
            </p>
            <div className="relative">
              <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                {sampleEnv}
              </pre>
              <button
                type="button"
                onClick={copyEnv}
                className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <span>Find your credentials in:</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline inline-flex items-center gap-0.5"
              >
                Supabase Dashboard &gt; Project Settings &gt; API
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-slate-300">
              The database schema migration is stored at <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs">/supabase/migrations/20260922000001_liquorflow_foundation.sql</code>.
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-200">Tables included in migration:</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'application_setup',
                  'owner_credentials',
                  'sessions',
                  'settings',
                  'categories',
                  'pack_sizes',
                  'brands',
                  'manufacturers',
                  'products',
                  'inventory',
                  'stock_ledger',
                  'sales',
                  'purchases',
                ].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Database className="w-4 h-4 text-slate-500" />
            <span>PostgreSQL Database Guard</span>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={checking}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? t.loading : t.recheckConnection}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
