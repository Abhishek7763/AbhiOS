'use client';

import React from 'react';
import { WifiOff, RotateCcw, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { STRINGS } from '@/src/lib/strings';

export default function OfflineFallbackPage() {
  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F5] dark:bg-[#0D1117] text-[#14171A] dark:text-[#F0F4F8] px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center space-y-6 shadow-sm">
        {/* Brand AO Icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            AO
          </div>
        </div>

        {/* Offline Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold">
          <WifiOff className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span>Offline Mode</span>
        </div>

        {/* Headline & Description */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {STRINGS.pwa.offlineTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {STRINGS.pwa.offlineDesc}
          </p>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 text-xs text-slate-600 dark:text-slate-400 text-left">
            💡 {STRINGS.pwa.offlineTip}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleRetry}
            className="w-full min-h-[48px] px-5 py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-600 active:scale-[0.98] text-white text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{STRINGS.pwa.retryBtn}</span>
          </button>

          <Link
            href="/?tab=today"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>{STRINGS.pwa.openAppBtn}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
