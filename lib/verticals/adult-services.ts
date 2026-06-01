import type { VerticalConfig } from './types';

export const adultServicesConfig: VerticalConfig = {
  id: 'adult_services',
  label: 'Adult Services',
  terminology: {
    staff: 'Worker',
    staff_plural: 'Workers',
    client: 'Client',
    client_plural: 'Clients',
    booking: 'Booking',
    booking_plural: 'Bookings',
    service: 'Service',
    service_plural: 'Services',
    booking_notes_label: 'Notes',
    booking_notes_placeholder: 'Any special requests or notes...',
    operator: 'Agency',
  },
  defaults: {
    client_mode: 'account',
    booking_confirm_mode: 'staff_must_accept',
    slot_minutes: 30,
    booking_notes_required: false,
    age_gate_minimum: 21,
    require_age_confirm: true,
    pricing_enabled: true,
  },
  wizard: {
    steps: [
      {
        id: 'identity',
        title: 'Agency Identity',
        description: 'Set your agency name, license, and contact details',
      },
      {
        id: 'branding',
        title: 'Branding',
        description: 'Customize colors, logo, and display name',
      },
      {
        id: 'booking_rules',
        title: 'Booking Rules',
        description: 'Set lead time, slot length, and approval mode',
      },
      {
        id: 'financial',
        title: 'Financial Setup',
        description: 'Configure pricing, payouts, and tax settings',
      },
      {
        id: 'client_approval',
        title: 'Client Approval',
        description: 'Set age gate and identity verification requirements',
      },
      {
        id: 'services',
        title: 'Services',
        description: 'Add your service tags and pricing extras',
      },
      {
        id: 'review',
        title: 'Review & Launch',
        description: 'Review settings and go live',
      },
    ],
  },
  seed_tags: ['GFE', 'Massage', 'Duo', 'Dinner Date', 'Overnight'],
  deposits_supported: false,
};
