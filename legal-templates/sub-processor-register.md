# Sub-processor Register — Book-IT

Last updated: [EFFECTIVE_DATE]

This register lists the sub-processors that [PROCESSOR_LEGAL_NAME] ("Book-IT")
engages to process personal data on behalf of its customers (tenants). It
supports the Data Processing Agreement (dpa-en.md / dpa-nl.md). We require each
sub-processor to provide protections consistent with the GDPR.

> Replace any bracketed values and verify regions/entities against the current
> contracts and the providers' own documentation before publishing.

## Active sub-processors

| Sub-processor | Service provided | Data processed | Hosting region | Transfer mechanism |
|---|---|---|---|---|
| **Supabase** (Supabase, Inc. / EU entity) | Managed PostgreSQL database, authentication, and file storage — the core data store | Customer & staff identities, bookings, notes, reference images, payment metadata, auth credentials | EU (eu-central-1, Frankfurt) | Intra-EU; SCCs for any support access |
| **Mollie B.V.** | Online payment processing (deposits, terminal/PIN payments) | Payment amount, status, method, booking reference; cardholder data handled by Mollie (not stored by Book-IT) | EU (Netherlands) | Intra-EU |
| **Twilio Inc.** | WhatsApp message delivery (default provider) | Recipient phone number, message content (booking notifications) | EU/US per configuration | SCCs (EU–US Data Privacy Framework where applicable) |
| **Meta Platforms Ireland Ltd.** (optional) | WhatsApp Business API delivery, when a tenant configures Meta instead of Twilio | Recipient phone number, message content | EU/US | SCCs / DPF |
| **Resend, Inc.** | Transactional email delivery (confirmations, reminders, receipts) | Recipient email, message content | US | SCCs |
| **[VPS_HOSTING_PROVIDER]** | Application hosting (the Book-IT application containers) | Transient request data, application logs | EU ([VPS_REGION]) | Intra-EU |

## Notes

- **Card data:** full card/payment-instrument data is processed by Mollie as a
  PCI-DSS compliant payment provider. Book-IT stores only payment metadata
  (amount, status, method, provider reference).
- **WhatsApp provider:** a tenant uses either Twilio (default) or Meta; only the
  configured provider receives data.
- **Email:** email notifications are only sent when a tenant has configured and
  activated the email integration.

## Changes

We will inform tenants of intended additions or replacements of sub-processors
in accordance with the DPA, giving the opportunity to object. Material updates
to this register are reflected by the "Last updated" date above.

| Date | Change |
|---|---|
| [EFFECTIVE_DATE] | Initial register published. |
