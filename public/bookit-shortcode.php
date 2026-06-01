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

/**
 * Shortcode: [bookit slug="inkhaus"]
 * Optional:  height="800" (default: 700)
 */
function bookit_booking_widget(array $atts): string {
    $atts = shortcode_atts([
        'slug'   => '',
        'height' => '700',
    ], $atts, 'bookit');

    $slug   = sanitize_text_field($atts['slug']);
    $height = absint($atts['height']);

    if (empty($slug)) {
        return '<p><em>Book-IT: missing slug attribute.</em></p>';
    }

    $src = esc_url(BOOKIT_APP_URL . '/book/' . rawurlencode($slug));

    return sprintf(
        '<iframe src="%s" width="100%%" height="%dpx" frameborder="0" scrolling="yes" allow="fullscreen" title="Book-IT Booking Widget" style="border:none;display:block;max-width:100%%"></iframe>',
        $src,
        $height
    );
}
add_shortcode('bookit', 'bookit_booking_widget');
