// Widget interface translations (Phase 16-C). No i18n library: a typed
// dictionary + tiny context. Scope is the public widget chrome ONLY —
// tenant-authored text (terminology, notes label/placeholder, service
// names, bios) is interpolated as-is and never machine-translated.
//
// The `en` strings must stay byte-identical to the pre-i18n hardcoded
// widget text: 'en' is the default for every existing tenant.
//
// IMPORTANT: this module is intentionally NOT 'use client'. The widget
// page (a Server Component) imports isWidgetLanguage from here; if this
// file were a client module, Next would turn these exports into client
// references and calling them during SSR throws "is not a function" (the
// public widget 500'd platform-wide — Phase 17 fix). The React context,
// provider and hook live in widget-i18n-context.tsx ('use client').

export type WidgetLanguage = 'en' | 'nl';

export const WIDGET_LANGUAGES: WidgetLanguage[] = ['en', 'nl'];

export interface WidgetStrings {
  /** BCP-47 locale for Intl date/number formatting. */
  locale: string;
  /** Monday-first weekday column headers for the month grid. */
  weekdaysShort: [string, string, string, string, string, string, string];

  // Header / chrome
  bookA: (bookingLower: string) => string;
  poweredBy: string;

  // Buttons / navigation
  back: string;
  continue_: string;
  review: string;
  bookAnother: string;
  chooseNewTime: string;

  // Staff browse
  noStaffAvailable: (staffPluralLower: string) => string;
  speaks: string;

  // Date & time
  chooseDate: string;
  chooseTime: string;
  selectDateHint: string;
  availabilityError: string;
  noAvailability: string;
  prevMonth: string;
  nextMonth: string;

  // Details form
  whatWouldYouLike: string;
  subtotal: string;
  each: string;
  increase: string;
  decrease: string;
  accountRequiredTitle: string;
  accountRequiredBefore: string;
  accountRequiredLogin: string;
  accountRequiredAfter: string;
  yourName: string;
  fullNamePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  phone: string;
  optionalSuffix: string;
  phonePlaceholder: string;
  waOptIn: string;
  ageConfirm: (minAge: number) => string;
  referenceImage: string;
  referenceImageRemove: string;
  referenceImageUpload: string;
  referenceImageUploading: string;
  referenceImageHint: string;
  referenceImageTypeError: string;
  referenceImageSizeError: string;
  referenceImageUploadError: string;
  fileAttached: string;
  serviceAddress: string;
  serviceAddressPlaceholder: string;

  // Validation / submit errors
  selectTimeSlot: string;
  accountModeError: string;
  nameRequired: string;
  emailRequired: string;
  emailInvalid: string;
  notesRequired: (notesLabel: string) => string;
  ageConfirmError: (minAge: number) => string;
  addressRequired: string;
  fieldRequired: (fieldLabel: string) => string;
  durationChangedShort: string;
  durationChangedTo: (minutes: number) => string;
  bookingFailed: string;
  networkError: string;

  // Confirm step
  with_: string;
  date: string;
  time: string;
  services: string;
  notes: string;
  toBeAssigned: string;
  total: string;
  depositRequiredLine: (pct: number) => string;
  depositNotice: (amount: string, pct: number) => string;
  submitting: string;
  submitBooking: string;
  trustLine: string;

  // Success step
  successConfirmedHeadline: (bookingLower: string) => string;
  successPendingHeadline: string;
  successConfirmedSub: string;
  successPendingSub: (staffName: string) => string;
  ref: string;
  depositPayButton: (amount: string) => string;
  depositPayDescription: string;
}

const en: WidgetStrings = {
  locale: 'en-GB',
  weekdaysShort: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],

  bookA: b => `Book a ${b}`,
  poweredBy: 'Powered by Book-IT',

  back: 'Back',
  continue_: 'Continue',
  review: 'Review',
  bookAnother: 'Book another',
  chooseNewTime: 'Choose a new time',

  noStaffAvailable: p => `No ${p} are currently available. Please check back later.`,
  speaks: 'Speaks: ',

  chooseDate: 'Choose a date',
  chooseTime: 'Choose a time',
  selectDateHint: 'Select a date to see available times',
  availabilityError: 'Failed to load availability. Please try again.',
  noAvailability: 'No availability on this date. Try another day.',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',

  whatWouldYouLike: 'What would you like?',
  subtotal: 'Subtotal',
  each: 'each',
  increase: 'Increase quantity',
  decrease: 'Decrease quantity',
  accountRequiredTitle: 'Account required',
  accountRequiredBefore: 'This business requires an account to book. Please',
  accountRequiredLogin: 'log in',
  accountRequiredAfter: 'or contact the business directly.',
  yourName: 'Your name',
  fullNamePlaceholder: 'Full name',
  email: 'Email',
  emailPlaceholder: 'you@example.com',
  phone: 'Phone',
  optionalSuffix: '(optional)',
  phonePlaceholder: '+31...',
  waOptIn: "I'd like to receive WhatsApp updates about my booking.",
  ageConfirm: n => `I confirm I am at least ${n} years old.`,
  referenceImage: 'Reference image',
  referenceImageRemove: 'Remove',
  referenceImageUpload: 'Upload a file',
  referenceImageUploading: 'Uploading…',
  referenceImageHint: 'Show us what you have in mind. JPEG, PNG or WebP, max 5 MB.',
  referenceImageTypeError: 'Allowed file types: JPEG, PNG, WebP, PDF, DOC or DOCX.',
  referenceImageSizeError: 'File must be 5 MB or smaller.',
  referenceImageUploadError: 'Upload failed. Please try again.',
  fileAttached: 'File attached',
  serviceAddress: 'Service address',
  serviceAddressPlaceholder: 'Street, number, city',

  selectTimeSlot: 'Please select a time slot.',
  accountModeError: 'Account mode requires login.',
  nameRequired: 'Name is required.',
  emailRequired: 'Email is required.',
  emailInvalid: 'Enter a valid email.',
  notesRequired: l => `${l} is required.`,
  ageConfirmError: n => `Please confirm you are at least ${n} years old.`,
  addressRequired: 'Service address is required.',
  fieldRequired: l => `${l} is required.`,
  durationChangedShort:
    'Your selected services changed the appointment duration — please pick a new time slot.',
  durationChangedTo: m =>
    `Your selected services changed the appointment duration to ${m} minutes. Please pick a new time slot.`,
  bookingFailed: 'Failed to book.',
  networkError: 'Network error. Please try again.',

  with_: 'With',
  date: 'Date',
  time: 'Time',
  services: 'Services',
  notes: 'Notes',
  toBeAssigned: 'To be assigned',
  total: 'Total',
  depositRequiredLine: pct => `Deposit required (${pct}%)`,
  depositNotice: (amount, pct) =>
    `A deposit of ${amount} (${pct}%) is required to confirm this booking. Payment link will be sent after confirmation.`,
  submitting: 'Submitting…',
  submitBooking: 'Submit Booking',
  trustLine: 'Your details are not stored without your consent.',

  successConfirmedHeadline: b => `Your ${b} is confirmed!`,
  successPendingHeadline: 'Request submitted',
  successConfirmedSub: 'Booking confirmed!',
  successPendingSub: s => `${s} will review and confirm shortly.`,
  ref: 'Ref:',
  depositPayButton: amount => `Pay deposit (${amount})`,
  depositPayDescription: 'A deposit is required to secure your booking.',
};

// Natural informal-professional Dutch ("je/jouw" register).
const nl: WidgetStrings = {
  locale: 'nl-NL',
  weekdaysShort: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'],

  bookA: b => `Boek een ${b}`,
  poweredBy: 'Mogelijk gemaakt door Book-IT',

  back: 'Terug',
  continue_: 'Verder',
  review: 'Controleren',
  bookAnother: 'Nog een boeking maken',
  chooseNewTime: 'Kies een nieuwe tijd',

  noStaffAvailable: p => `Er zijn momenteel geen ${p} beschikbaar. Probeer het later nog eens.`,
  speaks: 'Spreekt: ',

  chooseDate: 'Kies een datum',
  chooseTime: 'Kies een tijd',
  selectDateHint: 'Selecteer een datum om beschikbare tijden te zien',
  availabilityError: 'Beschikbaarheid laden is niet gelukt. Probeer het opnieuw.',
  noAvailability: 'Geen beschikbaarheid op deze datum. Probeer een andere dag.',
  prevMonth: 'Vorige maand',
  nextMonth: 'Volgende maand',

  whatWouldYouLike: 'Wat wil je laten doen?',
  subtotal: 'Subtotaal',
  each: 'per stuk',
  increase: 'Aantal verhogen',
  decrease: 'Aantal verlagen',
  accountRequiredTitle: 'Account vereist',
  accountRequiredBefore: 'Voor een boeking bij dit bedrijf heb je een account nodig.',
  accountRequiredLogin: 'Log in',
  accountRequiredAfter: 'of neem direct contact op met het bedrijf.',
  yourName: 'Je naam',
  fullNamePlaceholder: 'Voor- en achternaam',
  email: 'E-mailadres',
  emailPlaceholder: 'jij@voorbeeld.nl',
  phone: 'Telefoonnummer',
  optionalSuffix: '(optioneel)',
  phonePlaceholder: '+31...',
  waOptIn: 'Ik ontvang graag WhatsApp-updates over mijn boeking.',
  ageConfirm: n => `Ik bevestig dat ik minimaal ${n} jaar oud ben.`,
  referenceImage: 'Voorbeeldfoto',
  referenceImageRemove: 'Verwijderen',
  referenceImageUpload: 'Bestand uploaden',
  referenceImageUploading: 'Uploaden…',
  referenceImageHint: 'Laat zien wat je in gedachten hebt. JPEG, PNG of WebP, max. 5 MB.',
  referenceImageTypeError: 'Toegestane bestandstypen: JPEG, PNG, WebP, PDF, DOC of DOCX.',
  referenceImageSizeError: 'Het bestand mag maximaal 5 MB zijn.',
  referenceImageUploadError: 'Uploaden is niet gelukt. Probeer het opnieuw.',
  fileAttached: 'Bestand toegevoegd',
  serviceAddress: 'Adres voor de afspraak',
  serviceAddressPlaceholder: 'Straat, huisnummer, plaats',

  selectTimeSlot: 'Kies eerst een tijdslot.',
  accountModeError: 'Hiervoor moet je ingelogd zijn.',
  nameRequired: 'Vul je naam in.',
  emailRequired: 'Vul je e-mailadres in.',
  emailInvalid: 'Vul een geldig e-mailadres in.',
  notesRequired: l => `${l} is verplicht.`,
  ageConfirmError: n => `Bevestig dat je minimaal ${n} jaar oud bent.`,
  addressRequired: 'Vul het adres voor de afspraak in.',
  fieldRequired: l => `${l} is verplicht.`,
  durationChangedShort:
    'Door je gekozen services is de duur van de afspraak veranderd — kies een nieuw tijdslot.',
  durationChangedTo: m =>
    `Door je gekozen services duurt de afspraak nu ${m} minuten. Kies een nieuw tijdslot.`,
  bookingFailed: 'Boeken is niet gelukt.',
  networkError: 'Netwerkfout. Probeer het opnieuw.',

  with_: 'Bij',
  date: 'Datum',
  time: 'Tijd',
  services: 'Services',
  notes: 'Opmerkingen',
  toBeAssigned: 'Wordt nog toegewezen',
  total: 'Totaal',
  depositRequiredLine: pct => `Aanbetaling vereist (${pct}%)`,
  depositNotice: (amount, pct) =>
    `Om deze boeking te bevestigen is een aanbetaling van ${amount} (${pct}%) vereist. Je ontvangt een betaallink na de bevestiging.`,
  submitting: 'Versturen…',
  submitBooking: 'Boeking versturen',
  trustLine: 'Je gegevens worden niet opgeslagen zonder je toestemming.',

  successConfirmedHeadline: b => `Je ${b} is bevestigd!`,
  successPendingHeadline: 'Aanvraag verstuurd',
  successConfirmedSub: 'Boeking bevestigd!',
  successPendingSub: s => `${s} bekijkt je aanvraag en bevestigt deze binnenkort.`,
  ref: 'Ref:',
  depositPayButton: amount => `Aanbetaling doen (${amount})`,
  depositPayDescription: 'Een aanbetaling is nodig om je boeking vast te leggen.',
};

const DICTIONARIES: Record<WidgetLanguage, WidgetStrings> = { en, nl };

export function isWidgetLanguage(value: unknown): value is WidgetLanguage {
  return value === 'en' || value === 'nl';
}

export function getWidgetStrings(lang: WidgetLanguage): WidgetStrings {
  return DICTIONARIES[lang] ?? en;
}

/**
 * Money display for the widget. 'en' keeps the historical symbol+toFixed
 * rendering (byte-identical default); 'nl' formats via Intl (e.g. "€ 12,50").
 */
const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

export function formatWidgetMoney(
  amount: number,
  currency: string,
  strings: WidgetStrings
): string {
  if (strings.locale === 'en-GB') {
    const sym = CURRENCY_SYMBOLS[currency] ?? currency;
    return `${sym}${amount.toFixed(2)}`;
  }
  try {
    return new Intl.NumberFormat(strings.locale, {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
  } catch {
    const sym = CURRENCY_SYMBOLS[currency] ?? currency;
    return `${sym}${amount.toFixed(2)}`;
  }
}
