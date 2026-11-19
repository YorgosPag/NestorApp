/**
 * ADR-945 §7.6 — άγκυρες του πλαισίου του `/pro`: κύκλος γραφής ⇄ ανάγνωσης · «και τα δύο ή κανένα» · επιβίωση των
 * φίλτρων · ο ΕΝΑΣ δημιουργός διεύθυνσης (`documentIssuerSearchHref` · `agencyProfileRoute`).
 */

import { agencyProfileRoute, documentIssuerSearchHref } from '@/components/mandate/agency-directory-route';
import { parseIssuanceContext, withIssuanceContext, type IssuanceContext } from '@/lib/agency/issuance-context-query';
import { parseShowcaseFilters } from '@/lib/agency/showcase-filter';
import { documentToken } from '@/lib/agency/occupation-query';

const CONTEXT: IssuanceContext = { propertyId: 'ownp_123', documentKind: 'energy-certificate' };

const queryOf = (href: string): URLSearchParams => new URLSearchParams(href.split('?')[1] ?? '');

describe('ADR-945 §7.6 — πλαίσιο', () => {
  it('κύκλος: ό,τι γράφεται διαβάζεται ίδιο', () => {
    expect(parseIssuanceContext(withIssuanceContext(new URLSearchParams(), CONTEXT))).toEqual(CONTEXT);
  });

  it('μισό ή χαλασμένο πλαίσιο ⇒ κανένα', () => {
    expect(parseIssuanceContext(new URLSearchParams('forProperty=ownp_123'))).toBeNull();
    expect(parseIssuanceContext(new URLSearchParams('forProperty=ownp_123&forDocument=nope'))).toBeNull();
    expect(parseIssuanceContext(new URLSearchParams('forProperty=a%20b&forDocument=energy-certificate'))).toBeNull();
  });

  it('`null` αφαιρεί το πλαίσιο, κρατά τα υπόλοιπα — και δεν πειράζει το όρισμα', () => {
    const params = withIssuanceContext(new URLSearchParams('occupation=x'), CONTEXT);
    const cleared = withIssuanceContext(params, null);
    expect(cleared.toString()).toBe('occupation=x');
    expect(parseIssuanceContext(params)).toEqual(CONTEXT);
  });
});

describe('ADR-945 §7.6 — ο ΕΝΑΣ δημιουργός του `/pro`', () => {
  it('«Βρες επαγγελματία» από ακίνητο ⇒ φίλτρο εγγράφου ΚΑΙ πλαίσιο', () => {
    const query = queryOf(documentIssuerSearchHref('energy-certificate', null, 'ownp_123'));
    expect(parseShowcaseFilters(query).occupation).toBe(documentToken('energy-certificate'));
    expect(parseIssuanceContext(query)).toEqual(CONTEXT);
  });

  it('χωρίς ακίνητο ⇒ η διεύθυνση του μητρώου αμετάβλητη (κανένα πλαίσιο)', () => {
    expect(parseIssuanceContext(queryOf(documentIssuerSearchHref('energy-certificate', null)))).toBeNull();
  });

  it('το προφίλ κρατά το πλαίσιο · χωρίς πλαίσιο, καμία `?`', () => {
    expect(parseIssuanceContext(queryOf(agencyProfileRoute('alias', CONTEXT)))).toEqual(CONTEXT);
    expect(agencyProfileRoute('alias')).toBe('/pro/alias');
  });
});
