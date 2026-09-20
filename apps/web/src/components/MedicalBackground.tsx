'use client';

import React from 'react';
import Image from 'next/image';

interface MedicalBackgroundProps {
  children: React.ReactNode;
  showToggle?: boolean;
}

export default function MedicalBackground({ children }: MedicalBackgroundProps) {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden">
      {/* 1. Medical Photography Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <div className="absolute inset-0">
          {/* Medical Pharmacy Interior Shelves */}
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

      {/* Main Page Content rendered on top */}
      {children}
    </div>
  );
}
