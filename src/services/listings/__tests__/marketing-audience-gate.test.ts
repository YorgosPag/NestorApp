/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α1 · Α3 του ADR-864** — το κοινό κρίνεται στην ΠΥΛΗ, και η απουσία του είναι `public`.
 * @related ADR-864 §5.1 · §7 · constants/marketing-audiences.ts · services/listings/public-listing-projection.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΠΙΑΝΕΙ Η ΚΑΘΕ ΟΜΑΔΑ — ΚΑΙ Η ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΤΗΝ ΚΟΚΚΙΝΙΖΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ομάδα | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|---|
 * | **Α1** | ο έλεγχος κοινού φεύγει από την `isPubliclyListed` (γράφεται σε αναγνώστη) | `buildPublicListing` ≠ `null` για `custodians` ⇒ 🔴 |
 * | **Α1.δ** | η μετάφραση ιδιώτη **δεν** περνά το πεδίο | η κλειστή καταχώρηση ιδιώτη «δημοσιεύεται» ⇒ 🔴 |
 * | **Α3** | `DEFAULT_MARKETING_AUDIENCE = 'custodians'` | παλιό έγγραφο χωρίς πεδίο «εξαφανίζεται» ⇒ 🔴 |
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΜΠΑΙΝΕΙ ΠΡΩΤΟΣ** σε κάθε ομάδα: η ίδια καταχώρηση με `public`
 * **δημοσιεύεται**. Χωρίς αυτόν, μια πύλη που αρνείται τα πάντα θα περνούσε κάθε «ΔΕΝ».
 */

import {
  DEFAULT_MARKETING_AUDIENCE,
  MARKETING_AUDIENCES,
  marketingAudienceOf,
  narrowsAudience,
} from '@/constants/marketing-audiences';
import {
  buildPublicListing,
  isOffered,
  isPubliclyListed,
  projectListingShape,
  type PlaceKnowledge,
  type ProjectableProperty,
} from '../public-listing-projection';
import {
  ownerListingVisibility,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';

const AT = '2026-09-16T10:00:00.000Z';
const NO_PLACE: PlaceKnowledge = { candidates: [], ref: null };

/** Αγγελία γραφείου **προς πώληση** — ίδιο σχήμα με τα πραγματικά έγγραφα της Κ1. */
function forSale(overrides: Partial<ProjectableProperty> = {}): ProjectableProperty {
  return {
    id: 'prop_audience',
    name: 'Διαμέρισμα 85 τ.μ.',
    type: 'apartment',
    commercialStatus: 'for-sale',
    areas: { gross: 85 },
    commercial: { askingPrice: 265000 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('🏆 Α1 — μόνο το `public` περνά την πύλη προβολής', () => {
  it('🔑 παρονομαστής: η ίδια αγγελία με `public` ΔΗΜΟΣΙΕΥΕΤΑΙ', () => {
    expect(isPubliclyListed(forSale({ marketingAudience: 'public' }))).toBe(true);
    expect(buildPublicListing(forSale({ marketingAudience: 'public' }), NO_PLACE, AT)).not.toBeNull();
  });

  it.each(['custodians', 'network'] as const)(
    '🔴 `%s` ⇒ ΚΑΝΕΝΑ `PublicListing` — η απόφαση ζει στην ΠΥΛΗ, όχι σε αναγνώστη',
    (audience) => {
      const closed = forSale({ marketingAudience: audience });
      expect(isPubliclyListed(closed)).toBe(false);
      expect(buildPublicListing(closed, NO_PLACE, AT)).toBeNull();
    },
  );

  it('🔴 Α1.β — η κλειστή διάθεση ΔΙΑΤΙΘΕΤΑΙ: το «διατίθεται» είναι άλλη ερώτηση από το «δημόσιο»', () => {
    // Χωρίς αυτό, μια υλοποίηση που «έσβηνε» τη διάθεση για να κρύψει την αγγελία θα
    // περνούσε την Α1 — και η ζήτηση (ADR-864 §5.3) δεν θα έβρισκε ποτέ κλειστή καταχώρηση.
    expect(isOffered(forSale({ marketingAudience: 'custodians' }))).toBe(true);
  });

  it('🔴 Α1.γ — το ΣΧΗΜΑ χωρίς πύλη υπάρχει ακόμη (επίπεδο Γ: ο κάτοχος μαθαίνει πλήθος ζήτησης)', () => {
    const shape = projectListingShape(forSale({ marketingAudience: 'custodians' }), NO_PLACE, AT);
    expect(shape.offerKinds).toEqual(['sell']);
  });

  it('🔴 Α1.δ — ο ΙΔΙΩΤΗΣ: η μετάφραση ΠΕΡΝΑ το κοινό στην πύλη', () => {
    const open = validOwnerProperty();
    const closed = validOwnerProperty({ marketingAudience: 'custodians' });

    expect(isPubliclyListed(projectableFromOwnerProperty(open, AT))).toBe(true);
    expect(isPubliclyListed(projectableFromOwnerProperty(closed, AT))).toBe(false);
    // Η οθόνη του κατόχου λέει την αλήθεια: «δεν είναι στον δημόσιο χάρτη».
    expect(ownerListingVisibility(closed, AT)).toBe('withdrawn');
  });

  it('η πύλη δεν ανοίγει για ΜΗ διαθέσιμη αγγελία, όποιο κι αν είναι το κοινό', () => {
    expect(isPubliclyListed(forSale({ commercialStatus: 'sold', marketingAudience: 'public' }))).toBe(false);
  });
});

describe('🏆 Α3 — απουσία κοινού ⇒ `public` (η σημερινή συμπεριφορά)', () => {
  it('🔴 η προεπιλογή ΕΙΝΑΙ `public` — αλλιώς κάθε υπάρχουσα αγγελία εξαφανίζεται', () => {
    expect(DEFAULT_MARKETING_AUDIENCE).toBe('public');
  });

  it('🔴 αγγελία γραφείου ΧΩΡΙΣ πεδίο ⇒ δημοσιεύεται όπως πριν', () => {
    const legacy = forSale();
    expect('marketingAudience' in legacy).toBe(false);
    expect(isPubliclyListed(legacy)).toBe(true);
  });

  it('🔴 έγγραφο ιδιώτη ΧΩΡΙΣ πεδίο ⇒ το σύνορο δίνει `public`', () => {
    const { marketingAudience: _dropped, ...stored } = validOwnerProperty();
    const read = ownerPropertyFromDocument(stored, 'ownp_legacy');

    expect(read?.marketingAudience).toBe('public');
    expect(isPubliclyListed(projectableFromOwnerProperty(read!, AT))).toBe(true);
  });

  it('άγνωστη αποθηκευμένη λέξη ⇒ `public` · γνωστή ⇒ διατηρείται', () => {
    expect(marketingAudienceOf('secret')).toBe('public');
    expect(marketingAudienceOf(null)).toBe('public');
    expect(marketingAudienceOf('custodians')).toBe('custodians');
    expect(ownerPropertyFromDocument({ ...validOwnerProperty(), marketingAudience: 'network' }, 'ownp_n')?.marketingAudience)
      .toBe('network');
  });
});

describe('Το στένεμα παράγεται από τη ΣΕΙΡΑ της ρίζας', () => {
  it('από το ευρύτερο προς το στενότερο ⇒ στένεμα· αντίστροφα ⇒ διεύρυνση', () => {
    expect(MARKETING_AUDIENCES).toEqual(['custodians', 'network', 'public']);
    expect(narrowsAudience('public', 'custodians')).toBe(true);
    expect(narrowsAudience('public', 'network')).toBe(true);
    expect(narrowsAudience('network', 'custodians')).toBe(true);
    expect(narrowsAudience('custodians', 'public')).toBe(false);
    expect(narrowsAudience('public', 'public')).toBe(false);
  });
});
