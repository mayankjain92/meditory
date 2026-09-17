import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { TABLE_NAMES } from '@meditory/shared';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-surface">
      <div className="max-w-md w-full bg-surface-container-lowest p-8 rounded-2xl shadow-xl border border-slate-200/70">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-container text-white rounded-xl mb-4 font-bold text-2xl shadow-sm">
          M+
        </div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Meditory</h1>
        <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
          Clinic-to-Clinic Healthcare Inventory & Emergency Referral Network for Bharat
        </p>
        <div className="mt-6 p-3 bg-surface-container-low rounded-lg text-xs font-mono text-on-surface-variant border border-slate-200/60">
          Status: Monorepo initialized ({TABLE_NAMES.FACILITIES})
        </div>
        <div className="mt-6">
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-primary-container hover:bg-primary text-white font-semibold text-sm shadow-md transition-all active:scale-[0.99]"
          >
            <Lock className="w-4 h-4" />
            <span>Launch Dispensary Terminal Sign-in</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
