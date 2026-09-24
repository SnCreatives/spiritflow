import React from 'react';
import { Search, Globe, LogOut, Menu } from 'lucide-react';
import { SupportedLanguage, AuthUser } from '../../types';
import { translations } from '../../utils/i18n';
import { LiquorFlowLogo } from './LiquorFlowLogo';

interface HeaderProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  user: AuthUser | null;
  onLogout: () => void;
  onOpenSearch: () => void;
  currentRoute: string;
  onRouteChange: (route: string) => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  user,
  onLogout,
  onOpenSearch,
  currentRoute,
  onRouteChange,
  onToggleSidebar,
}) => {
  const t = translations[language];

  return (
    <header className="header-container sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white select-none">
      <div className="page-container px-3 sm:px-6 lg:px-8">
        <div className="header-inner h-16 items-center justify-between gap-2 sm:gap-4">
          {/* 1. Menu & Original Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            {user && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 md:hidden cursor-pointer"
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
              {/* Original Logo with styled brand mark — NO duplicate white text */}
              <LiquorFlowLogo size="xs" showText={true} showSubtitle={false} />

              <span className="hidden xl:inline-block text-[10px] uppercase font-bold tracking-wider text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 ml-1">
                Inventory & Excise Management
              </span>
            </button>
          </div>

          {/* 2. Large Global Search Field (Primary Navigation & Search) */}
          {user && (
            <div className="global-search-container max-w-md lg:max-w-lg xl:max-w-xl mx-1 sm:mx-2">
              <button
                type="button"
                onClick={onOpenSearch}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/90 border border-slate-700/80 hover:border-amber-500/70 text-slate-400 hover:text-slate-200 text-xs sm:text-sm transition-all shadow-inner group cursor-pointer"
                title="Search products, brands, SKU, batch, supplier, excise reference... (Ctrl + K)"
              >
                <div className="flex items-center gap-2.5 truncate min-w-0">
                  <Search className="w-4 h-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate text-slate-400 group-hover:text-slate-300">
                    Search complete Product Master (SKU, Brand, etc)...
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-1 shrink-0 ml-2">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700 rounded">
                    Ctrl K
                  </kbd>
                </div>
              </button>
            </div>
          )}

          {/* 3. Language Selector & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Language Selector */}
            <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-xl p-0.5">
              <Globe className="w-3 h-3 text-slate-400 ml-1.5 hidden lg:inline" />
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('hi')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  language === 'hi'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                HI
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('mr')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  language === 'mr'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MR
              </button>
            </div>

            {/* Logout */}
            {user && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 transition-colors cursor-pointer shrink-0"
                title={t.navLogout}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t.navLogout}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

