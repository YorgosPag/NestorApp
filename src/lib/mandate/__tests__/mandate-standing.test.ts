/**
 * @fileoverview **ΑΓΚΥΡΕΣ ΤΟΥ ΤΑΞΙΝΟΜΗΤΗ** — ADR-777 §8.34.
 * @related lib/mandate/mandate-standing.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ομάδα | Ερώτημα |
 * |---|---|
 * | **Κ** | Κάθε κατάσταση είναι **προσιτή** — καμία δεν είναι αδρανής φρουρός (ADR-749 §5) |
 * | **Σ** | Η **σειρά** των ερωτήσεων: ποια κατάσταση νικά όταν δύο ισχύουν μαζί |
 * | **Λ** | **Κλειστή λογιστική**: κάθε κατάσταση έχει ομάδα, κάθε ομάδα έχει κατάσταση |
 * | **Μ** | **Μεταλλάξεις**: αλλαγή σε μία είσοδο ⇒ αλλαγή ετυμηγορίας |
 *
 * 🔴 Το **Κ** δεν είναι διακοσμητικό: μια κατάσταση που **καμία** είσοδος δεν μπορεί
 * να παραγάγει είναι φρουρός χωρίς απόδειξη ζωής — και θα είχε δικό της κείμενο,
 * δική της γραμμή στην οθόνη και κανέναν να τη δει ποτέ.
 */

import {
  daysUntilExpiry,
  groupOfStanding,
  MANDATE_EXPIRY_HORIZON_DAYS,
  MANDATE_STANDING_GROUPS,
  MANDATE_STANDINGS,
  mandateStandingOf,
  type MandateStanding,
} from '@/lib/mandate/mandate-standing';
import { DEFAULT_LISTING_AGREEMENT } from '@/types/listing-agreement';
import {
  AGENCY_ATTESTATION,
  CUSTOMARY_COMMISSION_PERCENTAGE,
  OWNER_CONSENT,
  type BrokeredListingMandate,
} from '@/types/owner-property-mandate';

const NOW = '2026-08-21T10:00:00.000Z';

function daysFromNow(days: number): string {
  return new Date(Date.parse(NOW) + days * 24 * 60 * 60 * 1000).toISOString();
}

function mandate(over: Partial<BrokeredListingMandate> = {}): BrokeredListingMandate {
  return {
    kind: 'brokered',
    clientContactId: 'cont_kostas',
    confirmation: 'pending',
    confirmedByUserId: null,
    proof: { via: OWNER_CONSENT },
    agreement: DEFAULT_LISTING_AGREEMENT,
    compensation: {
      type: 'percentage',
      percentage: CUSTOMARY_COMMISSION_PERCENTAGE,
      vatIncluded: false,
    },
    decidedAt: null,
    notifiedAt: '2026-08-20T09:00:00.000Z',
    viewedAt: null,
    consentNonce: 'nonce-1',
    expiresAt: daysFromNow(300),
    scope: ['sell'],
    startsAt: NOW,
    ...over,
  };
}

// ============================================================================
// Κ — ΚΑΘΕ ΚΑΤΑΣΤΑΣΗ ΕΙΝΑΙ ΠΡΟΣΙΤΗ
// ============================================================================

/**
 * Μία **πραγματική** είσοδος ανά κατάσταση. Ο πίνακας είναι ταυτόχρονα η απόδειξη
 * ζωής και η τεκμηρίωση του «πώς φτάνει κανείς εδώ».
 */
const REACHABLE: ReadonlyArray<readonly [MandateStanding, BrokeredListingMandate]> = [
  ['declined', mandate({ confirmation: 'declined' })],
  ['expired', mandate({ confirmation: 'confirmed', expiresAt: daysFromNow(-1) })],
  ['expired-unanswered', mandate({ expiresAt: daysFromNow(-1) })],
  [
    'unannounced-live',
    mandate({
      confirmation: 'confirmed',
      notifiedAt: null,
      proof: {
        via: AGENCY_ATTESTATION,
        attestedByUserId: 'uid_1',
        attestedAt: NOW,
        documentPath: null,
      },
    }),
  ],
  ['never-notified', mandate({ notifiedAt: null })],
  ['link-revoked', mandate({ consentNonce: null })],
  ['awaiting-view', mandate({ viewedAt: null })],
  ['awaiting-decision', mandate({ viewedAt: '2026-08-20T12:00:00.000Z' })],
  ['expiring-soon', mandate({ confirmation: 'confirmed', expiresAt: daysFromNow(3) })],
  ['live', mandate({ confirmation: 'confirmed', expiresAt: daysFromNow(200) })],
];

describe('Κ — κάθε κατάσταση είναι προσιτή από πραγματική είσοδο', () => {
  it.each(REACHABLE)('Κ · %s', (expected, input) => {
    expect(mandateStandingOf(input, NOW)).toBe(expected);
  });

  it('Κ0 — ο πίνακας προσιτότητας καλύπτει ΟΛΟ το κλειστό σύνολο', () => {
    // 🔴 Χωρίς αυτό, μια ενδέκατη κατάσταση θα προστίθετο και ο πίνακας από πάνω θα
    // έμενε πράσινος **χωρίς να την αγγίξει** — δηλαδή αδρανής φρουρός με άγκυρα.
    const covered = REACHABLE.map(([standing]) => standing).sort();
    expect(covered).toEqual([...MANDATE_STANDINGS].sort());
  });
});

// ============================================================================
// Σ — Η ΣΕΙΡΑ ΤΩΝ ΕΡΩΤΗΣΕΩΝ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ
// ============================================================================

describe('Σ — ποια κατάσταση νικά όταν ισχύουν δύο', () => {
  it('Σ1 — «αρνήθηκε» νικά τη λήξη: ο άνθρωπος ΜΙΛΗΣΕ', () => {
    const input = mandate({ confirmation: 'declined', expiresAt: daysFromNow(-30) });
    expect(mandateStandingOf(input, NOW)).toBe('declined');
  });

  it('Σ2 — η λήξη νικά το «δεν στάλθηκε ποτέ»: δεν υπάρχει απάντηση που τη σώζει', () => {
    const input = mandate({ notifiedAt: null, expiresAt: daysFromNow(-1) });
    expect(mandateStandingOf(input, NOW)).toBe('expired-unanswered');
  });

  it('Σ3 — «δεν στάλθηκε» νικά το «δεν το άνοιξε»: δική μας παράλειψη, όχι του πελάτη', () => {
    const input = mandate({ notifiedAt: null, viewedAt: null });
    expect(mandateStandingOf(input, NOW)).toBe('never-notified');
  });

  it('Σ4 — η ανάκληση κρίνεται ΜΟΝΟ σε εκκρεμή· σε εγκεκριμένη αγνοείται', () => {
    const input = mandate({
      confirmation: 'confirmed',
      consentNonce: null,
      expiresAt: daysFromNow(200),
    });
    expect(mandateStandingOf(input, NOW)).toBe('live');
  });

  it('Σ5 — μη αναγνώσιμη λήξη ⇒ ΛΗΓΜΕΝΗ, ποτέ σιωπηλά «όλα καλά»', () => {
    const input = mandate({ confirmation: 'confirmed', expiresAt: 'κάποτε' });
    expect(mandateStandingOf(input, NOW)).toBe('expired');
  });
});

// ============================================================================
// Ο — Ο ΟΡΙΖΟΝΤΑΣ ΛΗΞΗΣ
// ============================================================================

describe('Ο — ο ορίζοντας των 14 ημερών', () => {
  it('Ο1 — μία μέρα ΠΡΙΝ το κατώφλι είναι ακόμη «ενεργή»', () => {
    const input = mandate({
      confirmation: 'confirmed',
      expiresAt: daysFromNow(MANDATE_EXPIRY_HORIZON_DAYS + 1),
    });
    expect(mandateStandingOf(input, NOW)).toBe('live');
  });

  it('Ο2 — ΠΑΝΩ στο κατώφλι είναι ήδη «λήγει σύντομα»', () => {
    const input = mandate({
      confirmation: 'confirmed',
      expiresAt: daysFromNow(MANDATE_EXPIRY_HORIZON_DAYS),
    });
    expect(mandateStandingOf(input, NOW)).toBe('expiring-soon');
  });

  it('Ο3 — οι μέρες στρογγυλοποιούνται ΠΡΟΣ ΤΑ ΠΑΝΩ: τρεις ώρες δεν είναι «0»', () => {
    const input = mandate({ expiresAt: new Date(Date.parse(NOW) + 3 * 3600_000).toISOString() });
    expect(daysUntilExpiry(input, NOW)).toBe(1);
  });

  it('Ο4 — ληγμένη ⇒ `null`, γιατί ο αριθμός δεν έχει νόημα', () => {
    expect(daysUntilExpiry(mandate({ expiresAt: daysFromNow(-5) }), NOW)).toBeNull();
  });
});

// ============================================================================
// Λ — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ ΚΑΤΑΣΤΑΣΕΩΝ ⇄ ΟΜΑΔΩΝ
// ============================================================================

describe('Λ — κλειστή λογιστική', () => {
  it('Λ1 — κάθε κατάσταση ανήκει σε δηλωμένη ομάδα', () => {
    for (const standing of MANDATE_STANDINGS) {
      expect(MANDATE_STANDING_GROUPS).toContain(groupOfStanding(standing));
    }
  });

  it('Λ2 — καμία ομάδα δεν είναι άδεια (ομάδα χωρίς κατάσταση = νεκρή επικεφαλίδα)', () => {
    const used = new Set(MANDATE_STANDINGS.map(groupOfStanding));
    const orphanGroups = MANDATE_STANDING_GROUPS.filter((group) => !used.has(group));
    expect(orphanGroups).toEqual([]);
  });

  it('Λ3 — καμία διπλοεγγραφή στο κλειστό σύνολο', () => {
    expect(new Set(MANDATE_STANDINGS).size).toBe(MANDATE_STANDINGS.length);
  });

  it('Λ4 — οι τρεις καταστάσεις «περιμένουν εσάς» είναι ΑΚΡΙΒΩΣ αυτές που φράζουν τον πελάτη', () => {
    const needsUs = MANDATE_STANDINGS.filter((s) => groupOfStanding(s) === 'needs-us');
    expect([...needsUs].sort()).toEqual(
      ['link-revoked', 'never-notified', 'unannounced-live'].sort(),
    );
  });
});

// ============================================================================
// Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ
// ============================================================================

describe('Μ — μία αλλαγή στην είσοδο αλλάζει την ετυμηγορία', () => {
  const cases: ReadonlyArray<
    readonly [string, Partial<BrokeredListingMandate>, MandateStanding, MandateStanding]
  > = [
    ['Μ1 · το είδε', { viewedAt: '2026-08-20T12:00:00.000Z' }, 'awaiting-view', 'awaiting-decision'],
    ['Μ2 · του στάλθηκε', { notifiedAt: null }, 'awaiting-view', 'never-notified'],
    ['Μ3 · ο σύνδεσμος ζει', { consentNonce: null }, 'awaiting-view', 'link-revoked'],
    ['Μ4 · η λήξη', { expiresAt: daysFromNow(-1) }, 'awaiting-view', 'expired-unanswered'],
    ['Μ5 · η απάντηση', { confirmation: 'declined' }, 'awaiting-view', 'declined'],
  ];

  it.each(cases)('%s', (_label, patch, before, after) => {
    const base = mandate();
    expect(mandateStandingOf(base, NOW)).toBe(before);

    const mutated = mandate(patch);
    // ⚠️ Ο φρουρός του μαθήματος Μ-Δ: η μετάλλαξη πρέπει να **άλλαξε** κάτι.
    expect(JSON.stringify(mutated)).not.toBe(JSON.stringify(base));
    expect(mandateStandingOf(mutated, NOW)).toBe(after);
  });

  it('Μ6 · το ΙΔΙΟ `notifiedAt: null` δίνει ΑΛΛΗ κατάσταση όταν η εντολή είναι εγκεκριμένη', () => {
    // 🔴 Η απόδειξη ότι `never-notified` και `unannounced-live` **δεν** είναι μία
    // κατάσταση με δύο ονόματα: ίδιο πεδίο, αντίθετη συνέπεια (τίποτα δημόσιο ⇄ όλα).
    expect(mandateStandingOf(mandate({ notifiedAt: null }), NOW)).toBe('never-notified');
    expect(
      mandateStandingOf(mandate({ notifiedAt: null, confirmation: 'confirmed' }), NOW),
    ).toBe('unannounced-live');
  });
});
