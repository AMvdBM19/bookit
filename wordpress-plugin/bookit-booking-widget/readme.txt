=== Book-IT Booking Widget ===
Contributors: monoliet
Tags: booking, appointments, scheduling, calendar, reservations
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed your Book-IT appointment booking widget anywhere on your WordPress site with a shortcode or block.

== Description ==

Book-IT Booking Widget lets you add your Book-IT online appointment booking page to any WordPress page or post. Your customers book directly on your site — no redirects.

* Simple shortcode: `[bookit slug="your-business"]`
* Gutenberg block: search for "Book-IT Booking Widget"
* Set a site-wide default slug so you don't have to repeat it
* Choose the interface language (English or Dutch)
* Adjustable height
* Responsive — fills the container width and works on mobile

This plugin requires an active Book-IT account. Find your booking slug in your Book-IT dashboard under the Widget tab.

== Installation ==

1. Upload the plugin ZIP via Plugins → Add New → Upload Plugin, or extract it into `/wp-content/plugins/`.
2. Activate the plugin through the Plugins menu.
3. (Optional) Go to Settings → Book-IT Widget and set your default booking slug.
4. Add the shortcode `[bookit slug="your-business"]` to any page or post, or insert the "Book-IT Booking Widget" block.

== Frequently Asked Questions ==

= Where do I find my booking slug? =

Log in to your Book-IT dashboard and open the Widget tab. Your slug is the part after `/book/` in your widget URL.

= Can I change the language? =

Yes. Add `lang="nl"` for Dutch or `lang="en"` for English, e.g. `[bookit slug="your-business" lang="nl"]`. The block has a Language dropdown.

= Can I change the height? =

Yes. Add `height="800"` (pixels), e.g. `[bookit slug="your-business" height="800"]`.

= Does this work in the block editor and classic editor? =

Both. Use the "Book-IT Booking Widget" block in the block editor, or the `[bookit]` shortcode anywhere.

== Screenshots ==

1. The booking widget embedded on a page.
2. The Book-IT Booking Widget block in the editor.
3. The settings page.

== Changelog ==

= 1.0.0 =
* Initial release: shortcode, Gutenberg block, and settings page.
