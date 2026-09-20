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
  Snowflake,
  PackagePlus,
  ArrowLeftRight,
  PhoneCall,
  Loader2,
} from 'lucide-react';
import { api, clearStoredSession, getStoredToken } from '@/lib/api-client';
import StockAlertSystem from '@/components/StockAlertSystem';
import TransferRequisitionsDesk from '@/components/TransferRequisitionsDesk';
import NetworkStatusBanner from '@/components/NetworkStatusBanner';
import EmergencyDirectoryModal from '@/components/EmergencyDirectoryModal';

interface WorkstationShellProps {
  children: React.ReactNode;
  onEmergencyClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  activeView?: 'all' | 'important' | 'cold-storage' | 'stock-entry';
}

export default function WorkstationShell({
  children,
  onEmergencyClick,
  searchQuery = '',
  onSearchChange,
  activeView,
}: WorkstationShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [workerName, setWorkerName] = useState('Dr. Rahul Sharma');
  const [facilityName, setFacilityName] = useState('Alibag Primary Health Centre (PHC)');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isTransfersOpen, setIsTransfersOpen] = useState(false);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [transferCounts, setTransferCounts] = useState({ pendingIncoming: 0, activeOutgoing: 0 });
  const [networkCounts, setNetworkCounts] = useState<{ clinics: number; users: number }>({ clinics: 9, users: 15 });

  const refreshTransferCounts = async () => {
    try {
      const res = await api.get<{ counts: { pendingIncoming: number; activeOutgoing: number } }>('/api/requisitions');
      if (res?.counts) {
        setTransferCounts(res.counts);
      }
    } catch {
      // silent catch in background poll
    }
  };

  const refreshNetworkCounts = async () => {
    try {
      const res = await api.get<{ facilities?: any[]; doctors?: any[] }>('/api/clinic/doctors');
      if (res) {
        setNetworkCounts({
          clinics: Array.isArray(res.facilities) && res.facilities.length > 0 ? res.facilities.length : 9,
          users: Array.isArray(res.doctors) && res.doctors.length > 0 ? res.doctors.length : 15,
        });
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    refreshTransferCounts();
    refreshNetworkCounts();
    const interval = setInterval(() => {
      refreshTransferCounts();
      refreshNetworkCounts();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auth Guard: strictly verify active session; redirect unauthenticated users to /login
    const token = getStoredToken();
    if (!token) {
      clearStoredSession();
      router.replace('/login');
      return;
    }

    // Hydrate cached user/facility immediately if available
    try {
      const storedUser = sessionStorage.getItem('meditory_user') || localStorage.getItem('meditory_user');
      const storedFacility = sessionStorage.getItem('meditory_facility') || localStorage.getItem('meditory_facility');
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

    api
      .get('/api/auth/me')
      .then((data) => {
        if (!data?.user) {
          clearStoredSession();
          router.replace('/login');
        } else {
          if (data.user?.name) setWorkerName(data.user.name);
          if (data.facility?.name) setFacilityName(data.facility.name);
          setIsCheckingAuth(false);
        }
      })
      .catch(() => {
        clearStoredSession();
        router.replace('/login');
      });
  }, [router]);

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // continue sign out
    }
    clearStoredSession();
    router.push('/login');
  };

  const navSections = [
    {
      title: 'DISPENSARY WORKSTATION',
      items: [
        {
          label: 'All Medicines Ledger',
          path: '/rapid-desk?view=all',
          matchPath: '/rapid-desk',
          matchView: 'all',
          icon: LayoutDashboard,
          badge: 'Ledger',
        },
        {
          label: 'Important Medicines',
          path: '/rapid-desk?view=important',
          matchPath: '/rapid-desk',
          matchView: 'important',
          icon: AlertTriangle,
          badge: 'Emergency',
          badgeColor: 'bg-rose-100 text-rose-700',
        },
        {
          label: 'Cold Storage (ILR)',
          path: '/rapid-desk?view=cold-storage',
          matchPath: '/rapid-desk',
          matchView: 'cold-storage',
          icon: Snowflake,
          badge: '2°C–8°C',
          badgeColor: 'bg-cyan-100 text-cyan-800',
        },
        {
          label: 'Unified Stock Desk',
          path: '/rapid-desk?view=stock-entry',
          matchPath: '/rapid-desk',
          matchView: 'stock-entry',
          icon: PackagePlus,
          badge: 'Restock & Dispense',
          badgeColor: 'bg-teal-100 text-teal-800',
        },
      ],
    },
    {
      title: 'DISTRICT REFERRAL NETWORK',
      items: [
        {
          label: 'Inter-Clinic Locator',
          path: '/locator',
          matchPath: '/locator',
          icon: Network,
          badge: 'Referrals',
        },
        {
          label: 'Registered Clinics & Users',
          path: '#directory',
          matchPath: '#directory',
          icon: Building2,
          badge: `${networkCounts.clinics} Clinics`,
          badgeColor: 'bg-emerald-100 text-emerald-800',
          onClick: () => setIsDirectoryOpen(true),
        },
        {
          label: 'Audit Trail',
          path: '/audit',
          matchPath: '/audit',
          icon: History,
          badge: 'Logs',
        },
      ],
    },
  ];

  const isMatch = (item: { matchPath: string; matchView?: string; path: string }) => {
    if (item.matchPath === '/rapid-desk') {
      if (pathname !== '/rapid-desk') return false;
      const effectiveView =
        activeView ||
        (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null) ||
        'all';
      return item.matchView === effectiveView;
    }
    return pathname === item.matchPath;
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 antialiased">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center border border-teal-200">
            <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Verifying Terminal Session...</p>
            <p className="text-xs text-slate-500">Authenticating authorized medical personnel</p>
          </div>
        </div>
      </div>
    );
  }

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

          {/* Categorized Navigation Items */}
          <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-250px)]">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = isMatch(item);
                    const Icon = item.icon;
                    if ((item as any).onClick) {
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={(item as any).onClick}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 shrink-0 text-emerald-600" />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${(item as any).badgeColor || 'bg-slate-100 text-slate-500'}`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-teal-700 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : (item as any).badgeColor || 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
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

          {/* Quick Actions & Status Chips */}
          <div className="flex items-center gap-2.5">
            {/* Native Offline Engine & Sync Controller */}
            <NetworkStatusBanner />

            {/* Unified Stock Alert System (Navbar Trigger + Auto-Notice + Drawer) */}
            <StockAlertSystem />

            {/* Cold Storage Telemetry Chip */}
            <Link
              href="/rapid-desk?view=cold-storage"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200/80 text-xs font-semibold transition-all"
              title="Cold Storage (ILR) Telemetry: 3.4°C"
            >
              <Snowflake className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
              <span className="font-mono">3.4°C</span>
              <span className="text-[10px] bg-cyan-200/70 text-cyan-800 px-1 py-0.2 rounded font-medium">ILR Normal</span>
            </Link>

            {/* Unified Stock Desk Quick Action */}
            <Link
              href="/rapid-desk?view=stock-entry"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-all shadow-xs active:scale-95"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>⚡ Stock Desk</span>
            </Link>

            {/* Important Medicines Quick Action */}
            <Link
              href="/rapid-desk?view=important"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-xs active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Important Medicines</span>
            </Link>

            {/* Inter-Clinic Transfer Desk Button with Badge */}
            <button
              onClick={() => setIsTransfersOpen(true)}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs active:scale-95 border ${
                transferCounts.pendingIncoming > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 animate-pulse'
                  : transferCounts.activeOutgoing > 0
                  ? 'bg-teal-700 hover:bg-teal-800 text-white border-teal-800'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Transfers</span>
              {transferCounts.pendingIncoming > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-white text-rose-700 font-mono text-[10px] font-bold">
                  {transferCounts.pendingIncoming} new
                </span>
              ) : transferCounts.activeOutgoing > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono text-[10px]">
                  {transferCounts.activeOutgoing} active
                </span>
              ) : null}
            </button>

            {/* Registered Clinics & Users Directory Trigger */}
            <button
              onClick={() => setIsDirectoryOpen(true)}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
              title="Registered Clinics & Users Directory"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Registered Clinics</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200/80 text-emerald-900 font-mono font-bold">
                {networkCounts.clinics}
              </span>
            </button>

            {/* Inter-Clinic Referral Quick Link */}
            <Link
              href="/locator?drug=DRUG-ASV-01"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
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

        {/* Inter-Clinic Transfer Requisitions Desk Modal */}
        <TransferRequisitionsDesk
          isOpen={isTransfersOpen}
          onClose={() => {
            setIsTransfersOpen(false);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('meditory:inventory-synced'));
            }
          }}
          onUpdate={() => {
            refreshTransferCounts();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('meditory:inventory-synced'));
            }
          }}
        />

        {/* Offline Emergency Doctor & Clinic Phone Directory Modal */}
        <EmergencyDirectoryModal
          isOpen={isDirectoryOpen}
          onClose={() => setIsDirectoryOpen(false)}
        />
      </div>
    </div>
  );
}

