/**
 * @fileoverview 🔴 **Η ΓΡΑΜΜΗ ΚΑΤΑΛΗΨΗΣ ΔΕΝ ΤΥΠΩΝΕΙ ΚΕΝΟ ΣΤΗ ΘΕΣΗ ΑΠΑΝΤΗΣΗΣ.**
 * @related ADR-834 §6.5 · components/mandate/MandateOccupancyPanel.tsx · ADR-832 §4
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ, ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το πάνελ έγραφε, **ζωντανά**:
 *
 * ```
 * Άλλο γραφείο — Αποκλειστική, με δικαίωμα του ιδιοκτήτη για , ως 2027-04-30
 *                                                             ^^^^ ΚΕΝΟ
 * ```
 *
 * Το κληροδοτημένο έγγραφο *(προ-ADR-832)* έχει `scope: []`, και το `join` σε κενό
 * πίνακα δίνει **κενή συμβολοσειρά**: η οθόνη παρουσίαζε **την άγνοιά της ως έγκυρη
 * λίστα**. Το ίδιο το `MandateOccupancy.scope` δηλώνει ρητά ότι το κενό σύνολο είναι
 * **έγκυρη κατάσταση** — άρα η οθόνη όφειλε να έχει λέξεις γι' αυτήν.
 *
 * 🔑 **Η ΑΣΥΜΜΕΤΡΙΑ ΠΟΥ ΤΟ ΚΑΝΕΙ ΚΛΑΣΗ**: για το άγνωστο **όνομα** η ίδια συνάρτηση
 * έκανε ήδη ακριβώς το σωστό — `nameOf(…) ?? t(occupancyHolderOther)`. Δύο άγνωστα
 * δίπλα-δίπλα, **το ένα ονομασμένο και το άλλο σιωπηλό**.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { MandateOccupancyPanel } from '@/components/mandate/MandateOccupancyPanel';
import { SCREEN_KEYS } from '@/components/mandate/mandate-request-form-labels';
import type { MandateOccupancy } from '@/lib/mandate/mandate-conflict';
import { EXCLUSIVE_AGENCY } from '@/types/listing-agreement';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values === undefined
        ? key
        : `${key}[${Object.entries(values)
            .map(([name, value]) => `${name}=${value}`)
            .join('|')}]`,
  }),
}));

const AGENCY = 'comp_alfa';

/** Το **ζωντανό** κληροδοτημένο σχήμα: κάτοχος και λήξη γνωστά, πράξεις άγνωστες. */
const UNKNOWN_SCOPE: MandateOccupancy = {
  agencyCompanyId: AGENCY,
  agreement: EXCLUSIVE_AGENCY,
  scope: [],
  // ⚠️ **Το `startsAt` είναι υποχρεωτικό πεδίο του κριτή.** Έλειπε στην πρώτη γραφή:
  //    εδώ δεν φαινόταν *(η οθόνη ζωγραφίζει, δεν κρίνει)*, αλλά στο
  //    `mandate-hint-claims.test.ts` έκανε τον κριτή να απαντά `undetermined`.
  //    Συμπληρώνεται εδώ ώστε το fixture να μη διδάσκει λάθος σχήμα (N.0.2).
  startsAt: '2026-08-31T00:00:00.000Z',
  expiresAt: '2027-04-30T23:59:59.999Z',
};

const KNOWN_SCOPE: MandateOccupancy = { ...UNKNOWN_SCOPE, scope: ['sell'] };

/** Η μία γραμμή που ζωγράφισε η οθόνη — ό,τι κείμενο έφτασε στο DOM. */
function lineFor(occupancy: MandateOccupancy): string {
  const { unmount } = render(
    <MandateOccupancyPanel
      notice={{ kind: 'occupied', held: [occupancy] }}
      nameOf={() => null}
    />,
  );
  const text = screen.getByRole('listitem').textContent ?? '';
  unmount();
  return text;
}

describe('🔑 Κ — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η γραμμή ζωγραφίζεται και ΛΕΕΙ κάτι', () => {
  it('Κ0 — με ΓΝΩΣΤΕΣ πράξεις, η θέση της λίστας ΔΕΝ είναι κενή', () => {
    // Χωρίς αυτό, μια οθόνη που δεν ζωγραφίζει **τίποτα** θα περνούσε το Κ1.
    expect(lineFor(KNOWN_SCOPE)).toContain('resource=');
    expect(lineFor(KNOWN_SCOPE)).not.toContain('resource=|');
    expect(lineFor(KNOWN_SCOPE)).not.toContain(SCREEN_KEYS.occupancyScopeUnknown);
  });
});

describe('🔴 Λ — η άγνοια για τις πράξεις ΟΝΟΜΑΖΕΤΑΙ', () => {
  it('🔴 Λ1 — με ΚΕΝΟ `scope`, η θέση της λίστας ΔΕΝ μένει κενή', () => {
    // Ακριβώς το ζωντανό «… για , ως …»: η τιμή `resource` έφτανε **άδεια** στο
    // πρότυπο. Η μετάλλαξη που επαναφέρει το `join` σκέτο κοκκινίζει **εδώ**.
    expect(lineFor(UNKNOWN_SCOPE)).not.toContain('resource=|');
    expect(lineFor(UNKNOWN_SCOPE)).not.toMatch(/resource=\]/);
  });

  it('🔴 Λ2 — και ονομάζεται με το ΔΙΚΟ της κλειδί, όχι με το κείμενο άλλης άγνοιας', () => {
    const line = lineFor(UNKNOWN_SCOPE);
    expect(line).toContain(SCREEN_KEYS.occupancyScopeUnknown);
    // ⚠️ Δεν δανείζεται το κείμενο του άγνωστου **ονόματος**: δύο άγνωστα, δύο λέξεις.
    expect(line).toContain(SCREEN_KEYS.occupancyHolderOther);
    expect(SCREEN_KEYS.occupancyScopeUnknown).not.toBe(SCREEN_KEYS.occupancyHolderOther);
  });

  it('Λ3 — ο κάτοχος και η λήξη ΕΞΑΚΟΛΟΥΘΟΥΝ να λέγονται (καμία απώλεια)', () => {
    // Η θεραπεία δεν επιτρέπεται να «λύσει» το κενό κρύβοντας τη γραμμή: ο άνθρωπος
    // χάνει **ποιος κρατά** και **ως πότε** — ό,τι ακριβώς ήρθε να δείξει το πάνελ.
    const line = lineFor(UNKNOWN_SCOPE);
    expect(line).toContain('agency=');
    expect(line).toContain('until=');
  });

  it('🔴 Λ4 — και η λήξη ονομάζει την ΗΜΕΡΑ ΠΟΥ ΓΡΑΦΤΗΚΕ (ADR-834 §6.5)', () => {
    // Δεύτερο μέλος της ίδιας κλάσης: `…T23:59:59.999Z` δεν επιτρέπεται να διαβαστεί
    // ως 01/05. Ο πλήρης έλεγχος ζει στο `mandate-term-day.test.ts`.
    expect(lineFor(UNKNOWN_SCOPE)).toContain('2027');
    expect(lineFor(UNKNOWN_SCOPE)).not.toContain('T23:59');
  });
});
