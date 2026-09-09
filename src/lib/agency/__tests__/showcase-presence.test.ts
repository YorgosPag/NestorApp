/**
 * ADR-846 **Φάση 5δ** — **Η ΑΓΚΥΡΑ ΤΗΣ ΑΠΟΔΕΔΕΙΓΜΕΝΗΣ ΠΑΡΟΥΣΙΑΣ.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΚΕΝΤΡΙΚΗ ΕΙΝΑΙ Η **Κ** — Η ΑΣΥΜΜΕΤΡΙΑ ΜΕ ΤΗ ΦΑΣΗ 5α
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Στη **Φ5α** η αβεβαιότητα **διευρύνει την αμφιβολία**: δεν λέμε ποτέ *«είσαι εκτός»*
 * όταν **εμείς** δεν ξέρουμε πού είναι το ακίνητο. Προστατεύει τον **επαγγελματία**.
 *
 * Στη **Φ5δ** η **ίδια** αβεβαιότητα **δεν επιτρέπεται να διευρύνει την παρουσία**: δεν
 * λέμε ποτέ *«έχει ακίνητο εδώ»* όταν **εμείς** δεν ξέρουμε πού είναι. Προστατεύει τον
 * **επισκέπτη**.
 *
 * ⇒ Οι δύο κρίσεις **οφείλουν να αποκλίνουν στο ίδιο ζεύγος**, και η **Κ4** το εκτελεί
 * μέσα στην ίδια δοκιμή — ώστε η μέρα που κάποιος «τις ενοποιήσει» να κοκκινίσει.
 *
 * ⚠️ **Τα fixtures είναι τα ΥΠΑΡΧΟΝΤΑ** *(`demand-fixtures.listing`)* — N.18.
 */

import {
  presenceFromListings,
  presenceMatches,
  type PresenceEvidence,
} from '../showcase-presence';
import { verdictForListing } from '../coverage-agreement';
import type { CoverageResolvers } from '../coverage-match';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { MAX_PRESENCE_AREAS } from '@/types/agency-profile';
import { NO_FOOTPRINTS } from '@/types/geo/admin-footprint';
import type { ShowcaseWhere } from '@/types/agency-coverage';
import type { GeoCircle } from '@/types/geo/coordinates';
import type { ListingPosition, PublicListing } from '@/types/public-listing';

const AT = '2026-09-09T00:00:00.000Z';

/** Θεσσαλονίκη. */
const HOME = { lat: 40.64, lng: 22.94 };
/** ~9 χλμ ανατολικά. */
const NEAR = { lat: 40.64, lng: 23.046 };
/** Κασσάνδρα Χαλκιδικής, ~75 χλμ. */
const FAR = { lat: 40.06, lng: 23.36 };

const RESOLVERS: CoverageResolvers = { lineageOf: () => [], footprintOf: NO_FOOTPRINTS };

/** Θέση με **δηλωμένη ακρίβεια γεωκωδικοποιητή** — ο μοχλός της ομάδας Κ. */
function geocoded(
  accuracy: 'exact' | 'center',
  point: { lat: number; lng: number },
): ListingPosition {
  return { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy };
}

function at(point: { lat: number; lng: number }, id = 'prop_1'): PublicListing {
  return listing({ id, position: { kind: 'known', provenance: 'manual', point, locatedAt: AT } });
}

function withAccuracy(
  accuracy: 'exact' | 'center',
  point: { lat: number; lng: number },
  id = 'prop_geo',
): PublicListing {
  return listing({ id, position: geocoded(accuracy, point) });
}

const UNLOCATED: PublicListing = listing({
  id: 'prop_unlocated',
  position: { kind: 'unknown', reason: 'never-asked' },
});

/** Κυκλικό ερώτημα επισκέπτη. */
function asking(center: { lat: number; lng: number }, radiusKm: number): ShowcaseWhere {
  return { circle: { center, radiusKm } };
}

// =============================================================================
// Θ — Ο ΠΑΡΑΓΩΓΟΣ: ΑΓΓΕΛΙΕΣ → ΣΥΝΟΛΟ
// =============================================================================

describe('Θ — από τις αγγελίες στο σύνολο των περιοχών', () => {
  it('Θ1 — αγγελία με ακριβή θέση δίνει κύκλο ΜΗΔΕΝΙΚΗΣ αβεβαιότητας', () => {
    const [area] = presenceFromListings([at(HOME)]);
    expect(area).toEqual<GeoCircle>({ center: HOME, radiusKm: 0 });
  });

  it('🔴 Θ2 — η ΑΒΕΒΑΙΟΤΗΤΑ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ: «μόνο πόλη» δίνει ακτίνα 10 χλμ', () => {
    // 🔑 Αν εδώ αποθηκευόταν **σκέτο σημείο**, ο κατάλογος θα εμφάνιζε το γραφείο σε
    //    κάθε δήμο που αγγίζει ο κύκλος — ισχυρισμός παρουσίας **χωρίς απόδειξη**.
    const [area] = presenceFromListings([withAccuracy('center', HOME)]);
    expect(area?.radiusKm).toBe(10);
  });

  it('Θ3 — αγγελία ΧΩΡΙΣ θέση δεν παράγει τίποτα (η σημερινή πλειοψηφία)', () => {
    expect(presenceFromListings([UNLOCATED])).toEqual([]);
    expect(presenceFromListings([])).toEqual([]);
  });

  it('🔴 Θ4 — ΑΠΟΡΡΟΦΗΣΗ: ο περιεχόμενος φεύγει, ο περιέχων μένει', () => {
    // Ακριβής θέση **μέσα** στον κύκλο αβεβαιότητας μιας «μόνο πόλη» αγγελίας.
    const areas = presenceFromListings([at(HOME, 'a'), withAccuracy('center', HOME, 'b')]);

    expect(areas).toHaveLength(1);
    expect(areas[0]?.radiusKm).toBe(10);
  });

  it('🔴 Θ5 — ΤΕΜΝΟΜΕΝΟΙ ΜΕΝΟΥΝ ΚΑΙ ΟΙ ΔΥΟ: καμία «συγχώνευση» σε μεγαλύτερο κύκλο', () => {
    // ⛔ Ένας περιβάλλων κύκλος θα κάλυπτε **τόπους χωρίς κανένα ακίνητο** — δηλαδή
    //    ακριβώς τον ψεύτικο ισχυρισμό που όλο το αρχείο υπάρχει για να αποκλείσει.
    const areas = presenceFromListings([
      withAccuracy('center', HOME, 'a'),
      withAccuracy('center', NEAR, 'b'),
    ]);

    expect(areas).toHaveLength(2);
    for (const area of areas) expect(area.radiusKm).toBe(10);
  });

  it('Θ6 — ΤΑΥΤΟΣΗΜΟΙ κύκλοι δεν αλληλοδιαγράφονται: μένει ΑΚΡΙΒΩΣ ένας', () => {
    // 🔴 Η κλασική παγίδα της αμοιβαίας σχέσης: Α ⊆ Β **και** Β ⊆ Α. Χωρίς σειρά, και
    //    οι δύο θα έφευγαν — και θα έσβηνε **αληθινή** απόδειξη.
    expect(presenceFromListings([at(HOME, 'a'), at(HOME, 'b'), at(HOME, 'c')])).toHaveLength(1);
  });

  it('Θ7 — ιδεμποτής και ντετερμινιστικός: ίδια είσοδος, ίδια έξοδος', () => {
    const input = [at(FAR, 'a'), at(HOME, 'b'), at(NEAR, 'c')];
    expect(presenceFromListings(input)).toEqual(presenceFromListings([...input].reverse()));
  });

  it('🔴 Θ8 — ΤΟ ΤΑΒΑΝΙ ΚΟΒΕΙ, ΚΑΙ ΚΟΒΕΙ ΜΕ ΨΕΥΔΩΣ ΑΡΝΗΤΙΚΟ', () => {
    // 40 ακίνητα σε **διακριτές** θέσεις (ώστε να μην απορροφηθούν).
    const many = Array.from({ length: 40 }, (_, i) =>
      at({ lat: 40 + i * 0.5, lng: 22 + i * 0.5 }, `prop_${i}`),
    );

    const areas = presenceFromListings(many);
    expect(areas).toHaveLength(MAX_PRESENCE_AREAS);
    // Ο παρονομαστής: **χωρίς** το ταβάνι θα ήταν 40 — άρα το ταβάνι όντως έκοψε.
    expect(many.length).toBeGreaterThan(MAX_PRESENCE_AREAS);
  });
});

// =============================================================================
// Κ — Ο ΚΡΙΤΗΣ: `within` ΚΑΙ ΜΟΝΟ
// =============================================================================

/**
 * **ΜΟΝΟ η γεωμετρική μαρτυρία** — δηλαδή η κατάσταση **κάθε** εγγράφου που γράφτηκε
 * πριν τη §9 #13, και ο παρονομαστής όλης της ομάδας Κ.
 *
 * 🔑 Οι Κ1-Κ7 μετρούν το σκέλος που **δεν** άλλαξε: αν κάποιος τις «περνούσε» δίνοντας
 * ταυτότητες, θα μετρούσαν **άλλη** διαδρομή και το γεωμετρικό σκέλος θα έμενε
 * αφύλακτο. Το διοικητικό σκέλος έχει **δική** του ομάδα.
 */
const geometryOnly = (presence: readonly GeoCircle[]): PresenceEvidence => ({
  presence,
  presenceAdminIds: [],
});

describe('Κ 🏆 — η αβεβαιότητα ΔΕΝ διευρύνει την παρουσία', () => {
  it('Κ1 — ακριβής θέση μέσα στο ερώτημα ⇒ ΠΑΡΩΝ', () => {
    const presence = presenceFromListings([at(HOME)]);
    expect(presenceMatches(geometryOnly(presence), asking(HOME, 5), RESOLVERS)).toBe(true);
  });

  it('🔴 Κ2 — Η ΙΔΙΑ ΘΕΣΗ ΓΝΩΣΤΗ ΜΟΝΟ ΣΕ ΕΠΙΠΕΔΟ ΠΟΛΗΣ ⇒ ΟΧΙ, σε ΣΤΕΝΟ ερώτημα', () => {
    // Κύκλος αβεβαιότητας **10 χλμ** εναντίον ερωτήματος **5 χλμ**: τέμνονται, αλλά ο
    // κύκλος **δεν χωράει**. Δεν ξέρουμε αν το ακίνητο είναι εδώ ή 9 χλμ παραδίπλα.
    // 🔑 **Εδώ ξεπερνάμε το Zillow**, που συγκρίνει ΤΚ με ΤΚ και θα έλεγε «ναι».
    const presence = presenceFromListings([withAccuracy('center', HOME)]);
    expect(presenceMatches(geometryOnly(presence), asking(HOME, 5), RESOLVERS)).toBe(false);
  });

  it('🏆 Κ3 — Ο ΙΔΙΟΣ κύκλος σε ΑΡΚΕΤΑ ΕΥΡΥ ερώτημα ⇒ ΠΑΡΩΝ', () => {
    // Η χονδρική θέση είναι **επαρκής απόδειξη για χονδρικό ερώτημα**: η αβεβαιότητα
    // δεν πετιέται, **μετριέται**. Χωρίς αυτό, το Κ2 θα ήταν απλώς «να μην απαντάς ποτέ».
    const presence = presenceFromListings([withAccuracy('center', HOME)]);
    expect(presenceMatches(geometryOnly(presence), asking(HOME, 30), RESOLVERS)).toBe(true);
  });

  it('🔴🔴 Κ4 — Η ΑΣΥΜΜΕΤΡΙΑ ΜΕ ΤΗ Φ5α, ΣΤΟ ΙΔΙΟ ΖΕΥΓΟΣ', () => {
    // ⚠️ **ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ «ΟΧΙ», ΚΑΙ ΔΕΝ ΕΝΟΠΟΙΟΥΝΤΑΙ.**
    //
    // Ίδιο ακίνητο, γνωστό μόνο σε επίπεδο πόλης, ίδια περιοχή:
    //  · Φ5α ρωτά «είναι εκτός της δήλωσής σου;» ⇒ **δεν ξέρω** (δεν κατηγορώ)
    //  · Φ5δ ρωτά «έχει αποδεδειγμένα ακίνητο εδώ;» ⇒ **όχι** (δεν ισχυρίζομαι)
    //
    // Η μέρα που κάποιος γράψει έναν «κοινό μεταφραστή», αυτή η δοκιμή κοκκινίζει.
    const vague = withAccuracy('center', HOME);
    const declared = { circle: { center: HOME, radiusKm: 5 } } as const;

    expect(verdictForListing(declared, vague, RESOLVERS)).toBe('indeterminate');
    expect(presenceMatches(geometryOnly(presenceFromListings([vague])), asking(HOME, 5), RESOLVERS)).toBe(false);
  });

  it('Κ5 — μακρινό ακίνητο δεν αποδεικνύει τίποτα εδώ', () => {
    const presence = presenceFromListings([at(FAR)]);
    expect(presenceMatches(geometryOnly(presence), asking(HOME, 20), RESOLVERS)).toBe(false);
  });

  it('Κ6 — ΚΕΝΗ απόδειξη ⇒ ποτέ ναι (η σημερινή κατάσταση ΟΛΩΝ)', () => {
    expect(presenceMatches(geometryOnly([]), asking(HOME, 50), RESOLVERS)).toBe(false);
  });

  it('🔴 Κ7 — ΔΙΟΙΚΗΤΙΚΟ ερώτημα ΧΩΡΙΣ αποτύπωμα ⇒ ΟΧΙ, ποτέ «μάλλον»', () => {
    // Η άγνοια δεν επιτρέπεται να **προσθέσει** κάποιον. Είναι το αντίστροφο του
    // `coverageMatches`, όπου «δεν ξέρω ⇒ ΔΕΝ κόβω» — και είναι σωστό και στα δύο,
    // γιατί η ένωση είναι fail-open από τη μεριά της δήλωσης: κανείς δεν χάνεται.
    const presence = presenceFromListings([at(HOME)]);
    expect(presenceMatches(geometryOnly(presence), { adminId: 'municipality:1303' }, RESOLVERS)).toBe(false);
  });
});
