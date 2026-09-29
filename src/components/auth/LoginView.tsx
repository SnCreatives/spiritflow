import React, { useState } from 'react';
import { Lock, AlertCircle, ArrowRight, ShieldCheck, User, Eye, EyeOff, Loader2, Sun, Moon } from 'lucide-react';
import { SupportedLanguage, AuthUser } from '../../types';
import { apiPost } from '../../utils/api';
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
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || t.invalidCredentialsAlert || 'Invalid username or password');
      }

      if (result.data?.sessionToken) {
        try {
          sessionStorage.setItem('liquorflow_session_token', result.data.sessionToken);
          localStorage.setItem('liquorflow_session_token', result.data.sessionToken);
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
      className={`min-h-screen flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-[#0d0d0f] transition-colors duration-200 ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0d0d0f] text-[#f2efeb]'
      }`}
    >
      {/* Enterprise Header */}
      <header
        className={`px-6 py-4 border-b flex justify-between items-center backdrop-blur z-20 shadow-sm transition-colors duration-200 ${
          isLight ? 'bg-white/95 border-slate-200' : 'bg-[#0d0d0f]/95 border-[#f2efeb]/10'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`p-2 rounded-xl border shadow-inner flex items-center justify-center transition-colors ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <LiquorFlowLogo size="xs" showText={true} showSubtitle={false} />
          </div>
          <div
            className={`hidden sm:block font-mono text-[0.65rem] uppercase tracking-[0.18em] font-semibold border-l pl-3.5 ${
              isLight ? 'border-slate-300 text-amber-700' : 'border-[#f2efeb]/15 text-amber-400/90'
            }`}
          >
            Enterprise Liquor ERP & Excise Compliance
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors cursor-pointer flex items-center justify-center shadow-sm ${
              isLight
                ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                : 'bg-slate-900/60 border-slate-700/80 hover:bg-slate-800 text-[#f2efeb]'
            }`}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle Theme"
          >
            {isLight ? (
              <Moon className="w-4 h-4 text-indigo-600" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {onLanguageChange && (
            <div
              className={`flex border rounded-lg overflow-hidden shadow-sm transition-colors ${
                isLight ? 'bg-white border-slate-300' : 'bg-slate-900/60 border-slate-700/80'
              }`}
            >
              <button
                type="button"
                id="lang-btn-en"
                onClick={() => onLanguageChange('en')}
                className={`px-3 py-1.5 text-[0.7rem] font-mono font-bold transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-amber-500 text-[#0d0d0f]'
                    : isLight
                    ? 'bg-transparent text-slate-700 hover:bg-slate-100'
                    : 'bg-transparent text-[#f2efeb] opacity-60 hover:opacity-100'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                id="lang-btn-hi"
                onClick={() => onLanguageChange('hi')}
                className={`px-3 py-1.5 text-[0.7rem] font-mono font-bold transition-all cursor-pointer ${
                  language === 'hi'
                    ? 'bg-amber-500 text-[#0d0d0f]'
                    : isLight
                    ? 'bg-transparent text-slate-700 hover:bg-slate-100'
                    : 'bg-transparent text-[#f2efeb] opacity-60 hover:opacity-100'
                }`}
              >
                HI
              </button>
              <button
                type="button"
                id="lang-btn-mr"
                onClick={() => onLanguageChange('mr')}
                className={`px-3 py-1.5 text-[0.7rem] font-mono font-bold transition-all cursor-pointer ${
                  language === 'mr'
                    ? 'bg-amber-500 text-[#0d0d0f]'
                    : isLight
                    ? 'bg-transparent text-slate-700 hover:bg-slate-100'
                    : 'bg-transparent text-[#f2efeb] opacity-60 hover:opacity-100'
                }`}
              >
                MR
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Enterprise Split Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-stretch min-h-[calc(100vh-130px)]">
        {/* Left Hero & Enterprise Showcase Section */}
        <section
          className={`p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-start border-b lg:border-b-0 lg:border-r relative overflow-hidden transition-colors duration-200 ${
            isLight
              ? 'bg-gradient-to-br from-slate-100 via-white to-slate-200 border-slate-200'
              : 'bg-[radial-gradient(circle_at_15%_15%,#1a1f2c_0%,#0d0d0f_100%)] border-[#f2efeb]/10'
          }`}
        >
          {/* Subtle Background Glow Accent */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-xl w-full">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[0.65rem] tracking-[0.2em] uppercase mb-6 shadow-sm border ${
                isLight
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-800'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Enterprise Grade Platform</span>
            </div>

            {/* Gorgeous Framed Logo Card */}
            <div
              className={`my-6 p-8 rounded-3xl border shadow-2xl flex flex-col items-center sm:items-start text-center sm:text-left relative backdrop-blur-md transition-colors ${
                isLight
                  ? 'bg-white border-slate-200 shadow-slate-300/60'
                  : 'bg-gradient-to-br from-slate-900 via-[#131722] to-slate-950 border-slate-800/90 shadow-black/80'
              }`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none" />
              <LiquorFlowLogo size="xl" orientation="vertical" showText={true} showSubtitle={true} className="mb-2" />
            </div>

            <h1
              className={`text-2xl sm:text-3xl font-bold tracking-tight mt-6 mb-3 transition-colors ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              Secure Operations & Excise Control
            </h1>

            <p
              className={`text-sm sm:text-base leading-relaxed font-light transition-colors ${
                isLight ? 'text-slate-600' : 'text-slate-300/80'
              }`}
            >
              {language === 'mr'
                ? 'दारू साठा व राज्य उत्पादन शुल्क व्यवस्थापन प्रणाली - उच्च सुरक्षा आणि अचूक नियंत्रण.'
                : language === 'hi'
                ? 'शराब स्टॉक एवं आबकारी प्रबंधन प्रणाली - पूर्ण अनुपालन और पारदर्शी नियंत्रण।'
                : 'Advanced multi-location inventory, automated excise return filings, and tamper-proof financial ledger for Indian liquor enterprises.'}
            </p>

            <div
              className={`grid grid-cols-3 gap-4 mt-8 pt-8 border-t font-mono text-xs transition-colors ${
                isLight ? 'border-slate-200' : 'border-slate-800/80'
              }`}
            >
              <div
                className={`p-3 rounded-xl border shadow-sm ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800/60'
                }`}
              >
                <div className={`font-bold text-sm ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>256-bit</div>
                <div className={`text-[0.65rem] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Encrypted Session</div>
              </div>
              <div
                className={`p-3 rounded-xl border shadow-sm ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800/60'
                }`}
              >
                <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">100%</div>
                <div className={`text-[0.65rem] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Excise Compliant</div>
              </div>
              <div
                className={`p-3 rounded-xl border shadow-sm ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800/60'
                }`}
              >
                <div className="font-bold text-sm text-blue-600 dark:text-blue-400">Real-Time</div>
                <div className={`text-[0.65rem] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ledger Sync</div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Professional Login Card Section */}
        <section
          className={`p-8 sm:p-12 lg:p-16 flex flex-col justify-center relative transition-colors duration-200 ${
            isLight ? 'bg-white' : 'bg-[#131316]'
          }`}
        >
          <div className="max-w-md w-full mx-auto">
            {/* Mobile Brand Badge */}
            <div className="lg:hidden mb-8 flex justify-center">
              <div
                className={`p-4 rounded-2xl border shadow-xl ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <LiquorFlowLogo size="md" orientation="horizontal" showText={true} showSubtitle={true} />
              </div>
            </div>

            <div className="mb-8">
              <h2 className={`text-xl font-bold tracking-tight mb-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Owner / Manager Sign In
              </h2>
              <p className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Enter your authorized credentials to access the ERP dashboard.
              </p>
            </div>

            {!setupCompleted && onGoToSetup && (
              <div className="mb-6 p-4 border border-amber-500/40 bg-amber-500/10 rounded-xl text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between font-mono shadow-sm">
                <span>{t.setupRequiredNotice}</span>
                <button
                  type="button"
                  onClick={onGoToSetup}
                  className="font-bold text-amber-600 dark:text-amber-400 hover:underline ml-2"
                >
                  {t.goToSetup} &rarr;
                </button>
              </div>
            )}

            {errorMessage && (
              <div
                id="login-error-alert"
                className="mb-6 p-4 border border-rose-500/40 bg-rose-500/10 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3 font-mono shadow-md"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              <div className="space-y-2">
                <label
                  htmlFor="username-input"
                  className={`block font-mono text-[0.65rem] uppercase tracking-[0.18em] font-semibold ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
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
                    autoFocus
                    autoComplete="off"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder={
                      language === 'mr'
                        ? 'वापरकर्ता नाव किंवा मोबाईल नंबर टाका'
                        : language === 'hi'
                        ? 'उपयोगकर्ता नाम या मोबाइल नंबर दर्ज करें'
                        : 'Enter username or mobile number'
                    }
                    className={`w-full pl-11 pr-4 py-3.5 font-mono text-sm rounded-xl outline-none transition-all shadow-sm border ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                        : 'bg-slate-900/90 border-slate-700/80 text-white placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password-input"
                  className={`block font-mono text-[0.65rem] uppercase tracking-[0.18em] font-semibold ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
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
                    placeholder={
                      language === 'mr'
                        ? 'पासवर्ड टाका'
                        : language === 'hi'
                        ? 'पासवर्ड दर्ज करें'
                        : 'Enter password'
                    }
                    className={`w-full pl-11 pr-16 py-3.5 font-mono text-sm rounded-xl outline-none transition-all shadow-sm border ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                        : 'bg-slate-900/90 border-slate-700/80 text-white placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    id="toggle-password-visibility"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer p-1 uppercase font-semibold"
                  >
                    {showPassword ? 'Hide' : 'View'}
                  </button>
                </div>
              </div>

              <div className="flex items-center text-xs font-mono pt-1">
                <label
                  className={`flex items-center gap-2.5 cursor-pointer select-none ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    id="remember-me-checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={`w-4 h-4 rounded cursor-pointer accent-amber-500 border ${
                      isLight ? 'border-slate-300 bg-slate-100 text-amber-600' : 'border-slate-700 bg-slate-900 text-amber-500'
                    }`}
                  />
                  <span>Remember password for further logins</span>
                </label>
              </div>

              <button
                type="submit"
                id="login-submit-btn"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0d0d0f] font-mono font-black uppercase tracking-[0.12em] text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#0d0d0f]" />
                    <span>
                      {language === 'mr'
                        ? 'लॉगिन होत आहे...'
                        : language === 'hi'
                        ? 'लॉगिन हो रहा है...'
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

            <div
              className={`font-mono text-[0.6rem] uppercase tracking-[0.15em] text-center mt-10 transition-colors ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Enterprise Secure Node Session &bull; Authorized Personnel Only
            </div>
          </div>
        </section>
      </main>

      {/* Enterprise Footer */}
      <footer
        className={`px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-2 transition-colors duration-200 ${
          isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#0d0d0f] border-[#f2efeb]/10 text-slate-400'
        }`}
      >
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-80">
          v4.3.3 Enterprise Build
        </div>
        <div className="flex items-center gap-2 font-mono text-[0.65rem]">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
          <span>Encrypted HTTP-Only Database Session Active</span>
        </div>
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-80">
          &copy; LiquorFlow ERP System
        </div>
      </footer>
    </div>
  );
};
