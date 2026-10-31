# Personal Goal OS (AbhiOS)

Brain-dump-first personal operating system with quality-gated goals, duty-aware daily routines, hydration tracking, and guilt-free reviews.

---

## Database on Cloud SQL + Vercel

This application runs serverless API routes on Vercel backed by **Google Cloud SQL for PostgreSQL** and **Drizzle ORM** (`src/db/schema.ts`, `src/db/index.ts`).

Because Vercel spawns multiple ephemeral serverless instances and uses dynamic egress IP addresses, **never** open your Cloud SQL instance's Authorized Networks to `0.0.0.0/0`, and keep the per-instance `pg.Pool` size capped at `1–2` connections (`SQL_POOL_MAX=2`, `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 10000`).

Instead, use the official **Cloud SQL Node.js Connector** (`@google-cloud/cloud-sql-connector`) in production (`SQL_CONNECTION_MODE=connector`), which establishes mutually authenticated TLS 1.3 connections verified via IAM without requiring static IP allowlists or manual SSL certificate rotation.

### 1. Required Environment Variables (Vercel Production)

Set the following in **Vercel → Project → Settings → Environment Variables**:

| Variable | Value / Description |
| :--- | :--- |
| `SQL_CONNECTION_MODE` | `connector` (uses `@google-cloud/cloud-sql-connector` in production; use `direct` for local dev) |
| `SQL_POOL_MAX` | `2` (max 1–2 connections per serverless instance) |
| `CLOUD_SQL_INSTANCE_CONNECTION_NAME` | `your-gcp-project:your-region:your-instance` (copied from Cloud SQL Overview) |
| `CLOUD_SQL_IP_TYPE` | `PUBLIC` (default; connector encrypts and authenticates over TLS 1.3 via IAM without `0.0.0.0/0` firewall rules) |
| `CLOUD_SQL_AUTH_TYPE` | `PASSWORD` (default) or `IAM` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Single-line JSON key for the dedicated GCP Service Account (mark as **Sensitive/Secret** in Vercel) |
| `SQL_DB_NAME` | Your PostgreSQL database name (e.g., `postgres` or `goalos`) |
| `SQL_USER` | Application DB user (e.g., `app_user`) |
| `SQL_PASSWORD` | Strong password for `SQL_USER` |
| `CRON_SECRET` | Strong random secret (40+ chars) used for `/api/cron/tick` and `/api/health` |

For **Local Development** (`SQL_CONNECTION_MODE=direct`), set `SQL_HOST=127.0.0.1`, `SQL_PORT=5432`, `SQL_SSL=false`, along with `SQL_DB_NAME`, `SQL_USER`, and `SQL_PASSWORD`.

### 2. How to Create the Google Cloud Service Account (`Cloud SQL Client`)

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and select your project.
2. Enable the **Cloud SQL Admin API** (`APIs & Services → Library → Cloud SQL Admin API → Enable`).
3. Go to **IAM & Admin → Service Accounts → + Create Service Account**:
   - **Name**: `vercel-cloudsql-connector`
   - **Role**: Grant **Cloud SQL Client** (`roles/cloudsql.client`) — no broader project roles are needed.
4. Open the created Service Account → **Keys → Add Key → Create new key → JSON**.
5. Copy the downloaded JSON file contents as a single-line string into Vercel's `GOOGLE_APPLICATION_CREDENTIALS_JSON` environment variable, then delete the local JSON file from your computer if not needed.
6. Verify your Cloud SQL instance has a **Public IP** enabled on the instance itself, **with zero (`0`) Authorized Networks** opened to the public internet (the Cloud SQL Connector bypasses IP allowlists securely via IAM + TLS 1.3).

### 3. How to Verify the Connection After Deploy (`/api/health`)

After deploying to Vercel, run the health check endpoint with your `CRON_SECRET`:

```bash
curl -i -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-APP.vercel.app/api/health
```

Expected response:
- HTTP `200 OK` with `{"db":true}` when `SELECT 1` succeeds.
- HTTP `401 Unauthorized` if `Authorization` is missing/invalid or `CRON_SECRET` is unset.
- HTTP `503 Service Unavailable` with `{"db":false}` if the database cannot be reached.

### 4. How to Run Drizzle Migrations Safely Against Cloud SQL

Never expose your database port publicly to run migrations. Use the local **Cloud SQL Auth Proxy** from your workstation:

1. Authenticate locally with Google Cloud:
   ```bash
   gcloud auth application-default login
   ```
2. Start the Cloud SQL Auth Proxy on localhost port `5432`:
   ```bash
   cloud-sql-proxy --address 127.0.0.1 --port 5432 your-gcp-project:your-region:your-instance
   ```
3. In a second terminal, run Drizzle Kit against `127.0.0.1:5432` using admin credentials:
   ```bash
   SQL_CONNECTION_MODE=direct \
   SQL_HOST=127.0.0.1 \
   SQL_PORT=5432 \
   SQL_SSL=false \
   SQL_DB_NAME=postgres \
   SQL_ADMIN_USER=postgres \
   SQL_ADMIN_PASSWORD="YOUR_ADMIN_PASSWORD" \
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```

### 5. How to Take a Manual Backup / Export from Cloud SQL Console

Before schema changes or monthly maintenance, take two backups:

1. **In-App JSON Backup**: Open **Goal OS → Settings → Export JSON Backup** and save the `.json` file in two places (Phone + Google Drive).
2. **Cloud SQL On-Demand Snapshot**:
   - Go to **Google Cloud Console → SQL → [Your Instance] → Backups**.
   - Click **Create Backup**, add a description (e.g., `pre-migration-2026-10-30`), and click **Create**.
3. **Cloud SQL SQL/Dump Export to Cloud Storage**:
   - In **Cloud SQL → [Your Instance] → Overview**, click **Export** in the top bar.
   - Choose **SQL** format, select your private Google Cloud Storage bucket, select the `postgres` / `goalos` database, and click **Export**.

---

## Reminder Scheduler & Web Push Setup

### 1. Generating VAPID Keys & Secrets

Generate your VAPID key pair once on your machine:

```bash
npx web-push generate-vapid-keys
```

Set the following environment variables in Vercel (and `.env.local` for local dev):

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key returned by `generate-vapid-keys` (used by browser `pushManager.subscribe`) |
| `VAPID_PRIVATE_KEY` | Private VAPID key returned by `generate-vapid-keys` (server-only secret) |
| `VAPID_SUBJECT` | Contact URI for push service (e.g. `mailto:abhishekbhardwaj7763@gmail.com`) |
| `CRON_SECRET` | Strong random secret (40+ chars) required in `Authorization: Bearer $CRON_SECRET` for `/api/cron/tick` |
| `DONE_LINK_SECRET` | Strong random secret (40+ chars) used to HMAC-sign notification action tokens (`done`, `water`, `snooze`) |

### 2. Reminder Scheduler (`POST /api/cron/tick` every 5 minutes)

The reminder engine is evaluated by calling:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR-APP.vercel.app/api/cron/tick
```

Per current Vercel Cron documentation, **Vercel Hobby (Free) accounts are strictly limited to once-per-day cron jobs** (with `±59 min` timing variance), and adding a `*/5 * * * *` schedule to `vercel.json` on the Hobby plan causes the deployment to fail with *"Hobby accounts are limited to daily cron jobs"*. Therefore, no `crons` entry is added to `vercel.json` by default.

Choose one of the two scheduling options below:

#### Option 1 (Recommended for Free Tier): Free External Cron Service
Use any free external scheduler (such as [cron-job.org](https://cron-job.org) or Supabase `pg_cron` + `pg_net`) configured to run every 5 minutes (`*/5 * * * *`):
- **Method**: `POST`
- **URL**: `https://YOUR-APP.vercel.app/api/cron/tick`
- **Headers**:
  - `Authorization: Bearer YOUR_CRON_SECRET`
  - `Content-Type: application/json`
- **Timeout**: `20 seconds`

#### Option 2 (Vercel Cron — Pro Plan Only)
If your Vercel project is on the **Pro plan** (which supports per-minute cron intervals), you may trigger `/api/cron/tick` on a `*/5 * * * *` schedule. Note that Vercel Cron sends `GET` requests by default with `Authorization: Bearer $CRON_SECRET`, whereas external schedulers should use `POST /api/cron/tick`.

### 3. Android Reliability Checklist
1. Open the deployed URL in **Android Chrome** and tap **Install App / Add to Home Screen**.
2. In **Goal OS → Settings → Reminders**, tap **Enable Notifications** and then **Test Notification**.
3. On your phone, go to **Android Settings → Apps → Chrome (and Goal OS) → Battery** and select **Unrestricted** so Android Doze mode does not delay background Web Push delivery.

