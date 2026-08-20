/**
 * @fileoverview **Η ΕΝΤΟΛΗ ΤΟΥ ΜΕΣΙΤΗ** — οι άγκυρες του §8.33.
 * @related ADR-777 §8.33 · types/mandate.ts · types/owner-property-mandate.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ — ΚΑΙ ΤΙ ΟΧΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αποδεικνύουν ότι **η δημοσίευση είναι δομικά αδύνατη** χωρίς έγκριση, και ότι η
 * λήξη τη σταματά **χωρίς να σβήσει τίποτα**. Δεν αποδεικνύουν ότι η οθόνη το δείχνει
 * σωστά — αυτό το βρίσκει **μόνο η οθόνη** (Μ-Η: τρία ελαττώματα σε δύο μέρες
 * πέρασαν όλες τις πύλες και όλες τις άγκυρες).
 *
 * ⚠️ **Κάθε άγκυρα κουβαλά τον ΠΑΡΟΝΟΜΑΣΤΗ της**: πριν ελεγχθεί ότι κάτι **δεν**
 * περνά, ελέγχεται ότι η ίδια είσοδος **περνά** όταν λείπει μόνο το κρίσιμο. Χωρίς
 * αυτό, ένα «δεν δημοσιεύεται» θα μπορούσε να είναι πράσινο επειδή **δεν υπήρξε ποτέ
 * βλάβη** — το σχήμα που το ADR-749 ονομάζει «0 = κανείς δεν κοίταξε».
 */

import {
  isMandateAttributable,
  MANDATE_CONFIRMATIONS,
  type MandateLike,
} from '@/types/mandate';
import {
  AGENCY_ATTESTATION,
  initialConfirmationFor,
  isMandateExpired,
  mandateAllowsPublication,
  mandateInvariantViolations,
  MANDATE_DEFAULT_DURATION_DAYS,
  MANDATE_INVARIANTS,
  MANDATE_PROOF_VIAS,
  OWNER_CONSENT,
  type BrokeredListingMandate,
} from '@/types/owner-property-mandate';
import { listingAuthorshipOf } from '@/types/owner-property';

const NOW = '2026-08-20T12:00:00.000Z';
const FUTURE = '2027-08-20T12:00:00.000Z';
const PAST = '2026-08-19T12:00:00.000Z';

function brokered(over: Partial<BrokeredListingMandate> = {}): BrokeredListingMandate {
  return {
    kind: 'brokered',
    clientContactId: 'cont_kostas',
    confirmation: 'pending',
    confirmedByUserId: null,
    proof: { via: OWNER_CONSENT },
    decidedAt: null,
    notifiedAt: null,
    consentNonce: null,
    expiresAt: FUTURE,
    ...over,
  };
}

// =============================================================================
// Λ — ΤΟ ΚΟΙΝΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

describe('Λ — το λεξιλόγιο της έγκρισης είναι ΕΝΑ', () => {
  it('Λ1 — τρεις καταστάσεις, ονομαστικά', () => {
    expect([...MANDATE_CONFIRMATIONS].sort()).toEqual(
      ['confirmed', 'declined', 'pending'].sort(),
    );
  });

  it('Λ2 — ο ίδιος κριτής απαντά για ΖΗΤΗΣΗ και ΠΡΟΣΦΟΡΑ (δομικά)', () => {
    // Το σκέλος `self` δεν έχει πεδία σε καμία από τις δύο οντότητες…
    const self: MandateLike = { kind: 'self' };
    expect(isMandateAttributable(self)).toBe(true);

    // …και η εντολή της προσφοράς, που έχει ΠΕΡΙΣΣΟΤΕΡΑ πεδία, περνά από τον ίδιο
    // κριτή **επειδή ταιριάζει δομικά**. Αν κάποιος σπάσει τη συμβατότητα, αυτό δεν
    // μεταγλωττίζεται.
    expect(isMandateAttributable(brokered({ confirmation: 'confirmed' }))).toBe(true);
    expect(isMandateAttributable(brokered())).toBe(false);
    expect(isMandateAttributable(brokered({ confirmation: 'declined' }))).toBe(false);
  });
});

// =============================================================================
// Ε — Η ΕΓΚΡΙΣΗ ΩΣ ΦΡΑΓΜΟΣ ΔΗΜΟΣΙΕΥΣΗΣ
// =============================================================================

describe('Ε — καμία δημοσίευση χωρίς «ναι»', () => {
  it('🔑 Ε1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ιδιώτης δημοσιεύεται πάντα', () => {
    expect(mandateAllowsPublication({ kind: 'self' }, NOW)).toBe(true);
  });

  it('🔴 Ε2 — εντολή σε ΑΝΑΜΟΝΗ δεν φτάνει στον κόσμο', () => {
    expect(mandateAllowsPublication(brokered(), NOW)).toBe(false);
  });

  it('Ε3 — ΕΓΚΕΚΡΙΜΕΝΗ εντολή φτάνει — και είναι η ΙΔΙΑ είσοδος με το Ε2', () => {
    expect(mandateAllowsPublication(brokered({ confirmation: 'confirmed' }), NOW)).toBe(
      true,
    );
  });

  it('Ε4 — ΑΡΝΗΣΗ δεν φτάνει, και ΔΕΝ ισοδυναμεί με αναμονή στο μοντέλο', () => {
    const declined = brokered({ confirmation: 'declined', decidedAt: NOW });
    expect(mandateAllowsPublication(declined, NOW)).toBe(false);
    // Το «αρνήθηκε» κρατά ΠΟΤΕ μίλησε — το «σε αναμονή» δεν έχει τι να κρατήσει.
    expect(declined.decidedAt).toBe(NOW);
    expect(brokered().decidedAt).toBeNull();
  });
});

// =============================================================================
// Χ — Η ΔΙΑΡΚΕΙΑ
// =============================================================================

describe('Χ — η εντολή λήγει, και η λήξη δεν είναι άρνηση', () => {
  it('Χ1 — ο ιδιώτης δεν λήγει ΠΟΤΕ', () => {
    expect(isMandateExpired({ kind: 'self' }, '2099-01-01T00:00:00.000Z')).toBe(false);
  });

  it('🔴 Χ2 — ΛΗΓΜΕΝΗ αλλά ΕΓΚΕΚΡΙΜΕΝΗ εντολή δεν δημοσιεύεται', () => {
    const expired = brokered({ confirmation: 'confirmed', expiresAt: PAST });

    // Ο παρονομαστής: η έγκριση **υπάρχει** — άρα ο κριτής της έγκρισης λέει «ναι»…
    expect(isMandateAttributable(expired)).toBe(true);
    // …και μόνο η λήξη τη σταματά. Χωρίς αυτές τις δύο γραμμές μαζί, το «false» θα
    // μπορούσε να οφείλεται στην έγκριση και το test θα ήταν πράσινο για λάθος λόγο.
    expect(isMandateExpired(expired, NOW)).toBe(true);
    expect(mandateAllowsPublication(expired, NOW)).toBe(false);
  });

  it('Χ3 — η στιγμή ΠΕΡΝΙΕΤΑΙ: ίδια εντολή, δύο ρολόγια, δύο απαντήσεις', () => {
    const mandate = brokered({ confirmation: 'confirmed', expiresAt: FUTURE });
    expect(mandateAllowsPublication(mandate, NOW)).toBe(true);
    expect(mandateAllowsPublication(mandate, '2028-01-01T00:00:00.000Z')).toBe(false);
  });

  it('Χ4 — η προεπιλογή είναι οι 12 μήνες του νόμου', () => {
    expect(MANDATE_DEFAULT_DURATION_DAYS).toBe(365);
  });
});

// =============================================================================
// Π — Η ΠΡΟΕΛΕΥΣΗ ΤΗΣ ΕΓΚΡΙΣΗΣ
// =============================================================================

describe('Π — δύο δρόμοι, ΠΟΤΕ ισοδύναμοι', () => {
  it('Π1 — δύο ρητοί δρόμοι, ονομαστικά', () => {
    expect([...MANDATE_PROOF_VIAS].sort()).toEqual(
      ['agency-attestation', 'owner-consent'].sort(),
    );
  });

  it('🔑 Π2 — ο δρόμος ορίζει την ΑΡΧΙΚΗ κατάσταση, και οι δύο τιμές διαφέρουν', () => {
    expect(initialConfirmationFor(OWNER_CONSENT)).toBe('pending');
    expect(initialConfirmationFor(AGENCY_ATTESTATION)).toBe('confirmed');
  });

  it('🔴 Π3 — η βεβαίωση δεν χάνει την ΤΑΥΤΟΤΗΤΑ αυτού που την έδωσε', () => {
    const attested = brokered({
      confirmation: 'confirmed',
      proof: {
        via: AGENCY_ATTESTATION,
        attestedByUserId: 'user_maria',
        attestedAt: NOW,
        documentPath: null,
      },
    });
    expect(attested.proof.via).toBe(AGENCY_ATTESTATION);
    // Η πληροφορία «ποιος βεβαίωσε» **δεν** μπορεί να λείπει: ζει μέσα στο σκέλος,
    // άρα ένα `proof` χωρίς `attestedByUserId` δεν μεταγλωττίζεται.
    if (attested.proof.via === AGENCY_ATTESTATION) {
      expect(attested.proof.attestedByUserId).toBe('user_maria');
    }
  });

  it('Π4 — η βεβαίωση ΔΕΝ κρύβει τη μετέπειτα αντίρρηση του ιδιοκτήτη', () => {
    const objected = brokered({
      confirmation: 'declined',
      decidedAt: NOW,
      proof: {
        via: AGENCY_ATTESTATION,
        attestedByUserId: 'user_maria',
        attestedAt: PAST,
        documentPath: null,
      },
    });
    expect(mandateAllowsPublication(objected, NOW)).toBe(false);
  });
});

// =============================================================================
// Ι — ΤΑ INVARIANTS
// =============================================================================

describe('Ι — τι δεν επιτρέπεται να γεννηθεί', () => {
  it('🔑 Ι1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: έγκυρη εντολή δεν παράγει καμία παραβίαση', () => {
    expect(mandateInvariantViolations(brokered(), NOW)).toEqual([]);
    expect(mandateInvariantViolations({ kind: 'self' }, NOW)).toEqual([]);
  });

  it('Ι2 — εντολή χωρίς πελάτη', () => {
    expect(mandateInvariantViolations(brokered({ clientContactId: '  ' }), NOW)).toContain(
      'mandate-client-missing',
    );
  });

  it('Ι3 — λήξη που δεν είναι ημερομηνία, ΞΕΧΩΡΙΣΤΑ από λήξη στο παρελθόν', () => {
    const garbage = mandateInvariantViolations(brokered({ expiresAt: 'χθες' }), NOW);
    expect(garbage).toContain('mandate-expiry-invalid');
    expect(garbage).not.toContain('mandate-expiry-past');

    const past = mandateInvariantViolations(brokered({ expiresAt: PAST }), NOW);
    expect(past).toContain('mandate-expiry-past');
    expect(past).not.toContain('mandate-expiry-invalid');
  });

  it('🔴 Ι4 — βεβαίωση που γεννιέται «σε αναμονή» δεν βεβαιώνει τίποτα', () => {
    const limbo = brokered({
      confirmation: 'pending',
      proof: {
        via: AGENCY_ATTESTATION,
        attestedByUserId: 'user_maria',
        attestedAt: NOW,
        documentPath: null,
      },
    });
    expect(mandateInvariantViolations(limbo, NOW)).toContain(
      'mandate-attestation-not-confirmed',
    );
  });

  it('Ι5 — ΟΛΕΣ οι παραβιάσεις, ποτέ η πρώτη', () => {
    const broken = brokered({ clientContactId: '', expiresAt: PAST });
    expect(mandateInvariantViolations(broken, NOW)).toEqual(
      expect.arrayContaining(['mandate-client-missing', 'mandate-expiry-past']),
    );
  });

  it('Ι6 — κάθε κωδικός του κλειστού συνόλου ΜΠΟΡΕΙ να παραχθεί', () => {
    const produced = new Set<string>([
      ...mandateInvariantViolations(brokered({ clientContactId: '' }), NOW),
      ...mandateInvariantViolations(brokered({ expiresAt: 'όχι' }), NOW),
      ...mandateInvariantViolations(brokered({ expiresAt: PAST }), NOW),
      ...mandateInvariantViolations(
        brokered({
          proof: {
            via: AGENCY_ATTESTATION,
            attestedByUserId: 'u',
            attestedAt: NOW,
            documentPath: null,
          },
        }),
        NOW,
      ),
    ]);
    for (const code of MANDATE_INVARIANTS) expect(produced).toContain(code);
  });
});

// =============================================================================
// Υ — Η ΥΠΟΓΡΑΦΗ ΠΡΟΣ ΤΟΝ ΚΟΣΜΟ
// =============================================================================

describe('Υ — η προέλευση της αγγελίας παράγεται, δεν δηλώνεται', () => {
  it('🔑 Υ1 — το `LISTING_AUTHORSHIPS` απέκτησε καταναλωτή', () => {
    expect(listingAuthorshipOf({ kind: 'self' })).toBe('owner-declared');
    expect(listingAuthorshipOf(brokered())).toBe('agency');
  });

  it('Υ2 — η υπογραφή ΔΕΝ εξαρτάται από την έγκριση, μόνο από το ποιος γράφει', () => {
    // Μια εντολή σε αναμονή είναι **εξίσου** «από γραφείο». Το αν φτάνει στον κόσμο
    // είναι άλλη ερώτηση, και την απαντά το `mandateAllowsPublication`.
    expect(listingAuthorshipOf(brokered({ confirmation: 'confirmed' }))).toBe('agency');
    expect(listingAuthorshipOf(brokered({ confirmation: 'declined' }))).toBe('agency');
  });
});
