import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, ArrowRight, ShieldCheck, User, Eye, EyeOff, Loader2, Sun, Moon, Building2 } from 'lucide-react';
import { SupportedLanguage, AuthUser } from '../../types';
import { apiPost, apiGet } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { LiquorFlowLogo } from '../common/LiquorFlowLogo';
import { useTheme } from '../../utils/ThemeContext';

interface LoginViewProps {
  language: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  onLoginSuccess: (user: AuthUser) => void;
  onGoToSetup?: () => void;
  setupCompleted: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  language,
  onLanguageChange,
  onLoginSuccess,
  onGoToSetup,
  setupCompleted,
}) => {
  const t = translations[language] || translations.en;
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  const [username, setUsername] = useState<string>(() => {
    try {
      return localStorage.getItem('liquorflow_saved_username') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    try {
      return localStorage.getItem('liquorflow_remember_me') !== 'false';
    } catch {
      return true;
    }
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string>('');
  const [barsList, setBarsList] = useState<{ id: string; name: string; code?: string }[]>([]);

  useEffect(() => {
    async function fetchBars() {
      try {
        const res = await apiGet('/api/bars/public');
        if (res.success && Array.isArray(res.data?.bars)) {
          setBarsList(res.data.bars);
          if (res.data.bars.length > 0) {
            setSelectedBarId(res.data.bars[0].id);
          }
        }
      } catch {}
    }
    fetchBars();
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorMessage(t.invalidCredentialsAlert || 'Invalid username or password');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await apiPost('/api/login', {
        username: trimmedUsername,
        mobileNumber: trimmedUsername,
        password: password,
        barId: selectedBarId,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || t.invalidCredentialsAlert || 'Invalid username or password');
      }

      if (result.data?.sessionToken) {
        try {
          sessionStorage.setItem('liquorflow_session_token', result.data.sessionToken);
          localStorage.setItem('liquorflow_session_token', result.data.sessionToken);
          if (selectedBarId) {
            localStorage.setItem('liquorflow_selected_bar_id', selectedBarId);
          }
        } catch {
          // Ignore storage quota errors
        }
      }

      if (rememberMe) {
        try {
          localStorage.setItem('liquorflow_saved_username', trimmedUsername);
          localStorage.removeItem('liquorflow_saved_password');
          localStorage.setItem('liquorflow_remember_me', 'true');
        } catch {}
      } else {
        try {
          localStorage.removeItem('liquorflow_saved_username');
          localStorage.removeItem('liquorflow_saved_password');
          localStorage.setItem('liquorflow_remember_me', 'false');
        } catch {}
      }

      onLoginSuccess(result.data.user);
    } catch (err: any) {
      setErrorMessage(err.message || t.invalidCredentialsAlert || 'Invalid username or password');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-slate-950 transition-colors duration-200 ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Premium Top Bar */}
      <header
        className={`px-6 py-4 border-b flex justify-between items-center backdrop-blur-md z-20 transition-colors duration-200 ${
          isLight ? 'bg-white/90 border-slate-200/80 shadow-xs' : 'bg-slate-950/90 border-slate-900 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <LiquorFlowLogo size="xs" variant="full" />
          <div
            className={`hidden sm:block font-mono text-[10px] uppercase tracking-[0.2em] font-semibold border-l pl-3 ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
            }`}
          >
            Compliance & Operations
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 ${
              isLight
                ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
            }`}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {isLight ? <Moon className="w-4 h-4 text-emerald-600" /> : <Sun className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Language Selection */}
          {onLanguageChange && (
            <div
              className={`flex border rounded-xl overflow-hidden p-0.5 transition-colors ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}
            >
              {(['en', 'hi', 'mr'] as SupportedLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onLanguageChange(lang)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg font-mono transition-all cursor-pointer ${
                    language === lang
                      ? 'bg-white text-emerald-700 shadow-xs font-black'
                      : isLight
                      ? 'text-slate-500 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] items-stretch">
        
        {/* Left Side: Brand & Product positioning */}
        <section
          className={`p-8 sm:p-12 lg:p-20 flex flex-col justify-center items-start border-b lg:border-b-0 lg:border-r relative overflow-hidden transition-colors duration-200 ${
            isLight
              ? 'bg-gradient-to-br from-slate-100 via-white to-slate-50 border-slate-200'
              : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-slate-900'
          }`}
        >
          {/* Elegant Subtle Glow Backdrop */}
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-lg w-full">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full font-mono text-[9px] tracking-[0.2em] uppercase mb-8 border ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200/60 text-emerald-800'
                  : 'bg-emerald-950/20 border-emerald-900/60 text-emerald-400'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Statutory Compliance Platform</span>
            </div>

            {/* Official Proportional Logo Display */}
            <div className="mb-10 flex justify-center lg:justify-start">
              <LiquorFlowLogo size="2xl" variant="full" />
            </div>

            <h1
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 transition-colors ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              Enterprise-Grade <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
                Liquor & Bar Operating System
              </span>
            </h1>

            <p
              className={`text-sm leading-relaxed mb-10 transition-colors ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Powering Maharashtra’s premier hospitality chains with instant FLR-3 and CL-3 excise books, 
              isolated multi-bar operations, strict real-time stock ledgering, and accurate profit analysis.
            </p>

            {/* Service Locations / Core Features summary */}
            <div
              className={`grid grid-cols-2 gap-4 pt-8 border-t transition-colors ${
                isLight ? 'border-slate-200' : 'border-slate-900'
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>100% Compliant</span>
                <span className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Auto-aligned with Maharashtra state excise norms.
                </span>
              </div>
              <div className="flex flex-col">
                <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Role-Based RLS</span>
                <span className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Isolated bar-level logs with military-grade safety.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Secure Login Form Card */}
        <section
          className={`p-8 sm:p-12 lg:p-20 flex flex-col justify-center relative transition-colors duration-200 ${
            isLight ? 'bg-white' : 'bg-slate-950'
          }`}
        >
          <div className="max-w-md w-full mx-auto">
            <div className="mb-8">
              <h2 className={`text-2xl font-black tracking-tight mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Sign In to Console
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Enter your system credentials below to manage your assigned bar operations.
              </p>
            </div>

            {/* Initial Setup Warning */}
            {!setupCompleted && onGoToSetup && (
              <div className="mb-6 p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between shadow-xs">
                <span>{t.setupRequiredNotice}</span>
                <button
                  type="button"
                  onClick={onGoToSetup}
                  className="font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline ml-2"
                >
                  {t.goToSetup} &rarr;
                </button>
              </div>
            )}

            {/* Auth Errors Block */}
            {errorMessage && (
              <div
                id="login-error-alert"
                className="mb-6 p-4 border border-rose-500/20 bg-rose-500/5 rounded-2xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3 shadow-sm font-medium"
              >
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              {/* Select Active Bar */}
              <div className="space-y-1.5">
                <label
                  htmlFor="bar-select-input"
                  className={`block text-[10px] font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {language === 'mr'
                    ? 'बार आउटलेट निवडा *'
                    : language === 'hi'
                    ? 'बार आउटलेट चुनें *'
                    : 'Select Active Bar Outlet *'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <select
                    id="bar-select-input"
                    name="barId"
                    value={selectedBarId}
                    onChange={(e) => setSelectedBarId(e.target.value)}
                    className={`w-full pl-11 pr-4 py-3 text-sm rounded-xl outline-none transition-all shadow-xs border appearance-none ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-white focus:bg-slate-950 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                    }`}
                  >
                    {barsList.length === 0 ? (
                      <option value="">Loading Active Outlets...</option>
                    ) : (
                      barsList.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.code ? `(${b.code})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="username-input"
                  className={`block text-[10px] font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {language === 'mr'
                    ? 'वापरकर्ता नाव / मोबाईल नंबर *'
                    : language === 'hi'
                    ? 'उपयोगकर्ता नाम / मोबाइल नंबर *'
                    : 'User / Mobile Number *'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="username-input"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder={
                      language === 'mr'
                        ? 'वापरकर्ता नाव किंवा मोबाईल नंबर टाका'
                        : language === 'hi'
                        ? 'उपयोगकर्ता नाम या मोबाइल नंबर दर्ज करें'
                        : 'e.g., bar_manager'
                    }
                    className={`w-full pl-11 pr-4 py-3 text-sm rounded-xl outline-none transition-all shadow-xs border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus:bg-slate-950 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                    }`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password-input"
                  className={`block text-[10px] font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {language === 'mr' ? 'पासवर्ड *' : language === 'hi' ? 'पासवर्ड *' : 'Password *'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="••••••••"
                    className={`w-full pl-11 pr-16 py-3 text-sm rounded-xl outline-none transition-all shadow-xs border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus:bg-slate-950 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    id="toggle-password-visibility"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-450 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer p-1.5 uppercase select-none"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Remember Pass checkbox */}
              <div className="flex items-center text-xs pt-1">
                <label
                  className={`flex items-center gap-2.5 cursor-pointer select-none ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    id="remember-me-checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer accent-emerald-600 text-white"
                  />
                  <span>Keep me signed in on this device</span>
                </label>
              </div>

              {/* Redesigned Premium Emerald Action Button */}
              <button
                type="submit"
                id="login-submit-btn"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>
                      {language === 'mr'
                        ? 'प्रवेश होत आहे...'
                        : language === 'hi'
                        ? 'प्रवेश हो रहा है...'
                        : 'Authenticating...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>Sign In to ERP Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Premium Footer */}
      <footer
        className={`px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-2 transition-colors duration-200 text-[10px] font-mono tracking-wider ${
          isLight ? 'bg-white border-slate-200/80 text-slate-500' : 'bg-slate-950 border-slate-900 text-slate-500'
        }`}
      >
        <div>
          v5.0 Enterprise Release
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
          <span>PostgreSQL Row Level Security Active</span>
        </div>
        <div>
          &copy; {new Date().getFullYear()} LiquorFlow ERP Systems
        </div>
      </footer>
    </div>
  );
};
