<?php
/**
 * Plugin Name: Book-IT Booking Widget
 * Plugin URI:  https://monoliet.cloud
 * Description: Embeds the Book-IT booking widget on any page via shortcode.
 * Version:     1.0.0
 * Author:      Monoliet.cloud
 */

if (!defined('ABSPATH')) exit;

// Change this to your Book-IT app URL
define('BOOKIT_APP_URL', 'https://bookit.monoliet.cloud');
define('BOOKIT_PLUGIN_VERSION', '1.0.0');

/**
 * Shortcode: [bookit slug="inkhaus"]
 * Optional:  height="800" (default: 700)
 *            color="primary" (default: '')
 *            max_booking_days_ahead="30" (optional)
 */
function bookit_booking_widget(array $atts): string {
    $atts = shortcode_atts([
        'slug'                   => '',
        'height'                 => '700',
        'color'                  => '',
        'max_booking_days_ahead' => '',
    ], $atts, 'bookit');

    $slug   = sanitize_text_field($atts['slug']);
    $height = absint($atts['height']);
    $color  = sanitize_text_field($atts['color']);
    $days   = absint($atts['max_booking_days_ahead']);

    if (empty($slug)) {
        return '<p><em>Book-IT: missing slug attribute.</em></p>';
    }

    $src = esc_url(BOOKIT_APP_URL . '/book/' . rawurlencode($slug));
    $src = add_query_arg('v', BOOKIT_PLUGIN_VERSION, $src);
    if (!empty($color)) {
        $src = add_query_arg('color', rawurlencode($color), $src);
    }
    if ($days > 0) {
        $src = add_query_arg('days', $days, $src);
    }

    return sprintf(
        '<iframe src="%s" width="100%%" height="%dpx" frameborder="0" scrolling="yes" allow="fullscreen" loading="lazy" title="Book-IT Booking Widget" style="border:none;display:block;max-width:100%%"></iframe>',
        $src,
        $height
    );
}
add_shortcode('bookit', 'bookit_booking_widget');

function bookit_autoresize_listener(): void {
    ?>
    <script>
    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'bookit:resize') {
            document.querySelectorAll('iframe[src*="bookit"]').forEach(function(iframe) {
                iframe.style.height = Math.min(e.data.height + 32, 900) + 'px';
            });
        }
    });
    </script>
    <?php
}
add_action('wp_footer', 'bookit_autoresize_listener');
