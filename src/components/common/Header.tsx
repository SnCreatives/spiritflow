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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 text-slate-900 select-none shadow-xs">
      <div className="page-container px-3 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Menu & Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            {user && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 md:hidden cursor-pointer"
                aria-label="Toggle Navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => onRouteChange('/dashboard')}
              className="flex items-center gap-2 focus:outline-none group cursor-pointer shrink-0"
              aria-label="LiquorFlow ERP Dashboard"
            >
              <LiquorFlowLogo size="xs" showText={true} showSubtitle={false} />

              <span className="hidden xl:inline-block text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 ml-1">
                Excise & Bar Stock ERP
              </span>
            </button>
          </div>

          {/* Active Bar Badge (Read-Only Display Only) & User Profile/Logout */}
          <div className="flex items-center gap-3 shrink-0">
            {user && selectedBar && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-xs"
                title={`Active Session Bar: ${selectedBar.name}`}
              >
                <div className="w-5 h-5 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Store className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] uppercase font-bold text-slate-400 leading-none">
                    Active Bar
                  </span>
                  <span className="text-xs font-bold text-amber-400 leading-tight truncate max-w-[140px] sm:max-w-[200px]">
                    {selectedBar.name}
                  </span>
                </div>
              </div>
            )}

            {user && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer shrink-0"
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
