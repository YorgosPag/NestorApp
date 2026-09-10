/**
 * @jest-environment node
 *
 * Άγκυρα — **ΟΙ ΚΕΦΑΛΙΔΕΣ ΤΟΥ ΦΑΚΕΛΟΥ ΦΤΑΝΟΥΝ ΚΑΙ ΣΤΟΥΣ ΔΥΟ ΚΡΙΚΟΥΣ** (ADR-848)
 *
 * 🔑 **Γιατί και στους δύο**: αν τις περνούσε μόνο ο ένας, μια σιωπηλή μετάπτωση θα
 * άλλαζε τον φάκελο — και το «Κατάργηση εγγραφής» του Gmail θα εμφανιζόταν ή όχι
 * ανάλογα με το ποιος πάροχος ήταν όρθιος εκείνη την ώρα.
 *
 * ⚠️ **Καμία πραγματική αποστολή (Π3)**: το δίκτυο του Mailgun και το SDK του Resend
 * είναι ψεύτικα. Εκτελείται όμως ο **αληθινός** `EmailAdapter` — αλλιώς η άγκυρα θα
 * δοκίμαζε τη δική της υπόθεση για το πώς γράφεται το `FormData`.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/app/api/communications/webhooks/telegram/firebase/availability', () => ({
  isFirebaseAvailable: () => false,
}));
jest.mock('@/app/api/communications/webhooks/telegram/firebase/helpers-lazy', () => ({
  getFirestoreHelpers: jest.fn(),
}));
jest.mock('@/app/api/communications/webhooks/telegram/firebase/safe-op', () => ({
  safeDbOperation: jest.fn(),
}));

const mockResendSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockResendSend } })),
}));

import { mailgunProvider, resendProvider } from '@/server/comms/email-providers';
import { safeHeaderEntries, type OutboundEmail } from '@/server/comms/email-provider-chain';

const CRLF = String.fromCharCode(13, 10);

const UNSUBSCRIBE: Readonly<Record<string, string>> = {
  'List-Unsubscribe': '<https://nestorconstruct.gr/api/notifications/email/subscription?t=abc>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
};

const BASE: OutboundEmail = { to: 'a@example.com', subject: 'Θέμα', text: 'Σώμα' };

const ENV_KEYS = ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'RESEND_API_KEY'] as const;
const ORIGINAL_ENV = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

let fetchSpy: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  process.env.MAILGUN_API_KEY = 'key-test';
  process.env.MAILGUN_DOMAIN = 'mg.example.com';
  process.env.RESEND_API_KEY = 're_test';
  fetchSpy = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ id: 'mg-1' }), { status: 200 }));
  mockResendSend.mockReset().mockResolvedValue({ data: { id: 're-1' }, error: null });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** Το σώμα της κλήσης Mailgun — ως `FormData`, αλλιώς η άγκυρα δεν κοίταξε τίποτα. */
function mailgunForm(): FormData {
  const body = fetchSpy.mock.calls[0]?.[1]?.body;
  if (!(body instanceof FormData)) {
    throw new Error('Το Mailgun δεν έλαβε FormData — η άγκυρα δεν κοίταξε τίποτα.');
  }
  return body;
}

// ============================================================================
// Α — MAILGUN
// ============================================================================

describe('Α — Mailgun: κάθε κεφαλίδα γίνεται h:<Όνομα>', () => {
  it('περνά ΚΑΙ τις δύο κεφαλίδες του RFC 8058', async () => {
    const result = await mailgunProvider().send({ ...BASE, headers: UNSUBSCRIBE });

    expect(result.kind).toBe('delivered');
    const form = mailgunForm();
    expect(form.get('h:List-Unsubscribe')).toBe(UNSUBSCRIBE['List-Unsubscribe']);
    expect(form.get('h:List-Unsubscribe-Post')).toBe('List-Unsubscribe=One-Click');
  });

  it('χωρίς κεφαλίδες δεν γράφει κανένα h: — τα υπάρχοντα email δεν αλλάζουν', async () => {
    await mailgunProvider().send(BASE);

    expect([...mailgunForm().keys()].some((key) => key.startsWith('h:'))).toBe(false);
  });
});

// ============================================================================
// Β — RESEND
// ============================================================================

describe('Β — Resend: οι ίδιες κεφαλίδες, στο πεδίο headers του SDK', () => {
  it('περνά τις κεφαλίδες αυτούσιες', async () => {
    await resendProvider().send({ ...BASE, headers: UNSUBSCRIBE });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({ headers: UNSUBSCRIBE }));
  });

  it('χωρίς κεφαλίδες δεν στέλνει κλειδί headers', async () => {
    await resendProvider().send(BASE);

    expect(mockResendSend.mock.calls[0]?.[0]).not.toHaveProperty('headers');
  });
});

// ============================================================================
// Γ — ΕΓΧΥΣΗ ΚΕΦΑΛΙΔΩΝ
// ============================================================================

describe('Γ — έγχυση κεφαλίδων: τίποτα δεν φεύγει στο δίκτυο', () => {
  const INJECTED = { 'List-Unsubscribe': `<https://x.example>${CRLF}Bcc: victim@example.com` };

  it('Mailgun: αλλαγή γραμμής σε τιμή ⇒ απόρριψη ΠΡΙΝ το fetch', async () => {
    await expect(mailgunProvider().send({ ...BASE, headers: INJECTED })).rejects.toThrow(
      /line break/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Resend: το ίδιο, ΠΡΙΝ το SDK', async () => {
    await expect(resendProvider().send({ ...BASE, headers: INJECTED })).rejects.toThrow(
      /line break/,
    );
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it.each(['Bcc:', 'X Bad', ''])('όνομα %p ⇒ απόρριψη', (name) => {
    expect(() => safeHeaderEntries({ [name]: 'x' })).toThrow(/Invalid email header name/);
  });

  it('έγκυρες κεφαλίδες περνούν αυτούσιες, με τη σειρά τους', () => {
    expect(safeHeaderEntries(UNSUBSCRIBE)).toEqual(Object.entries(UNSUBSCRIBE));
    expect(safeHeaderEntries(undefined)).toEqual([]);
  });
});
