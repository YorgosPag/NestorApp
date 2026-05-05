import type { ResolvedAddressFields } from '../types';

export const FIELD_LABEL_I18N_KEY: Record<keyof ResolvedAddressFields, string> = {
  street: 'form.street',
  number: 'form.number',
  postalCode: 'form.postalCode',
  neighborhood: 'form.neighborhood',
  city: 'form.city',
  county: 'editor.fields.county',
  region: 'form.region',
  country: 'form.country',
};
