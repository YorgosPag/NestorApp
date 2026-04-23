/**
 * Contact Address Type Registry (SSoT) — ADR-319
 *
 * Semantic taxonomy for addresses attached to contact records
 * (individual / company / service). Single source of truth for:
 *   - which address-type keys exist
 *   - which contact types may use which keys
 *   - which key is the "primary" (HQ-equivalent) per contact type
 *
 * Separate from `ProjectAddressType` (project-level taxonomy) because a
 * contact's address space ("residence", "vacation home", "factory") is not
 * the same as a project's ("site", "entrance", "delivery"). Overlap is
 * only incidental (both have `other`).
 *
 * Labels live in `src/i18n/locales/{el,en}/addresses.json` under `types.*`.
 */

import type { ContactType } from '@/types/contacts';

export type ContactAddressType =
  // Company-scope semantics
  | 'headquarters'
  | 'branch'
  | 'warehouse'
  | 'showroom'
  | 'factory'
  // Public-service scope (ADR-319 revision 2026-04-23)
  | 'central_service'
  | 'regional_service'
  | 'annex'
  | 'department'
  // Shared
  | 'office'
  | 'home'
  | 'vacation'
  | 'other';

export type ContactAddressScope = 'individual' | 'company' | 'service';

interface ContactAddressTypeMeta {
  /** Contact types allowed to use this address-type key. */
  readonly scope: readonly ContactAddressScope[];
  /**
   * True when this key is the canonical "primary" slot for at least one
   * contact scope (residence for individuals, headquarters for companies).
   * Used to pick a sensible default on new records.
   */
  readonly primaryFor?: readonly ContactAddressScope[];
  /** Free-text custom label allowed (only for `other`). */
  readonly allowsCustomLabel?: boolean;
}

export const CONTACT_ADDRESS_TYPE_METADATA: Record<ContactAddressType, ContactAddressTypeMeta> = {
  // Company only — warehouse/showroom/factory/branch do not apply to public services
  headquarters:            { scope: ['company'], primaryFor: ['company'] },
  branch:                  { scope: ['company'] },
  warehouse:               { scope: ['company'] },
  showroom:                { scope: ['company'] },
  factory:                 { scope: ['company'] },
  // Public-service taxonomy — Greek public administration (Κεντρική/Περιφερειακή
  // Υπηρεσία, Παράρτημα, Τμήμα). ΚΕΠ is itself a public service entity (a
  // contact), not an address-type label for other public services.
  central_service:         { scope: ['service'], primaryFor: ['service'] },
  regional_service:        { scope: ['service'] },
  annex:                   { scope: ['service'] },
  department:              { scope: ['service', 'company'] },
  // Shared
  office:                  { scope: ['individual', 'company', 'service'] },
  home:                    { scope: ['individual'], primaryFor: ['individual'] },
  vacation:                { scope: ['individual'] },
  other:                   { scope: ['individual', 'company', 'service'], allowsCustomLabel: true },
};

export const CONTACT_ADDRESS_TYPES = Object.keys(CONTACT_ADDRESS_TYPE_METADATA) as ContactAddressType[];

function contactTypeToScope(contactType: ContactType | undefined): ContactAddressScope {
  if (contactType === 'company') return 'company';
  if (contactType === 'service') return 'service';
  return 'individual';
}

/** All address-type keys allowed for the given contact type. */
export function getAddressTypesForContact(contactType: ContactType | undefined): ContactAddressType[] {
  const scope = contactTypeToScope(contactType);
  return CONTACT_ADDRESS_TYPES.filter(k => CONTACT_ADDRESS_TYPE_METADATA[k].scope.includes(scope));
}

/** Canonical primary key for a contact type (`headquarters` for companies, `home` for individuals). */
export function getPrimaryAddressType(contactType: ContactType | undefined): ContactAddressType {
  const scope = contactTypeToScope(contactType);
  const primary = CONTACT_ADDRESS_TYPES.find(k => CONTACT_ADDRESS_TYPE_METADATA[k].primaryFor?.includes(scope));
  return primary ?? 'other';
}

/** Default non-primary key for a contact type. */
export function getDefaultSecondaryAddressType(contactType: ContactType | undefined): ContactAddressType {
  const scope = contactTypeToScope(contactType);
  if (scope === 'individual') return 'office';
  if (scope === 'service') return 'regional_service';
  return 'branch';
}

export function isValidContactAddressType(value: unknown): value is ContactAddressType {
  return typeof value === 'string' && (CONTACT_ADDRESS_TYPES as string[]).includes(value);
}
