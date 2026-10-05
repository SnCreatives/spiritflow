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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      {/* Background click to close (optional, but standard) */}
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className={`relative bg-slate-900 border-x border-y border-slate-800 w-full ${maxWidth} 
          h-full sm:h-auto sm:max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden 
          sm:rounded-2xl animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* STICKY HEADER */}
        <header className="flex-shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </header>

        {/* SCROLLABLE BODY */}
        <main 
          className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
          {/* Spacer for mobile to ensure last field is not covered by footer if it's large */}
          <div className="h-4 sm:hidden" />
        </main>

        {/* STICKY FOOTER */}
        {footer && (
          <footer className="flex-shrink-0 px-6 py-4 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 z-10 pb-[calc(16px+env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
