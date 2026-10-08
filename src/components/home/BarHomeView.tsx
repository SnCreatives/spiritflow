import React, { useState } from 'react';
import {
  Building2,
  Package,
  ArrowDownToLine,
  ShoppingCart,
  Sliders,
  BarChart3,
  FileSpreadsheet,
  Database,
  User,
  MapPin,
  Phone,
  ShieldCheck,
  ChevronDown,
  Layers,
  ArrowRight,
  ClipboardList,
  Award,
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { LiquorFlowLogo } from '../common/LiquorFlowLogo';
import { ModalShell } from '../common/ModalShell';

interface BarHomeViewProps {
  onNavigate: (route: string) => void;
  onLogout: () => void;
}

export const BarHomeView: React.FC<BarHomeViewProps> = ({ onNavigate, onLogout }) => {
  const { selectedBar, availableBars, isLoading } = useBar();
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingBarId, setPendingBarId] = useState<string>('');

  const handleBarChangeRequest = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const barId = e.target.value;
    if (barId === selectedBar?.id) return;
    
    setPendingBarId(barId);
    setShowSwitchConfirm(true);
  };

  const confirmSwitchAndLogout = () => {
    // Clear bar-specific local storage context
    localStorage.removeItem('liquorflow_selected_bar_id');
    
    // Clear any potentially cached session-specific items
    // (Master data can persist, but bar-scoped data must be cleared on re-login)
    
    setShowSwitchConfirm(false);
    onLogout();
  };

  const modules = [
    {
      title: 'Inventory',
      description: 'View current physical stock, ML balance, and batch positions',
      route: '/inventory',
      icon: Package,
      color: 'text-amber-600 bg-amber-50 border-amber-200'
    },
    {
      title: 'Opening Stock',
      description: 'Record and verify opening bottle counts and master batches',
      route: '/stock/opening',
      icon: Layers,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      title: 'Received Stock / Inward',
      description: 'Inward consignments, TP permits, and excise paste import',
      route: '/purchases',
      icon: ArrowDownToLine,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    {
      title: 'Sales',
      description: 'Record counter sales, range sales, and customer billing',
      route: '/transactions?tab=add-sale',
      icon: ShoppingCart,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
    },
    {
      title: 'Stock Adjustment',
      description: 'Record breakages, spillages, returns, and physical corrections',
      route: '/stock/adjustments',
      icon: Sliders,
      color: 'text-purple-600 bg-purple-50 border-purple-200'
    },
    {
      title: 'Closing Stock',
      description: 'Physical stock reconciliation and ledger variance auditing',
      route: '/transactions?tab=closing-stock',
      icon: ClipboardList,
      color: 'text-rose-600 bg-rose-50 border-rose-200'
    },
    {
      title: 'Reports & Excise Log Book',
      description: 'Daily/Monthly sales, statutory Excise Log Book & tax summaries',
      route: '/reports',
      icon: BarChart3,
      color: 'text-teal-600 bg-teal-50 border-teal-200'
    },
    {
      title: 'SCM Code Management',
      description: 'Maharashtra Excise SCM codes, mappings & template import',
      route: '/scm-code',
      icon: FileSpreadsheet,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200'
    },
    {
      title: 'Backup & Restore',
      description: 'Full database backups, snapshot exports, and data recovery',
      route: '/backup-restore',
      icon: Database,
      color: 'text-slate-600 bg-slate-100 border-slate-300'
    },
    {
      title: 'Bar Settings',
      description: 'Outlet profiles, excise license configuration, and addresses',
      route: '/bar-settings',
      icon: Building2,
      color: 'text-orange-600 bg-orange-50 border-orange-200'
    },
    {
      title: 'User Settings',
      description: 'Manage passwords, role permissions, and user profile',
      route: '/user-settings',
      icon: User,
      color: 'text-violet-600 bg-violet-50 border-violet-200'
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Top Bar Branding & Active Bar Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-slate-100">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <LiquorFlowLogo size="sm" variant="full" theme="light" />
              <span className="font-mono text-[10px] uppercase font-bold tracking-[0.2em] px-2 py-0.5 bg-slate-900 text-white rounded">
                Operational Portal
              </span>
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Active Bar Context
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {selectedBar?.name || (isLoading ? 'Loading Bar...' : 'No Bar Selected')}
            </h1>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl font-medium">
              Manage inventory, daily sales, and statutory excise compliance records for this outlet.
            </p>
          </div>

          {/* Bar Selector Card */}
          <div className="w-full lg:w-96 bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-inner">
            <label htmlFor="bar-home-selector" className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Switch Operational Outlet
            </label>
            <div className="relative">
              <select
                id="bar-home-selector"
                value={selectedBar?.id || ''}
                onChange={handleBarChangeRequest}
                disabled={isLoading || availableBars.length === 0}
                className="w-full pl-4 pr-10 py-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer appearance-none shadow-sm transition-all"
              >
                {availableBars.map(bar => (
                  <option key={bar.id} value={bar.id}>
                    {bar.name} {bar.code ? `(${bar.code})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 w-fit">
              <ShieldCheck className="w-3 h-3" />
              <span>Multi-Bar Isolation Active</span>
            </div>
          </div>
        </div>

        {/* Bar Switch Confirmation Modal */}
        <ModalShell
          isOpen={showSwitchConfirm}
          onClose={() => setShowSwitchConfirm(false)}
          title="Switch Bar Confirmation"
          subtitle="Session Security Action"
          icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
          maxWidth="max-w-md"
        >
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <LogOut className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">Logout Required</h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              Switching operational bars will terminate your current secure session. 
              You will need to <span className="text-slate-900 font-bold underline decoration-amber-500 underline-offset-4">log in again</span> to access the newly selected bar.
            </p>
            
            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={confirmSwitchAndLogout}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-[0.98] cursor-pointer"
              >
                Switch & Logout
              </button>
              <button
                onClick={() => setShowSwitchConfirm(false)}
                className="w-full py-3.5 bg-white hover:bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest rounded-xl border border-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalShell>

        {/* Configured Bar Details - Read-only operational summary */}
        {selectedBar && (
          <div className="pt-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px bg-slate-200 flex-1"></div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Outlet Profile Summary</div>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Address */}
              <div className="flex gap-3 p-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Location</div>
                  <div className="text-xs font-bold text-slate-800 leading-relaxed">
                    {[selectedBar.address, selectedBar.city, selectedBar.state, selectedBar.pincode].filter(Boolean).join(', ') || 'Address not configured'}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="flex gap-3 p-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Contact</div>
                  <div className="text-xs font-bold text-slate-800">
                    <div>{selectedBar.contact_person || 'Manager'}</div>
                    {selectedBar.phone && <div className="text-slate-500 font-mono mt-0.5">{selectedBar.phone}</div>}
                  </div>
                </div>
              </div>

              {/* License */}
              <div className="flex gap-3 p-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Excise Permit</div>
                  <div className="text-xs font-bold text-slate-800">
                    <div className="truncate">{selectedBar.license_number || 'FLR-3 License'}</div>
                    <div className="text-emerald-600 font-mono mt-0.5">{selectedBar.code || 'CODE-PENDING'}</div>
                  </div>
                </div>
              </div>

              {/* Stats/Status */}
              <div className="flex gap-3 p-1">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Operation</div>
                  <div className="text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>System Active</span>
                    </div>
                    <div className="text-slate-500 mt-0.5 font-mono">UID: {selectedBar.id.slice(0, 8)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Module Navigation Grid */}
      <div className="mb-8">
        <div className="flex items-baseline gap-3 mb-6">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Operations
          </h2>
          <div className="h-0.5 bg-slate-900 flex-1"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.route}
                type="button"
                onClick={() => onNavigate(mod.route)}
                className="group relative flex flex-col p-6 bg-white border border-slate-200 hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-900/5 rounded-2xl text-left transition-all duration-300 cursor-pointer overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-slate-50 rounded-full transition-transform group-hover:scale-150 group-hover:bg-amber-50 duration-500"></div>
                
                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center border mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg ${mod.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                
                <div className="relative flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-slate-900 group-hover:text-amber-600 transition-colors uppercase tracking-tight">
                      {mod.title}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {mod.description}
                  </p>
                </div>
                
                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-amber-500 transition-all duration-500 group-hover:w-full"></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
