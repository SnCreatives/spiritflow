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

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
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

      onLoginSuccess(result.data.user);
    } catch (err: any) {
      setErrorMessage(err.message || t.invalidCredentialsAlert || 'Invalid username or password');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111113] text-[#f2efeb] flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-[#111113]">
      {/* Header */}
      <header className="px-6 py-5 border-b border-[#f2efeb]/10 flex justify-between items-center bg-[#111113]/90 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <LiquorFlowLogo size="sm" showText={true} showSubtitle={false} />
          <div className="hidden sm:block font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-60 font-semibold border-l border-[#f2efeb]/15 pl-3">
            Inventory & Excise Management
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-xs border border-[#f2efeb]/15 bg-transparent hover:bg-[#f2efeb]/10 text-[#f2efeb] transition-colors cursor-pointer flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {onLanguageChange && (
          <div className="flex border border-[#f2efeb]/15 rounded overflow-hidden">
            <button
              type="button"
              id="lang-btn-en"
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-1 text-[0.7rem] font-semibold transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-amber-500 text-[#111113] opacity-100 font-bold'
                  : 'bg-transparent text-[#f2efeb] opacity-50 hover:opacity-80'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              id="lang-btn-hi"
              onClick={() => onLanguageChange('hi')}
              className={`px-3 py-1 text-[0.7rem] font-semibold transition-all cursor-pointer ${
                language === 'hi'
                  ? 'bg-amber-500 text-[#111113] opacity-100 font-bold'
                  : 'bg-transparent text-[#f2efeb] opacity-50 hover:opacity-80'
              }`}
            >
              HI
            </button>
            <button
              type="button"
              id="lang-btn-mr"
              onClick={() => onLanguageChange('mr')}
              className={`px-3 py-1 text-[0.7rem] font-semibold transition-all cursor-pointer ${
                language === 'mr'
                  ? 'bg-amber-500 text-[#111113] opacity-100 font-bold'
                  : 'bg-transparent text-[#f2efeb] opacity-50 hover:opacity-80'
              }`}
            >
              MR
            </button>
          </div>
        )}
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_450px] items-stretch min-h-[calc(100vh-120px)]">
        {/* Left Hero Section */}
        <section className="p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-start bg-[radial-gradient(circle_at_10%_10%,#1a1a1d_0%,#111113_100%)] border-b lg:border-b-0 lg:border-r border-[#f2efeb]/10">
          <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-60 mb-6">
            [ Platform Access ]
          </div>

          <div className="my-4 p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 via-[#151518] to-slate-950/90 border border-slate-800/80 shadow-2xl shadow-amber-500/5 max-w-lg w-full flex flex-col items-center sm:items-start text-center sm:text-left">
            <LiquorFlowLogo size="xl" orientation="vertical" showText={true} showSubtitle={true} className="mb-4" />
          </div>

          <p className="text-sm sm:text-base opacity-70 leading-relaxed max-w-lg font-light mt-4">
            {language === 'mr'
              ? 'दारू साठा व राज्य उत्पादन शुल्क व्यवस्थापन प्रणाली'
              : language === 'hi'
              ? 'शराब स्टॉक एवं आबकारी (Excise) प्रबंधन प्रणाली'
              : 'Production-ready inventory & ERP for Indian liquor operations.'}
          </p>
        </section>

        {/* Right Login Section */}
        <section className="p-8 sm:p-12 flex flex-col justify-center bg-[#151518]">
          {/* Mobile Brand Badge */}
          <div className="lg:hidden mb-8 flex justify-center">
            <LiquorFlowLogo size="md" orientation="horizontal" showText={true} showSubtitle={true} />
          </div>
          {!setupCompleted && onGoToSetup && (
            <div className="mb-6 p-3.5 border border-amber-500/40 bg-amber-500/10 rounded text-amber-300 text-xs flex items-center justify-between font-mono">
              <span>{t.setupRequiredNotice}</span>
              <button
                type="button"
                onClick={onGoToSetup}
                className="font-bold text-amber-400 hover:underline ml-2"
              >
                {t.goToSetup} &rarr;
              </button>
            </div>
          )}

          {errorMessage && (
            <div
              id="login-error-alert"
              className="mb-6 p-3.5 border border-rose-800 bg-rose-950/60 rounded text-rose-300 text-xs flex items-start gap-2.5 font-mono"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            <div className="space-y-2">
              <label htmlFor="username-input" className="block font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-80">
                {language === 'mr'
                  ? 'वापरकर्ता नाव / मोबाईल नंबर *'
                  : language === 'hi'
                  ? 'उपयोगकर्ता नाम / मोबाइल नंबर *'
                  : 'User / Mobile Number *'}
              </label>
              <div className="relative">
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
                  className="w-full bg-transparent border border-[#f2efeb]/15 text-[#f2efeb] p-3.5 font-mono text-sm rounded-xs outline-none focus:border-amber-500 transition-colors placeholder:opacity-30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password-input" className="block font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-80">
                {language === 'mr'
                  ? 'पासवर्ड *'
                  : language === 'hi'
                  ? 'पासवर्ड *'
                  : 'Password *'}
              </label>
              <div className="relative">
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
                  className="w-full bg-transparent border border-[#f2efeb]/15 text-[#f2efeb] p-3.5 pr-16 font-mono text-sm rounded-xs outline-none focus:border-amber-500 transition-colors placeholder:opacity-30"
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono tracking-wider opacity-60 hover:opacity-100 text-[#f2efeb] transition-opacity cursor-pointer p-1"
                >
                  {showPassword ? 'HIDE' : 'VIEW'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#f2efeb] hover:bg-amber-500 text-[#111113] font-mono font-bold uppercase tracking-[0.1em] text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {language === 'mr'
                      ? 'लॉगिन होत आहे...'
                      : language === 'hi'
                      ? 'लॉगिन हो रहा है...'
                      : 'Logging in...'}
                  </span>
                </>
              ) : (
                <span>Login Access &rarr;</span>
              )}
            </button>
          </form>

          <div className="font-mono text-[0.55rem] uppercase tracking-[0.15em] opacity-40 text-center mt-12">
            Authorized personnel only. Sessions are logged.
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-3.5 border-t border-[#f2efeb]/10 flex flex-col sm:flex-row justify-between items-center gap-2 bg-[#111113]">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-60">
          v4.3.3 Build 2024
        </div>
        <div className="flex items-center gap-2 font-mono text-[0.65rem] opacity-70">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span>Encrypted HTTP-Only Database Session</span>
        </div>
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] opacity-60">
          &copy; LiquorFlow ERP
        </div>
      </footer>
    </div>
  );
};
