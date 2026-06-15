# Embedding Book-IT in WordPress

The easiest way is the free **Book-IT Booking Widget** plugin.

## Option A — Plugin (recommended)

1. Download the plugin ZIP from your Book-IT dashboard → **Widget** tab → *Download WordPress plugin*.
2. In WordPress admin, go to **Plugins → Add New → Upload Plugin**.
3. Choose the `.zip` file, click **Install Now**, then **Activate**.
4. (Optional) Go to **Settings → Book-IT Widget** and enter your default booking slug so you don't have to type it every time.
5. Add the widget to any page or post:
   - **Block editor:** add the **Book-IT Booking Widget** block and set the slug in the block sidebar.
   - **Classic editor / anywhere:** use the shortcode

     ```
     [bookit slug="YOUR-SLUG"]
     ```

   Optional attributes: `lang="nl"` (Dutch) and `height="800"` (pixels).

   ```
   [bookit slug="YOUR-SLUG" lang="nl" height="800"]
   ```

## Option B — Iframe (no plugin)

If you'd rather not install a plugin, add a **Custom HTML** block and paste:

```html
<iframe src="https://app.bookit.monoliet.cloud/book/YOUR-SLUG"
  width="100%" height="700" frameborder="0"
  style="border:none;max-width:100%" title="Book an appointment"></iframe>
```

## Troubleshooting

- **Nothing shows up:** make sure you replaced `YOUR-SLUG` with your real slug.
- **Widget is cut off:** increase the `height` value.
- **Shortcode prints as text:** you're in a plain-text field; use a Custom HTML / Shortcode block, or install the plugin.
