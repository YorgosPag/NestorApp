'use client';

import { useTranslation } from 'react-i18next';

/**
 * Shared i18n namespaces for contact-form pickers (ADR-601).
 * SSoT for the six-namespace `useTranslation([...])` call repeated by
 * EmployerPicker, EscoOccupationPicker and EscoSkillPicker.
 */
export const CONTACT_PICKER_NAMESPACES = [
  'contacts',
  'contacts-banking',
  'contacts-core',
  'contacts-form',
  'contacts-lifecycle',
  'contacts-relationships',
];

export function useContactPickerTranslation() {
  return useTranslation(CONTACT_PICKER_NAMESPACES);
}
