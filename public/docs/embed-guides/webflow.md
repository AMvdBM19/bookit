# Embedding Book-IT in Webflow

Webflow has a built-in **Embed** element for custom HTML.

## Steps

1. Open the **Webflow Designer** and the page you want.
2. From the **Add panel (+)**, drag an **Embed** element onto the page where the
   widget should appear.
3. The HTML Embed Code editor opens. Paste:

   ```html
   <iframe src="https://app.bookit.monoliet.cloud/book/YOUR-SLUG"
     width="100%" height="700" frameborder="0"
     style="border:none;max-width:100%" title="Book an appointment"></iframe>
   ```

4. Click **Save & Close**.
5. The embed shows a placeholder in the Designer — it renders for real on the
   **published** site (and in Preview).
6. **Publish** your site.

## Notes

- Replace `YOUR-SLUG` with your real slug (Book-IT dashboard → Widget tab).
- Put the Embed inside a container/section with a set width so it sizes nicely.
- For Dutch: `…/book/YOUR-SLUG?lang=nl`.
- The free Webflow `.webflow.io` staging domain works too; a paid Site plan is
  needed for a custom domain.
