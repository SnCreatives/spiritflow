import React, { useState } from 'react';
import { Lock, AlertCircle, ArrowRight, ShieldCheck, User, Globe, Eye, EyeOff, Loader2 } from 'lucide-react';
import { SupportedLanguage, AuthUser } from '../../types';
import { apiPost } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { LiquorFlowLogo } from '../common/LiquorFlowLogo';

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

  // 1. Initial form state MUST be completely empty
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // 2. Show / Hide password state (Default: hidden)
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

    // Reset any prior error before attempting
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
        password: password, // Send exact password without trimming
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Top Bar with Language Selector */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex justify-end mb-4">
        {onLanguageChange && (
          <div
            id="login-language-switcher"
            className="inline-flex items-center bg-slate-900/90 border border-slate-800 rounded-2xl p-1 shadow-lg"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <button
              type="button"
              id="lang-btn-en"
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              English
            </button>
            <button
              type="button"
              id="lang-btn-hi"
              onClick={() => onLanguageChange('hi')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                language === 'hi'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              id="lang-btn-mr"
              onClick={() => onLanguageChange('mr')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                language === 'mr'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              मराठी
            </button>
          </div>
        )}
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="flex justify-center mb-3">
          <LiquorFlowLogo size="xl" showSubtitle={true} orientation="vertical" />
        </div>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 font-medium">
          {language === 'mr'
            ? 'दारू साठा व राज्य उत्पादन शुल्क व्यवस्थापन प्रणाली'
            : language === 'hi'
            ? 'शराब स्टॉक एवं आबकारी (Excise) प्रबंधन प्रणाली'
            : 'Liquor Shop & Bar Inventory & Excise Compliance ERP'}
        </p>
      </div>

      {/* Login Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          {/* Subtle lighting accents */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          {!setupCompleted && onGoToSetup && (
            <div className="mb-6 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
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
              className="mb-6 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            {/* Username / Mobile Number */}
            <div>
              <label
                htmlFor="username-input"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                {language === 'mr'
                  ? 'वापरकर्ता नाव / मोबाईल क्रमांक'
                  : language === 'hi'
                  ? 'उपयोगकर्ता नाम / मोबाइल नंबर'
                  : 'Username / Mobile Number'}{' '}
                <span className="text-amber-400">*</span>
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
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors font-mono"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Password with Eye Show/Hide Toggle */}
            <div>
              <label
                htmlFor="password-input"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                {t.passwordLabel || 'Password'} <span className="text-amber-400">*</span>
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
                  className="w-full px-3.5 py-2.5 pl-10 pr-11 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 focus:outline-none p-1 rounded-lg transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="login-submit-btn"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm tracking-wide transition-all shadow-lg shadow-amber-500/15 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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
                  <>
                    <span>
                      {language === 'mr'
                        ? 'लॉगिन करा →'
                        : language === 'hi'
                        ? 'लॉगिन करें →'
                        : 'Login →'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Single User Encrypted Session Indicator */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Encrypted HTTP-Only Database Session</span>
          </div>
        </div>
      </div>
    </div>
  );
};
