/**
 * @jest-environment node
 *
 * Άγκυρα — **Η ΕΜΒΕΛΕΙΑ ΤΗΣ ΣΥΝΔΡΟΜΗΣ** (ADR-849 Α2): ποια email αφορά ένας σύνδεσμος —
 * και ότι ένας υποχρεωτικός τύπος δεν μπαίνει ΠΟΤΕ σε αυτήν.
 */

import {
  ALL_EMAILS,
  emailScopeOf,
  parseMutableSettingPaths,
  parseScopeField,
  parseSettingPaths,
  scopeField,
  scopeSettingPaths,
} from '@/lib/notifications/email-subscription-scope';

const MATCH = 'properties.demandListingMatch';
const MANDATE = 'properties.mandateDecided';

describe('Α — από τους τύπους ενός email', () => {
  it('Α1 — ένας τύπος ⇒ η εμβέλειά του', () => {
    expect(scopeSettingPaths(emailScopeOf([MATCH]))).toEqual([MATCH]);
  });

  it('Α2 — μοναδικοί, με σειρά εμφάνισης', () => {
    expect(scopeSettingPaths(emailScopeOf([MANDATE, MATCH, MANDATE]))).toEqual([MANDATE, MATCH]);
  });

  it('Α3 🔑 — δύο συμβάντα με ΙΔΙΟ διακόπτη ⇒ ΕΝΑΣ (το συμβάν δεν είναι ο διακόπτης)', () => {
    expect(scopeSettingPaths(emailScopeOf(['procurement.quoteReceived', 'procurement.quoteScanCompleted']))).toEqual([
      'procurement.quoteReceived',
    ]);
  });

  it('Α4 🔴 — υποχρεωτικό / άγνωστο / απόν ⇒ «όλα», ποτέ μαντεψιά', () => {
    expect(emailScopeOf(['security.newDeviceLogin'])).toEqual(ALL_EMAILS);
    expect(emailScopeOf(['ghost.type', undefined])).toEqual(ALL_EMAILS);
    expect(emailScopeOf([])).toEqual(ALL_EMAILS);
  });
});

describe('Β — το πεδίο του token', () => {
  it('Β1 — στρογγυλή διαδρομή', () => {
    const scope = emailScopeOf([MATCH, MANDATE]);
    expect(scopeField(scope)).toBe(`${MATCH},${MANDATE}`);
    expect(parseScopeField(scopeField(scope))).toEqual(scope);
    expect(parseScopeField('all')).toEqual(ALL_EMAILS);
  });

  it.each(['security.newDeviceLogin', 'properties.ghost', 'properties.__proto__', '', `${MATCH},`, 'properties'])(
    '🔴 απορρίπτει %p',
    (field) => {
      expect(parseScopeField(field)).toBeNull();
    },
  );
});

describe('Γ — διαδρομές που διαβάζονται vs διαδρομές που γράφονται', () => {
  it('Γ1 — ανάγνωση: υποχρεωτικές επιτρέπονται (υπάρχουν στη βάση), κενή λίστα επιτρέπεται', () => {
    expect(parseSettingPaths(['security.newDeviceLogin'])).toEqual(['security.newDeviceLogin']);
    expect(parseSettingPaths([])).toEqual([]);
  });

  it('Γ2 🔴 — εγγραφή: ΚΑΝΕΝΑΣ υποχρεωτικός, ΟΧΙ κενή, όλοι γνωστοί', () => {
    expect(parseMutableSettingPaths(['security.newDeviceLogin'])).toBeNull();
    expect(parseMutableSettingPaths([])).toBeNull();
    expect(parseMutableSettingPaths([MATCH, 'properties.ghost'])).toBeNull();
    expect(parseMutableSettingPaths([MATCH, MATCH])).toEqual([MATCH]);
  });
});
