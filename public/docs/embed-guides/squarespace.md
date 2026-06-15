# Embedding Book-IT in Squarespace

Squarespace uses a **Code Block** for custom HTML (available on Business plans and above).

## Steps

1. Edit the page where you want the widget.
2. Click an insert point **(+)** and choose **Code**.
3. Set the block type to **HTML** (not Markdown). Make sure **Display Source** is unchecked.
4. Paste:

   ```html
   <iframe src="https://app.bookit.monoliet.cloud/book/YOUR-SLUG"
     width="100%" height="700" frameborder="0"
     style="border:none;max-width:100%" title="Book an appointment"></iframe>
   ```

5. Click **Apply**, then **Save**.

## Add a booking button instead

1. Add a **Button** block.
2. Set its link to `https://app.bookit.monoliet.cloud/book/YOUR-SLUG`.
3. Choose **Open in New Window** if you prefer.

## Notes

- Replace `YOUR-SLUG` with your real slug (Book-IT dashboard → Widget tab).
- The Code Block requires a **Business** plan or higher. On Personal plans, use a
  button/link to your booking URL instead.
- For Dutch: `…/book/YOUR-SLUG?lang=nl`.
