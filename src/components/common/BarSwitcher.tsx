import React, { useState, useRef, useEffect } from 'react';
import {
  Store,
  ChevronDown,
  Search,
  Check,
  MapPin,
  FileText,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { motion, AnimatePresence } from 'motion/react';
import { BarOutlet } from '../../types';

interface BarSwitcherProps {
  onNavigateToBarsMaster?: () => void;
  variant?: 'header' | 'compact' | 'drawer';
}

export const BarSwitcher: React.FC<BarSwitcherProps> = ({
  onNavigateToBarsMaster,
  variant = 'header',
}) => {
  const { selectedBar, setSelectedBar, availableBars, isLoading, error, refreshBars } = useBar();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter available bars by name, code, city, or license number
  const filteredBars = availableBars.filter((bar: BarOutlet) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      bar.name.toLowerCase().includes(q) ||
      (bar.code && bar.code.toLowerCase().includes(q)) ||
      (bar.city && bar.city.toLowerCase().includes(q)) ||
      (bar.license_number && bar.license_number.toLowerCase().includes(q))
    );
  });

  const handleSelectBar = (bar: BarOutlet) => {
    setSelectedBar(bar);
    setIsOpen(false);
    setSearchQuery('');
  };

  if (variant === 'drawer') {
    return (
      <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <span>Current Bar / Outlet</span>
          </span>
          {availableBars.length > 1 && (
            <span className="text-[10px] text-amber-400/80 font-mono">
              {availableBars.length} Outlets
            </span>
          )}
        </div>

        {selectedBar ? (
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                <span>{selectedBar.name}</span>
                <span className="px-1.5 py-0.2 text-[9px] font-mono bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                  {selectedBar.code}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {selectedBar.city || 'Maharashtra'} • {selectedBar.status}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shrink-0 cursor-pointer ml-2"
            >
              Switch
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-1">No active bar selected</div>
        )}

        {isOpen && (
          <div className="pt-2 border-t border-slate-800 space-y-1.5 max-h-48 overflow-y-auto">
            {availableBars.map(bar => (
              <button
                key={bar.id}
                type="button"
                onClick={() => handleSelectBar(bar)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors text-left ${
                  selectedBar?.id === bar.id
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="truncate">
                  <div className="font-medium truncate">{bar.name}</div>
                  <div className="text-[10px] text-slate-400">{bar.code} • {bar.city || 'Maharashtra'}</div>
                </div>
                {selectedBar?.id === bar.id && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Main Switcher Button in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 rounded-xl transition-all shadow-sm group cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        title="Switch active operating bar outlet"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
          <Store className="w-3.5 h-3.5" />
        </div>

        <div className="flex flex-col text-left min-w-0 max-w-[110px] sm:max-w-[160px] md:max-w-[200px]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1 leading-none">
            <span className="hidden sm:inline">Current Bar:</span>
            <span className="sm:hidden">Bar:</span>
          </span>
          <span className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors leading-snug">
            {isLoading ? 'Loading...' : selectedBar?.name || 'Select Outlet'}
          </span>
        </div>

        {selectedBar?.code && (
          <span className="hidden md:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded">
            {selectedBar.code}
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-amber-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
          >
            {/* Header / Search */}
            <div className="p-3 bg-slate-950/90 border-b border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Authorized Outlets
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 font-bold">
                    {availableBars.length} {availableBars.length === 1 ? 'outlet' : 'outlets'}
                  </span>
                </div>
              </div>

              {availableBars.length > 2 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by name, code, city, license..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Outlets List */}
            <div className="max-h-72 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {isLoading ? (
                <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Loading authorized outlets...</span>
                </div>
              ) : error ? (
                <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={refreshBars}
                    className="w-full py-1 text-center bg-rose-900/60 hover:bg-rose-800 text-white rounded-lg font-medium transition-colors"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : filteredBars.length > 0 ? (
                filteredBars.map(bar => {
                  const isSelected = selectedBar?.id === bar.id;
                  return (
                    <button
                      key={bar.id}
                      type="button"
                      onClick={() => handleSelectBar(bar)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-start justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border border-amber-500/50 shadow-sm shadow-amber-500/10'
                          : 'bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-xs ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                            {bar.name}
                          </span>
                          <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">
                            {bar.code}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                              bar.status === 'Active'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {bar.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                          {bar.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{bar.city}{bar.state ? `, ${bar.state}` : ''}</span>
                            </span>
                          )}
                          {bar.license_number && (
                            <span className="flex items-center gap-1 font-mono text-slate-300">
                              <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{bar.license_number}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center pt-0.5">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-slate-700 hover:border-amber-400 flex items-center justify-center text-[10px] text-slate-500">
                            →
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No outlets match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>

            {/* Footer */}
            {onNavigateToBarsMaster && (
              <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  Switching updates all modules in real-time.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateToBarsMaster();
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <span>Manage Outlets</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
