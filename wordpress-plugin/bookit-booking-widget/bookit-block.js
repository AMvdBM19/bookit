( function ( blocks, element, blockEditor, components, i18n ) {
	'use strict';

	var el = element.createElement;
	var __ = i18n.__;
	var Fragment = element.Fragment;
	var InspectorControls = blockEditor.InspectorControls;
	var useBlockProps = blockEditor.useBlockProps;
	var PanelBody = components.PanelBody;
	var TextControl = components.TextControl;
	var SelectControl = components.SelectControl;
	var Placeholder = components.Placeholder;

	blocks.registerBlockType( 'bookit/booking-widget', {
		title: __( 'Book-IT Booking Widget', 'bookit-booking-widget' ),
		description: __( 'Embed your Book-IT appointment booking widget.', 'bookit-booking-widget' ),
		icon: 'calendar-alt',
		category: 'embed',
		keywords: [ __( 'booking', 'bookit-booking-widget' ), __( 'appointment', 'bookit-booking-widget' ), 'bookit' ],
		attributes: {
			slug: { type: 'string', default: '' },
			lang: { type: 'string', default: '' },
			height: { type: 'number', default: 700 }
		},

		edit: function ( props ) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;
			var blockProps = useBlockProps();

			var controls = el(
				InspectorControls,
				{},
				el(
					PanelBody,
					{ title: __( 'Widget settings', 'bookit-booking-widget' ), initialOpen: true },
					el( TextControl, {
						label: __( 'Booking slug', 'bookit-booking-widget' ),
						help: __( 'Leave blank to use the site default set under Settings → Book-IT Widget.', 'bookit-booking-widget' ),
						value: attributes.slug,
						onChange: function ( value ) {
							setAttributes( { slug: value } );
						}
					} ),
					el( SelectControl, {
						label: __( 'Language', 'bookit-booking-widget' ),
						value: attributes.lang,
						options: [
							{ label: __( 'Default', 'bookit-booking-widget' ), value: '' },
							{ label: 'English', value: 'en' },
							{ label: 'Nederlands', value: 'nl' }
						],
						onChange: function ( value ) {
							setAttributes( { lang: value } );
						}
					} ),
					el( TextControl, {
						label: __( 'Height (px)', 'bookit-booking-widget' ),
						type: 'number',
						value: attributes.height,
						onChange: function ( value ) {
							setAttributes( { height: parseInt( value, 10 ) || 700 } );
						}
					} )
				)
			);

			var preview = el(
				Placeholder,
				{
					icon: 'calendar-alt',
					label: __( 'Book-IT Booking Widget', 'bookit-booking-widget' ),
					instructions: attributes.slug
						? __( 'Booking widget for: ', 'bookit-booking-widget' ) + attributes.slug
						: __( 'Set a booking slug in the block settings (or a site default).', 'bookit-booking-widget' )
				}
			);

			return el( Fragment, {}, controls, el( 'div', blockProps, preview ) );
		},

		// Dynamic block — rendered server-side by render_callback.
		save: function () {
			return null;
		}
	} );
} )(
	window.wp.blocks,
	window.wp.element,
	window.wp.blockEditor,
	window.wp.components,
	window.wp.i18n
);
