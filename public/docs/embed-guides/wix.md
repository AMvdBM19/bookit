# Embedding Book-IT in Wix

Wix calls custom HTML an **Embed / HTML iframe** element.

## Steps

1. In the Wix Editor, open the page where you want the widget.
2. Click **Add Elements (+) → Embed Code → Embed HTML** (sometimes shown as *HTML iframe*).
3. An "HTML Settings" panel opens. Choose **Code** and paste:

   ```html
   <iframe src="https://app.bookit.monoliet.cloud/book/YOUR-SLUG"
     width="100%" height="700" frameborder="0"
     style="border:none;max-width:100%" title="Book an appointment"></iframe>
   ```

4. Click **Apply / Update**.
5. Drag the corners of the element to size it on the page — make it tall enough
   (around 700px) so the widget isn't scrollable inside a small box.
6. Click **Publish**.

## Notes

- Replace `YOUR-SLUG` with your real slug (Book-IT dashboard → Widget tab).
- The Wix embed element has its own fixed size; if the widget is cut off,
  enlarge the element *and* raise the iframe `height`.
- For Dutch: `…/book/YOUR-SLUG?lang=nl`.
- Wix free plans show a Wix banner; the booking widget itself is unaffected.
