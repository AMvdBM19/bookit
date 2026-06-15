# Widget Guide

> The public booking widget at `/book/{slug}`: what clients experience, and
> how the owner customizes and embeds it from the Widget tab.

## What the widget is

A standalone, no-login booking page served at
`https://app.bookit.monoliet.cloud/book/{slug}`. It can be linked directly
or embedded in the tenant's own website. All terminology inside it (staff,
booking, services…) comes from the tenant's template.

## The client experience, step by step

1. **Browse** — grid of active, setup-complete staff with photo, pseudonym
   and service tags. *Skipped* in pool mode (no staff choice) and
   auto-skipped when only one staff member exists.
2. **Date & time** — a month-grid calendar with previous/next month
   navigation, bounded by the minimum lead time (below) and the tenant's
   max booking window (above); out-of-range days are disabled. Tapping a
   date loads free slots. Slot length is the default slot minutes, or the
   summed durations of selected services when per-service duration is on.
3. **Details** — name, email, phone (optional), service selection, notes
   (label, placeholder and required-ness are template-driven), and an age
   confirmation checkbox when the age gate is active. If changing services
   changes the duration, the client is asked to re-pick a time.
4. **Confirm** — summary card; price breakdown when "Show price to client"
   is on; deposit notice when applicable (pricing-guide.md); submit.
5. **Success** — "confirmed" (auto-confirm tenants) or "request submitted,
   you'll hear from us" (staff-must-accept and all pool bookings).

Booking submissions are rate-limited per IP to deter abuse.

## Widget language (English / Dutch)

The widget interface can run in **English** (default) or **Dutch**: Widget
tab → **Language** → English / Nederlands → Save & Apply. This translates
the widget *chrome only* — step labels, buttons, form fields, validation
messages, the success screen, dates ("donderdag 18 juni") and number
formats. **The tenant's own terms appear exactly as typed**: service
names, staff naming, the notes label/placeholder and other terminology are
never machine-translated. Advise owners: *set your terminology in Dutch if
your widget is Dutch* (Templates tab terminology applies platform-wide).
For testing or embeds, `?lang=en|nl` on the widget URL overrides the saved
setting. Notification templates are also written per tenant in whatever
language the owner chooses — they are not auto-translated either.

## The Widget tab (owner dashboard)

Left column = controls, right = a **live preview** iframe of the real
widget. Changes apply to the preview instantly; nothing is public until
**Save & Apply**. A 📱 Mobile / 🖥 Desktop toggle resizes the preview.

### Presets

Eight one-click themes (grid of swatch buttons). Picking one overwrites all
color/shape values; you can then fine-tune.

### Language

**Interface**: English / Nederlands segmented control (see "Widget
language" above). The live preview reloads in the chosen language
immediately; the public widget switches on Save & Apply.

### Colors

- **Background** segmented control: **Dark**, **Light**, or **Custom** (which
  reveals a custom background color picker).
- Pickers (color swatch + hex field) for: **Primary** (buttons, highlights),
  **Accent**, **Surface** (cards), **Text**, **Text muted**, **Border**.

### Shape

- **Corners**: None / SM / MD / LG / XL.
- **Cards**: Bordered / Elevated / Flat.
- **Spacing**: Compact / Normal / Relaxed.

### Branding

- **Show "Powered by Book-IT"** checkbox.
- **Widget logo URL** — overrides the main logo (Settings → Identity) for
  the widget only; falls back to the main logo when blank.

### Actions

- **Save & Apply** — publishes the theme to the live widget immediately.
- **Reset to Default** — restores the default theme in the editor (still
  needs Save & Apply to publish).

### Embed Code

Three tabs with a **Copy to Clipboard** button:

| Tab | Snippet | Notes |
|---|---|---|
| **WordPress** | `[bookit slug="{slug}"]` | Free plugin (download button + steps shown); optional `lang="nl"`, `height="800"` |
| **HTML** | `<iframe src="…/book/{slug}" …>` | Works on any site |
| **Script** | `<div data-bookit-slug="{slug}"></div>` + `embed.js` | Auto-injects the iframe |

The WordPress tab also offers a **Download WordPress plugin (.zip)** button
and install steps. See embed-guide.md for per-platform instructions
(WordPress, Shopify, Wix, Squarespace, Webflow, Jimdo, Google Business,
Facebook/Instagram).

Linking directly to the widget URL (e.g. from an Instagram bio) is equally
valid — no embed needed.

## Technical notes (for grounding)

- Theming is pure CSS variables (`--w-*`) set in the widget layout from
  `tenant_settings.widget_*` columns; the customizer live-preview uses a
  `postMessage` override into the iframe, so preview ≠ published until
  saved.
- The widget layout is force-dynamic — saved theme changes appear on the
  next page load without redeploys.

## Common owner questions

- *"I saved a theme but the embedded widget looks old"* — hard-refresh the
  page embedding it; the iframe caches like any page.
- *"Can I change the widget's wording?"* — labels come from the industry
  template terminology and notes-field flags; wording is not free-form
  editable. Notification templates are editable (notifications-guide.md).
- *"Can clients cancel from the widget?"* — no client self-service
  cancellation exists; clients must contact the business.

## Related APIs (for tool integration)

- `GET /book/{slug}/api/catalog` — public: staff, services, settings needed
  to render.
- `GET /book/{slug}/api/availability?staff_id=&date=` — public slots.
- `GET /book/{slug}/api/pool-availability?date=` — pool mode slots.
- `POST /book/{slug}/api/book` — create booking (rate-limited).
- `PATCH /api/{slug}/settings` — widget_* theme fields (agent).
