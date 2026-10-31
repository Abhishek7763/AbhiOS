CREATE TABLE IF NOT EXISTS "ai_usage" (
  "user_id" text NOT NULL REFERENCES "public"."users"("uid") ON DELETE cascade,
  "day" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "ai_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
