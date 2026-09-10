/**
 * @jest-environment node
 *
 * Άγκυρα — **ΤΟ ΕΙΣΙΤΗΡΙΟ ΤΗΣ ΔΙΑΓΡΑΦΗΣ** (ADR-848)
 *
 * Κάθε άρνηση εδώ είναι μια ζημιά που θα γινόταν χωρίς αυτήν: πλαστό token που
 * καταργεί email ξένου · token άλλης πύλης που περνά για διαγραφή · ένα email που
 * **δεν φεύγει** επειδή λείπει μεταβλητή περιβάλλοντος.
 */

jest.mock('server-only', () => ({}));

import { ALL_EMAILS, emailScopeOf } from '@/lib/notifications/email-subscription-scope';
import { encodeSignedToken } from '@/lib/tokens/signed-token';
import {
  EMAIL_SUBSCRIPTION_SECRET_ENV,
  issueEmailSubscriptionToken,
  readEmailSubscriptionToken,
} from '@/services/notifications/email-subscription-token.service';

const SECRET = 'test-secret-for-email-subscription';
const ORIGINAL = process.env[EMAIL_SUBSCRIPTION_SECRET_ENV];

beforeEach(() => {
  process.env[EMAIL_SUBSCRIPTION_SECRET_ENV] = SECRET;
});

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env[EMAIL_SUBSCRIPTION_SECRET_ENV];
  else process.env[EMAIL_SUBSCRIPTION_SECRET_ENV] = ORIGINAL;
});

function issued(uid: string): string {
  const token = issueEmailSubscriptionToken(uid);
  if (token === null) throw new Error('Δεν εκδόθηκε token — η άγκυρα δεν κοίταξε τίποτα.');
  return token;
}

describe('Α — το σωστό token', () => {
  it('Α1 — στρογγυλή διαδρομή: ό,τι εκδίδεται, διαβάζεται στον ίδιο χρήστη', () => {
    expect(readEmailSubscriptionToken(issued('u1'))).toEqual({ ok: true, uid: 'u1', scope: ALL_EMAILS });
  });

  it('Α2 — base64url: ασφαλές μέσα σε διαδρομή και ερώτημα, χωρίς κωδικοποίηση', () => {
    expect(issued('u1')).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('Β — κάθε πλαστογραφία απορρίπτεται ως «invalid»', () => {
  it('Β1 — αλλοιωμένος χαρακτήρας', () => {
    const token = issued('u1');
    const tampered = `${token.slice(0, -2)}${token.endsWith('A') ? 'B' : 'A'}${token.slice(-1)}`;
    expect(readEmailSubscriptionToken(tampered)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('Β2 🔴 — υπογραφή του ΙΔΙΟΥ μυστικού για ΑΛΛΟ σκοπό δεν περνά', () => {
    const otherPurpose = encodeSignedToken(SECRET, ['mandate', 'v1', 'u1']);
    expect(readEmailSubscriptionToken(otherPurpose)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('Β3 — token άλλου μυστικού', () => {
    const token = issued('u1');
    process.env[EMAIL_SUBSCRIPTION_SECRET_ENV] = 'another-secret';
    expect(readEmailSubscriptionToken(token)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('Β4 — σκουπίδια', () => {
    expect(readEmailSubscriptionToken('')).toEqual({ ok: false, reason: 'invalid' });
    expect(readEmailSubscriptionToken('not-a-token')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('Γ — χωρίς μυστικό: ΥΠΟΒΑΘΜΙΣΗ, ποτέ διακοπή αλληλογραφίας', () => {
  it('Γ1 🔑 — η έκδοση επιστρέφει null (το email φεύγει χωρίς διαγραφή) — ΔΕΝ πετά', () => {
    delete process.env[EMAIL_SUBSCRIPTION_SECRET_ENV];
    expect(issueEmailSubscriptionToken('u1')).toBeNull();
  });

  it('Γ2 — η ανάγνωση λέει server-config: φταίμε εμείς, όχι ο σύνδεσμος', () => {
    const token = issued('u1');
    delete process.env[EMAIL_SUBSCRIPTION_SECRET_ENV];
    expect(readEmailSubscriptionToken(token)).toEqual({ ok: false, reason: 'server-config' });
  });

  it('Γ3 — ταυτότητα με `:` δεν υπογράφεται καθόλου (δύο σύνολα πεδίων, ίδιο κείμενο)', () => {
    expect(issueEmailSubscriptionToken('u:1')).toBeNull();
    expect(issueEmailSubscriptionToken('')).toBeNull();
  });
});

describe('📧 Δ — ADR-849: εμβέλεια ΜΕΣΑ στην υπογραφή (v2)', () => {
  const LISTING_MATCH = emailScopeOf(['properties.demandListingMatch']);

  it('Δ1 🔑 — εμβέλεια τύπου: στρογγυλή διαδρομή', () => {
    const token = issueEmailSubscriptionToken('u1', LISTING_MATCH);
    if (token === null) throw new Error('Δεν εκδόθηκε token — η άγκυρα δεν κοίταξε τίποτα.');
    expect(readEmailSubscriptionToken(token)).toEqual({ ok: true, uid: 'u1', scope: LISTING_MATCH });
  });

  it('Δ2 🔴 — ΠΑΛΙΟ token v1 (email του ADR-848) δουλεύει ΓΙΑ ΠΑΝΤΑ, ως «όλα»', () => {
    const legacy = encodeSignedToken(SECRET, ['email-sub', 'v1', 'u1']);
    expect(readEmailSubscriptionToken(legacy)).toEqual({ ok: true, uid: 'u1', scope: ALL_EMAILS });
  });

  it('Δ3 🔴 — εμβέλεια με ΥΠΟΧΡΕΩΤΙΚΟ ή άγνωστο τύπο ⇒ άκυρο (ποτέ «όλα» κατά μαντεψιά)', () => {
    for (const field of ['security.newDeviceLogin', 'properties.ghost', '', 'all,properties.demandListingMatch']) {
      const token = encodeSignedToken(SECRET, ['email-sub', 'v2', 'u1', field === '' ? 'x' : field]);
      expect(readEmailSubscriptionToken(token)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('Δ4 — v2 χωρίς εμβέλεια / v1 με εμβέλεια ⇒ άκυρο', () => {
    expect(readEmailSubscriptionToken(encodeSignedToken(SECRET, ['email-sub', 'v2', 'u1']))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(readEmailSubscriptionToken(encodeSignedToken(SECRET, ['email-sub', 'v1', 'u1', 'all']))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
