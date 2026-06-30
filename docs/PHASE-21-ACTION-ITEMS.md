# Phase 21 — Action Items for Andres

Items that require manual action (cannot be done by Claude Code).

## HIGHEST PRIORITY

### 1. Supabase backup posture
- [ ] Check if project `wkcczlujvwmgjiwhmraf` has daily backups / PITR enabled
- [ ] If on Free tier: **upgrade to Supabase Pro** — this is a launch blocker
- [ ] Pro plan includes daily backups + PITR (point-in-time recovery to the second)

### 2. Fill Supabase connection string on VPS
- [ ] SSH into VPS: `ssh monoliet-vps`
- [ ] Edit `/opt/scripts/.bookit-backup-env`
- [ ] Replace `YOUR_DB_PASSWORD_HERE` with the actual database password
- [ ] Find it in: Supabase Dashboard → Settings → Database → Connection string (URI)
- [ ] Use the **Direct connection** string, NOT the pooler
- [ ] Test manually: `/opt/scripts/bookit-db-backup.sh`
- [ ] Verify output: `ls -lh /opt/backups/bookit/` and `gunzip -t` on the file

## HIGH PRIORITY

### 3. Create Sentry account + provide DSN
- [ ] Create account at https://sentry.io (or self-hosted)
- [ ] Create a Next.js project
- [ ] Copy the DSN (looks like `https://xxx@yyy.ingest.sentry.io/zzz`)
- [ ] Add to VPS: edit `/opt/docker/bookit/.env.production`
  - `SENTRY_DSN=<your-dsn>`
  - `NEXT_PUBLIC_SENTRY_DSN=<your-dsn>`
- [ ] Test: after deploy, visit `/api/_sentry-test?secret=<SUPER_ADMIN_API_KEY>` — should show error in Sentry dashboard

### 4. Create UptimeRobot/BetterStack monitor
- [ ] Create free account at https://uptimerobot.com or https://betterstack.com
- [ ] Add HTTP(s) monitor: `https://bookit.monoliet.cloud/api/health`
- [ ] Expected: 200 OK with `{ "ok": true, ... }`
- [ ] Set check interval: 5 minutes
- [ ] Set alert contacts (email/Slack/WhatsApp)

### 5. Verify Resend sending domain (SPF/DKIM)
- [ ] In Resend dashboard, check domain `mail.bookit.monoliet.cloud`
- [ ] Ensure SPF and DKIM records are configured in DNS
- [ ] Without this, booking emails may land in spam

## BEFORE FIRST CLIENT

### 6. KvK registration
- [ ] Complete KvK registration for Monoliet/Book-IT
- [ ] Blocks: legal templates, terms & conditions URLs

### 7. Apply Phase 21 migrations
- [ ] Run all new migration files from `supabase/migrations/` in Supabase SQL Editor
- [ ] Files will be named `20260630*` — run them in order
