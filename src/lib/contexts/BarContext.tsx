import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BarOutlet } from '../../types';
import { apiGet } from '../../utils/api';

interface BarContextType {
  selectedBar: BarOutlet | null;
  setSelectedBar: (bar: BarOutlet) => void;
  availableBars: BarOutlet[];
  isLoading: boolean;
  error: string | null;
  refreshBars: () => Promise<void>;
}

const BarContext = createContext<BarContextType | undefined>(undefined);

export function BarProvider({ children, userBars }: { children: ReactNode; userBars?: BarOutlet[] }) {
  const [availableBars, setAvailableBars] = useState<BarOutlet[]>(userBars || []);
  const [selectedBar, setSelectedBarState] = useState<BarOutlet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncSelectedBar = useCallback((bars: BarOutlet[]) => {
    if (!bars || bars.length === 0) {
      setSelectedBarState(null);
      localStorage.removeItem('liquorflow_selected_bar_id');
      window.dispatchEvent(new CustomEvent('liquorflow_bar_changed', { detail: { bar: null } }));
      return;
    }

    const activeBars = bars.filter(b => b.status === 'Active');
    const savedBarId = localStorage.getItem('liquorflow_selected_bar_id');

    if (savedBarId) {
      // Prefer currently saved bar if it is active
      const foundActive = activeBars.find(b => b.id === savedBarId);
      if (foundActive) {
        setSelectedBarState(foundActive);
        return;
      }
    }

    // Default to first active bar, or first available bar if none active
    const defaultBar = activeBars[0] || bars[0] || null;
    setSelectedBarState(defaultBar);
    if (defaultBar) {
      localStorage.setItem('liquorflow_selected_bar_id', defaultBar.id);
      window.dispatchEvent(new CustomEvent('liquorflow_bar_changed', { detail: { bar: defaultBar } }));
    } else {
      localStorage.removeItem('liquorflow_selected_bar_id');
    }
  }, []);

  const refreshBars = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet('/api/bars');
      if (res.success && res.data?.bars) {
        const bars: BarOutlet[] = res.data.bars;
        setAvailableBars(bars);
        syncSelectedBar(bars);
      } else {
        throw new Error(res.error?.message || 'Failed to fetch authorized bars');
      }
    } catch (e: any) {
      console.error('Failed to refresh bars:', e);
      setError(e.message || 'Unable to load outlets');
    } finally {
      setIsLoading(false);
    }
  }, [syncSelectedBar]);

  useEffect(() => {
    if (userBars && userBars.length > 0) {
      setAvailableBars(userBars);
      syncSelectedBar(userBars);
      setIsLoading(false);
    } else {
      refreshBars();
    }
  }, [userBars, refreshBars, syncSelectedBar]);

  const setSelectedBar = (bar: BarOutlet) => {
    setSelectedBarState(bar);
    localStorage.setItem('liquorflow_selected_bar_id', bar.id);
    // Dispatch custom event to notify all active views and components
    window.dispatchEvent(new CustomEvent('liquorflow_bar_changed', { detail: { bar } }));
  };

  return (
    <BarContext.Provider value={{ selectedBar, setSelectedBar, availableBars, isLoading, error, refreshBars }}>
      {children}
    </BarContext.Provider>
  );
}

export function useBar() {
  const context = useContext(BarContext);
  if (context === undefined) {
    throw new Error('useBar must be used within a BarProvider');
  }
  return context;
}
