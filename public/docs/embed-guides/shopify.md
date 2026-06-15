# Embedding Book-IT in Shopify

You can add the booking widget to a page or to your theme.

## Add to a page

1. In Shopify admin, go to **Online Store → Pages**.
2. Open an existing page or click **Add page** (e.g. "Book an appointment").
3. In the content editor, click the **`< >` (Show HTML)** button in the toolbar.
4. Paste:

   ```html
   <iframe src="https://app.bookit.monoliet.cloud/book/YOUR-SLUG"
     width="100%" height="700" frameborder="0"
     style="border:none;max-width:100%" title="Book an appointment"></iframe>
   ```

5. Click **Save**, then **View page** to check it.

## Add to your theme (a section anywhere)

1. Go to **Online Store → Themes → Customize**.
2. Add a **Custom Liquid** section (most themes) or block.
3. Paste the same iframe snippet above into the Custom Liquid box.
4. Save.

## Add a booking button to the navigation

1. **Online Store → Navigation**, edit your main menu.
2. Add a menu item linking to the page you created, or directly to
   `https://app.bookit.monoliet.cloud/book/YOUR-SLUG`.

## Notes

- Replace `YOUR-SLUG` with your real slug (Book-IT dashboard → Widget tab).
- For a Dutch interface, use `…/book/YOUR-SLUG?lang=nl`.
- If the widget looks short, increase `height`.
