# Embed Guide

> How a business owner puts their booking widget on their own website or
> profile, including the WordPress plugin and the per-platform guides.

## What it is

The booking widget is a public page at
`https://app.bookit.monoliet.cloud/book/{slug}`. Owners embed it on their
existing site (iframe) or link to it (button) so customers book without
leaving their site. Everything an owner needs is in the **Widget** dashboard
tab → **Embed Code** section.

## Embed Code section (Widget tab)

Three tabs of copy-paste snippets:

- **WordPress** — the `[bookit slug="{slug}"]` shortcode, plus a **Download
  WordPress plugin (.zip)** button and three install steps.
- **HTML** — an `<iframe>` snippet (width 100%, height 700) for any site that
  accepts custom HTML.
- **Script** — `<div data-bookit-slug="{slug}"></div>` + `embed.js` for an
  auto-resizing embed.

Optional iframe/shortcode tweaks: `lang="nl"` (Dutch interface) and a taller
`height`. The interface language only changes the widget's own UI strings; the
owner's terminology (services, {staff} naming, notes label) always appears as
typed.

## WordPress plugin

A free plugin, **Book-IT Booking Widget**, packaged at
`dist/bookit-booking-widget.zip` and served for download at
`/downloads/bookit-booking-widget.zip` (the Widget tab links to it).

- Provides the `[bookit slug="" lang="" height=""]` shortcode, a server-rendered
  **Book-IT Booking Widget** Gutenberg block, and a **Settings → Book-IT Widget**
  page for a site-wide default slug.
- Install: WordPress admin → **Plugins → Add New → Upload Plugin** → choose the
  ZIP → **Install Now** → **Activate**.
- If a shortcode/block has no slug and no default is set, logged-in admins see a
  reminder notice; visitors see nothing.

## Per-platform guides

Full step-by-step guides live in `public/docs/embed-guides/` (served at
`/docs/embed-guides/<platform>.md`):

- **WordPress** — plugin (recommended) or iframe.
- **Shopify** — page HTML (`< >` button), Custom Liquid section, or nav link.
- **Wix** — Add Elements → Embed Code → Embed HTML.
- **Squarespace** — Code Block (Business plan+), or a Button link on lower plans.
- **Webflow** — Embed element; renders on the published site.
- **Jimdo** — Widget/HTML element (Creator); button link on Dolphin.
- **Google Business Profile** — no HTML; add the booking URL as the
  Booking/Appointment link (or a post link fallback).
- **Facebook & Instagram** — no HTML; "Book Now" Page button, Instagram action
  button, link in bio, or Story link sticker.

Rule of thumb to advise an owner: if the platform has an "embed HTML / custom
code" block, use the **iframe**; if it doesn't (Google, social profiles), use a
**link/button** to the booking URL.

## Common questions

- *"How do I find my slug?"* — Widget tab; it's the part after `/book/` in the
  widget URL.
- *"The widget is cut off."* — increase the iframe/shortcode `height`.
- *"Can I show it in Dutch?"* — add `?lang=nl` to the URL, or `lang="nl"` to the
  shortcode/block.
- *"Does embedding cost extra or need an account on the other platform?"* — no
  extra Book-IT cost; some site builders gate custom HTML behind paid plans
  (e.g. Squarespace Business), in which case use a button link instead.

## Related APIs (for tool integration)

- `GET /book/{slug}` — the public widget page that gets embedded.
- The plugin and guides are static assets; there is no embed-specific API.
