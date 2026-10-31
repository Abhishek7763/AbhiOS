'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Plays a pleasant, tactile two-tone upward chime using the browser's Web Audio API
 * when a task or routine is ticked complete. Requires zero external audio files.
 */
export function playCompletionCelebrationSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Crisp upward major triad arpeggio (E5 -> G#5 -> B5 -> E6)
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);

      gain.gain.setValueAtTime(0.001, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.055 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.25);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore if browser blocks audio before interaction
  }
}

const PARTICLE_VECTORS = [
  { x: -24, y: -20, color: '#10b981' },
  { x: 0, y: -28, color: '#f59e0b' },
  { x: 24, y: -20, color: '#14b8a6' },
  { x: 28, y: 0, color: '#10b981' },
  { x: 22, y: 22, color: '#f59e0b' },
  { x: 0, y: 26, color: '#0d9488' },
  { x: -22, y: 22, color: '#10b981' },
  { x: -28, y: 0, color: '#f59e0b' },
];

interface AnimatedCheckButtonProps {
  checked: boolean;
  celebrating?: boolean;
  onToggle: () => void;
  ariaLabel: string;
  size?: 'sm' | 'md' | 'lg';
  skipped?: boolean;
}

export function AnimatedCheckButton({
  checked,
  celebrating = false,
  onToggle,
  ariaLabel,
  size = 'md',
  skipped = false,
}: AnimatedCheckButtonProps) {
  const boxSizeClass =
    size === 'lg'
      ? 'w-7 h-7 rounded-xl'
      : size === 'sm'
        ? 'w-5 h-5 rounded-md'
        : 'w-6 h-6 rounded-lg';

  const svgSizeClass =
    size === 'lg' ? 'w-4 h-4' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      data-testid="animated-check-btn"
      className="relative min-h-[44px] min-w-[44px] -m-1.5 flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shrink-0 group cursor-pointer"
    >
      {/* Main Checkbox Square with Spring Physics */}
      <motion.span
        whileTap={{ scale: 0.78 }}
        animate={
          celebrating
            ? {
                scale: [1, 1.42, 0.88, 1.15, 1],
                rotate: [0, -10, 10, -4, 0],
              }
            : { scale: 1, rotate: 0 }
        }
        transition={{
          duration: 0.52,
          ease: 'easeOut',
        }}
        className={`${boxSizeClass} border-2 flex items-center justify-center transition-colors duration-200 ${
          checked
            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/35'
            : skipped
              ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
              : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-500 bg-white dark:bg-slate-900'
        }`}
      >
        <AnimatePresence initial={false}>
          {checked && (
            <motion.svg
              key="check-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={svgSizeClass}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 18 }}
            >
              <motion.path
                d="M20 6L9 17l-5-5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>

      {/* Radial Burst Rings, Confetti Dots & Floating "+Done" Badge */}
      <AnimatePresence>
        {celebrating && (
          <>
            {/* Expanding Shockwave Ring 1 */}
            <motion.span
              key="ring-1"
              initial={{ scale: 0.6, opacity: 0.95 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="pointer-events-none absolute w-6 h-6 rounded-full border-2 border-emerald-500"
            />
            {/* Expanding Glow Ring 2 */}
            <motion.span
              key="ring-2"
              initial={{ scale: 0.5, opacity: 0.85 }}
              animate={{ scale: 3.1, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="pointer-events-none absolute w-5 h-5 rounded-full bg-emerald-400/35"
            />
            {/* 8 Radial Sparkle Particles */}
            {PARTICLE_VECTORS.map((vec, i) => (
              <motion.span
                key={`particle-${i}`}
                initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
                animate={{
                  x: vec.x,
                  y: vec.y,
                  scale: [0.4, 1.25, 0],
                  opacity: [1, 1, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.58, ease: 'easeOut' }}
                style={{ backgroundColor: vec.color }}
                className="pointer-events-none absolute w-2 h-2 rounded-full shadow-xs"
              />
            ))}
            {/* Floating "✓ Done!" Micro-Pill */}
            <motion.span
              key="floating-done-pill"
              initial={{ y: 0, opacity: 0, scale: 0.7 }}
              animate={{ y: -28, opacity: [0, 1, 1, 0], scale: [0.8, 1.08, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold whitespace-nowrap shadow-md"
            >
              ✓ Ho Gaya!
            </motion.span>
          </>
        )}
      </AnimatePresence>
    </button>
  );
}
