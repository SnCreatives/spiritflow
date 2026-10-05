import { useState, useCallback } from 'react';
import { useToast } from '../lib/contexts/ToastContext';

export type SubmissionStatus = 'IDLE' | 'VALIDATING' | 'READY' | 'SAVING' | 'SUCCESS' | 'ERROR';

interface FormSubmissionOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables) => void | Promise<void>;
  successMessage?: string | ((data: TData, variables: TVariables) => string);
  errorMessage?: string | ((error: Error, variables: TVariables) => string);
  invalidateQueries?: () => void | Promise<void>;
  closeModal?: () => void;
  validate?: (variables: TVariables) => boolean | Promise<boolean>;
}

/**
 * Custom React hook 'useFormSubmission' that standardizes the submission pattern
 * across all forms in LiquorFlow.
 * Enforces lifecycle: IDLE → VALIDATING → READY → SAVING → SUCCESS / ERROR
 */
export function useFormSubmission<TData = any, TVariables = any>(
  submitFn: (variables: TVariables) => Promise<{ success: boolean; data?: TData; error?: { message: string } }>,
  options: FormSubmissionOptions<TData, TVariables> = {}
) {
  const [status, setStatus] = useState<SubmissionStatus>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<TData | null>(null);
  const { showSuccess, showError } = useToast();

  const submit = useCallback(
    async (variables: TVariables) => {
      // Prevent duplicate submissions
      if (status === 'SAVING' || status === 'VALIDATING') return;

      setError(null);

      // 1. Validation phase
      if (options.validate) {
        setStatus('VALIDATING');
        try {
          const isValid = await options.validate(variables);
          if (!isValid) {
            setStatus('READY');
            return;
          }
        } catch (valErr: any) {
          setStatus('ERROR');
          const msg = valErr?.message || 'Validation failed';
          setError(msg);
          showError(msg);
          return;
        }
      }

      // 2. Saving phase
      setStatus('SAVING');
      try {
        const result = await submitFn(variables);

        if (result.success) {
          setStatus('SUCCESS');
          setSuccessData(result.data as TData);

          const successMsg = typeof options.successMessage === 'function'
            ? options.successMessage(result.data as TData, variables)
            : options.successMessage;

          if (successMsg) {
            showSuccess(successMsg);
          }

          if (options.onSuccess) {
            await options.onSuccess(result.data as TData, variables);
          }

          if (options.invalidateQueries) {
            await options.invalidateQueries();
          }

          if (options.closeModal) {
            options.closeModal();
          }
        } else {
          setStatus('ERROR');
          const errMessage = result.error?.message || 'Operation failed';
          setError(errMessage);

          const finalErrorMsg = typeof options.errorMessage === 'function'
            ? options.errorMessage(new Error(errMessage), variables)
            : options.errorMessage || errMessage;

          showError(finalErrorMsg);

          if (options.onError) {
            await options.onError(new Error(errMessage), variables);
          }
        }
      } catch (err: any) {
        setStatus('ERROR');
        const errMessage = err.message || 'An unexpected error occurred';
        setError(errMessage);

        const finalErrorMsg = typeof options.errorMessage === 'function'
          ? options.errorMessage(err, variables)
          : options.errorMessage || errMessage;

        showError(finalErrorMsg);

        if (options.onError) {
          await options.onError(err, variables);
        }
      }
    },
    [status, submitFn, options, showSuccess, showError]
  );

  const reset = useCallback(() => {
    setStatus('IDLE');
    setError(null);
    setSuccessData(null);
  }, []);

  return {
    submit,
    reset,
    status,
    isLoading: status === 'SAVING' || status === 'VALIDATING',
    isSaving: status === 'SAVING',
    isValidating: status === 'VALIDATING',
    isSuccess: status === 'SUCCESS',
    isError: status === 'ERROR',
    error,
    successData,
  };
}
