'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Building2,
  ExternalLink,
  ArrowLeft,
  Server,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileCheck2,
} from 'lucide-react';

export default function AdminBridgePage() {
  const router = useRouter();
  const [adminStatus, setAdminStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    fetch('http://localhost:3005/health')
      .then((res) => {
        if (res.ok) setAdminStatus('online');
        else setAdminStatus('offline');
      })
      .catch(() => setAdminStatus('offline'));
  }, []);

  return (
    <main className="min-h-screen bg-surface-container-low flex flex-col antialiased text-on-surface">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-surface-container-lowest px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/rapid-desk')}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-on-surface hover:bg-slate-100 transition-colors"
            title="Back to Rapid Desk"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Meditory" className="h-7 w-auto object-contain" />
            <div className="h-4 w-px bg-slate-300 hidden sm:block" />
            <span className="text-xs sm:text-sm font-semibold tracking-tight text-on-surface">
              District Health Authority Admin Gateway
            </span>
          </div>
        </div>

        <button
          onClick={() => router.push('/login')}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Dispensary Sign-in
        </button>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 space-y-6">
        <div className="bg-surface-container-lowest rounded-xl border border-slate-200 shadow-xl overflow-hidden p-8 sm:p-10 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary-container/15 flex items-center justify-center mx-auto text-primary-container">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wide">
              Dedicated Server Architecture • Port 3005
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              District Health Authority Admin Portal
            </h1>
            <p className="text-sm text-on-surface-variant max-w-lg mx-auto">
              Per security policy, clinic registration approvals and master health grid governance are isolated on an independent server process.
            </p>
          </div>

          {/* Status Indicator */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 max-w-md mx-auto flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-slate-500" />
              <div className="text-left">
                <span className="font-semibold block text-slate-800">Admin Server Process</span>
                <span className="font-mono text-slate-500 text-[11px]">http://localhost:3005</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-bold">
              {adminStatus === 'online' ? (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Active
                </span>
              ) : adminStatus === 'offline' ? (
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                  Ready on :3005
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking
                </span>
              )}
            </div>
          </div>

          {/* Primary Action to Open Admin Portal */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="http://localhost:3005"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto h-12 px-8 rounded-lg bg-primary-container text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary transition-all shadow-md active:scale-[0.99]"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Launch District Admin Portal</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => router.push('/rapid-desk')}
              className="w-full sm:w-auto h-12 px-6 rounded-lg bg-surface-container-high hover:bg-slate-200 text-on-surface text-sm font-semibold transition-all border border-slate-200"
            >
              Open Clinic Workstation
            </button>
          </div>

          {/* Information list */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-200/60 text-left text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                1-Tap Approvals
              </span>
              <p className="text-slate-500 text-[11px]">
                Review facility GPS coordinates, license details, and verify MOIC doctor credentials.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                Auto Stock Seeding
              </span>
              <p className="text-slate-500 text-[11px]">
                Approving automatically provisions Anti-Snake Venom, ARV, ORS, and Paracetamol to their shelf.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Instant Activation
              </span>
              <p className="text-slate-500 text-[11px]">
                Worker accounts activate instantly so clinics can immediately sign into the Rapid Desk.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
