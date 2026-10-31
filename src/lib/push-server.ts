import webpush from 'web-push';
import { and, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { pushSubscriptions } from '@/src/db/schema';
import { shouldCleanupSubscription } from '@/src/lib/logic/tick-logic';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function resolveVapidConfig(
  env: Record<string, string | undefined> = process.env
): VapidConfig | null {
  const publicKey = (
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || env.VAPID_PUBLIC_KEY
  )?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

export interface StoredPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendWebPushToUserSubscriptions(
  uid: string,
  subscriptions: StoredPushSubscription[],
  payload: Record<string, unknown>,
  vapidConfig: VapidConfig
): Promise<{ sent: number; removed: number }> {
  webpush.setVapidDetails(
    vapidConfig.subject,
    vapidConfig.publicKey,
    vapidConfig.privateKey
  );

  let sent = 0;
  let removed = 0;
  const payloadStr = JSON.stringify(payload);

  for (const sub of subscriptions) {
    if (sub.userId !== uid) continue;
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payloadStr,
        {
          urgency: 'high',
          TTL: 3600,
        }
      );

      sent += 1;
      await db
        .update(pushSubscriptions)
        .set({ lastOkAt: new Date() })
        .where(
          and(
            eq(pushSubscriptions.id, sub.id),
            eq(pushSubscriptions.userId, uid)
          )
        );
    } catch (error) {
      const statusCode = (error as { statusCode?: unknown })?.statusCode;
      if (shouldCleanupSubscription(statusCode)) {
        removed += 1;
        await db
          .delete(pushSubscriptions)
          .where(
            and(
              eq(pushSubscriptions.id, sub.id),
              eq(pushSubscriptions.userId, uid)
            )
          );
      } else {
        const errClass =
          error instanceof Error ? error.constructor.name : 'WebPushError';
        console.warn(`[WebPush] Delivery failed (${errClass}).`);
      }
    }
  }

  return { sent, removed };
}
