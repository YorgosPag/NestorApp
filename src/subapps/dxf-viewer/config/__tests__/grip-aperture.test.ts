/**
 * 🔴 ADR-739 §27.16 Ε4 — **Η ΟΠΗ ΤΗΣ ΛΑΒΗΣ, ΜΙΑ ΦΟΡΑ.**
 *
 * Ο τύπος `gripSize × dpiScale + 2` ήταν γραμμένος **τέσσερις** φορές, και ο φραγμός
 * `max(…, TOLERANCE_CONFIG.GRIP_APERTURE)` **μόνο σε μία** από αυτές. Δηλαδή, με μικρό `gripSize`,
 * ο δείκτης **φώτιζε** μια λαβή σε άλλη ακτίνα από αυτήν που την **έπιανε**. Και ο πίνακας
 * (§27.11) άφηνε κενό **σταθερό 8 px** ενώ η ζωντανή οπή είναι **9 px** στις προεπιλογές —
 * λανθάνον σφάλμα που μεγαλώνει αναλογικά με τη ρύθμιση του χρήστη.
 */

import { TOLERANCE_CONFIG } from '../tolerance-config';
import { GRIP_SIZE_DEFAULT } from '../grip-size-default';
import { gripAperturePx, gripSizePx } from '../grip-aperture';

describe('🔴 §27.16 Ε4 — gripSizePx: το ΜΕΓΕΘΟΣ της λαβής σε px οθόνης', () => {
  it('είναι το γινόμενο μεγέθους × κλίμακας οθόνης', () => {
    expect(gripSizePx({ gripSize: 7, dpiScale: 2 })).toBe(14);
  });

  it('χωρίς ρυθμίσεις πέφτει στις ίδιες προεπιλογές που είχαν και τα τέσσερα αντίγραφα', () => {
    expect(gripSizePx({})).toBe(5);
    expect(gripSizePx()).toBe(5);
  });
});

describe('🔴 §27.16 Ε4 — gripAperturePx: η ΟΠΗ ΣΥΛΛΗΨΗΣ', () => {
  it('είναι το μέγεθος συν το περιθώριο σύλληψης', () => {
    expect(gripAperturePx({ gripSize: 20, dpiScale: 1 })).toBe(22);
  });

  it('🔴 ΠΟΤΕ κάτω από το δάπεδο του `TOLERANCE_CONFIG.GRIP_APERTURE` — ο φραγμός έλειπε από 3 στους 4', () => {
    // Με `gripSize: 1` ο ωμός τύπος δίνει 3 px: μια λαβή που πρακτικά δεν πιάνεται.
    expect(gripAperturePx({ gripSize: 1, dpiScale: 1 })).toBe(TOLERANCE_CONFIG.GRIP_APERTURE);
  });

  it('🔴 στις ΠΡΟΕΠΙΛΟΓΕΣ βγάζει 9 px — ο μετρημένος αριθμός του §27.11, όχι το 8 της σταθεράς', () => {
    expect(gripAperturePx({ gripSize: GRIP_SIZE_DEFAULT, dpiScale: 1 })).toBe(GRIP_SIZE_DEFAULT + 2);
    expect(gripAperturePx({ gripSize: GRIP_SIZE_DEFAULT, dpiScale: 1 })).toBeGreaterThan(
      TOLERANCE_CONFIG.GRIP_APERTURE,
    );
  });

  it('🔴 μεγαλώνει με τη ρύθμιση του χρήστη — γι΄ αυτό ΔΕΝ μπορεί να είναι σταθερά', () => {
    expect(gripAperturePx({ gripSize: 20, dpiScale: 1 })).toBeGreaterThan(
      gripAperturePx({ gripSize: GRIP_SIZE_DEFAULT, dpiScale: 1 }),
    );
  });

  it('ακολουθεί την κλίμακα οθόνης (retina)', () => {
    expect(gripAperturePx({ gripSize: 10, dpiScale: 2 })).toBe(22);
  });
});
