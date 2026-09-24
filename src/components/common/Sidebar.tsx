import React from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  Award,
  Factory,
  Box,
  FileInput,
  ArrowDownToLine,
  SlidersHorizontal,
  FileSpreadsheet,
  QrCode,
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { SupportedLanguage, AuthUser } from '../../types';
import { translations } from '../../utils/i18n';
import { LiquorFlowLogo } from './LiquorFlowLogo';

interface SidebarProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
  language: SupportedLanguage;
  user: AuthUser | null;
  onLogout: () => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onRouteChange,
  language,
  user,
  onLogout,
}) => {
  const t = translations[language];

  const navigationItems = [
    {
      group: 'OVERVIEW',
      items: [
        {
          id: '/dashboard',
          label: t.navDashboard || 'Dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      group: 'INVENTORY & STOCK',
      items: [
        {
          id: '/inventory',
          label: t.navInventory || 'Inventory',
          icon: Package,
        },
        {
          id: '/stock/opening',
          label: 'Opening / TP Stock',
          icon: FileInput,
        },
        {
          id: '/purchases',
          label: 'Purchase / Inward',
          icon: ArrowDownToLine,
        },
        {
          id: '/stock/adjustments',
          label: 'Stock Adjustments',
          icon: SlidersHorizontal,
        },
        {
          id: '/stock-ledger',
          label: 'Stock Ledger',
          icon: FileSpreadsheet,
        },
        {
          id: '/batches',
          label: 'Batches',
          icon: QrCode,
        },
      ],
    },
    {
      group: 'MASTERS',
      items: [
        {
          id: '/products',
          label: t.navProducts || 'Products',
          icon: Layers,
        },
        {
          id: '/brands',
          label: t.navBrands || 'Brands',
          icon: Award,
        },
        {
          id: '/pack-sizes',
          label: t.navPackSizes || 'Pack Sizes',
          icon: Box,
        },
      ],
    },
    {
      group: 'EXCISE & AUDIT',
      items: [
        {
          id: '/excise',
          label: 'Excise Management',
          icon: ShieldCheck,
        },
        {
          id: '/reports',
          label: t.navReports || 'Reports',
          icon: BarChart3,
        },
        {
          id: '/settings',
          label: t.navSettings || 'Settings',
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-2">
        <LiquorFlowLogo size="sm" showSubtitle={true} orientation="horizontal" />
        <div className="flex items-center justify-between px-1 pt-1 border-t border-slate-800/60 text-xs">
          <span className="text-slate-400 font-medium truncate max-w-[130px]">
            {user?.business_name || 'Active Session'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-6">
        {navigationItems.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1">
              {group.group}
            </div>
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onRouteChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/5'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / User Profile & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <LogOut className="w-4 h-4" />
            <span>{t.navLogout || 'Logout'}</span>
          </div>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Exit</span>
        </button>
      </div>
    </aside>
  );
};
