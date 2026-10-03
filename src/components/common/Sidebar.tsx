import React from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  Award,
  Box,
  FileInput,
  ArrowDownToLine,
  ShoppingCart,
  ShieldCheck,
  BarChart3,
  Database,
  Store,
  User,
  SlidersHorizontal,
  FileSpreadsheet,
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

  const navigationSections = [
    {
      group: 'OVERVIEW',
      items: [
        {
          id: '/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      group: 'CORE OPERATIONS',
      items: [
        {
          id: '/stock/opening',
          label: 'Opening Stock',
          icon: FileInput,
        },
        {
          id: '/purchases',
          label: 'Received Stock',
          icon: ArrowDownToLine,
        },
        {
          id: '/transactions',
          label: 'Transaction Entry',
          icon: ShoppingCart,
          badge: 'Sales & Closing',
        },
        {
          id: '/inventory',
          label: 'Inventory Register',
          icon: Package,
        },
        {
          id: '/stock-ledger',
          label: 'Stock Ledger',
          icon: FileSpreadsheet,
        },
      ],
    },
    {
      group: 'EXCISE & AUDIT',
      items: [
        {
          id: '/reports',
          label: 'Excise & ERP Reports',
          icon: BarChart3,
        },
        {
          id: '/scm-code',
          label: 'SCM Code Master',
          icon: ShieldCheck,
        },
      ],
    },
    {
      group: 'PRODUCT MASTERS',
      items: [
        {
          id: '/products',
          label: 'Product Master',
          icon: Layers,
        },
        {
          id: '/brands',
          label: 'Brand Master',
          icon: Award,
        },
        {
          id: '/pack-sizes',
          label: 'Bottle Sizes',
          icon: Box,
        },
      ],
    },
    {
      group: 'SYSTEM & SETTINGS',
      items: [
        {
          id: '/backup-restore',
          label: 'Backup & Restore',
          icon: Database,
        },
        {
          id: '/bar-settings',
          label: 'Bar Settings',
          icon: Store,
        },
        {
          id: '/user-settings',
          label: 'User Settings',
          icon: User,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 min-h-screen flex flex-col justify-between select-none">
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {/* Brand Banner */}
        <div className="px-2 flex items-center gap-2">
          <LiquorFlowLogo size="sm" showText={true} />
        </div>

        {/* Selected Bar Mini-Badge */}
        <div className="mx-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Selected Bar Outlet
          </span>
          <span className="text-xs font-black text-slate-900 truncate block mt-0.5">
            {selectedBar?.name || 'All Authorized Bars'}
          </span>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-5">
          {navigationSections.map(section => (
            <div key={section.group} className="space-y-1">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                {section.group}
              </span>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive =
                    currentRoute === item.id ||
                    (item.id === '/transactions' && currentRoute.startsWith('/transactions')) ||
                    (item.id === '/stock/opening' && currentRoute === '/opening-stock') ||
                    (item.id === '/purchases' && currentRoute === '/received-stock') ||
                    (item.id === '/bar-settings' && currentRoute === '/bars') ||
                    (item.id === '/user-settings' && currentRoute === '/settings');

                  return (
                    <button
                      key={item.id}
                      onClick={() => onRouteChange(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          isActive ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* User Footer Summary */}
      {user && (
        <div className="p-3 border-t border-slate-200 bg-white m-2 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 font-bold text-xs">
              {user.username ? user.username.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-900 truncate block">
                {user.username || 'Admin User'}
              </span>
              <span className="text-[10px] text-slate-500 truncate block font-mono">
                {user.email || 'Excise Manager'}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
