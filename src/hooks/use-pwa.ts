'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type PushReminderStatus =
  | 'unsupported'
  | 'denied'
  | 'enabled'
  | 'disabled';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration skipped:', err);
      });
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    queueMicrotask(() => {
      setIsInstalled(isStandalone);
      setIsIOS(isIOSDevice);
    });

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export function usePushReminders(user: User | null) {
  const [status, setStatus] = useState<PushReminderStatus>('disabled');
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    if (Notification.permission !== 'granted') {
      setStatus('disabled');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'enabled' : 'disabled');
    } catch {
      setStatus('disabled');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshStatus();
    });
  }, [refreshStatus]);

  const enablePush = useCallback(async (): Promise<{
    ok: boolean;
    reason?: 'unsupported' | 'denied' | 'no_user' | 'no_vapid' | 'failed';
  }> => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('unsupported');
      return { ok: false, reason: 'unsupported' };
    }

    if (!user) {
      return { ok: false, reason: 'no_user' };
    }

    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || '';
    if (!vapidPublicKey) {
      return { ok: false, reason: 'no_vapid' };
    }

    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'disabled');
        return { ok: false, reason: perm === 'denied' ? 'denied' : 'failed' };
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as unknown as BufferSource,
      });

      const subJson = subscription.toJSON();
      const token = await user.getIdToken();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        return { ok: false, reason: 'failed' };
      }

      setStatus('enabled');
      return { ok: true };
    } catch {
      return { ok: false, reason: 'failed' };
    } finally {
      setBusy(false);
    }
  }, [user]);

  const disablePush = useCallback(async (): Promise<{ ok: boolean }> => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setStatus('unsupported');
      return { ok: false };
    }

    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        if (user) {
          const token = await user.getIdToken();
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
            }),
          });
        }
        await subscription.unsubscribe();
      }
      setStatus('disabled');
      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, [user]);

  const sendTestPush = useCallback(async (): Promise<{ ok: boolean }> => {
    if (!user) return { ok: false };
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, [user]);

  return {
    status,
    busy,
    enablePush,
    disablePush,
    sendTestPush,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    );

    // Check registration status
    navigator.serviceWorker.ready
      .then((registration) => {
        // If a waiting worker already exists
        if (registration.waiting) {
          waitingWorkerRef.current = registration.waiting;
          queueMicrotask(() => setUpdateAvailable(true));
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              waitingWorkerRef.current = newWorker;
              queueMicrotask(() => setUpdateAvailable(true));
            }
          });
        });
      })
      .catch(() => {
        // Service worker ready failed or unsupported
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }, []);

  return {
    updateAvailable,
    applyUpdate,
  };
}

export function usePWA() {
  const installState = usePWAInstall();
  const isOnline = useOnlineStatus();
  const updateState = useServiceWorkerUpdate();
  return {
    ...installState,
    isOnline,
    ...updateState,
  };
}

