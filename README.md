# Book-IT ERP

Multi-vertical, multi-tenant appointment management platform.

Built with Next.js 14, Supabase, Tailwind CSS, Twilio WhatsApp.
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

## Phase status

See CLAUDE.md for architecture. See Notion for full spec.
