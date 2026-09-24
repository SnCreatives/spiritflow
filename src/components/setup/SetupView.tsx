import React, { useState } from 'react';
import { Wine, Store, Key, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { SupportedLanguage, SetupInput } from '../../types';
import { apiPost } from '../../utils/api';
import { translations } from '../../utils/i18n';

interface SetupViewProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onSetupSuccess: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({
  language,
  onLanguageChange,
  onSetupSuccess,
}) => {
  const t = translations[language];

  const [formData, setFormData] = useState<SetupInput>({
    businessName: '',
    address: '',
    ownerMobile: '',
    vatNumber: '',
    licenceReference: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
    language: (language === 'hi' ? 'hi' : 'mr'),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleInputChange = (field: keyof SetupInput, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // If ownerMobile is typed, default the login mobileNumber to it if empty
      ...(field === 'ownerMobile' && !prev.mobileNumber ? { mobileNumber: value } : {}),
    }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleLanguageSelect = (lang: 'mr' | 'hi') => {
    setFormData(prev => ({ ...prev, language: lang }));
    onLanguageChange(lang);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double-clicks / repeated requests (Requirement 7)

    // Basic client checks
    if (!formData.businessName.trim()) {
      setErrorMessage('Please enter your business / shop name.');
      return;
    }
    if (!formData.address.trim()) {
      setErrorMessage('Please enter business address.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(formData.ownerMobile.trim())) {
      setErrorMessage('Please enter a valid 10-digit Indian owner mobile number.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(formData.mobileNumber.trim())) {
      setErrorMessage('Please enter a valid 10-digit Indian login mobile number.');
      return;
    }
    if (formData.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Password and Confirm Password must match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await apiPost('/api/setup', formData);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to complete business setup');
      }

      setSuccessMessage('Setup completed successfully! Redirecting to login...');
      setTimeout(() => {
        onSetupSuccess();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during setup');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
          <Wine className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Welcome to LiquorFlow
        </h1>
        <p className="mt-2 text-base text-slate-400 max-w-md mx-auto">
          Let's set up your business before you start.
        </p>

        {/* Language selector toggle on setup screen */}
        <div className="mt-5 inline-flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-xs text-slate-400 font-medium px-3">
            {t.languageSelectLabel}:
          </span>
          <button
            type="button"
            onClick={() => handleLanguageSelect('mr')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              formData.language === 'mr'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            मराठी (Marathi)
          </button>
          <button
            type="button"
            onClick={() => handleLanguageSelect('hi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              formData.language === 'hi'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            हिंदी (Hindi)
          </button>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-10">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Business Information */}
            <div>
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800 text-amber-400 font-semibold text-sm uppercase tracking-wider">
                <Store className="w-4 h-4" />
                <span>{t.businessInfoSection}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.businessNameLabel} <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={e => handleInputChange('businessName', e.target.value)}
                    placeholder={t.businessNamePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.addressLabel} <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={e => handleInputChange('address', e.target.value)}
                    placeholder={t.addressPlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.ownerMobileLabel} <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs font-mono">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      required
                      value={formData.ownerMobile}
                      onChange={e => handleInputChange('ownerMobile', e.target.value.replace(/\D/g, ''))}
                      placeholder={t.ownerMobilePlaceholder}
                      className="w-full pl-11 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.vatLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={formData.vatNumber || ''}
                    onChange={e => handleInputChange('vatNumber', e.target.value.toUpperCase())}
                    placeholder={t.vatPlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors uppercase font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.licenceLabel}
                  </label>
                  <input
                    type="text"
                    value={formData.licenceReference}
                    onChange={e => handleInputChange('licenceReference', e.target.value)}
                    placeholder={t.licencePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Login Credentials */}
            <div>
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800 text-amber-400 font-semibold text-sm uppercase tracking-wider">
                <Key className="w-4 h-4" />
                <span>{t.credentialsSection}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.loginMobileLabel} <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs font-mono">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      required
                      value={formData.mobileNumber}
                      onChange={e => handleInputChange('mobileNumber', e.target.value.replace(/\D/g, ''))}
                      placeholder={t.loginMobilePlaceholder}
                      className="w-full pl-11 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.passwordLabel} <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={e => handleInputChange('password', e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.confirmPasswordLabel} <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.confirmPassword}
                    onChange={e => handleInputChange('confirmPassword', e.target.value)}
                    placeholder={t.confirmPasswordPlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Atomic Setup Confirmation */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSubmitting ? t.settingUp : t.completeSetupButton}</span>
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Setup will atomically initialize your store settings, 9 core categories, and compliant pack sizes.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
