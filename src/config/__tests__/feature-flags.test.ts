/**
 * Η άγκυρα του διακόπτη των τιμών της βιτρίνας (ADR-923 §5.13 Σ6, ανασκόπηση Χ6), **χωρίς mock**: η πραγματική τιμή του κώδικα.
 * Ανοίγει μόνο με απόφαση Giorgio μετά τη νομική γνώμη (§23.5 Ν8). Όποιος τον ανοίξει πρέπει να αλλάξει ρητά και αυτή την άγκυρα.
 */

import { APP_FEATURE_FLAGS, isAppFeatureEnabled } from '../feature-flags';

describe('APP_FEATURE_FLAGS', () => {
  it('οι τιμές της βιτρίνας είναι ΚΛΕΙΣΤΕΣ', () => {
    expect(APP_FEATURE_FLAGS.PUBLIC_SHOWCASE_PRICES).toBe(false);
    expect(isAppFeatureEnabled('PUBLIC_SHOWCASE_PRICES')).toBe(false);
  });

  // ADR-945 §7.6 — ανοίγει με απόφαση Giorgio ΜΕΤΑ τη Φ3 (ειδοποίηση επαγγελματία): όποιος τον ανοίξει αλλάζει ρητά κι αυτό.
  it('το αίτημα προσφορών του ιδιώτη είναι ΚΛΕΙΣΤΟ', () => {
    expect(APP_FEATURE_FLAGS.OWNER_ISSUANCE_REQUESTS).toBe(false);
    expect(isAppFeatureEnabled('OWNER_ISSUANCE_REQUESTS')).toBe(false);
  });

  // ADR-947 Φ2 — dark launch: ανοίγει με απόφαση Giorgio στη Φ7· όποιος τον ανοίξει αλλάζει ρητά κι αυτό.
  it('οι επαγγελματικές βαθμίδες της αντικειμενικής αξίας είναι ΚΛΕΙΣΤΕΣ', () => {
    expect(APP_FEATURE_FLAGS.OBJECTIVE_VALUE_PROFESSIONAL_TIERS).toBe(false);
    expect(isAppFeatureEnabled('OBJECTIVE_VALUE_PROFESSIONAL_TIERS')).toBe(false);
  });

  it('παγωμένοι: καμία αλλαγή στην εκτέλεση', () => {
    expect(Object.isFrozen(APP_FEATURE_FLAGS)).toBe(true);
  });
});
