// Phase 20-C: tenant-defined custom booking fields.

export type BookingFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'address'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'file';

export interface BookingField {
  id: string;
  field_key: string;
  label: string;
  field_type: BookingFieldType;
  placeholder: string | null;
  help_text: string | null;
  required: boolean;
  /** Choices for radio/checkbox/select (each entry is both value and label). */
  options: string[] | null;
  display_order: number;
  is_active: boolean;
}

/** Field types that require an options list. */
export const OPTION_FIELD_TYPES: BookingFieldType[] = ['radio', 'checkbox', 'select'];

/** Legacy keys mapped to dedicated booking columns (service_address, reference_image_url). */
export const LEGACY_FIELD_KEYS = ['service_address', 'reference_image'] as const;

export const FIELD_TYPE_LABELS: Record<BookingFieldType, string> = {
  text: 'Short text',
  textarea: 'Paragraph',
  date: 'Date',
  address: 'Address',
  radio: 'Single choice (radio)',
  checkbox: 'Multiple choice (checkboxes)',
  select: 'Dropdown',
  file: 'File upload',
};
