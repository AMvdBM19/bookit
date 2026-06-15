# Embedding Book-IT in Jimdo

Jimdo offers a **Widget / HTML** element for custom code.

## Steps (Jimdo Creator)

1. Edit your page and click where you want the widget.
2. Click **Add Element** and choose **Widget / HTML**.
3. Paste:

   ```html
   <iframe src="https://app.bookit.monoliet.cloud/book/YOUR-SLUG"
     width="100%" height="700" frameborder="0"
     style="border:none;max-width:100%" title="Book an appointment"></iframe>
   ```

4. Click **Save**.

## Steps (Jimdo Dolphin)

Dolphin sites have limited custom-HTML support. If you don't see a Widget/HTML
option:

1. Add a **Button** block.
2. Link it to `https://app.bookit.monoliet.cloud/book/YOUR-SLUG`.

## Notes

- Replace `YOUR-SLUG` with your real slug (Book-IT dashboard → Widget tab).
- For Dutch: `…/book/YOUR-SLUG?lang=nl`.
- If the widget area is too short, raise the `height` value.
