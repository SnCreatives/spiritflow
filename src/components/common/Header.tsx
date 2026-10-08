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
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 select-none font-sans">
      <div className="px-4 sm:px-6">
        <div className="h-13 flex items-center justify-between gap-4">
          {/* Mobile Menu & Logo */}
          <div className="flex items-center gap-3">
            {user && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-700 md:hidden cursor-pointer"
                aria-label="Toggle Navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => onRouteChange('/bar-home')}
              className="flex items-center gap-2 cursor-pointer focus:outline-none"
              aria-label="LiquorFlow ERP"
            >
              <LiquorFlowLogo size="sm" variant="full" theme="light" />
            </button>
          </div>

          {/* Active Bar Context & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user && selectedBar && (
              <button
                type="button"
                onClick={() => onRouteChange('/bar-home')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-md text-xs text-slate-600 cursor-pointer"
                title="View Bar Home"
              >
                <span className="text-slate-500 font-medium whitespace-nowrap">Current Bar:</span>
                <span className="font-bold text-slate-900 truncate max-w-[120px] sm:max-w-[240px]">
                  {selectedBar.name}
                </span>
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
