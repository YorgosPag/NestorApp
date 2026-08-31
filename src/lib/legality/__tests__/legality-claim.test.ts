/**
 * @fileoverview Άγκυρες της **αξίωσης** — και της ΑΜΑ ανά διακριτό χώρο (ADR-835 §4.12).
 * @related ADR-838 §4.3/§4.4 · ADR-835 §4.12 · ADR-777 §7
 *
 * 🔴 **ΤΙ ΣΚΟΤΩΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ:**
 *
 * | # | Μετάλλαξη | Άγκυρα |
 * |---|---|---|
 * | Μ1 | `claimSubjectIsWellFormed`: αφαίρεση του ελέγχου κενού συνόλου | Γ3 |
 * | Μ2 | `subjectScope` του `building-identity` → `'space-set'` | Γ4 |
 * | Μ3 | `claimAuthorityIsWellFormed` → πάντα `true` | Γ5 |
 * | Μ4 | `claimCovers` → `spaceSetsIntersect` (κάλυψη γίνεται τομή) | Γ6 |
 * | Μ5 | `publication` του ΑΜΑ → `'disclosed-only'` | Γ2 |
 * | Μ6 | `valueDisclosure` του ΑΜΑ → `'withheld'` | Γ2 |
 * | Μ7 | `expires` του `building-identity` → `false` | Γ2 |
 */

import {
  claimAuthorityIsWellFormed,
  claimCovers,
  claimSubjectIsWellFormed,
  legalityKindSpec,
  publicationBlockingKinds,
  LEGALITY_CLAIM_KINDS,
  LEGALITY_CLAIM_KIND_SPECS,
  type LegalityClaim,
} from '../legality-claim';

const P = 'prop_a0000001';
const AT = '2026-08-31T10:00:00.000Z';

function ama(over: Partial<LegalityClaim> = {}): LegalityClaim {
  return {
    kind: 'short-stay-registry',
    subject: [{ propertyId: P, spaceId: null }],
    tier: 'self-declared',
    value: '1234567890',
    authority: null,
    assertedAt: AT,
    validUntil: null,
    ...over,
  };
}

describe('Γ1 — το λεξιλόγιο των ειδών', () => {
  it('τέσσερα είδη, χωρίς διπλότυπα, καθένα με κανόνες', () => {
    expect(new Set(LEGALITY_CLAIM_KINDS).size).toBe(LEGALITY_CLAIM_KINDS.length);
    for (const kind of LEGALITY_CLAIM_KINDS) {
      expect(LEGALITY_CLAIM_KIND_SPECS[kind]).toBeDefined();
    }
  });

  it('🔴 ΚΑΘΕ είδος κουβαλά ΔΙΑΤΑΞΗ — καμία σταθερά νόμου χωρίς πηγή', () => {
    for (const kind of LEGALITY_CLAIM_KINDS) {
      expect(legalityKindSpec(kind).statute.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('Γ2 — 🔴 οι κανόνες ΔΙΑΦΕΡΟΥΝ ανά είδος, και ένα `boolean` θα ήταν ψευδές', () => {
  it('ο ΑΜΑ ΜΠΛΟΚΑΡΕΙ τη δημοσίευση· η ταυτότητα κτιρίου ΟΧΙ', () => {
    // Καν. (ΕΕ) 2024/1028 (από 20/05/2026) vs ADR-777 §7 #4 («επιλογή, ποτέ
    // προϋπόθεση», απόφαση Giorgio). Ένας καθολικός κανόνας θα έκανε ένα από τα δύο
    // ΨΕΥΔΕΣ — γι' αυτό η ιδιότητα ζει στο ΕΙΔΟΣ.
    expect(legalityKindSpec('short-stay-registry').publication).toBe('blocks-publication');
    expect(legalityKindSpec('building-identity').publication).toBe('disclosed-only');
    expect(publicationBlockingKinds()).toEqual(['short-stay-registry']);
  });

  it('🔴 ο ΑΜΑ ΔΗΜΟΣΙΕΥΕΙ την τιμή του — η απόκρυψη είναι η παράβαση', () => {
    // «Αναγράφεται υποχρεωτικά σε εμφανές σημείο… σε κάθε μέσο προβολής», πρόστιμο
    // από 5.000 €. Ένα καθολικό «ποτέ την τιμή» θα παρέβαινε τον νόμο.
    expect(legalityKindSpec('short-stay-registry').valueDisclosure).toBe('published');
    expect(legalityKindSpec('energy-performance').valueDisclosure).toBe('published');
  });

  it('🔴 η ταυτότητα κτιρίου και η τακτοποίηση ΔΕΝ δημοσιεύουν τιμή', () => {
    expect(legalityKindSpec('building-identity').valueDisclosure).toBe('withheld');
    expect(legalityKindSpec('arbitrary-settlement').valueDisclosure).toBe('withheld');
  });

  it('η βεβαίωση μηχανικού ΛΗΓΕΙ (2 μήνες)· ο ΑΜΑ όχι', () => {
    expect(legalityKindSpec('building-identity').expires).toBe(true);
    expect(legalityKindSpec('short-stay-registry').expires).toBe(false);
  });

  it('🔑 ΜΟΝΟ ο ΑΜΑ δείχνει σε διακριτό χώρο — τα υπόλοιπα είναι του ακινήτου', () => {
    expect(legalityKindSpec('short-stay-registry').subjectScope).toBe('space-set');
    for (const kind of LEGALITY_CLAIM_KINDS.filter((k) => k !== 'short-stay-registry')) {
      expect(legalityKindSpec(kind).subjectScope).toBe('whole-property');
    }
  });
});

describe('Γ3 — το κενό υποκείμενο είναι ΔΥΣΜΟΡΦΙΑ, όχι «ολόκληρο»', () => {
  it('αξίωση που δεν καλύπτει κανέναν χώρο απορρίπτεται', () => {
    expect(claimSubjectIsWellFormed(ama({ subject: [] }))).toBe(false);
  });

  it('το «ολόκληρο» γράφεται με μπαλαντέρ, και είναι έγκυρο', () => {
    expect(claimSubjectIsWellFormed(ama())).toBe(true);
  });
});

describe('Γ4 — 🔴 «ταυτότητα κτιρίου ΤΟΥ ΔΩΜΑΤΙΟΥ Α» είναι ανύπαρκτο έγγραφο', () => {
  it('είδος `whole-property` με ονομασμένο χώρο απορρίπτεται', () => {
    const claim = ama({
      kind: 'building-identity',
      subject: [{ propertyId: P, spaceId: 'room-a' }],
      tier: 'professional-attested',
      authority: 'Μηχανικός ΤΕΕ 12345',
    });
    expect(claimSubjectIsWellFormed(claim)).toBe(false);
  });

  it('το ίδιο είδος για ΟΛΟΚΛΗΡΟ το ακίνητο γίνεται δεκτό', () => {
    const claim = ama({
      kind: 'building-identity',
      subject: [{ propertyId: P, spaceId: null }],
      tier: 'professional-attested',
      authority: 'Μηχανικός ΤΕΕ 12345',
    });
    expect(claimSubjectIsWellFormed(claim)).toBe(true);
  });

  it('ο ΑΜΑ ΕΠΙΤΡΕΠΕΤΑΙ να δείχνει σε δωμάτιο — το απαιτεί η ΑΑΔΕ', () => {
    expect(claimSubjectIsWellFormed(ama({ subject: [{ propertyId: P, spaceId: 'room-a' }] }))).toBe(
      true
    );
  });
});

describe('Γ5 — ετικέτα ΧΩΡΙΣ προέλευση είναι ισχυρισμός (SPEC-777 §24.3)', () => {
  it('`self-declared` επιτρέπεται χωρίς `authority` — ο δηλών ΕΙΝΑΙ ο κάτοχος', () => {
    expect(claimAuthorityIsWellFormed(ama({ tier: 'self-declared', authority: null }))).toBe(true);
  });

  it('🔴 κάθε ΑΝΩΤΕΡΗ βαθμίδα χωρίς `authority` απορρίπτεται', () => {
    for (const tier of ['document-provided', 'professional-attested', 'registry-verified'] as const) {
      expect(claimAuthorityIsWellFormed(ama({ tier, authority: null }))).toBe(false);
      expect(claimAuthorityIsWellFormed(ama({ tier, authority: 'ΑΑΔΕ' }))).toBe(true);
    }
  });
});

describe('Γ6 — 🏆 ΤΡΕΙΣ ΧΩΡΟΙ, ΤΡΕΙΣ ΑΜΑ (ADR-835 §4.12)', () => {
  // Το τριάρι της ΑΑΔΕ: ολόκληρο + δωμ. Α + δωμ. Β ⇒ τρεις καταχωρίσεις.
  const WHOLE = ama({ value: 'ΑΜΑ-1', subject: [{ propertyId: P, spaceId: null }] });
  const ROOM_A = ama({ value: 'ΑΜΑ-2', subject: [{ propertyId: P, spaceId: 'room-a' }] });
  const ROOM_B = ama({ value: 'ΑΜΑ-3', subject: [{ propertyId: P, spaceId: 'room-b' }] });

  it('τρεις διακριτές αξιώσεις, τρεις διαφορετικοί αριθμοί', () => {
    expect(new Set([WHOLE.value, ROOM_A.value, ROOM_B.value]).size).toBe(3);
  });

  it('ο ΑΜΑ του ολόκληρου καλύπτει και τα δύο δωμάτια', () => {
    expect(claimCovers(WHOLE, [{ propertyId: P, spaceId: 'room-a' }])).toBe(true);
    expect(claimCovers(WHOLE, [{ propertyId: P, spaceId: 'room-b' }])).toBe(true);
  });

  it('🔴 ο ΑΜΑ του ΔΩΜΑΤΙΟΥ Α ΔΕΝ καλύπτει το ολόκληρο ούτε το δωμάτιο Β', () => {
    // Με τομή αντί για κάλυψη, και τα δύο θα ήταν `true` για το ολόκληρο — δηλαδή
    // ένας αριθμός δωματίου θα «νομιμοποιούσε» ολόκληρο το διαμέρισμα.
    expect(claimCovers(ROOM_A, [{ propertyId: P, spaceId: null }])).toBe(false);
    expect(claimCovers(ROOM_A, [{ propertyId: P, spaceId: 'room-b' }])).toBe(false);
  });

  it('κάθε ΑΜΑ καλύπτει τον δικό του χώρο', () => {
    expect(claimCovers(ROOM_A, [{ propertyId: P, spaceId: 'room-a' }])).toBe(true);
    expect(claimCovers(ROOM_B, [{ propertyId: P, spaceId: 'room-b' }])).toBe(true);
  });

  it('και τα τρία είναι καλά σχηματισμένα', () => {
    for (const claim of [WHOLE, ROOM_A, ROOM_B]) {
      expect(claimSubjectIsWellFormed(claim)).toBe(true);
    }
  });
});
