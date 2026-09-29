import React from 'react';
import { Store, Layers, Info } from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';

export type ReportScope = 'CURRENT_BAR' | 'ALL_BARS';

interface ReportScopeSelectorProps {
  scope: ReportScope;
  onChange: (scope: ReportScope) => void;
  title?: string;
  className?: string;
}

export const ReportScopeSelector: React.FC<ReportScopeSelectorProps> = ({
  scope,
  onChange,
  title = 'Report Scope',
  className = '',
}) => {
  const { selectedBar, availableBars } = useBar();

  return (
    <div className={`bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 sm:p-4 space-y-2 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {title}:
          </span>
          <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => onChange('CURRENT_BAR')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                scope === 'CURRENT_BAR'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Current Bar ({selectedBar?.name || 'Selected'})</span>
            </button>

            <button
              type="button"
              onClick={() => onChange('ALL_BARS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                scope === 'ALL_BARS'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Bars ({availableBars.length} Authorized Outlets)</span>
            </button>
          </div>
        </div>

        {scope === 'ALL_BARS' ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
            <Info className="w-3 h-3 shrink-0" />
            <span>Reporting analytics only. Operational transactions remain assigned to {selectedBar?.name || 'your active bar'}.</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
            <span>Filtered strictly to {selectedBar?.name || 'current outlet'} ({selectedBar?.code || 'MAIN'}).</span>
          </span>
        )}
      </div>
    </div>
  );
};
