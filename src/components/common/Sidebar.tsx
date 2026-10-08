import React, { useState, useEffect } from 'react';
import {
  Home,
  Package,
  ShoppingCart,
  BarChart3,
  Sliders,
  ChevronDown,
  ChevronRight,
  Store,
  User,
  FileInput,
  ArrowDownToLine,
  FileSpreadsheet,
  ShieldCheck,
  Database,
  Receipt,
  TrendingUp,
  CircleDot,
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

  // Auto-expand group when route matches
  useEffect(() => {
    const route = currentRoute.split('?')[0];
    if (['/stock/opening', '/opening-stock', '/purchases', '/received-stock', '/inventory', '/stock/adjustments', '/stock-ledger'].includes(route)) {
      setOpenGroups(prev => ({ ...prev, inventory: true }));
    } else if (route.startsWith('/transactions') || route.startsWith('/sales')) {
      setOpenGroups(prev => ({ ...prev, transactions: true }));
    } else if (route.startsWith('/reports')) {
      setOpenGroups(prev => ({ ...prev, reports: true }));
    } else if (['/scm-code', '/backup-restore', '/bar-settings', '/bars', '/user-settings', '/settings', '/brands', '/products', '/pack-sizes'].includes(route)) {
      setOpenGroups(prev => ({ ...prev, management: true }));
    }
  }, [currentRoute]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const modules = [
    {
      key: 'inventory',
      label: 'Inventory',
      icon: Package,
      items: [
        { id: '/stock/opening', label: 'Opening Stock' },
        { id: '/purchases', label: 'Received Stock' },
        { id: '/inventory', label: 'Inventory' },
        { id: '/stock/adjustments', label: 'Stock Adjustments' },
      ],
    },
    {
      key: 'transactions',
      label: 'Sales',
      icon: ShoppingCart,
      items: [
        { id: '/transactions?tab=add-sale', label: 'Add New Sale' },
        { id: '/transactions?tab=daily-sales', label: 'Daily Sales' },
        { id: '/transactions?tab=range-sales', label: 'Range Sales' },
        { id: '/transactions?tab=closing-sales', label: 'Closing Sales' },
      ],
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: BarChart3,
      items: [
        { id: '/reports?tab=daily-sales', label: 'Daily Sales' },
        { id: '/reports?tab=monthly-report', label: 'Monthly Reports' },
        { id: '/reports?tab=excise-log-book', label: 'Excise Log Book' },
        { id: '/reports?tab=sales-tax', label: 'Sales Tax' },
        { id: '/reports?tab=sales-summary', label: 'Sales Summary' },
        { id: '/reports?tab=permit-bills', label: 'Permit Bills' },
        { id: '/reports?tab=received-tp', label: 'Received TP' },
        { id: '/reports?tab=stock-value', label: 'Stock Value' },
        { id: '/reports?tab=available-stock', label: 'Available Stock' },
      ],
    },
    {
      key: 'management',
      label: 'Management',
      icon: Sliders,
      items: [
        { id: '/scm-code', label: 'SCM Codes' },
        { id: '/backup-restore', label: 'Backup & Restore' },
        { id: '/bar-settings', label: 'Bar Settings' },
        { id: '/user-settings', label: 'User Settings' },
      ],
    },
  ];

  const isItemActive = (itemId: string) => {
    if (itemId === currentRoute) return true;
    const currentBase = currentRoute.split('?')[0];
    const itemBase = itemId.split('?')[0];
    
    // Check if query parameter matches
    if (itemId.includes('?')) {
      if (currentRoute.includes('?')) {
        return itemId === currentRoute;
      }
      return itemId === (currentRoute + window.location.search);
    }
    
    return currentBase === itemBase;
  };

  const isBarHomeActive = currentRoute === '/bar-home' || currentRoute === '/' || currentRoute === '';

  return (
    <aside className="w-64 bg-[#0f172a] text-slate-300 border-r border-slate-800 min-h-screen flex flex-col justify-between select-none font-sans overflow-hidden">
      <div className="flex-1 py-6 px-4 space-y-6 overflow-y-auto scrollbar-hide">
        {/* Brand Logo */}
        <button
          type="button"
          onClick={() => onRouteChange('/bar-home')}
          className="w-full text-left px-2 mb-2 cursor-pointer focus:outline-none transition-transform hover:scale-[1.02] active:scale-100"
        >
          <LiquorFlowLogo size="md" variant="full" theme="dark" />
        </button>

        {/* Current Bar Status & Link to Bar Home */}
        <button
          type="button"
          onClick={() => onRouteChange('/bar-home')}
          className="w-full text-left px-3.5 py-3 bg-slate-800/40 hover:bg-slate-800 transition-all border border-slate-700/50 rounded-xl cursor-pointer group"
        >
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between mb-1">
            <span>Outlet</span>
            <span className="text-[9px] text-amber-400 font-bold bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-800/50 group-hover:bg-amber-800/50 transition-colors">Switch</span>
          </div>
          <div className="text-sm font-bold text-white truncate">
            {selectedBar?.name || 'No Bar Selected'}
          </div>
        </button>

        {/* Navigation List */}
        <nav className="space-y-1">
          {/* Bar Home Link */}
          <button
            type="button"
            onClick={() => onRouteChange('/bar-home')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left ${
              isBarHomeActive
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Home className={`w-4.5 h-4.5 shrink-0 ${isBarHomeActive ? 'text-slate-900' : 'text-slate-500'}`} />
            <span>Bar Home</span>
          </button>

          {/* Groups */}
          <div className="pt-4 pb-2">
            <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Modules</div>
            {modules.map(module => {
              const isOpen = openGroups[module.key];
              const ModuleIcon = module.icon;
              const hasActiveChild = module.items.some(item => isItemActive(item.id));

              return (
                <div key={module.key} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(module.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left group ${
                      hasActiveChild && !isOpen
                        ? 'text-amber-400 bg-amber-400/5'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ModuleIcon className={`w-4.5 h-4.5 shrink-0 transition-colors ${hasActiveChild ? 'text-amber-500' : 'text-slate-500 group-hover:text-slate-400'}`} />
                      <span>{module.label}</span>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="ml-5.5 pl-4 border-l border-slate-800/80 mt-1 space-y-1">
                      {module.items.map(item => {
                        const active = isItemActive(item.id);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onRouteChange(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer text-left ${
                              active
                                ? 'bg-amber-500/10 text-amber-400 font-bold'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`} />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      </div>

      {/* User Info Footer */}
      {user && (
        <div className="p-4 border-t border-slate-800 bg-[#0f172a] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm shrink-0">
            {user.username ? user.username.slice(0, 1).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {user.username || 'Admin User'}
            </div>
            <div className="text-[10px] text-slate-500 truncate font-medium">
              {user.email || 'Bar Manager'}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
