'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarCheck,
  Inbox,
  CheckSquare,
  Target,
  Settings,
  Plus,
  RotateCcw,
  X,
  WifiOff,
  Search,
} from 'lucide-react';
import {
  GoalOsProvider,
  NavTab,
  useGoalOs,
} from '@/src/context/goal-os-context';
import { STRINGS } from '@/src/lib/strings';
import { TodayView } from '@/src/components/today-view';
import { InboxView } from '@/src/components/inbox-view';
import { TasksView } from '@/src/components/tasks-view';
import { GoalsView } from '@/src/components/goals-view';
import { SettingsView } from '@/src/components/settings-view';
import {
  QuickCaptureModal,
  GoalQualityGateModal,
} from '@/src/components/quick-capture-modal';
import { GlobalSearchModal } from '@/src/components/global-search-modal';
import { LoginView } from '@/src/components/login-view';
import { usePWA } from '@/src/hooks/use-pwa';

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'today', label: STRINGS.nav.today, icon: CalendarCheck },
  { id: 'inbox', label: STRINGS.nav.inbox, icon: Inbox },
  { id: 'tasks', label: STRINGS.nav.tasks, icon: CheckSquare },
  { id: 'goals', label: STRINGS.nav.goals, icon: Target },
  { id: 'settings', label: STRINGS.nav.settings, icon: Settings },
];

function GoalOsShell() {
  const {
    state,
    user,
    authLoading,
    accessDenied,
    logoutUser,
    activeTab,
    setActiveTab,
    setQuickCaptureOpen,
    openQuickCaptureWithPrefill,
    showToast,
    toasts,
    dismissToast,
  } = useGoalOs();
  const { isOnline, updateAvailable, applyUpdate } = usePWA();
  const [searchOpen, setSearchOpen] = useState(false);
  const updateToastShownRef = useRef(false);
  const urlParamsHandledRef = useRef(false);

  // 1. Service Worker Update Notification: Toast with Refresh button
  useEffect(() => {
    if (updateAvailable && !updateToastShownRef.current) {
      updateToastShownRef.current = true;
      showToast(STRINGS.pwa.updateAvailable, 'info', applyUpdate);
    }
  }, [updateAvailable, showToast, applyUpdate]);

  // 2. Handle Shortcuts (?action=capture, ?tab=) and Android Share Target (?title=, ?text=, ?url=)
  useEffect(() => {
    if (urlParamsHandledRef.current || typeof window === 'undefined') return;
    urlParamsHandledRef.current = true;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const action = searchParams.get('action');
      const tabParam = searchParams.get('tab');
      const sharedTitle = searchParams.get('title');
      const sharedText = searchParams.get('text');
      const sharedUrl = searchParams.get('url');

      if (
        tabParam &&
        ['today', 'inbox', 'tasks', 'goals', 'settings'].includes(tabParam)
      ) {
        setActiveTab(tabParam as NavTab);
      }

      const textParts: string[] = [];
      if (sharedTitle?.trim()) textParts.push(sharedTitle.trim());
      if (sharedText?.trim()) textParts.push(sharedText.trim());
      if (sharedUrl?.trim()) textParts.push(sharedUrl.trim());
      const combinedText = textParts.join('\n');

      if (action === 'capture' || combinedText) {
        if (combinedText) {
          openQuickCaptureWithPrefill(combinedText);
          showToast(STRINGS.pwa.sharedCaptureToast, 'info');
        } else {
          setQuickCaptureOpen(true);
        }
      }

      // Clean query parameters from URL bar without triggering a navigation reload
      if (action || sharedTitle || sharedText || sharedUrl) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('action');
        cleanUrl.searchParams.delete('title');
        cleanUrl.searchParams.delete('text');
        cleanUrl.searchParams.delete('url');
        window.history.replaceState(
          {},
          '',
          cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
        );
      }
    } catch {
      // Safe fallback if URL parsing encounters an exception
    }
  }, [openQuickCaptureWithPrefill, setActiveTab, setQuickCaptureOpen, showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] dark:bg-[#0A0D12]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-md animate-pulse">
            AO
          </div>
          <span className="text-xs font-medium text-slate-500 font-mono">
            AbhiOS loading...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] dark:bg-[#0D1117] text-[#14171A] dark:text-[#F0F4F8] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-base mx-auto">
            !
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {STRINGS.auth.noAccessTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {STRINGS.auth.noAccessSubtitle}
            </p>
            {user.email && (
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300 pt-1">
                {user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={logoutUser}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
          >
            {STRINGS.auth.logoutBtn}
          </button>
        </div>
      </div>
    );
  }

  const unprocessedInboxCount = state.inboxItems.filter(
    (item) => item.status === 'new' || item.status === 'processing'
  ).length;
  const candidateGoalCount = state.goals.filter(
    (g) => g.status === 'candidate'
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#0D1117] text-[#14171A] dark:text-[#F0F4F8] transform-gpu"
    >
      {/* Offline Banner */}
      {!isOnline && (
        <div
          role="status"
          className="bg-amber-800 text-amber-50 px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            Offline mode — changes local cache me safe hain aur internet aate hi
            sync honge.
          </span>
        </div>
      )}

      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-[#E4E0D8] dark:border-[#21262D] bg-[#FAF8F5]/95 dark:bg-[#0D1117]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand title, one line */}
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              AO
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {STRINGS.appName}
            </span>
          </button>

          {/* Zone 2: Desktop primary navigation (5 single-line items) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-1"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const count =
                item.id === 'inbox'
                  ? unprocessedInboxCount
                  : item.id === 'goals'
                    ? candidateGoalCount
                    : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative min-h-[40px] px-3.5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'text-teal-800 dark:text-teal-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="desktop-nav-active-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-teal-700/10 dark:bg-teal-500/15 -z-10"
                    />
                  )}
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {count > 0 && (
                    <span className="text-xs font-mono tabular-nums text-teal-700 dark:text-teal-300">
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quick Search + Primary Action (+ Brain Dump) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="open-global-search-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="Open Quick Search"
              title="Quick Search (Ctrl+K)"
              className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] text-slate-600 dark:text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Khojein</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setQuickCaptureOpen(true)}
              aria-label="Open Brain Dump Quick Capture"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 active:scale-[0.98] text-white text-sm font-semibold shadow-xs transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{STRINGS.quickCapture.button}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area with Smooth Hardware-Accelerated Motion Transition */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-28 md:pb-12">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="will-change-transform"
          >
            {activeTab === 'today' && <TodayView />}
            {activeTab === 'inbox' && <InboxView />}
            {activeTab === 'tasks' && <TasksView />}
            {activeTab === 'goals' && <GoalsView />}
            {activeTab === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (5 items, >=44px touch targets) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 border-t border-[#E4E0D8] dark:border-[#21262D] bg-[#FAF8F5]/95 dark:bg-[#0D1117]/95 backdrop-blur-md px-2 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-full max-w-md mx-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeCount =
              item.id === 'inbox'
                ? unprocessedInboxCount
                : item.id === 'goals'
                  ? candidateGoalCount
                  : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors relative cursor-pointer ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-3.5 text-[10px] font-mono tabular-nums font-bold text-teal-700 dark:text-teal-300">
                      {badgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Notification Stack with Reversible Undo */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border border-slate-700 bg-slate-900 text-slate-100 text-sm"
            >
              <span className="leading-snug">{toast.text}</span>
              <div className="flex items-center gap-2 shrink-0">
                {toast.undoAction && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.undoAction?.();
                      dismissToast(toast.id);
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Undo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Persistent Universal Modals */}
      <QuickCaptureModal />
      <GoalQualityGateModal />
      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <GoalOsProvider>
      <GoalOsShell />
    </GoalOsProvider>
  );
}
