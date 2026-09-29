/**
 * @fileoverview **Οι καθαροί κριτές της Φάσης 2** — ADR-894 §10 Β2 · Β3 · Β4.
 * @related session-lifecycle.ts (`partitionSessionsOverview`, `endReasonOf`) · sign-in-novelty.ts ·
 *   legacy-session-scrub.ts
 *
 * | Μετάλλαξη | Άγκυρα που κοκκινίζει |
 * |---|---|
 * | ληγμένη «active» μετράει ζωντανή / τελειωμένες όχι από την πιο πρόσφατη | Ο1 · Ο2 |
 * | άγνωστη θέση μετρά ως «νέα χώρα» | Ν3 |
 * | ειδοποίηση στην ΠΡΩΤΗ εγγραφή του λογαριασμού | Ν1 |
 * | έκδοση browser μετρά ως νέα συσκευή | Ν4 |
 * | ο καθαρισμός αγγίζει εγγραφές του ΝΕΟΥ σχήματος / κρατά την τοποθεσία ipapi | Κ1 · Κ2 |
 */

import { endReasonOf, partitionSessionsOverview } from '../session-lifecycle';
import { assessSignInNovelty, signInFactsOf } from '../sign-in-novelty';
import { planLegacySessionScrub } from '../legacy-session-scrub';
import { LEGACY_LOCATION } from '../session-helpers';

const NOW = new Date('2026-09-29T12:00:00Z');
const H = 3_600_000;
const DAY = 24 * H;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

describe('Ο — ζωντανές και τελειωμένες (Β2)', () => {
  const session = (id: string, status: string, expiresIn: number, extra: Record<string, unknown> = {}) => ({
    id, status, timestamps: { expiresAt: at(expiresIn), lastActiveAt: at(-H) }, ...extra,
  });

  it('Ο1 — «active» που έληξε ΔΕΝ είναι ζωντανή· τελείωσε τη στιγμή της λήξης', () => {
    const { live, ended } = partitionSessionsOverview(
      [session('live', 'active', H), session('stale', 'active', -2 * H)],
      NOW,
    );
    expect(live.map((s) => s.id)).toEqual(['live']);
    expect(ended).toEqual([{ session: expect.objectContaining({ id: 'stale' }), reason: 'expired', endedAt: at(-2 * H) }]);
  });

  it('Ο2 — οι τελειωμένες από την πιο πρόσφατη, με τη στιγμή ανάκλησης όπου υπάρχει', () => {
    const { ended } = partitionSessionsOverview([
      session('old', 'revoked', -DAY, { revocationReason: 'logout', timestamps: { expiresAt: at(-DAY), lastActiveAt: at(-3 * DAY), revokedAt: at(-3 * DAY) } }),
      session('new', 'revoked', H, { revocationReason: 'user_requested', timestamps: { expiresAt: at(H), lastActiveAt: at(-H), revokedAt: at(-H) } }),
    ], NOW);
    expect(ended.map((e) => [e.session.id, e.reason])).toEqual([['new', 'removed'], ['old', 'signed_out']]);
  });

  it('Ο3 — κάθε λόγος ανάκλησης έχει όνομα· άγνωστος (παλιά εγγραφή) ⇒ «αφαιρέθηκε»', () => {
    expect(endReasonOf('revoked', 'revoked_all_other')).toBe('removed');
    expect(endReasonOf('revoked', 'auto_revoked_max_sessions')).toBe('device_limit');
    expect(endReasonOf('revoked', 'mystery')).toBe('removed');
    expect(endReasonOf('expired', undefined)).toBe('expired');
  });
});

describe('Ν — «νέα σύνδεση από νέα χώρα/συσκευή» (Β3)', () => {
  const doc = (countryCode: string | null, precision: string, browserType = 'Chrome', os = 'Windows') => ({
    location: { countryCode, precision },
    deviceInfo: { browserType, os },
  });
  const gr = signInFactsOf(doc('GR', 'city'));

  it('Ν1 — πρώτη εγγραφή του λογαριασμού ⇒ τίποτα', () => {
    expect(assessSignInNovelty(signInFactsOf(doc('NG', 'city')), [])).toEqual([]);
  });

  it('Ν2 — νέα χώρα και νέα συσκευή ⇒ και οι δύο λόγοι, με σταθερή σειρά', () => {
    expect(assessSignInNovelty(signInFactsOf(doc('NG', 'city', 'Safari', 'macOS')), [gr])).toEqual(['new-country', 'new-device']);
  });

  it('Ν3 🔴 άγνωστη θέση (localhost · ιδιωτική IP · παλιά εγγραφή) ΔΕΝ είναι «νέα χώρα»', () => {
    expect(assessSignInNovelty(signInFactsOf(doc(null, 'none')), [gr])).toEqual([]);
    expect(assessSignInNovelty(signInFactsOf({ location: { countryCode: 'NG' }, deviceInfo: { browserType: 'Chrome', os: 'Windows' } }), [gr])).toEqual([]);
  });

  it('Ν4 — η θέση της ΤΕΛΕΥΤΑΙΑΣ δραστηριότητας μετρά ως γνωστή· η έκδοση browser όχι ως νέα συσκευή', () => {
    const roamed = signInFactsOf({ ...doc('GR', 'city'), lastLocation: { countryCode: 'NG', precision: 'city' } });
    const chromeUpdate = { location: { countryCode: 'NG', precision: 'country' }, deviceInfo: { browser: 'Chrome 141', browserType: 'Chrome', os: 'Windows' } };
    expect(assessSignInNovelty(signInFactsOf(chromeUpdate), [roamed])).toEqual([]);
  });
});

describe('Κ — καθαρισμός της εποχής ipapi (Β4)', () => {
  const nowMs = NOW.getTime();
  const legacy = {
    location: { ipHash: '85448d44', countryCode: 'GR', countryName: 'Greece', city: 'Thessaloniki' },
    status: 'revoked', expiresAtMs: nowMs - 10 * DAY, revokedAtMs: nowMs - 11 * DAY, hasPurgeAt: false, hasIsCurrent: true,
  };

  it('Κ1 🔴 η τοποθεσία του ipapi φεύγει· purgeAt = τέλος + 90 ημέρες· isCurrent φεύγει', () => {
    expect(planLegacySessionScrub(legacy, nowMs)).toEqual({
      kind: 'scrub',
      update: { location: LEGACY_LOCATION, purgeAtMs: nowMs - 11 * DAY + 90 * DAY, markExpired: false, dropIsCurrent: true },
    });
  });

  it('Κ2 🔴 εγγραφή του ΝΕΟΥ σχήματος δεν αγγίζεται (ιδεμποτία: δεύτερη εκτέλεση = 0)', () => {
    expect(planLegacySessionScrub({ ...legacy, location: LEGACY_LOCATION }, nowMs)).toEqual({ kind: 'skip' });
  });

  it('Κ3 — πέρα από τις 90 ημέρες ⇒ purgeAt = τώρα (σβήνει στο επόμενο πέρασμα του TTL)· ληγμένη «active» ⇒ expired', () => {
    const plan = planLegacySessionScrub({ ...legacy, status: 'active', revokedAtMs: null, expiresAtMs: nowMs - 120 * DAY }, nowMs);
    expect(plan).toMatchObject({ kind: 'scrub', update: { purgeAtMs: nowMs, markExpired: true } });
  });

  it('Κ4 — υπάρχον purgeAt μένει ως έχει', () => {
    expect(planLegacySessionScrub({ ...legacy, hasPurgeAt: true }, nowMs)).toMatchObject({ update: { purgeAtMs: null } });
  });
});
