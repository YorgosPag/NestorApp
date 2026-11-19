/**
 * ADR-777 §8.103 — η παρουσία της αγγελίας: ΕΝΑΣ κριτής, πέντε ονόματα, η απουσία ονομασμένη.
 */
import {
  LISTING_PRESENCES,
  countListingPresences,
  listingPresenceOf,
  listingPresenceSpec,
} from '@/lib/listings/listing-presence';
import { isPubliclyListed, type ProjectableProperty } from '@/services/listings/public-listing-projection';
import { MARKETING_AUDIENCES } from '@/constants/marketing-audiences';

const offered = { type: 'apartment', commercialStatus: 'for-sale' };
const facts = (extra: Record<string, unknown>) => ({ ...offered, ...extra }) as unknown as ProjectableProperty;

describe('listingPresenceOf — ο ίδιος κριτής με την πύλη προβολής', () => {
  it('✅ διατίθεται χωρίς πεδίο κοινού ⇒ public (ADR-864 Α3)', () => {
    expect(listingPresenceOf(facts({}))).toBe('public');
  });

  it.each(MARKETING_AUDIENCES)('✅ διατίθεται στο κοινό %s ⇒ το ίδιο όνομα', (marketingAudience) => {
    expect(listingPresenceOf(facts({ marketingAudience }))).toBe(marketingAudience);
  });

  it('🔴 εκτός αγοράς ⇒ unlisted, ποτέ public — όποιο κι αν είναι το πεδίο κοινού', () => {
    expect(listingPresenceOf(facts({ commercialStatus: 'unavailable', marketingAudience: 'public' }))).toBe('unlisted');
  });

  it('🔴 πουλημένο ⇒ settled · στον κάδο ⇒ unlisted', () => {
    expect(listingPresenceOf(facts({ commercialStatus: 'sold' }))).toBe('settled');
    expect(listingPresenceOf(facts({ status: 'deleted' }))).toBe('unlisted');
  });

  it('🔴 «Στο κοινό» ⇔ η πύλη δημοσίευσης λέει ναι — για κάθε συνδυασμό', () => {
    const statuses = ['for-sale', 'for-rent', 'unavailable', 'reserved', 'sold', 'rented'];
    for (const commercialStatus of statuses) {
      for (const marketingAudience of [undefined, ...MARKETING_AUDIENCES]) {
        const property = facts({ commercialStatus, marketingAudience });
        expect(listingPresenceOf(property) === 'public').toBe(isPubliclyListed(property));
      }
    }
  });
});

describe('παρουσίαση — διακριτή χωρίς χρώμα', () => {
  it('κάθε παρουσία έχει ΜΟΝΑΔΙΚΟ σχήμα και δικό της κλειδί', () => {
    const specs = LISTING_PRESENCES.map(listingPresenceSpec);
    expect(new Set(specs.map((s) => s.icon)).size).toBe(LISTING_PRESENCES.length);
    expect(specs.map((s) => s.labelKey)).toEqual(LISTING_PRESENCES.map((p) => `listingPresence.${p}`));
  });

  it('μόνο το «Στο κοινό» είναι γεμάτο· η απουσία είναι διακεκομμένη', () => {
    expect(listingPresenceSpec('public').variant).toBe('success');
    expect(LISTING_PRESENCES.filter((p) => listingPresenceSpec(p).variant === 'success')).toEqual(['public']);
    expect(listingPresenceSpec('unlisted').className).toContain('border-dashed');
  });

  it('το σύνολο ξεκινά από το ευρύτερο κοινό και περιέχει κάθε κοινό της ρίζας', () => {
    expect(LISTING_PRESENCES[0]).toBe('public');
    for (const audience of MARKETING_AUDIENCES) expect(LISTING_PRESENCES).toContain(audience);
  });
});

describe('countListingPresences', () => {
  it('μετρά κάθε παρουσία, και το μηδέν ονομασμένο', () => {
    const counts = countListingPresences([
      facts({}),
      facts({}),
      facts({ marketingAudience: 'network' }),
      facts({ commercialStatus: 'unavailable' }),
    ]);
    expect(counts).toEqual({ public: 2, network: 1, custodians: 0, unlisted: 1, settled: 0 });
  });
});
