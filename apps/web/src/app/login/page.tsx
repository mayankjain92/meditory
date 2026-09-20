'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Hospital,
  Building2,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  AlertTriangle,
  Lock,
  Phone,
  ThermometerSnowflake,
  Loader2,
  Check,
  HeartPulse,
} from 'lucide-react';

import { api, setStoredSession } from '@/lib/api-client';
import MedicalBackground from '@/components/MedicalBackground';

export default function LoginPage() {
  const router = useRouter();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberTerminal, setRememberTerminal] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'HI' | 'TA' | 'TE'>('EN');

  // UI Interactive State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic Validation
    if (!email.trim()) {
      setErrorMessage('Please enter your Work Email or Staff ID.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your Secure Access Key / PIN.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await api.post('/api/auth/login', { email: email.trim(), password });

      // Store the token and worker profile across session and local storage
      setStoredSession(data.token, data.user, data.facility);

      setLoginSuccess(true);
      showToast(`Welcome, ${data.user?.name || 'Staff'}. Terminal Session Established.`);

      setTimeout(() => {
        router.push('/rapid-desk');
      }, 600);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
    }
  };



  return (
    <MedicalBackground>
      {/* Floating Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-teal-500/30 flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <HeartPulse className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* 1. Operational Header Strip */}
      <header className="w-full max-w-7xl mx-auto px-6 py-3 my-3 rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-lg flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center p-2 rounded bg-primary-container text-on-primary shadow-sm">
            <Hospital className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface tracking-wider uppercase">
                Ministry of Health & Family Welfare
              </span>
              <span className="text-outline-variant font-bold">•</span>
              <span className="text-[11px] text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full font-semibold border border-secondary/20">
                Tier-3 Rural Node
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-normal">
              National Rural Health Mission • Inventory Registry Portal
            </p>
          </div>
        </div>

        {/* Right Controls: Sync Telemetry & Language Toggle */}
        <div className="flex items-center gap-4">
          {/* District Admin Authority Portal Link */}
          <a
            href="http://localhost:3005"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-slate-200 text-xs text-on-surface hover:bg-slate-50 transition-all shadow-xs"
            title="District Health Authority Registration Approval Portal"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-[11px]">District Admin Portal</span>
          </a>

          {/* Multilingual Selector */}
          <div className="flex items-center bg-surface-container-high rounded p-0.5 shadow-sm border border-slate-200/50">
            <button
              onClick={() => setSelectedLanguage('EN')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-all ${
                selectedLanguage === 'EN'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              EN
            </button>
            <button
              onClick={() => setSelectedLanguage('HI')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-all ${
                selectedLanguage === 'HI'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              हिन्दी
            </button>
            <button
              onClick={() => setSelectedLanguage('TA')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-all ${
                selectedLanguage === 'TA'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              தமிழ்
            </button>
            <button
              onClick={() => setSelectedLanguage('TE')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-all ${
                selectedLanguage === 'TE'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              తెలుగు
            </button>
          </div>
        </div>
      </header>

      {/* 2. Central Workstation Login Canvas */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 relative z-10">
        <div className="w-full max-w-[490px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/80 ring-1 ring-slate-900/5">
          {/* Top Clinical Accent Bar */}
          <div className="h-1.5 w-full bg-primary-container" />

          <div className="p-8 sm:p-9 space-y-6">
            {/* Logo & Center Subtitles */}
            <div className="text-center space-y-3">
              <div className="inline-flex justify-center items-center">
                <img
                  src="/logo.svg"
                  alt="Meditory Logo"
                  className="h-12 w-auto object-contain mx-auto"
                />
              </div>
              <div>
                <h1 className="text-lg sm:text-[20px] font-semibold text-on-surface tracking-tight">
                  Dispensary Terminal Sign-in
                </h1>
                <p className="text-xs text-on-surface-variant mt-1">
                  Primary Healthcare Centre (PHC) & Sub-Center Inventory Portal
                </p>
              </div>
            </div>

            {/* Clinic Registration Callout Card */}
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-primary-container/10 border border-primary-container/20 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary-container/15 flex items-center justify-center text-primary-container shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-on-surface block">New Clinic Facility?</span>
                  <p className="text-[11px] text-on-surface-variant">Register your PHC/CHC for network access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="px-3 py-1.5 rounded bg-primary-container text-white text-[11px] font-bold hover:bg-primary transition-all shadow-xs shrink-0"
              >
                Register Clinic
              </button>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Interactive Form */}
            <form className="space-y-4 text-left" onSubmit={handleLoginSubmit}>
              {/* Staff ID / Email Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label
                    htmlFor="staffId"
                    className="block text-[11px] font-semibold text-on-surface uppercase tracking-wide"
                  >
                    Work Email / Staff ID
                  </label>
                  <span className="text-[11px] text-outline flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                    <span className="font-medium text-secondary">Verified Staff</span>
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-outline pointer-events-none">
                    <svg
                      className="w-[18px] h-[18px]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                      />
                    </svg>
                  </span>
                  <input
                    id="staffId"
                    name="staffId"
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g., STF-84021 or rahul.sharma@phc-alibag.in"
                    className="w-full h-11 pl-10 pr-10 rounded bg-surface-container-low text-on-surface text-sm border border-slate-200/60 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container transition-all"
                  />
                  {email.trim().length > 3 && (
                    <CheckCircle2 className="w-4 h-4 text-secondary absolute right-3 shrink-0" />
                  )}
                </div>
              </div>

              {/* Password Field with Show/Hide */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-semibold text-on-surface uppercase tracking-wide"
                  >
                    Secure Access Key / PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => showToast('Password reset requested. Contact District Health Administrator.')}
                    className="text-[11px] text-primary-container hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-outline absolute left-3 pointer-events-none" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password or numeric shift PIN"
                    className="w-full h-11 pl-10 pr-10 rounded bg-surface-container-low text-on-surface text-sm border border-slate-200/60 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-outline hover:text-on-surface rounded transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Auxiliary Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberTerminal}
                    onChange={(e) => setRememberTerminal(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-container accent-primary-container focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-on-surface-variant">
                    Remember this terminal for 12h shift
                  </span>
                </label>
              </div>

              {/* Primary Submit Button */}
              <div className="pt-2">
                <button
                  id="submitBtn"
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full h-11 px-6 rounded text-sm font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] group text-on-primary ${
                    loginSuccess
                      ? 'bg-secondary'
                      : 'bg-primary-container hover:bg-primary'
                  } disabled:opacity-80`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating terminal...</span>
                    </>
                  ) : loginSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Identity Verified. Launching ledger...</span>
                    </>
                  ) : (
                    <>
                      <span>Log In to Inventory</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>



            {/* Security Disclaimer */}
            <div className="text-center pt-2">
              <div className="flex items-center justify-center gap-1.5 text-outline">
                <Lock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Restricted Internal Health System
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-on-surface-variant mt-1">
                Authorized Medical Officers, Pharmacists, & Auxiliary Staff Nurses only. All terminal
                actions, lot allocations, and barcode transactions are audit-logged under NHM guidelines.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Operational Footer Bar with Quick Rural Support */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-3 my-3 rounded-2xl bg-white/90 backdrop-blur-md border border-white/80 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 text-on-surface-variant relative z-10 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-on-surface">Rural Dispensary Helpdesk:</span>
          <a
            href="tel:18006334357"
            className="flex items-center gap-1 text-primary-container font-semibold hover:underline"
          >
            <Phone className="w-3.5 h-3.5" /> Dial 1800-MED-HELP (Toll Free)
          </a>
        </div>

        {/* Cold-Chain Indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <ThermometerSnowflake className="w-4 h-4 text-secondary" />
            <span>
              Cold-Chain Main ILR:{' '}
              <strong className="text-on-surface font-semibold font-mono">3.8°C (Normal)</strong>
            </span>
          </div>
        </div>
      </footer>
    </MedicalBackground>
  );
}
