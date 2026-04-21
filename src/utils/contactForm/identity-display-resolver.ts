/**
 * 🏢 Identity Display Resolver — Code → Human-readable label
 *
 * Centralized resolver used by identity impact dialogs to convert raw
 * stored codes (taxOffice '1101', legalForm 'ae', gemiStatus 'active')
 * into human-readable display strings, via the same SSoT data sources
 * the corresponding form dropdowns consume.
 *
 * Pure: no DOM, no side effects. Accepts a translator callback so it
 * stays unit-testable without i18n provider setup.
 *
 * @module utils/contactForm/identity-display-resolver
 * @enterprise ADR-278 — Company Identity Field Guard (resolver layer)
 */

import { getTaxOfficeDisplayName } from '@/subapps/accounting/data/greek-tax-offices';
import { MODAL_SELECT_LEGAL_FORMS, MODAL_SELECT_GEMI_STATUSES } from '@/subapps/dxf-viewer/config/modal-select/core/options/company';
import type { CompanyIdentityField } from './company-identity-guard';

export type IdentityDisplayTranslator = (key: string) => string;

interface CodeLabelOption {
  readonly value: string;
  readonly label: string;
}

function resolveOptionLabel(
  options: ReadonlyArray<CodeLabelOption>,
  code: string,
  t: IdentityDisplayTranslator,
): string {
  const normalized = code.toLowerCase();
  const option = options.find((o) => o.value.toLowerCase() === normalized);
  if (!option) return code;
  const translated = t(option.label);
  return translated && translated !== option.label ? translated : code;
}

/**
 * Resolve a raw identity-field value to a human-readable display string.
 * Falls back to the raw value when no SSoT mapping exists, so the dialog
 * never loses information even for unknown/custom codes.
 */
export function resolveIdentityDisplay(
  field: CompanyIdentityField,
  value: string,
  t: IdentityDisplayTranslator,
): string {
  if (!value) return value;
  switch (field) {
    case 'taxOffice':
      return getTaxOfficeDisplayName(value);
    case 'legalForm':
      return resolveOptionLabel(MODAL_SELECT_LEGAL_FORMS, value, t);
    case 'gemiStatus':
      return resolveOptionLabel(MODAL_SELECT_GEMI_STATUSES, value, t);
    case 'companyName':
    case 'vatNumber':
    case 'gemiNumber':
    case 'tradeName':
      return value;
  }
}
