'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Gauge,
  Network,
  ClipboardList,
  LogOut,
  Search,
  ThermometerSnowflake,
  AlertTriangle,
  Radio,
  Stethoscope,
  ChevronRight,
  User,
  Barcode,
} from 'lucide-react';

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

  const [workerName, setWorkerName] = useState('Dr. Rahul Sharma (Chief Pharmacist)');
  const [facilityName, setFacilityName] = useState('PHC Sector 4 — Dispensary');
  const [selectedLang, setSelectedLang] = useState<'EN' | 'HI' | 'TA'>('EN');

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
    } catch (e) {
      // fallback to defaults
    }
  }, []);

  const handleSignOut = () => {
    sessionStorage.clear();
    router.push('/login');
  };

  const navItems = [
    {
      label: 'Rapid Desk',
      path: '/rapid-desk',
      icon: Gauge,
      badge: 'ALT+1',
      badgeClass: 'bg-secondary-fixed text-on-secondary-fixed font-bold',
    },
    {
      label: 'Inter-Clinic Locator',
      path: '/locator',
      icon: Network,
      badge: '3 Nearby PHCs',
      badgeClass: 'bg-secondary-container text-on-secondary-container font-semibold',
    },
    {
      label: 'Audit Log',
      path: '/audit',
      icon: ClipboardList,
      hasChevron: true,
    },
  ];

  return (
    <div className="bg-surface font-sans text-on-surface antialiased min-h-screen flex selection:bg-primary-container selection:text-white">
      {/* 1. Fixed Left Sidebar (72 = 18rem = 288px) */}
      <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-lowest flex flex-col justify-between z-50 shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-slate-200/60">
        <div className="flex flex-col">
          {/* Clinic Branding & Profile Card */}
          <div className="p-4 flex flex-col gap-2 bg-surface-container-low border-b border-slate-200/50">
            <div className="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="Meditory Logo"
                className="h-8 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="text-sm text-primary font-bold tracking-tight leading-tight">
                  Meditory
                </span>
                <span className="text-[10px] text-outline uppercase tracking-wider font-semibold">
                  Clinical Suite
                </span>
              </div>
            </div>

            <div className="mt-1 pt-1 flex flex-col gap-0.5 border-t border-slate-200/40">
              <span className="text-xs text-on-surface font-semibold truncate">
                {facilityName}
              </span>
              <div className="flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[11px] text-on-surface-variant truncate">
                  {workerName}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 pt-0.5">
                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-surface-container-high rounded text-on-surface-variant font-medium">
                  Terminal: TRM-04-A
                </span>
                <span className="flex items-center gap-1 text-[11px] text-secondary font-semibold">
                  <span className="w-2 h-2 rounded-full bg-secondary inline-block animate-pulse"></span>
                  Live
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-primary-container text-on-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-white/20 text-white font-bold'
                          : item.badgeClass
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.hasChevron && !isActive && (
                    <ChevronRight className="w-4 h-4 text-outline" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Shift & Sign Out */}
        <div className="p-3.5 flex flex-col gap-3 bg-surface-container-low border-t border-slate-200/50">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
              <span className="w-2 h-2 rounded-full bg-secondary inline-block"></span>
              <span>12h Shift • Offline Sync Active</span>
            </div>
            <div className="flex items-center justify-between text-outline font-mono text-[10px]">
              <span>Local Cache v4.2.1</span>
              <span className="text-secondary font-semibold">99.8% Sync</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-surface-container-highest text-error hover:bg-error-container hover:text-on-error-container text-xs font-semibold transition-colors"
            type="button"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out / Switch Shift</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Workstation Area (offset by sidebar width 72 = 18rem = 288px) */}
      <div className="pl-72 w-full flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="fixed top-0 left-72 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-6 border-b border-slate-200/50">
          {/* Global Drug Search Bar */}
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                placeholder="Search medicine by generic name, salt, batch, or barcode... (Press /)"
                className="w-full h-10 pl-10 pr-24 rounded-lg bg-surface-container-low text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container/20 border border-slate-200/60 transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
                  /
                </span>
                <span title="Barcode Scanner Listener Active">
                  <Barcode className="w-4 h-4 text-primary cursor-pointer" />
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Widgets */}
          <div className="flex items-center gap-4">
            {/* Operational Telemetry Pill */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-semibold border border-secondary/20">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span>Sync Server: Operational</span>
              <span className="text-outline-variant font-normal">|</span>
              <span className="flex items-center gap-1">
                <ThermometerSnowflake className="w-3.5 h-3.5 text-secondary" />
                ILR Cold Chain: 3.8°C
              </span>
            </div>

            {/* Emergency Dispense Action */}
            <button
              onClick={() => {
                if (onEmergencyClick) onEmergencyClick();
                else router.push('/rapid-desk#emergency');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary text-on-tertiary hover:bg-tertiary-container hover:text-on-tertiary text-xs font-semibold transition-colors shadow-sm active:scale-95"
              type="button"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
              <span>Emergency Dispense</span>
            </button>

            {/* Language Switcher */}
            <div className="flex items-center gap-0.5 bg-surface-container-low rounded-lg p-0.5 text-xs text-on-surface-variant border border-slate-200/40">
              <button
                onClick={() => setSelectedLang('EN')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  selectedLang === 'EN'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'hover:text-on-surface'
                }`}
                type="button"
              >
                EN
              </button>
              <button
                onClick={() => setSelectedLang('HI')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  selectedLang === 'HI'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'hover:text-on-surface'
                }`}
                type="button"
              >
                हिन्दी
              </button>
              <button
                onClick={() => setSelectedLang('TA')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  selectedLang === 'TA'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'hover:text-on-surface'
                }`}
                type="button"
              >
                தமிழ்
              </button>
            </div>

            {/* Profile Avatar */}
            <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center shadow-xs cursor-pointer hover:ring-2 hover:ring-primary-container/30 transition-all">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </header>

        {/* Page Body Viewport */}
        <main className="relative pt-16 bg-surface min-h-screen w-full flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
