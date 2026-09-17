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
  Radio,
  ArrowRight,
  AlertTriangle,
  Lock,
  Wifi,
  Phone,
  Headphones,
  ThermometerSnowflake,
  Loader2,
  Check,
  HeartPulse,
  PlusCircle,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  // Form State
  const [email, setEmail] = useState('STF-71092-PHC');
  const [password, setPassword] = useState('Password@123');
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed. Please check credentials.');
      }

      // Store the token and worker profile in Session Storage per PRD Section 6.3
      sessionStorage.setItem('meditory_token', data.token);
      sessionStorage.setItem('meditory_user', JSON.stringify(data.user));
      sessionStorage.setItem('meditory_facility', JSON.stringify(data.facility));

      setLoginSuccess(true);
      showToast(`Welcome, ${data.user.name}. Terminal Session Established.`);

      setTimeout(() => {
        router.push('/rapid-desk');
      }, 700);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  };

  const triggerEmergencyProtocol = () => {
    sessionStorage.setItem('meditory_token', 'emergency_override_token');
    sessionStorage.setItem(
      'meditory_user',
      JSON.stringify({
        id: 'USR-EMERGENCY',
        name: 'Emergency Duty Officer',
        role: 'facility_worker',
        facilityId: 'PHC-SECTOR4-01',
      })
    );
    router.push('/rapid-desk?mode=emergency');
  };

  const openTerminalTicket = () => {
    showToast('📡 Rural Health IT Dispatch: Terminal diagnostic beacon transmitted.');
  };

  return (
    <main className="w-full min-h-screen bg-surface flex flex-col justify-between overflow-x-hidden relative select-none">
      {/* Background Graphic Layers */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Blurred Dispensary Photography Texture */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[2px] scale-105"
          style={{ backgroundImage: "url('/clinic-bg.jpg')" }}
        />
        {/* Ambient Clinical Color Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-surface via-surface/90 to-surface-container/80" />
        {/* Clinical Grid Dot Pattern */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'radial-gradient(#0f4c5c 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* Floating Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-primary text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-primary-container flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <HeartPulse className="w-4 h-4 text-secondary-fixed shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* 1. Operational Header Strip */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 relative z-10">
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
          {/* Real-time Sync Status Badge */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded bg-surface-container-lowest shadow-sm border border-slate-200/70">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
            </span>
            <div className="text-left leading-tight">
              <span className="text-[11px] font-semibold text-on-surface block">
                Sync Server: Operational
              </span>
              <span className="text-[10px] text-on-surface-variant block">
                Local Offline Cache Active (v4.2.1)
              </span>
            </div>
          </div>

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
      <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-[490px] bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden border border-slate-200/70">
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

            {/* Terminal Node Info Bar */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded bg-surface-container-low text-on-surface border border-slate-200/50">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-primary-container shrink-0" />
                <span className="text-xs text-on-surface truncate font-medium">
                  PHC Sector 4 — Dispensary Terminal A
                </span>
              </div>
              <button
                onClick={() => showToast('Unit assignment verified for Raigad District Central Registry.')}
                className="text-primary-container hover:underline text-xs shrink-0 font-semibold ml-2"
                type="button"
              >
                Switch Unit
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

              {/* Auxiliary Checkbox & Scanner Live Status */}
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
                <span className="text-[11px] text-secondary flex items-center gap-1 font-semibold">
                  <Radio className="w-3.5 h-3.5 animate-pulse" /> Scanner Live
                </span>
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

            {/* 3. Emergency Override Protocol (Anti-Venom / Trauma bypass) */}
            <div className="rounded-lg bg-tertiary/10 p-3.5 space-y-2 border border-tertiary/20">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
                <div className="text-left">
                  <div className="text-xs font-bold text-tertiary tracking-tight">
                    CRITICAL STOCK EMERGENCY?
                  </div>
                  <p className="text-xs text-on-surface mt-0.5 leading-snug">
                    Access Urgent Anti-Venom, ARV, & Trauma Drug Protocol without signing in.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={triggerEmergencyProtocol}
                  className="h-8 px-3 rounded bg-tertiary hover:bg-tertiary-dark text-on-tertiary text-[11px] flex items-center gap-1.5 font-bold shadow-sm transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Open Emergency Dispense</span>
                </button>
              </div>
            </div>

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

          {/* Card Footer Bar: Station Telemetry */}
          <div className="bg-surface-container px-6 py-2.5 flex items-center justify-between text-on-surface-variant text-xs border-t border-slate-200/50">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-secondary" />
              <span className="text-[11px]">Online Telemetry</span>
            </span>
            <span className="font-mono text-[11px] text-on-surface-variant">
              IP: 10.42.88.194 [STATIC-PHC]
            </span>
          </div>
        </div>
      </div>

      {/* 4. Operational Footer Bar with Quick Rural Support */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-on-surface-variant relative z-10 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-on-surface">Rural Dispensary Helpdesk:</span>
          <a
            href="tel:18006334357"
            className="flex items-center gap-1 text-primary-container font-semibold hover:underline"
          >
            <Phone className="w-3.5 h-3.5" /> Dial 1800-MED-HELP (Toll Free)
          </a>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <button
            onClick={openTerminalTicket}
            className="flex items-center gap-1 hover:text-on-surface transition-colors"
            type="button"
          >
            <Headphones className="w-3.5 h-3.5" /> Raise Terminal Ticket
          </button>
        </div>

        {/* Cold-Chain & National Health Stack Indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <ThermometerSnowflake className="w-4 h-4 text-secondary" />
            <span>
              Cold-Chain Main ILR:{' '}
              <strong className="text-on-surface font-semibold font-mono">3.8°C (Normal)</strong>
            </span>
          </div>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <span>National Health Stack v4.2</span>
        </div>
      </footer>
    </main>
  );
}
