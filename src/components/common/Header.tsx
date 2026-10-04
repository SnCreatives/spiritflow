import React from 'react';
import { LogOut, Menu, Store } from 'lucide-react';
import { AuthUser } from '../../types';
import { LiquorFlowLogo } from './LiquorFlowLogo';
import { useBar } from '../../lib/contexts/BarContext';

interface HeaderProps {
  user: AuthUser | null;
  onLogout: () => void;
  onOpenSearch?: () => void;
  currentRoute: string;
  onRouteChange: (route: string) => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onRouteChange,
  onToggleSidebar,
}) => {
  const { selectedBar } = useBar();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 text-slate-900 select-none shadow-sm font-sans">
      <div className="page-container px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between gap-4">
          {/* Menu & Logo */}
          <div className="flex items-center gap-3 shrink-0">
            {user && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 md:hidden cursor-pointer transition-colors border border-slate-200"
                aria-label="Toggle Navigation"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => onRouteChange('/dashboard')}
              className="flex items-center gap-2.5 focus:outline-none group cursor-pointer shrink-0"
              aria-label="LiquorFlow ERP Dashboard"
            >
              <LiquorFlowLogo size="sm" variant="full" />

              <span className="hidden xl:inline-block text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/50 ml-1 uppercase tracking-wider">
                Excise & Bar Stock ERP
              </span>
            </button>
          </div>

          {/* Active Session Bar Context (Read-Only Display) & Logout */}
          <div className="flex items-center gap-3 shrink-0">
            {user && selectedBar && (
              <div
                className="flex items-center gap-2 px-3 py-1 bg-slate-50 text-slate-800 rounded-lg border border-slate-200/60"
                title={`Active Session Bar: ${selectedBar.name}`}
              >
                <div className="w-5 h-5 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <Store className="w-3 h-3" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[8px] uppercase font-bold tracking-widest text-slate-400 leading-none">
                    Active Bar
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[140px] sm:max-w-[220px]">
                    {selectedBar.name}
                  </span>
                </div>
              </div>
            )}

            {user && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 transition-colors cursor-pointer shrink-0"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
