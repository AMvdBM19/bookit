import type { VerticalId, ClientMode, BookingConfirmMode, TenantConfig, IndustryTemplate } from './tenant-config';

export type { TenantConfig, IndustryTemplate };

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  vertical: VerticalId;
  client_mode: ClientMode;
  kvk_number: string | null;
  license_number: string | null;
  registered_domain: string | null;
  domain_verified: boolean;
  domain_txt_token: string | null;
  subscription_tier: string;
  is_active: boolean;
  wizard_completed: boolean;
  wizard_step: number;
  created_at: string;
}

export interface Agent {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  x?: string;
  website?: string;
}

export interface Staff {
  id: string;
  tenant_id: string;
  real_name: string | null;
  bsn: string | null;
  kvk_number: string | null;
  pseudonym: string;
  age: number | null;
  nationality: string | null;
  gender: string | null;
  languages: string[] | null;
  bio: string | null;
  photo_urls: string[] | null;
  social_links: SocialLinks;
  status: 'active' | 'inactive' | 'offline';
  offline_reason: string | null;
  consent_photo_signed_at: string | null;
  tos_signed_at: string | null;
  btw_exempt: boolean;
  wizard_completed: boolean;
  first_login: boolean;
  created_at: string;
  created_by_agent_id: string | null;
}

export interface Client {
  id: string;
  tenant_id: string;
  real_name: string | null;
  email: string;
  phone: string | null;
  display_name: string;
  status: 'unverified' | 'pending' | 'approved' | 'rejected' | 'suspended';
  status_reason: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  changed_by_agent_id: string | null;
  wa_opt_in: boolean;
  wa_opt_in_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface GuestClient {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  phone: string | null;
  wa_opt_in: boolean;
  booking_count: number;
  last_seen_at: string;
  created_at: string;
}

export interface GuestBlock {
  id: string;
  tenant_id: string;
  email: string | null;
  phone: string | null;
  reason: string | null;
  blocked_by: string | null;
  blocked_at: string;
}

export interface ServiceTag {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  extra_price: number | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface Booking {
  id: string;
  tenant_id: string;
  staff_id: string | null;
  client_id: string | null;
  guest_client_id: string | null;
  booking_source: 'client_request' | 'manual';
  source: 'widget' | 'manual';
  slot_date: string;
  slot_start: string;
  slot_end: string;
  duration_minutes: number;
  location_type: 'incall' | 'outcall' | 'other' | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_notes: string | null;
  booking_notes: string | null;
  base_rate_per_30: number | null;
  tag_extras_total: number;
  total_price: number | null;
  staff_payout: number | null;
  agency_share: number | null;
  deposit_required: boolean;
  deposit_amount: number | null;
  deposit_paid: boolean;
  status: 'pending_staff' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  no_show_revenue_policy: string | null;
  requested_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: 'staff' | 'agent' | 'client' | 'system' | null;
  cancellation_reason: string | null;
  reminder_sent: boolean;
  reminder_sent_at: string | null;
}

export interface TenantSettings {
  tenant_id: string;
  default_slot_minutes: number;
  min_lead_time_hours: number;
  max_booking_days_ahead: number;
  allow_back_to_back: boolean;
  cancellation_window_hours: number;
  booking_confirm_mode: BookingConfirmMode;
  pricing_enabled: boolean;
  base_rate_per_30min: number;
  staff_payout_pct: number;
  agency_share_pct: number;
  currency: string;
  show_price_to_client: boolean;
  no_show_revenue_policy: 'full' | 'partial' | 'zero';
  no_show_partial_pct: number;
  tax_rate_pct: number;
  tax_label: string;
  tax_period: string;
  client_approval_mode: 'auto' | 'manual';
  age_gate_minimum: number;
  require_age_confirm: boolean;
  require_id_upload: boolean;
  require_phone_verify: boolean;
  offline_behaviour: 'auto_approve' | 'require_acknowledgement' | 'blocked';
  reminder_lead_time_minutes: number;
  wa_sender_name: string | null;
  email_sender_name: string | null;
  staff_kpi_visible: boolean;
  notification_log_months: number;
  brand_color: string;
  logo_url: string | null;
  agency_display_name: string | null;
  erp_theme: 'light' | 'dark';
  widget_layout: 'grid' | 'list' | 'minimal';
  widget_primary_color: string;
  widget_accent_color: string;
  widget_bg: 'white' | 'off-white' | 'light-gray' | 'dark';
  widget_logo_url: string | null;
  widget_font_pair: string;
  max_staff: number;
  integrations_enabled: boolean;
  ai_assistant_enabled: boolean;
  ai_provider: 'anthropic' | 'openai' | 'mistral' | null;
  gdpr_retention_years: number;
  updated_at: string;
}

export interface TenantIntegration {
  id: string;
  tenant_id: string;
  integration_type: string;
  api_key: string | null;
  config: Record<string, string> | null;
  is_active: boolean;
  added_by_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentNotification {
  id: string;
  tenant_id: string;
  type: string;
  priority: number;
  linked_entity: string | null;
  linked_id: string | null;
  message: string | null;
  is_read: boolean;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}
