import React, { useState, useEffect, useCallback } from 'react';
import { SupportedLanguage, AuthUser } from './types';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { TutorialModal } from './components/common/TutorialModal';
import { SetupView } from './components/setup/SetupView';
import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { InventoryView } from './components/inventory/InventoryView';
import { ExciseView } from './components/excise/ExciseView';
import { ProductListView } from './components/products/ProductListView';
import { BrandMasterView } from './components/masters/BrandMasterView';
import { PackSizeMasterView } from './components/masters/PackSizeMasterView';
import { OpeningStockView } from './components/stock/OpeningStockView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { StockAdjustmentsView } from './components/stock/StockAdjustmentsView';
import { StockLedgerView } from './components/stock/StockLedgerView';
import { BatchesView } from './components/batches/BatchesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { apiGet, apiPost } from './utils/api';

export default function App() {
  // Default language is English ('en') for all first-time visitors
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem('liquorflow_language');
    if (saved === 'en' || saved === 'hi' || saved === 'mr') {
      return saved as SupportedLanguage;
    }
    return 'en';
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentRoute, setCurrentRoute] = useState<string>('/login');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean>(true);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Global search modal
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    localStorage.setItem('liquorflow_language', lang);
  };

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

  // Initialize application and check active server-side session
  const initializeApp = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Verify active session with database using HTTP-only cookie and token header fallback
      const authData = await apiGet('/api/auth/me');

      if (authData.success && authData.data?.user) {
        const user = authData.data.user;
        setCurrentUser(user);
        if (user.selected_language) {
          handleLanguageChange(user.selected_language);
        }
        checkAndTriggerTutorial(user.id);
        setCurrentRoute(prev => (prev === '/login' || prev === '/setup' ? '/dashboard' : prev));
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
    }
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    if (user.selected_language) {
      handleLanguageChange(user.selected_language);
    }
    checkAndTriggerTutorial(user.id);
    setCurrentRoute('/dashboard');
  };

  const handleSetupSuccess = () => {
    setSetupCompleted(true);
    setCurrentRoute('/login');
  };

  const handleRouteChange = (route: string) => {
    if (!currentUser && route !== '/login' && route !== '/setup') {
      setCurrentRoute('/login');
      return;
    }
    setCurrentRoute(route);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">LiquorFlow ERP Starting...</p>
      </div>
    );
  }

  // Unauthenticated routes: strictly enforce /login
  if (!currentUser || currentRoute === '/login' || currentRoute === '/setup') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
        <Header
          language={language}
          onLanguageChange={handleLanguageChange}
          user={null}
          onLogout={handleLogout}
          onOpenSearch={() => {}}
          currentRoute="/login"
          onRouteChange={handleRouteChange}
        />

        <main className="flex-1">
          {currentRoute === '/setup' ? (
            <SetupView
              language={language}
              onLanguageChange={handleLanguageChange}
              onSetupSuccess={handleSetupSuccess}
            />
          ) : (
            <LoginView
              language={language}
              onLanguageChange={handleLanguageChange}
              onLoginSuccess={handleLoginSuccess}
              onGoToSetup={() => setCurrentRoute('/setup')}
              setupCompleted={setupCompleted}
            />
          )}
        </main>
      </div>
    );
  }

  // Authenticated Application Layout with persistent Sidebar & Header
  return (
    <div className="app-shell bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Desktop Sidebar */}
      <div className="sidebar-container hidden md:block">
        <Sidebar
          currentRoute={currentRoute}
          onRouteChange={handleRouteChange}
          language={language}
          user={currentUser}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10">
            <Sidebar
              currentRoute={currentRoute}
              onRouteChange={handleRouteChange}
              language={language}
              user={currentUser}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content flex flex-col">
        <Header
          language={language}
          onLanguageChange={handleLanguageChange}
          user={currentUser}
          onLogout={handleLogout}
          onOpenSearch={() => setIsSearchOpen(true)}
          currentRoute={currentRoute}
          onRouteChange={handleRouteChange}
          onToggleSidebar={() => setMobileSidebarOpen(prev => !prev)}
        />

        <main className="flex-1 pb-16">
          {currentRoute === '/dashboard' && (
            <DashboardView language={language} user={currentUser} onRouteChange={handleRouteChange} />
          )}

          {currentRoute === '/inventory' && (
            <InventoryView language={language} />
          )}

          {currentRoute === '/stock/opening' && (
            <OpeningStockView language={language} />
          )}

          {currentRoute === '/purchases' && (
            <PurchasesView language={language} />
          )}

          {currentRoute === '/stock/adjustments' && (
            <StockAdjustmentsView language={language} />
          )}

          {currentRoute === '/stock-ledger' && (
            <StockLedgerView language={language} />
          )}

          {currentRoute === '/batches' && (
            <BatchesView language={language} />
          )}

          {currentRoute === '/products' && (
            <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
              <ProductListView language={language} />
            </div>
          )}

          {currentRoute === '/brands' && (
            <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
              <BrandMasterView language={language} />
            </div>
          )}

          {currentRoute === '/pack-sizes' && (
            <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
              <PackSizeMasterView language={language} />
            </div>
          )}

          {currentRoute === '/excise' && (
            <ExciseView language={language} />
          )}

          {currentRoute === '/reports' && (
            <ReportsView language={language} />
          )}

          {currentRoute === '/settings' && (
            <SettingsView
              language={language}
              onLanguageChange={handleLanguageChange}
              onRestartTutorial={() => setShowTutorial(true)}
            />
          )}
        </main>
      </div>

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        language={language}
        onRouteChange={handleRouteChange}
      />

      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={handleCompleteTutorial}
        language={language}
        onNavigateTo={handleRouteChange}
      />
    </div>
  );
}
