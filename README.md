# Book-IT ERP

Multi-vertical, multi-tenant appointment management platform.

Built with Next.js 14, Supabase, Tailwind CSS, Twilio/Meta WhatsApp.
Developed by Monoliet.cloud.

## Development

```bash
cp .env.example .env
# Fill in Supabase + Twilio credentials
npm install
npm run dev
```

## Deploy (VPS)

```bash
docker compose up -d --build
```

## Tenant access

Navigate to /{slug} (e.g. /inkhaus, /velours-demo).
Agent login required. Demo password: Test1234!

## WordPress integration

The public booking widget at `/book/{slug}` is iframe-embeddable. Two integration
options ship in the `public/` directory:

**1. WordPress shortcode plugin (`public/bookit-shortcode.php`)**

Upload to `wp-content/plugins/bookit-widget/` and activate. Use in any page or
post with:

```
[bookit slug="inkhaus"]
[bookit slug="inkhaus" height="800" color="brand"]
[bookit slug="inkhaus" max_booking_days_ahead="60"]
```

The plugin auto-resizes the iframe to fit the widget's reported content height
via `postMessage`.

**2. Universal embed script (`public/embed.js`)**

For non-WordPress sites, drop a container and include the script:

```html
<div data-bookit-slug="inkhaus" data-bookit-height="700"></div>
<script src="https://bookit.monoliet.cloud/embed.js" defer></script>
```

Multiple containers on a single page are supported. The script registers its
resize listener once at init to avoid duplicate handlers on SPA navigation.

## Production checklist

**Required environment variables** (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-side auth)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only; bypasses RLS)
- `SUPER_ADMIN_API_KEY` — Bearer token for `/api/super-admin/*` and `/super-admin` console
- `NEXT_PUBLIC_APP_URL` — canonical app URL (used by the widget iframe wrapper)

**Optional — WhatsApp (one provider per tenant via `tenant_integrations`):**

- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- Meta: `META_WA_ACCESS_TOKEN`, `META_WA_PHONE_NUMBER_ID`

**Cron jobs** — the reminder cron boots from `instrumentation.ts` only when
`NODE_ENV === 'production'` OR `ENABLE_CRON=true`. Set `ENABLE_CRON=true` in
your production env file to ensure reminders fire even if `NODE_ENV` is
otherwise set.

**Rate limiting** — `POST /book/[slug]/api/book` is IP rate-limited (10
requests/minute) using in-process memory. This assumes a single Docker
container per host; do not horizontally scale without a shared store.

## Phase status

See `CLAUDE.md` for architecture, key paths, and the full phase tracker (1–9
complete). See Notion for the full spec.
