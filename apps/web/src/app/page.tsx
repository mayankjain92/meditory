import { TABLE_NAMES } from '@meditory/shared';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 text-emerald-600 rounded-xl mb-4 font-bold text-2xl">
          M+
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Meditory</h1>
        <p className="text-sm text-slate-600 mt-2">
          Clinic-to-Clinic Healthcare Inventory & Emergency Referral Network for Bharat
        </p>
        <div className="mt-6 p-3 bg-slate-50 rounded-lg text-xs font-mono text-slate-500 border border-slate-200">
          Status: Monorepo initialized ({TABLE_NAMES.FACILITIES})
        </div>
      </div>
    </main>
  );
}
