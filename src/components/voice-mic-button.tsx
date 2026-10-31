'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles } from 'lucide-react';

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  onStatusMessage?: (msg: string) => void;
  compact?: boolean;
  testId?: string;
}

interface BrowserSpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function VoiceMicButton({
  onTranscript,
  onStatusMessage,
  compact = false,
  testId = 'voice-mic-btn',
}: VoiceMicButtonProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  const toggleVoiceCapture = useCallback(() => {
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setListening(false);
      return;
    }

    const win = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
    const SpeechRec =
      (win?.SpeechRecognition as (new () => BrowserSpeechRecognitionInstance) | undefined) ||
      (win?.webkitSpeechRecognition as (new () => BrowserSpeechRecognitionInstance) | undefined);

    if (!SpeechRec) {
      onStatusMessage?.(
        'Is browser me direct Voice Mic available nahi hai — Chrome/Android par bol kar type kar sakte hain.'
      );
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'hi-IN';
      rec.interimResults = false;
      rec.continuous = false;

      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          onTranscript(transcript);
        }
      };

      rec.onerror = () => {
        setListening(false);
        onStatusMessage?.(
          'Microphone permission allow karein ya fir se try karein.'
        );
      };

      rec.onend = () => {
        setListening(false);
      };

      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      onStatusMessage?.('Voice input start nahi ho paya.');
    }
  }, [listening, onTranscript, onStatusMessage]);

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={toggleVoiceCapture}
      aria-label={listening ? 'Stop voice capture' : 'Start voice capture'}
      title="Bol kar Brain Dump likhein (Voice Input)"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all whitespace-nowrap shrink-0 border ${
        compact ? 'min-h-[34px] px-2.5 py-1 text-xs' : 'min-h-[38px] px-3 py-1.5 text-xs'
      } ${
        listening
          ? 'bg-rose-600 text-white border-rose-600 animate-pulse shadow-sm'
          : 'bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-700 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-300'
      }`}
    >
      {listening ? (
        <>
          <MicOff className="w-3.5 h-3.5 shrink-0" />
          <span>Sun Raha Hai...</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>Voice</span>
          <Sparkles className="w-2.5 h-2.5 text-teal-500 opacity-75 hidden sm:inline" />
        </>
      )}
    </button>
  );
}
