import React, { useState, useEffect, useCallback } from 'react';
import { AuthUser } from './types';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { TutorialModal } from './components/common/TutorialModal';
import { SetupView } from './components/setup/SetupView';
import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { InventoryView } from './components/inventory/InventoryView';
import { ProductListView } from './components/products/ProductListView';
import { BrandMasterView } from './components/masters/BrandMasterView';
import { PackSizeMasterView } from './components/masters/PackSizeMasterView';
import { OpeningStockView } from './components/stock/OpeningStockView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { StockAdjustmentsView } from './components/stock/StockAdjustmentsView';
import { StockLedgerView } from './components/stock/StockLedgerView';
import { StockTransfersView } from './components/stock/StockTransfersView';
import { BatchesView } from './components/batches/BatchesView';
import { SalesTransactionView } from './components/transactions/SalesTransactionView';
import { ScmMasterView } from './components/masters/ScmMasterView';
import { ReportsView } from './components/reports/ReportsView';
import { BackupRestoreView } from './components/settings/BackupRestoreView';
import { BarSettingsView } from './components/settings/BarSettingsView';
import { UserSettingsView } from './components/settings/UserSettingsView';
import { apiGet, apiPost } from './utils/api';
import { BarProvider } from './lib/contexts/BarContext';
import { ToastProvider } from './lib/contexts/ToastContext';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    if (path && path !== '/' && path !== '') {
      return path;
    }
    return '/dashboard';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean>(true);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Global search modal
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const checkAndTriggerTutorial = (userId: string) => {
    const isCompleted = localStorage.getItem(`liquorflow_tutorial_completed_${userId}`);
    if (!isCompleted) {
      setShowTutorial(true);
    }
  };

  const handleCompleteTutorial = () => {
    if (currentUser?.id) {
      localStorage.setItem(`liquorflow_tutorial_completed_${currentUser.id}`, 'true');
    }
    setShowTutorial(false);
  };

  // Keyboard shortcut listener for Global Search (Ctrl+K, Cmd+K, /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to popstate (browser back/forward/refresh)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path && path !== '/') {
        setCurrentRoute(path);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initialize application and check active server-side session
  const initializeApp = useCallback(async () => {
    setIsLoading(true);
    try {
      const authData = await apiGet('/api/auth/me');

      if (authData.success && authData.data?.user) {
        const user = authData.data.user;
        setCurrentUser(user);
        checkAndTriggerTutorial(user.id);
        setCurrentRoute(prev => {
          const path = window.location.pathname;
          if (path && path !== '/' && path !== '/login' && path !== '/setup') {
            return path;
          }
          if (prev === '/login' || prev === '/setup' || !prev) {
            return '/dashboard';
          }
          return prev;
        });
      } else {
        setCurrentUser(null);
        setCurrentRoute('/login');
      }
    } catch {
      setCurrentUser(null);
      setCurrentRoute('/login');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setCurrentRoute('/login');
    };

    window.addEventListener('liquorflow_unauthorized', handleUnauthorized);
    initializeApp();

    return () => {
      window.removeEventListener('liquorflow_unauthorized', handleUnauthorized);
    };
  }, [initializeApp]);

  const handleLogout = async () => {
    try {
      await apiPost('/api/logout', {});
    } catch {
      // ignore network errors on logout
    } finally {
      sessionStorage.removeItem('liquorflow_session_token');
      localStorage.removeItem('liquorflow_session_token');
      setCurrentUser(null);
      setCurrentRoute('/login');
      window.history.pushState({}, '', '/login');
    }
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    checkAndTriggerTutorial(user.id);
    const targetRoute =
      window.location.pathname && window.location.pathname !== '/' && window.location.pathname !== '/login'
        ? window.location.pathname
        : '/dashboard';
    setCurrentRoute(targetRoute);
    window.history.pushState({}, '', targetRoute);
  };

  const handleSetupSuccess = () => {
    setSetupCompleted(true);
    setCurrentRoute('/login');
    window.history.pushState({}, '', '/login');
  };

  const handleRouteChange = (route: string) => {
    if (!currentUser && route !== '/login' && route !== '/setup') {
      setCurrentRoute('/login');
      window.history.pushState({}, '', '/login');
      return;
    }
    setCurrentRoute(route);
    window.history.pushState({}, '', route);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold tracking-wide text-slate-800">LiquorFlow ERP Starting...</p>
      </div>
    );
  }

  // Unauthenticated routes: strictly enforce /login
  if (!currentUser || currentRoute === '/login' || currentRoute === '/setup') {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-amber-500 selection:text-slate-950">
          <main className="flex-1">
            {currentRoute === '/setup' ? (
              <SetupView
                language="en"
                onLanguageChange={() => {}}
                onSetupSuccess={handleSetupSuccess}
              />
            ) : (
              <LoginView
                language="en"
                onLanguageChange={() => {}}
                onLoginSuccess={handleLoginSuccess}
                onGoToSetup={() => setCurrentRoute('/setup')}
                setupCompleted={setupCompleted}
              />
            )}
          </main>
        </div>
      </ToastProvider>
    );
  }

  // Authenticated Application Layout with persistent Sidebar & Header
  return (
    <ToastProvider>
      <BarProvider userBars={currentUser.bars}>
        <div className="min-h-screen flex bg-slate-50 text-slate-900 selection:bg-amber-500 selection:text-slate-950">
          {/* Desktop Sidebar */}
          <div className="hidden md:block shrink-0">
            <Sidebar
              currentRoute={currentRoute}
              onRouteChange={handleRouteChange}
              user={currentUser}
              onLogout={handleLogout}
            />
          </div>

          {/* Mobile Drawer Sidebar */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <div className="relative z-10">
                <Sidebar
                  currentRoute={currentRoute}
                  onRouteChange={handleRouteChange}
                  user={currentUser}
                  onLogout={handleLogout}
                />
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <Header
              user={currentUser}
              onLogout={handleLogout}
              onOpenSearch={() => setIsSearchOpen(true)}
              currentRoute={currentRoute}
              onRouteChange={handleRouteChange}
              onToggleSidebar={() => setMobileSidebarOpen(prev => !prev)}
            />

            <main className="flex-1 pb-16">
              {currentRoute === '/dashboard' && (
                <DashboardView language="en" user={currentUser} onRouteChange={handleRouteChange} />
              )}

              {/* Core Operations */}
              {(currentRoute === '/stock/opening' || currentRoute === '/opening-stock') && (
                <OpeningStockView />
              )}

              {(currentRoute === '/purchases' || currentRoute === '/received-stock') && (
                <PurchasesView />
              )}

              {(currentRoute === '/transactions' || currentRoute === '/sales' || currentRoute.startsWith('/transactions/')) && (
                <SalesTransactionView />
              )}

              {currentRoute === '/inventory' && (
                <InventoryView language="en" />
              )}

              {currentRoute === '/stock-ledger' && (
                <StockLedgerView language="en" />
              )}

              {currentRoute === '/stock/adjustments' && (
                <StockAdjustmentsView language="en" />
              )}

              {currentRoute === '/stock/transfers' && (
                <StockTransfersView />
              )}

              {currentRoute === '/batches' && (
                <BatchesView language="en" />
              )}

              {/* Excise & Audit */}
              {currentRoute === '/reports' && (
                <ReportsView />
              )}

              {(currentRoute === '/scm-code' || currentRoute === '/excise') && (
                <ScmMasterView />
              )}

              {/* Product Masters */}
              {currentRoute === '/products' && (
                <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
                  <ProductListView language="en" />
                </div>
              )}

              {currentRoute === '/brands' && (
                <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
                  <BrandMasterView language="en" />
                </div>
              )}

              {currentRoute === '/pack-sizes' && (
                <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
                  <PackSizeMasterView language="en" />
                </div>
              )}

              {/* System & Settings */}
              {currentRoute === '/backup-restore' && (
                <BackupRestoreView />
              )}

              {(currentRoute === '/bar-settings' || currentRoute === '/bars') && (
                <BarSettingsView />
              )}

              {(currentRoute === '/user-settings' || currentRoute === '/settings') && (
                <UserSettingsView user={currentUser} />
              )}
            </main>
          </div>

          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            language="en"
            onRouteChange={handleRouteChange}
          />

          <TutorialModal
            isOpen={showTutorial}
            onClose={() => setShowTutorial(false)}
            onComplete={handleCompleteTutorial}
            language="en"
            onNavigateTo={handleRouteChange}
          />
        </div>
      </BarProvider>
    </ToastProvider>
  );
}
