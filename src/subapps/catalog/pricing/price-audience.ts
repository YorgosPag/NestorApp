/**
 * Κοινό τιμής ↔ θεατής (ADR-923 §12): ποιο κοινό **καλύπτει** ποιον θεατή, πόσο ειδικό είναι,
 * και πότε δύο συνθήκες μιλούν για **το ίδιο** κοινό (για την απαγόρευση ασάφειας).
 *
 * Ο συνδεδεμένος θεατής καλύπτεται από το `anonymous` **και** το `signedIn` — ο ειδικότερος
 * κανόνας νικά στην επιλογή, όχι εδώ.
 *
 * @module subapps/catalog/pricing/price-audience
 */

import type { PriceAudience, PricingPartyRef, PricingViewer } from '../types/price-list';
import { AUDIENCE_SPECIFICITY } from '../vocabulary/pricing';

export function samePartyRef(a: PricingPartyRef, b: PricingPartyRef): boolean {
  if (a.kind === 'contact') return b.kind === 'contact' && a.contactId === b.contactId;
  return b.kind === 'workspace' && a.companyId === b.companyId;
}

/** `true` αν το κοινό καλύπτει τον θεατή. */
export function audienceCovers(audience: PriceAudience, viewer: PricingViewer): boolean {
  switch (audience.kind) {
    case 'anonymous':
      return true;
    case 'signedIn':
      return viewer.kind === 'signedIn';
    case 'customerGroup':
      return viewer.kind === 'signedIn' && viewer.customerGroupId === audience.customerGroupId;
    case 'partner':
      return viewer.kind === 'signedIn' && viewer.party !== null && samePartyRef(viewer.party, audience.party);
  }
}

export function audienceSpecificity(audience: PriceAudience): number {
  return AUDIENCE_SPECIFICITY[audience.kind];
}

/** Σταθερό κλειδί ταυτότητας κοινού: ίδιο κλειδί ⇔ ίδιο κοινό. */
export function audienceIdentity(audience: PriceAudience): string {
  switch (audience.kind) {
    case 'anonymous':
    case 'signedIn':
      return audience.kind;
    case 'customerGroup':
      return `customerGroup:${audience.customerGroupId}`;
    case 'partner':
      return audience.party.kind === 'contact'
        ? `partner:contact:${audience.party.contactId}`
        : `partner:workspace:${audience.party.companyId}`;
  }
}
