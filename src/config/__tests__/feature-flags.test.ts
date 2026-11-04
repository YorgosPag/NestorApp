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

  it('παγωμένοι: καμία αλλαγή στην εκτέλεση', () => {
    expect(Object.isFrozen(APP_FEATURE_FLAGS)).toBe(true);
  });
});
