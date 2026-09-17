'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Network,
  History,
  LogOut,
  Search,
  AlertTriangle,
  Stethoscope,
  Building2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface WorkstationShellProps {
  children: React.ReactNode;
  onEmergencyClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export default function WorkstationShell({
  children,
  onEmergencyClick,
  searchQuery = '',
  onSearchChange,
}: WorkstationShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [workerName, setWorkerName] = useState('Dr. Rahul Sharma');
  const [facilityName, setFacilityName] = useState('Alibag Primary Health Centre (PHC)');

  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem('meditory_user');
      const storedFacility = sessionStorage.getItem('meditory_facility');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.name) setWorkerName(u.name);
      }
      if (storedFacility) {
        const f = JSON.parse(storedFacility);
        if (f.name) setFacilityName(f.name);
      }
    } catch {
      // fallback to pre-seeded defaults
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // continue sign out
    }
    sessionStorage.clear();
    router.push('/login');
  };

  const navItems = [
    {
      label: 'Inventory & Dispensing',
      path: '/rapid-desk',
      icon: LayoutDashboard,
      badge: 'Ledger',
    },
    {
      label: 'Inter-Clinic Locator',
      path: '/locator',
      icon: Network,
      badge: 'Referrals',
    },
    {
      label: 'Audit Trail',
      path: '/audit',
      icon: History,
      badge: 'Logs',
    },
  ];

  return (
    <div className="bg-slate-50 text-slate-800 antialiased min-h-screen flex selection:bg-teal-600 selection:text-white">
      {/* Fixed Left Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white flex flex-col justify-between z-50 shadow-sm border-r border-slate-200">
        <div className="flex flex-col">
          {/* App Branding */}
          <div className="p-4 border-b border-slate-100">
            <Link href="/rapid-desk" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                M+
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                  Meditory
                </span>
                <span className="text-[10px] text-teal-700 font-semibold tracking-wider uppercase">
                  Primary Clinic Desk
                </span>
              </div>
            </Link>

            {/* Clinic Tenancy Card */}
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 truncate">
                <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">{facilityName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate mt-1">
                <Stethoscope className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{workerName}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[10px] font-medium text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span>Active Shift • Online</span>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Security Badge & Sign Out */}
        <div className="p-3.5 border-t border-slate-100 space-y-2.5 bg-slate-50/50">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>Clinic Boundary Guard Active</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold transition-colors border border-slate-200 hover:border-rose-200 shadow-2xs"
            type="button"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="pl-64 w-full flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 h-16 bg-white/95 backdrop-blur-md z-40 flex items-center justify-between px-6 border-b border-slate-200/80 shadow-2xs">
          {/* Global Search Bar */}
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                placeholder="Search shelf medicines, generic salts, or formulations..."
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 border border-slate-200 transition-all"
              />
            </div>
          </div>

          {/* Quick Actions & Status */}
          <div className="flex items-center gap-3">
            <Link
              href="/rapid-desk/emergency"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold transition-all shadow-xs active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Emergency Injections</span>
            </Link>

            <Link
              href="/locator?drug=DRUG-ASV-01"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
            >
              <Network className="w-3.5 h-3.5 text-teal-600" />
              <span>Inter-Clinic Referral</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 bg-slate-50 flex-1 w-full max-w-[1400px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
