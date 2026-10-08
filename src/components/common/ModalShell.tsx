import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useScrollLock } from '../../hooks/useScrollLock';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string; // e.g. 'max-w-3xl'
  showCloseButton?: boolean;
}

/**
 * Enterprise-grade Modal Shell component with robust mobile scrolling support.
 * Implements sticky header/footer and scrollable body.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'max-w-2xl',
  showCloseButton = true,
}) => {
  // Lock background scroll when open
  useScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4 font-sans animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className={`relative bg-white border border-slate-200 w-full ${maxWidth} 
          h-full sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden 
          rounded-2xl animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* STICKY HEADER */}
        <header className="shrink-0 px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3.5">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                {title}
              </h2>
              {subtitle && <p className="text-[11px] text-slate-500 font-medium mt-0.5 uppercase tracking-wide">{subtitle}</p>}
            </div>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-50 transition-all shrink-0 cursor-pointer border border-transparent hover:border-slate-200"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </header>

        {/* SCROLLABLE BODY */}
        <main 
          className="flex-1 overflow-y-auto px-6 py-6 space-y-5 overscroll-contain custom-scrollbar"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
          <div className="h-4 sm:hidden" />
        </main>

        {/* STICKY FOOTER */}
        {footer && (
          <footer className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/50 sticky bottom-0 z-10 backdrop-blur-xs">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
