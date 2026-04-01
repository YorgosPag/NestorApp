/**
 * 📍 Address Impact Helpers — HQ address change detection
 *
 * Extracted from useContactSubmission to comply with 500-line hook limit.
 *
 * @module utils/contactForm/address-impact-helpers
 * @enterprise ADR-277 — Address Impact Guard
 */

import type { Contact } from '@/types/contacts';

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyAddressSnapshot {
  street: string;
  number: string;
  postalCode: string;
  city: string;
  settlementId?: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Extract HQ address from contact for comparison */
export function extractHeadquartersAddress(contact: Contact): CompanyAddressSnapshot | null {
  const addresses = (contact.customFields as Record<string, unknown> | undefined)
    ?.companyAddresses as Array<{
      type: string;
      street: string;
      number: string;
      postalCode: string;
      city: string;
      settlementId?: string | null;
    }> | undefined;

  if (!addresses?.length) {
    const addr = contact.addresses?.[0];
    if (!addr) return null;
    return {
      street: addr.street || '',
      number: addr.number || '',
      postalCode: addr.postalCode || '',
      city: addr.city || '',
    };
  }

  const hq = addresses.find(a => a.type === 'headquarters') ?? addresses[0];
  return {
    street: hq.street || '',
    number: hq.number || '',
    postalCode: hq.postalCode || '',
    city: hq.city || '',
    settlementId: hq.settlementId,
  };
}

/** Check if HQ address fields have changed */
export function hasHQAddressChanged(
  oldAddr: CompanyAddressSnapshot | null,
  newAddr: CompanyAddressSnapshot | null
): boolean {
  if (!oldAddr && !newAddr) return false;
  if (!oldAddr || !newAddr) return true;
  return oldAddr.street !== newAddr.street
    || oldAddr.number !== newAddr.number
    || oldAddr.postalCode !== newAddr.postalCode
    || oldAddr.city !== newAddr.city
    || oldAddr.settlementId !== newAddr.settlementId;
}
