import { useState, useCallback } from 'react';
import { useToast } from '../lib/contexts/ToastContext';

interface MutationOptions<TData, TVariables> {
  /**
   * Callback fired when the mutation is successful.
   */
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  /**
   * Callback fired when the mutation fails.
   */
  onError?: (error: Error, variables: TVariables) => void | Promise<void>;
  /**
   * Success message to display in a toast. Can be a string or a function returning a string.
   */
  successMessage?: string | ((data: TData, variables: TVariables) => string);
  /**
   * Error message to display in a toast. Can be a string or a function returning a string.
   */
  errorMessage?: string | ((error: Error, variables: TVariables) => string);
  /**
   * Function to refresh data (e.g., refetch the list).
   */
  invalidateQueries?: () => void | Promise<void>;
  /**
   * Function to close the modal or form.
   */
  closeModal?: () => void;
}

/**
 * Custom hook for handling form mutations (POST, PUT, DELETE) with consistent UX.
 * Handles 'saving' status, duplicate prevention, toasts, and modal closure.
 */
export function useFormMutation<TData = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<{ success: boolean; data?: TData; error?: { message: string } }>,
  options: MutationOptions<TData, TVariables> = {}
) {
  const [isSaving, setIsSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  const mutate = useCallback(
    async (variables: TVariables) => {
      if (isSaving) return;

      setIsSaving(true);
      try {
        const result = await mutationFn(variables);

        if (result.success) {
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
          const errorMsg = result.error?.message || 'Operation failed';
          const finalErrorMsg = typeof options.errorMessage === 'function'
            ? options.errorMessage(new Error(errorMsg), variables)
            : options.errorMessage || errorMsg;

          showError(finalErrorMsg);
          
          if (options.onError) {
            await options.onError(new Error(errorMsg), variables);
          }
        }
      } catch (err: any) {
        const errorMsg = err.message || 'An unexpected error occurred';
        const finalErrorMsg = typeof options.errorMessage === 'function'
          ? options.errorMessage(err, variables)
          : options.errorMessage || errorMsg;

        showError(finalErrorMsg);
        
        if (options.onError) {
          await options.onError(err, variables);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, mutationFn, options, showSuccess, showError]
  );

  return {
    mutate,
    isSaving,
    reset: () => setIsSaving(false)
  };
}
