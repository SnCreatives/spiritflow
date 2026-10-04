import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Sliders,
  ChevronRight,
  Store,
  User,
  FileInput,
  ArrowDownToLine,
  FileSpreadsheet,
  Award,
  Box,
  Layers,
  ShieldCheck,
  Database,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { AuthUser } from '../../types';
import { LiquorFlowLogo } from './LiquorFlowLogo';
import { useBar } from '../../lib/contexts/BarContext';

interface SidebarProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
  user: AuthUser | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onRouteChange,
  user,
}) => {
  const { selectedBar } = useBar();

  // Collapsible accordion group states
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    inventory: true,
    transactions: false,
    reports: false,
    management: false,
  });

  // Auto-expand parent module when route matches
  useEffect(() => {
    if (['/stock/opening', '/opening-stock', '/purchases', '/received-stock', '/inventory', '/stock/adjustments', '/stock-ledger', '/products', '/brands', '/pack-sizes'].includes(currentRoute)) {
      setOpenGroups(prev => ({ ...prev, inventory: true }));
    } else if (currentRoute.startsWith('/transactions') || currentRoute.startsWith('/sales')) {
      setOpenGroups(prev => ({ ...prev, transactions: true }));
    } else if (currentRoute.startsWith('/reports') || currentRoute === '/reports') {
      setOpenGroups(prev => ({ ...prev, reports: true }));
    } else if (['/scm-code', '/excise', '/backup-restore', '/bar-settings', '/bars', '/user-settings', '/settings'].includes(currentRoute)) {
      setOpenGroups(prev => ({ ...prev, management: true }));
    }
  }, [currentRoute]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const modules = [
    {
      key: 'inventory',
      label: 'INVENTORY',
      icon: Package,
      items: [
        { id: '/stock/opening', label: 'Opening Stock', icon: FileInput },
        { id: '/purchases', label: 'Received Stock', icon: ArrowDownToLine },
        { id: '/inventory', label: 'Inventory Register', icon: Package },
        { id: '/stock/adjustments', label: 'Stock Adjustments', icon: Sliders },
        { id: '/stock-ledger', label: 'Stock Ledger', icon: FileSpreadsheet },
        { id: '/products', label: 'Product Master', icon: Layers },
        { id: '/brands', label: 'Brand Master', icon: Award },
        { id: '/pack-sizes', label: 'Bottle Sizes', icon: Box },
      ],
    },
    {
      key: 'transactions',
      label: 'TRANSACTIONS',
      icon: ShoppingCart,
      items: [
        { id: '/transactions', label: 'Add Sale Entry', icon: Receipt },
        { id: '/transactions?tab=update', label: 'Update Sale Entry', icon: Receipt },
        { id: '/transactions?tab=range', label: 'Range Sales', icon: TrendingUp },
        { id: '/transactions?tab=closing', label: 'Closing Sales & Stock', icon: Package },
      ],
    },
    {
      key: 'reports',
      label: 'REPORTS',
      icon: BarChart3,
      items: [
        { id: '/reports', label: 'Daily Sales Report', icon: BarChart3 },
        { id: '/reports', label: 'Monthly Reports', icon: BarChart3 },
        { id: '/reports', label: 'Excise Log Book Report', icon: ShieldCheck },
        { id: '/reports', label: 'Sales Tax Report', icon: BarChart3 },
        { id: '/reports', label: 'Sales Report Summary', icon: BarChart3 },
        { id: '/reports', label: 'Permit Bills', icon: Receipt },
        { id: '/reports', label: 'Received TP Report', icon: ArrowDownToLine },
        { id: '/reports', label: 'Stock Value Report', icon: Package },
        { id: '/reports', label: 'Available Stock Status', icon: Package },
      ],
    },
    {
      key: 'management',
      label: 'MANAGEMENT',
      icon: Sliders,
      items: [
        { id: '/scm-code', label: 'SCM Code Management', icon: ShieldCheck },
        { id: '/backup-restore', label: 'Backup & Restore', icon: Database },
        { id: '/bar-settings', label: 'Bar Settings', icon: Store },
        { id: '/user-settings', label: 'User Settings', icon: User },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 min-h-screen flex flex-col justify-between select-none font-sans text-slate-300">
      <div className="flex-1 py-5 px-4 space-y-6 overflow-y-auto custom-scrollbar">
        {/* Brand Banner */}
        <div className="px-1 py-1 flex items-center justify-start">
          <LiquorFlowLogo size="md" variant="full" />
        </div>

        {/* Selected Bar Context Badge (Compact premium status component) */}
        <div className="mx-1 px-3 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
            CURRENT BAR
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-bold text-slate-100 truncate pr-2">
              {selectedBar?.name || 'No Bar Selected'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-400">Active</span>
            </div>
          </div>
        </div>

        {/* Navigation Accordion */}
        <nav className="space-y-4">
          {/* Dashboard (Direct Item) */}
          <div>
            <button
              type="button"
              onClick={() => onRouteChange('/dashboard')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentRoute === '/dashboard'
                  ? 'bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-600/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className={`w-4 h-4 shrink-0 ${currentRoute === '/dashboard' ? 'text-slate-950' : 'text-slate-500'}`} />
                <span>Dashboard</span>
              </div>
            </button>
          </div>

          {/* Collapsible Modules */}
          {modules.map(module => {
            const isOpen = openGroups[module.key];
            const ModuleIcon = module.icon;
            const isAnyChildActive = module.items.some(
              item => currentRoute === item.id || (item.id.includes('?') && currentRoute === item.id.split('?')[0])
            );

            return (
              <div key={module.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(module.key)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer ${
                    isAnyChildActive && !isOpen
                      ? 'text-emerald-400 bg-emerald-950/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ModuleIcon className={`w-3.5 h-3.5 shrink-0 ${isAnyChildActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>{module.label}</span>
                  </div>
                  <ChevronRight
                    className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${
                      isOpen ? 'rotate-90 text-emerald-400' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="pl-3 py-0.5 space-y-1 ml-2 border-l border-slate-800">
                    {module.items.map((item, idx) => {
                      const SubIcon = item.icon;
                      const isSubActive = currentRoute === item.id || (idx === 0 && module.key === 'reports' && currentRoute === '/reports');

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onRouteChange(item.id.split('?')[0])}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-left border-l-2 ${
                            isSubActive
                              ? 'bg-slate-800/80 text-emerald-400 font-bold border-emerald-500'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-transparent'
                          }`}
                        >
                          <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* User Footer Summary */}
      {user && (
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/40 m-3 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
            {user.username ? user.username.slice(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-200 truncate block">
              {user.username || 'Admin User'}
            </span>
            <span className="text-[10px] text-slate-500 truncate block">
              {user.email || 'Bar Manager'}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
