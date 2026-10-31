CREATE TABLE IF NOT EXISTS "reminder_sent" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("uid") ON DELETE CASCADE,
  "log_date" text NOT NULL,
  "item_key" text NOT NULL,
  "nudge_no" integer DEFAULT 0 NOT NULL,
  "batch_id" text NOT NULL,
  "sent_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("uid") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_ok_at" timestamp
);

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" text;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "p256dh" text;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "auth" text;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "last_ok_at" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "reminder_sent_user_date_item_nudge_uidx"
  ON "reminder_sent" ("user_id", "log_date", "item_key", "nudge_no");

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_uidx"
  ON "push_subscriptions" ("endpoint");
