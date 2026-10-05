import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { SubmissionStatus } from '../../hooks/useFormSubmission';

interface ActionButtonProps {
  status?: SubmissionStatus | string;
  isLoading?: boolean;
  isSaving?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  form?: string;
}

/**
 * Unified ActionButton component that enforces the READY → SAVING → SUCCESS/ERROR
 * lifecycle and serves as the single source of truth for form submission visuals in LiquorFlow.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  status = 'READY',
  isLoading = false,
  isSaving = false,
  isSuccess = false,
  isError = false,
  disabled = false,
  onClick,
  type = 'submit',
  children,
  loadingText = 'Saving...',
  successText,
  errorText,
  className = '',
  variant = 'primary',
  form,
}) => {
  const savingState = isSaving || isLoading || status === 'SAVING' || status === 'VALIDATING';
  const successState = isSuccess || status === 'SUCCESS';
  const errorState = isError || status === 'ERROR';

  const isDisabled = disabled || savingState;

  const variantClasses =
    variant === 'primary'
      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/10'
      : variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/10'
      : variant === 'secondary'
      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
      : 'bg-transparent hover:bg-slate-800 text-slate-300';

  return (
    <button
      type={type}
      form={form}
      disabled={isDisabled}
      onClick={onClick}
      className={`px-5 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses} ${className}`}
    >
      {savingState ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin text-current shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : successState ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successText || children}</span>
        </>
      ) : errorState ? (
        <>
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorText || children}</span>
        </>
      ) : (
        <span>{children}</span>
      )}
    </button>
  );
};
