import { useEffect } from 'react';

/**
 * Hook to lock body scroll when a modal is open.
 * Properly handles cleanup and prevents page jump.
 */
export function useScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Prevent scrolling and account for scrollbar width to prevent "jump"
    document.body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.paddingRight = '';
    };
  }, [lock]);
}
