<?php
/**
 * Plugin Name:       Book-IT Booking Widget
 * Plugin URI:        https://app.bookit.monoliet.cloud
 * Description:        Embed your Book-IT appointment booking widget anywhere on your WordPress site with a shortcode or block.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.2
 * Author:            Monoliet
 * Author URI:        https://monoliet.cloud
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       bookit-booking-widget
 *
 * @package BookIt
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'BOOKIT_WIDGET_VERSION', '1.0.0' );
define( 'BOOKIT_WIDGET_BASE_URL', 'https://app.bookit.monoliet.cloud' );
define( 'BOOKIT_WIDGET_PLUGIN_FILE', __FILE__ );

/**
 * Build the booking widget iframe markup.
 *
 * @param array $args {
 *     @type string $slug   Tenant slug (required).
 *     @type string $lang   Interface language: en|nl. Optional.
 *     @type string $height Iframe height in px. Optional, defaults to 700.
 * }
 * @return string HTML, or an admin-only notice when misconfigured.
 */
function bookit_widget_render( $args ) {
	$slug   = isset( $args['slug'] ) ? sanitize_title( $args['slug'] ) : '';
	$lang   = isset( $args['lang'] ) ? sanitize_key( $args['lang'] ) : '';
	$height = isset( $args['height'] ) ? absint( $args['height'] ) : 0;

	if ( '' === $slug ) {
		$slug = sanitize_title( (string) get_option( 'bookit_widget_default_slug', '' ) );
	}
	if ( '' === $slug ) {
		if ( current_user_can( 'manage_options' ) ) {
			return '<p style="padding:12px;border:1px dashed #d33;color:#d33;">' .
				esc_html__( 'Book-IT: no booking slug set. Add slug="your-slug" to the shortcode, or set a default under Settings → Book-IT Widget.', 'bookit-booking-widget' ) .
				'</p>';
		}
		return '';
	}

	if ( ! in_array( $lang, array( 'en', 'nl' ), true ) ) {
		$lang = '';
	}
	if ( $height < 300 || $height > 3000 ) {
		$height = 700;
	}

	$url = trailingslashit( BOOKIT_WIDGET_BASE_URL ) . 'book/' . rawurlencode( $slug );
	if ( '' !== $lang ) {
		$url = add_query_arg( 'lang', $lang, $url );
	}

	return sprintf(
		'<iframe src="%1$s" width="100%%" height="%2$d" frameborder="0" style="border:none;max-width:100%%;width:100%%;" title="%3$s" loading="lazy"></iframe>',
		esc_url( $url ),
		$height,
		esc_attr__( 'Book an appointment', 'bookit-booking-widget' )
	);
}

/**
 * Shortcode handler: [bookit slug="" lang="" height=""].
 *
 * @param array $atts Shortcode attributes.
 * @return string
 */
function bookit_widget_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'slug'   => '',
			'lang'   => '',
			'height' => '',
		),
		$atts,
		'bookit'
	);

	return bookit_widget_render( $atts );
}
add_shortcode( 'bookit', 'bookit_widget_shortcode' );

/**
 * Register the Gutenberg block (dynamic, server-rendered).
 */
function bookit_widget_register_block() {
	if ( ! function_exists( 'register_block_type' ) ) {
		return;
	}

	wp_register_script(
		'bookit-widget-block',
		plugins_url( 'bookit-block.js', __FILE__ ),
		array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
		BOOKIT_WIDGET_VERSION,
		true
	);

	register_block_type(
		'bookit/booking-widget',
		array(
			'api_version'     => 2,
			'editor_script'   => 'bookit-widget-block',
			'render_callback' => 'bookit_widget_block_render',
			'attributes'      => array(
				'slug'   => array(
					'type'    => 'string',
					'default' => '',
				),
				'lang'   => array(
					'type'    => 'string',
					'default' => '',
				),
				'height' => array(
					'type'    => 'number',
					'default' => 700,
				),
			),
		)
	);
}
add_action( 'init', 'bookit_widget_register_block' );

/**
 * Server-render callback for the block.
 *
 * @param array $attributes Block attributes.
 * @return string
 */
function bookit_widget_block_render( $attributes ) {
	return bookit_widget_render(
		array(
			'slug'   => isset( $attributes['slug'] ) ? $attributes['slug'] : '',
			'lang'   => isset( $attributes['lang'] ) ? $attributes['lang'] : '',
			'height' => isset( $attributes['height'] ) ? $attributes['height'] : '',
		)
	);
}

/* -------------------------------------------------------------------------- */
/* Settings page                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Register the settings page under the Settings menu.
 */
function bookit_widget_admin_menu() {
	add_options_page(
		__( 'Book-IT Widget', 'bookit-booking-widget' ),
		__( 'Book-IT Widget', 'bookit-booking-widget' ),
		'manage_options',
		'bookit-widget',
		'bookit_widget_settings_page'
	);
}
add_action( 'admin_menu', 'bookit_widget_admin_menu' );

/**
 * Register settings.
 */
function bookit_widget_register_settings() {
	register_setting(
		'bookit_widget_settings',
		'bookit_widget_default_slug',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_title',
			'default'           => '',
		)
	);
}
add_action( 'admin_init', 'bookit_widget_register_settings' );

/**
 * Render the settings page.
 */
function bookit_widget_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$slug = (string) get_option( 'bookit_widget_default_slug', '' );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Book-IT Booking Widget', 'bookit-booking-widget' ); ?></h1>
		<p><?php esc_html_e( 'Embed your Book-IT booking widget on any page or post.', 'bookit-booking-widget' ); ?></p>

		<form action="options.php" method="post">
			<?php settings_fields( 'bookit_widget_settings' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">
						<label for="bookit_widget_default_slug"><?php esc_html_e( 'Default booking slug', 'bookit-booking-widget' ); ?></label>
					</th>
					<td>
						<input name="bookit_widget_default_slug" id="bookit_widget_default_slug" type="text"
							value="<?php echo esc_attr( $slug ); ?>" class="regular-text" placeholder="your-business" />
						<p class="description">
							<?php esc_html_e( 'Used when a shortcode or block does not specify its own slug. Find your slug in your Book-IT dashboard.', 'bookit-booking-widget' ); ?>
						</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<hr />
		<h2><?php esc_html_e( 'How to use', 'bookit-booking-widget' ); ?></h2>
		<p><?php esc_html_e( 'Add the shortcode to any page or post:', 'bookit-booking-widget' ); ?></p>
		<p><code>[bookit slug="<?php echo esc_html( $slug ? $slug : 'your-business' ); ?>"]</code></p>
		<p><?php esc_html_e( 'Optional attributes:', 'bookit-booking-widget' ); ?></p>
		<ul style="list-style:disc;margin-left:20px;">
			<li><code>lang="nl"</code> — <?php esc_html_e( 'interface language (en or nl).', 'bookit-booking-widget' ); ?></li>
			<li><code>height="800"</code> — <?php esc_html_e( 'iframe height in pixels (default 700).', 'bookit-booking-widget' ); ?></li>
		</ul>
		<p><?php esc_html_e( 'Or, in the block editor, add the "Book-IT Booking Widget" block.', 'bookit-booking-widget' ); ?></p>
	</div>
	<?php
}

/**
 * Add a Settings link on the Plugins page.
 *
 * @param array $links Existing action links.
 * @return array
 */
function bookit_widget_action_links( $links ) {
	$settings = '<a href="' . esc_url( admin_url( 'options-general.php?page=bookit-widget' ) ) . '">' .
		esc_html__( 'Settings', 'bookit-booking-widget' ) . '</a>';
	array_unshift( $links, $settings );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'bookit_widget_action_links' );
