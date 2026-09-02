/**
 * @fileoverview ΑΓΚΥΡΑ — **τα επίπεδα κουβαλούν την προέλευσή τους** (ADR-842 Φ5 · §8 #7).
 * @related services/listings/public-listing-attributes.ts · ./public-listing-schema
 *          · lib/property/attribute-provenance.ts · ./listing-attribute-declared
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ — ΜΕΤΡΗΜΕΝΟ ΣΕ ΖΩΝΤΑΝΟ ΕΓΓΡΑΦΟ (2026-09-02)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `prop_2d612992` έχει `isMultiLevel: true` και `levels[]` με **δύο** εγγραφές, και
 * **καμία** τιμή στο `layout.levels`. Η δημόσια αγγελία έλεγε *«Επίπεδα: δεν έχει
 * δηλωθεί»* — για γνώση που **κατέχουμε**. Παραβίαση του *«ποτέ ό,τι μπορούμε να
 * υπολογίσουμε»* (Α14 §17.2 · ADR-842 Α1).
 *
 * Αυτή η άγκυρα φυλάει **και τα τρία** στρώματα της θεραπείας: τον **γραφέα** (ποια
 * πηγή, με ποιο όνομα), την **αλυσίδα** (τα παλιά έγγραφα δεν λένε ψέματα), και το
 * **σύνορο του Α7** (τι φτάνει στον αγοραστή).
 */

import { projectListingAttributes } from '@/services/listings/public-listing-attributes';
import type { ProjectableProperty } from '@/services/listings/public-listing-projection-types';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

import { isAttributeDeclared } from '../listing-attribute-declared';
import {
  LISTING_MIGRATIONS,
  PUBLIC_LISTING_SCHEMA_VERSION,
  upgradeListingDocument,
  type StoredListingDocument,
} from '../public-listing-schema';

const AT = '2026-09-02T12:00:00.000Z';
const BASE: ProjectableProperty = { id: 'prop_2d612992' };

function levelsOf(over: Partial<ProjectableProperty>) {
  return projectListingAttributes({ ...BASE, ...over } as ProjectableProperty, AT).levels;
}

// ============================================================================
// Ε1 — Ο ΓΡΑΦΕΑΣ: ΔΥΟ ΠΗΓΕΣ, ΜΕ ΟΝΟΜΑ
// ============================================================================

describe('Ε1 — ο γραφέας λέει ΑΠΟ ΠΟΥ το ξέρει', () => {
  it('η δήλωση του κατόχου ταξιδεύει ως `declared`', () => {
    expect(levelsOf({ layout: { levels: 3 } })).toEqual({
      provenance: 'declared',
      value: 3,
      at: AT,
    });
  });

  /**
   * 🔴 **ΤΟ ΖΩΝΤΑΝΟ ΕΓΓΡΑΦΟ**: δύο εγγραφές ορόφων, καμία δήλωση. Πριν τη Φ5 αυτό
   * έδινε `null` — «δεν έχει δηλωθεί» για κάτι που ξέραμε.
   */
  it('🔴 η δομή των ορόφων μετριέται και ταξιδεύει ως `measured`, με δείκτη πηγής', () => {
    const levels = levelsOf({ isMultiLevel: true, levels: [{ floorId: 'flr_a' }, { floorId: 'flr_b' }] });
    expect(levels).toEqual({
      provenance: 'measured',
      value: 2,
      at: AT,
      sourceRef: 'property-model:levels',
    });
  });

  /**
   * ⚠️ **Η σειρά είναι ΑΠΟΦΑΣΗ, και είναι η αντίστροφη της κατάταξης** — δες το
   * σχόλιο του `projectLevels`. Η **ρητή απάντηση** νικά την **παρενέργεια**.
   */
  it('⚠️ όταν υπάρχουν ΚΑΙ ΟΙ ΔΥΟ, η ρητή δήλωση νικά τη δομή', () => {
    const levels = levelsOf({ layout: { levels: 1 }, levels: [{}, {}, {}] });
    expect(levels).toEqual({ provenance: 'declared', value: 1, at: AT });
  });

  it('⛔ κενή δομή ⇒ `null` («δεν ξέρουμε»), ΠΟΤΕ `0`', () => {
    expect(levelsOf({ levels: [] })).toBeNull();
    expect(levelsOf({})).toBeNull();
    expect(levelsOf({ isMultiLevel: true })).toBeNull();
  });

  it('ο δείκτης πηγής ΔΕΝ δημοσιεύει κανένα ιδιωτικό αναγνωριστικό', () => {
    const levels = levelsOf({ levels: [{ floorId: 'flr_4275c4c9' }] });
    expect(JSON.stringify(levels)).not.toContain('flr_');
    expect(JSON.stringify(levels)).not.toContain('bldg_');
  });

  it('το `at` έρχεται από τον ΚΑΛΟΥΝΤΑ — καμία συνάρτηση δεν διαβάζει ρολόι', () => {
    const other = '2020-01-01T00:00:00.000Z';
    expect(
      projectListingAttributes({ ...BASE, layout: { levels: 2 } } as ProjectableProperty, other)
        .levels,
    ).toEqual({ provenance: 'declared', value: 2, at: other });
  });
});

// ============================================================================
// Ε2 — Η ΑΛΥΣΙΔΑ: ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΛΕΝΕ ΨΕΜΑΤΑ
// ============================================================================

describe('Ε2 — ο κρίκος 6 αλλάζει σχήμα χωρίς να εφευρίσκει γνώση', () => {
  const V5: StoredListingDocument = {
    schemaVersion: 5,
    levels: 2,
    projectedAt: '2026-08-30T08:00:00.000Z',
  };

  it('η έκδοση ανέβηκε ΜΑΖΙ με κρίκο (ADR-839 §5)', () => {
    expect(PUBLIC_LISTING_SCHEMA_VERSION).toBe(LISTING_MIGRATIONS.length + 1);
    expect(LISTING_MIGRATIONS.at(-1)?.to).toBe(6);
    expect(LISTING_MIGRATIONS.at(-1)?.adds).toEqual(['levels']);
  });

  it('ωμός αριθμός ⇒ `declared`, με το `projectedAt` του ΙΔΙΟΥ του εγγράφου', () => {
    expect(upgradeListingDocument(V5).levels).toEqual({
      provenance: 'declared',
      value: 2,
      at: '2026-08-30T08:00:00.000Z',
    });
  });

  /**
   * 🔑 **`declared`, ΟΧΙ `measured`**: η έκδοση 5 κρατούσε μόνο το `layout.levels` —
   * αριθμό που πληκτρολόγησε άνθρωπος. Μια μετανάστευση που τον βάφτιζε «μετρημένο»
   * θα ανέβαζε τη **βαθμίδα αξιοπιστίας** του χωρίς να έχει κοιτάξει τίποτα.
   */
  it('🔑 η μετανάστευση ΔΕΝ προάγει παλιές δηλώσεις σε «μετρημένες»', () => {
    expect(upgradeListingDocument(V5).levels).not.toMatchObject({ provenance: 'measured' });
  });

  /**
   * ⛔ **Η ΑΠΩΛΕΙΑ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΗ ΚΑΙ ΔΗΛΩΜΕΝΗ.** Γεγονός που δεν μπορεί να πει
   * **πότε** το μάθαμε δεν είναι γεγονός αυτού του σχήματος — και η εναλλακτική
   * (ρολόι μέσα στη μετανάστευση) θα έλεγε *«το μάθαμε τη στιγμή που το διαβάσαμε»*.
   */
  it('⛔ χωρίς `projectedAt` ⇒ `null`, ΟΧΙ εφευρεμένη ημερομηνία', () => {
    const noStamp = { schemaVersion: 5, levels: 2 };
    expect(upgradeListingDocument(noStamp).levels).toBeNull();
  });

  it('απόν / μη αριθμός ⇒ `null`', () => {
    expect(upgradeListingDocument({ schemaVersion: 5, projectedAt: AT }).levels).toBeNull();
    expect(
      upgradeListingDocument({ schemaVersion: 5, levels: 'δύο', projectedAt: AT }).levels,
    ).toBeNull();
  });

  it('🔑 ΙΔΙΟΔΥΝΑΜΙΑ: ήδη σχηματισμένο γεγονός δεν καταστρέφεται από δεύτερη διέλευση', () => {
    const shaped = {
      levels: { provenance: 'measured', value: 2, at: AT, sourceRef: 'property-model:levels' },
      projectedAt: AT,
    };
    expect(upgradeListingDocument(shaped).levels).toEqual(shaped.levels);
  });
});

// ============================================================================
// Ε3 — ΤΟ ΣΥΝΟΡΟ ΤΟΥ Α7: ΤΙ ΦΤΑΝΕΙ ΣΤΟΝ ΑΓΟΡΑΣΤΗ
// ============================================================================

function listingWith(levels: PublicListing['levels']): PublicListing {
  return {
    id: 'prop_2d612992',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 1, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'maisonette',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    floor: 1,
    bedrooms: 3,
    ...UNASKED_LISTING_ATTRIBUTES,
    levels,
    title: 'Μεζονέτα',
    legality: [],
    projectedAt: AT,
  };
}

describe('Ε3 — 🔴 το Α7 φυλάει και ΑΥΤΟ το πεδίο', () => {
  it('`measured` και `declared` φτάνουν στον αγοραστή', () => {
    expect(isAttributeDeclared(listingWith({ provenance: 'declared', value: 2, at: AT }), 'levels')).toBe(true);
    expect(
      isAttributeDeclared(
        listingWith({ provenance: 'measured', value: 2, at: AT, sourceRef: 'property-model:levels' }),
        'levels',
      ),
    ).toBe(true);
  });

  /**
   * 🔴 **Ο ΠΥΡΗΝΑΣ ΤΟΥ Α7**: μάντεμα μοντέλου **χωρίς ανθρώπινη έγκριση** δεν είναι
   * γεγονός. Εδώ ο Νέστωρ είναι **αυστηρότερος** από τη Zillow, που δημοσιεύει
   * συμπεράσματα computer-vision αυτούσια.
   */
  it('🔴 ΑΝΕΠΙΒΕΒΑΙΩΤΟ `inferred` ΔΕΝ μετράει ως δηλωμένο', () => {
    const guessed = listingWith({
      provenance: 'inferred',
      value: 2,
      at: AT,
      confidence: 0.9,
      confirmedAt: null,
    });
    expect(isPubliclyPresentable(guessed.levels!)).toBe(false);
    expect(isAttributeDeclared(guessed, 'levels')).toBe(false);
  });

  it('…και ΕΠΙΒΕΒΑΙΩΜΕΝΟ `inferred` μετράει', () => {
    const confirmed = listingWith({
      provenance: 'inferred',
      value: 2,
      at: AT,
      confidence: 0.9,
      confirmedAt: AT,
    });
    expect(isAttributeDeclared(confirmed, 'levels')).toBe(true);
  });

  it('`null` παραμένει «κανείς δεν ρώτησε»', () => {
    expect(isAttributeDeclared(listingWith(null), 'levels')).toBe(false);
  });
});
