'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Unlock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Smartphone,
  Delete,
  Check,
} from 'lucide-react';
import { useGoalOs } from '@/src/context/goal-os-context';
import { STRINGS } from '@/src/lib/strings';
import { playCompletionCelebrationSound } from '@/src/components/animated-check-button';

export function LoginView() {
  const { loginWithCredentials, loginWithPin, showToast } = useGoalOs();

  const [activeTab, setActiveTab] = useState<'pin' | 'credentials'>('pin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Focus hidden input on pin tab switch
  useEffect(() => {
    if (activeTab === 'pin') {
      hiddenInputRef.current?.focus();
    }
  }, [activeTab]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSuccess) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await loginWithCredentials(
        identifier,
        password,
        rememberMe,
        450
      );
      if (!res.ok) {
        setErrorMsg(
          res.error || 'Galat ID ya Password. Kripya dobara koshish karein.'
        );
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      } else {
        setIsSuccess(true);
        playCompletionCelebrationSound();
        showToast('Welcome Abhishek! Logged in successfully.', 'success');
      }
    } catch {
      setErrorMsg('Login request fail hui. Kripya connection check karein.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (pinValue: string) => {
    if (loading || isSuccess) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await loginWithPin(pinValue, rememberMe, 450);
      if (!res.ok) {
        setIsShaking(true);
        setErrorMsg('Galat PIN. Kripya dobara koshish karein.');
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
          hiddenInputRef.current?.focus();
        }, 500);
      } else {
        setIsSuccess(true);
        playCompletionCelebrationSound();
        showToast('Welcome Abhishek! Workspace Unlocked.', 'success');
      }
    } catch {
      setErrorMsg('PIN verification fail hui.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (val: string) => {
    if (loading || isSuccess) return;
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPin(clean);
    setErrorMsg(null);

    if (clean.length === 6) {
      void handlePinSubmit(clean);
    }
  };

  const handleKeypadPress = (num: number) => {
    if (pin.length < 6 && !loading && !isSuccess) {
      const nextPin = pin + num;
      handlePinInput(nextPin);
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0 && !loading && !isSuccess) {
      setPin((prev) => prev.slice(0, -1));
      setErrorMsg(null);
    }
  };

  const handleClear = () => {
    if (!loading && !isSuccess) {
      setPin('');
      setErrorMsg(null);
      hiddenInputRef.current?.focus();
    }
  };

  // Dial pad sublabels for an authentic cute iOS/Android tactile look
  const dialSublabels: Record<number, string> = {
    1: '',
    2: 'A B C',
    3: 'D E F',
    4: 'G H I',
    5: 'J K L',
    6: 'M N O',
    7: 'P Q R S',
    8: 'T U V',
    9: 'W X Y Z',
    0: '+',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] dark:bg-[#0A0D12] text-[#14171A] dark:text-[#F0F4F8] p-4 sm:p-6 relative overflow-hidden select-none">
      {/* GPU Accelerated Ambient Background Glows */}
      <motion.div
        initial={false}
        animate={{
          scale: isSuccess ? 1.25 : 1 + pin.length * 0.02,
          opacity: isSuccess ? 0.42 : 0.22,
        }}
        transition={{
          duration: 0.45,
          ease: 'easeOut',
        }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[480px] h-[480px] bg-gradient-to-tr from-teal-500/25 via-emerald-400/20 to-cyan-500/25 rounded-full blur-3xl pointer-events-none transform-gpu"
      />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none transform-gpu" />
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-teal-600/15 rounded-full blur-3xl pointer-events-none transform-gpu" />

      <div
        className={`w-full max-w-sm sm:max-w-md relative z-10 transition-all duration-300 ${
          isSuccess ? 'scale-[1.02] opacity-95' : 'scale-100 opacity-100'
        }`}
      >
        <div className="rounded-[32px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Cute Animated Lock Avatar */}
          <div className="text-center space-y-3">
            <motion.div
              initial={false}
              animate={
                isSuccess
                  ? {
                      scale: 1.12,
                      rotate: 0,
                      y: -2,
                    }
                  : {
                      scale: 1 + (pin.length > 0 ? 0.03 : 0),
                      rotate: 0,
                      y: 0,
                    }
              }
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="relative inline-block cursor-pointer transform-gpu"
              onClick={() => hiddenInputRef.current?.focus()}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-xl transition-all duration-300 ${
                  isSuccess
                    ? 'bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-400 text-white shadow-emerald-500/40 ring-4 ring-emerald-400/30'
                    : 'bg-gradient-to-tr from-teal-800 via-teal-700 to-teal-500 text-white shadow-teal-800/30 ring-4 ring-teal-500/20'
                }`}
              >
                {isSuccess ? (
                  <Unlock className="w-8 h-8 text-white" />
                ) : (
                  <Lock className="w-8 h-8 text-white transition-transform hover:scale-105" />
                )}
              </div>

              {/* Cute Status Sparkle Badge */}
              <motion.span
                initial={false}
                animate={
                  isSuccess
                    ? { scale: 1.15, rotate: 180 }
                    : { scale: 1, rotate: 0 }
                }
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full text-white flex items-center justify-center text-xs ring-2 ring-white dark:ring-slate-900 shadow-sm ${
                  isSuccess ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
              >
                {isSuccess ? (
                  <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
              </motion.span>
            </motion.div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1.5">
                {STRINGS.appName}
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 font-semibold border border-teal-200/80 dark:border-teal-800">
                  Private OS
                </span>
              </h1>
              <motion.p
                key={isSuccess ? 'success-text' : 'idle-text'}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                className={`text-xs font-medium ${
                  isSuccess
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isSuccess
                  ? 'Welcome Abhishek! 🌟 Unlocking your workspace...'
                  : 'Secure Personal Workspace'}
              </motion.p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pin');
                setErrorMsg(null);
                hiddenInputRef.current?.focus();
              }}
              className={`min-h-[38px] rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                activeTab === 'pin'
                  ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Quick PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('credentials');
                setErrorMsg(null);
              }}
              className={`min-h-[38px] rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                activeTab === 'credentials'
                  ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              ID & Password
            </button>
          </div>

          {/* Error Message Box (Privacy Clean - No secrets or user emails leaked) */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-center gap-2 text-center font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab 1: 6-Digit Quick PIN (Cute, Satisfying & Seamless) */}
          {activeTab === 'pin' && (
            <div className="space-y-5 text-center">
              {/* Hidden input to capture physical keyboard input seamlessly */}
              <input
                ref={hiddenInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => handlePinInput(e.target.value)}
                className="sr-only"
                aria-label="Enter 6-digit Master PIN"
                autoComplete="one-time-code"
              />

              {/* Cute 6-Digit Dots / Indicators with Bouncy Wave Effect */}
              <motion.div
                initial={false}
                animate={
                  isShaking
                    ? { x: [-10, 10, -8, 8, -4, 4, 0] }
                    : { x: 0 }
                }
                transition={{ duration: 0.35 }}
                onClick={() => hiddenInputRef.current?.focus()}
                className="flex items-center justify-center gap-2.5 sm:gap-3 py-2 cursor-pointer transform-gpu"
              >
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = idx < pin.length;
                  const isCurrent = idx === pin.length;

                  return (
                    <motion.div
                      key={idx}
                      initial={false}
                      animate={{
                        scale: isSuccess
                          ? 1.08
                          : isFilled
                          ? 1.04
                          : isCurrent
                          ? 1.02
                          : 1,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 22,
                      }}
                      className={`w-11 h-14 sm:w-12 sm:h-15 rounded-2xl border-2 flex items-center justify-center transition-colors duration-200 relative transform-gpu ${
                        isSuccess
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 shadow-sm shadow-emerald-500/30'
                          : isFilled
                          ? 'border-teal-600 dark:border-teal-400 bg-teal-500/10 dark:bg-teal-400/15 shadow-sm shadow-teal-500/20'
                          : isCurrent
                          ? 'border-teal-500/70 bg-white dark:bg-slate-800 ring-2 ring-teal-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50'
                      }`}
                    >
                      <AnimatePresence initial={false}>
                        {isFilled && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{
                              type: 'spring',
                              stiffness: 500,
                              damping: 25,
                            }}
                            className={`w-4 h-4 rounded-full shadow-xs ${
                              isSuccess
                                ? 'bg-gradient-to-tr from-emerald-600 to-teal-400'
                                : 'bg-gradient-to-tr from-teal-700 to-emerald-500'
                            }`}
                          />
                        )}
                      </AnimatePresence>

                      {!isFilled && isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-teal-500/70 transition-opacity" />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Cute Tactile Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <motion.button
                    key={num}
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleKeypadPress(num)}
                    disabled={loading || isSuccess}
                    className="min-h-[52px] rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:border-teal-400/40 border border-transparent text-slate-850 dark:text-slate-100 flex flex-col items-center justify-center transition-colors shadow-2xs active:bg-teal-100 disabled:opacity-50 transform-gpu cursor-pointer"
                  >
                    <span className="text-xl font-bold font-mono leading-none">
                      {num}
                    </span>
                    {dialSublabels[num] ? (
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium tracking-widest mt-0.5">
                        {dialSublabels[num]}
                      </span>
                    ) : null}
                  </motion.button>
                ))}

                {/* Clear Button */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={handleClear}
                  disabled={loading || isSuccess || pin.length === 0}
                  className="min-h-[52px] rounded-2xl bg-slate-100/60 dark:bg-slate-800/50 hover:bg-slate-200/80 dark:hover:bg-slate-750 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors disabled:opacity-40 transform-gpu cursor-pointer"
                >
                  Clear
                </motion.button>

                {/* 0 Button */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleKeypadPress(0)}
                  disabled={loading || isSuccess}
                  className="min-h-[52px] rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:border-teal-400/40 border border-transparent text-slate-850 dark:text-slate-100 flex flex-col items-center justify-center transition-colors shadow-2xs active:bg-teal-100 disabled:opacity-50 transform-gpu cursor-pointer"
                >
                  <span className="text-xl font-bold font-mono leading-none">
                    0
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium tracking-widest mt-0.5">
                    +
                  </span>
                </motion.button>

                {/* Backspace Button */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={handleBackspace}
                  disabled={loading || isSuccess || pin.length === 0}
                  className="min-h-[52px] rounded-2xl bg-slate-100/60 dark:bg-slate-800/50 hover:bg-slate-200/80 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors disabled:opacity-40 transform-gpu cursor-pointer"
                  aria-label="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Status indicator */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                {loading ? (
                  <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-medium">
                    <span className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    Verifying PIN...
                  </span>
                ) : (
                  <span>6-Digit Security PIN</span>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: ID & Password */}
          {activeTab === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ID ya Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Apna registered email likhein"
                    className="w-full min-h-[46px] pl-10 pr-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Apna password likhein"
                    className="w-full min-h-[46px] pl-10 pr-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <span>Mujhe is device par logged in rakhein</span>
                </label>
              </div>

              <motion.button
                type="submit"
                disabled={loading || isSuccess}
                whileTap={{ scale: 0.98 }}
                className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-teal-600 hover:from-teal-700 hover:to-teal-500 text-white font-semibold text-sm shadow-md shadow-teal-700/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 transform-gpu cursor-pointer"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Unlock AbhiOS</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
          )}
        </div>

        {/* Ultra-Clean Privacy Footer Note */}
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 pt-4 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-500" />
          <span>256-Bit Encrypted Session · Private OS</span>
        </p>
      </div>
    </div>
  );
}
