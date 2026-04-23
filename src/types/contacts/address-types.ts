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

import type { ContactType } from '@/types/contacts/core';

export type ContactAddressType =
  | 'headquarters'
  | 'branch'
  | 'warehouse'
  | 'showroom'
  | 'factory'
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
  headquarters: { scope: ['company', 'service'], primaryFor: ['company', 'service'] },
  branch:       { scope: ['company', 'service'] },
  warehouse:    { scope: ['company', 'service'] },
  showroom:     { scope: ['company', 'service'] },
  factory:      { scope: ['company', 'service'] },
  office:       { scope: ['individual', 'company', 'service'] },
  home:         { scope: ['individual'], primaryFor: ['individual'] },
  vacation:     { scope: ['individual'] },
  other:        { scope: ['individual', 'company', 'service'], allowsCustomLabel: true },
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

/** Default non-primary key for a contact type (`branch` for companies, `office` for individuals). */
export function getDefaultSecondaryAddressType(contactType: ContactType | undefined): ContactAddressType {
  const scope = contactTypeToScope(contactType);
  if (scope === 'individual') return 'office';
  return 'branch';
}

export function isValidContactAddressType(value: unknown): value is ContactAddressType {
  return typeof value === 'string' && (CONTACT_ADDRESS_TYPES as string[]).includes(value);
}
