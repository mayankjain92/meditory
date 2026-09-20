'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Pill, Sparkles, Building2, Eye } from 'lucide-react';

interface MedicalBackgroundProps {
  children: React.ReactNode;
  showToggle?: boolean;
}

export default function MedicalBackground({
  children,
  showToggle = true,
}: MedicalBackgroundProps) {
  // Default to the user's pharmacy shelves image in components, with optional toggle to clinical photo
  const [backgroundTheme, setBackgroundTheme] = useState<'pharmacy' | 'dispensary'>('pharmacy');

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden">
      {/* 1. Medical Photography Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {backgroundTheme === 'pharmacy' ? (
          <div className="absolute inset-0 transition-opacity duration-700">
            {/* Medical Pharmacy Interior Shelves from components */}
            <Image
              src="/pharmacy-shelves.webp"
              alt="Medical pharmacy shelves with medicine supplies"
              fill
              priority
              unoptimized
              className="object-cover object-center scale-[1.02] filter brightness-[0.78] contrast-[1.08] saturate-[1.1]"
            />
            {/* Deep Clinical Gradient Overlay to protect contrast & typography */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/50 to-slate-900/75" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-teal-950/30 to-slate-950/70" />
          </div>
        ) : (
          <div className="absolute inset-0 transition-opacity duration-700">
            {/* High-res Clinical Dispensary Facility Scene */}
            <Image
              src="/medical-bg.jpg"
              alt="Dispensary and cold chain medical facility"
              fill
              priority
              unoptimized
              className="object-cover object-center scale-[1.02] filter brightness-[0.72] contrast-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/50 to-slate-900/75" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-teal-950/30 to-slate-950/70" />
          </div>
        )}

        {/* Ambient Subtle Grid Dot Pattern */}
        <div
          className="absolute inset-0 opacity-15 mix-blend-overlay"
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Vignette Shadow around screen edges */}
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />
      </div>

      {/* 2. Optional Theme Toggle in Top Corner for the user */}
      {showToggle && (
        <div className="fixed bottom-3 right-4 z-40">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 shadow-lg text-[10px] text-white/90">
            <span className="px-2 text-slate-400 font-medium flex items-center gap-1">
              <Pill className="w-3 h-3 text-teal-400" />
              Medical Theme:
            </span>
            <button
              type="button"
              onClick={() => setBackgroundTheme('pharmacy')}
              className={`px-2.5 py-1 rounded-full font-semibold transition-all ${
                backgroundTheme === 'pharmacy'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Pharmacy Shelves
            </button>
            <button
              type="button"
              onClick={() => setBackgroundTheme('dispensary')}
              className={`px-2.5 py-1 rounded-full font-semibold transition-all ${
                backgroundTheme === 'dispensary'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              PHC Dispensary
            </button>
          </div>
        </div>
      )}

      {/* Main Page Content rendered on top */}
      {children}
    </div>
  );
}
