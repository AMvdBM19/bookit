# Book-IT — Embed Guides

Add your Book-IT booking widget to your website or profile. Pick your platform:

- [WordPress](./wordpress.md)
- [Shopify](./shopify.md)
- [Wix](./wix.md)
- [Squarespace](./squarespace.md)
- [Webflow](./webflow.md)
- [Jimdo](./jimdo.md)
- [Google Business Profile](./google-business-profile.md)
- [Facebook & Instagram](./facebook-instagram.md)

## Your widget URL

Everything below uses your **booking URL**:

```
https://app.bookit.monoliet.cloud/book/YOUR-SLUG
```

Replace `YOUR-SLUG` with your tenant slug. You can find it in your Book-IT dashboard
under the **Widget** tab (it's the part after `/book/`).

## The two embed methods

Most platforms support one of these:

1. **Iframe** — paste an HTML snippet. Works on almost every builder that allows
   "embed HTML" or "custom code" blocks:

   ```html
   <iframe src="https://app.bookit.monoliet.cloud/book/YOUR-SLUG"
     width="100%" height="700" frameborder="0"
     style="border:none;max-width:100%" title="Book an appointment"></iframe>
   ```

2. **Direct link / button** — for platforms that don't allow custom HTML
   (Google Business, social profiles), just link to your booking URL.

Optional query parameter: add `?lang=nl` for a Dutch interface, e.g.
`https://app.bookit.monoliet.cloud/book/YOUR-SLUG?lang=nl`.
