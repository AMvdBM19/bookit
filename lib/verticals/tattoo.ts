import type { VerticalConfig } from './types';

export const tattooConfig: VerticalConfig = {
  id: 'tattoo',
  label: 'Tattoo Studio',
  terminology: {
    staff: 'Artist',
    staff_plural: 'Artists',
    client: 'Client',
    client_plural: 'Clients',
    booking: 'Appointment',
    booking_plural: 'Appointments',
    service: 'Style',
    service_plural: 'Styles',
    booking_notes_label: 'Describe your piece',
    booking_notes_placeholder: 'Describe the tattoo you have in mind — style, size, placement, reference images...',
    operator: 'Studio',
  },
  defaults: {
    client_mode: 'guest',
    booking_confirm_mode: 'staff_must_accept',
    slot_minutes: 60,
    booking_notes_required: true,
    age_gate_minimum: 18,
    require_age_confirm: true,
    pricing_enabled: true,
  },
  wizard: {
    steps: [
      {
        id: 'identity',
        title: 'Studio Identity',
        description: 'Set your studio name and contact details',
      },
      {
        id: 'branding',
        title: 'Branding',
        description: 'Customize colors, logo, and display name',
      },
      {
        id: 'booking_rules',
        title: 'Booking Rules',
        description: 'Set lead time, session length, and approval mode',
      },
      {
        id: 'financial',
        title: 'Financial Setup',
        description: 'Configure session rates, payouts, and deposit rules',
      },
      {
        id: 'services',
        title: 'Styles',
        description: 'Add tattoo styles your studio offers',
      },
      {
        id: 'review',
        title: 'Review & Launch',
        description: 'Review settings and go live',
      },
    ],
  },
  seed_tags: [
    'Traditional',
    'Neo-Traditional',
    'Blackwork',
    'Fine Line',
    'Watercolor',
    'Japanese',
    'Realism',
    'Geometric',
    'Illustrative',
    'Cover-up',
  ],
  deposits_supported: true,
};
