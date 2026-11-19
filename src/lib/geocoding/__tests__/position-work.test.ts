/**
 * ΑΓΚΥΡΑ — **«εκκρεμεί» σημαίνει ΕΝΑ πράγμα σε όλο το σύστημα** (ADR-332 §D33).
 *
 * Ο γραφέας, το μητρώο και η σάρωση ρωτούν την ίδια ερώτηση· αν απαντούσαν διαφορετικά, η σάρωση θα
 * έβαζε στην ουρά ό,τι ο γραφέας δεν θα άγγιζε ποτέ (για πάντα στην ουρά), ή το αντίστροφο.
 */

import {
  POSITION_WORK_BACKOFF_MS,
  addressNeedsPosition,
  positionRetryDelayMs,
  unsettledAddressIds,
} from '../position-work';
import { GEOCODING_POLICY_REVISION } from '../geocoding-policy-revision';

const TSIMISKI = { street: 'Τσιμισκή', number: '43', city: 'Θεσσαλονίκη' };
const HOUR = 60 * 60 * 1000;

describe('Ε — ποια διεύθυνση περιμένει θέση', () => {
  it('Ε1 — κείμενο χωρίς θέση και χωρίς ίχνος ⇒ εκκρεμεί', () => {
    expect(addressNeedsPosition(TSIMISKI)).toBe(true);
  });

  it('Ε2 — καμία οδός και καμία πόλη ⇒ ΔΕΝ εκκρεμεί (ο γραφέας δεν θα ρωτούσε ποτέ ⇒ αιώνια ουρά)', () => {
    expect(addressNeedsPosition({ postalCode: '54623' })).toBe(false);
  });

  it('Ε3 — πινέζα ανθρώπου ⇒ κριμένη, ποτέ στην ουρά', () => {
    expect(addressNeedsPosition({ ...TSIMISKI, coordinates: { lat: 40.63, lng: 22.94 }, source: 'dragged' })).toBe(false);
  });

  it('Ε4 — «δεν βρέθηκε» για ΑΥΤΟ το κείμενο στην ΤΡΕΧΟΥΣΑ πολιτική ⇒ κριμένη', () => {
    const attempt = { status: 'unmatched' as const, revision: GEOCODING_POLICY_REVISION, at: 1, resolvedFor: TSIMISKI };
    expect(addressNeedsPosition({ ...TSIMISKI, geocodeAttempt: attempt })).toBe(false);
  });

  it('Ε5 — «δεν βρέθηκε» σε ΠΑΛΙΑ πολιτική ⇒ εκκρεμεί ξανά (αυτόματο rematch όταν βελτιωθεί η αναζήτηση)', () => {
    const attempt = { status: 'unmatched' as const, revision: GEOCODING_POLICY_REVISION - 1, at: 1, resolvedFor: TSIMISKI };
    expect(addressNeedsPosition({ ...TSIMISKI, geocodeAttempt: attempt })).toBe(true);
  });

  it('Ε6 — μόνο διευθύνσεις ΜΕ ταυτότητα: ο γραφέας ταιριάζει μόνο με `id`', () => {
    expect(unsettledAddressIds([{ ...TSIMISKI }, { ...TSIMISKI, id: 'addr_1' }])).toEqual(['addr_1']);
  });
});

describe('Α — η αναμονή μετά από αναπάντητη δοκιμή', () => {
  it('Α1 — 1ώ → 6ώ → 24ώ → 7μ', () => {
    expect([1, 2, 3, 4].map(positionRetryDelayMs)).toEqual([HOUR, 6 * HOUR, 24 * HOUR, 7 * 24 * HOUR]);
  });

  it('Α2 — η τελευταία βαθμίδα ΕΠΑΝΑΛΑΜΒΑΝΕΤΑΙ: ποτέ εγκατάλειψη', () => {
    expect(positionRetryDelayMs(50)).toBe(POSITION_WORK_BACKOFF_MS[POSITION_WORK_BACKOFF_MS.length - 1]);
  });
});
