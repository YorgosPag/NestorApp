/**
 * @jest-environment node
 *
 * @fileoverview **ΜΙΑ ΠΟΡΤΑ ΕΞΟΔΟΥ EMAIL** — το email ακολουθεί το επίπεδο δεδομένων (ADR-876 §5.8 Σ22).
 * @related server/comms/egress/* · services/ai-pipeline/shared/mailgun-sender · server/comms/email-adapter ·
 *          server/comms/email-providers · subapps/procurement/services/channels/email-channel
 *
 * 🔴 **Το εύρημα** (μετρημένο 2026-09-24): με `dev:emulator` ο server έστειλε **πραγματικό** email μέσω
 * Mailgun. Τέσσερις δρόμοι έφταναν στο δίκτυο· κανείς δεν ήξερε ότι τα δεδομένα του ήταν ψεύτικα.
 *
 * Ε1 πολιτική: host emulator ⇒ capture · απουσία/κενά ⇒ deliver ·
 * Ε2 🔴 σε emulator, **με όλα τα κλειδιά ρυθμισμένα**, ΚΑΝΕΝΑΣ από τους τέσσερις δρόμους δεν αγγίζει δίκτυο ή SDK —
 *    και το outbox κρατά ό,τι θα έφευγε ·
 * Ε3 εκτός emulator η πόρτα ΣΤΕΛΝΕΙ (με όριο χρόνου) — ο φρουρός δεν έκλεισε και την παραγωγή ·
 * Ε4 παρονομαστής: `mailgun.net`/`resend` ΜΟΝΟ στις δύο πόρτες, με ≥1 εύρημα στην καθεμιά ·
 * Ε5 το κανάλι πρόσκλησης: απόρριψη Resend (`{ error }`) ⇒ **μετάπτωση** στον Mailgun, όχι ψευδής επιτυχία.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('server-only', () => ({}));

const mockResendSend = jest.fn();
const mockResendCtor = jest.fn(() => ({ emails: { send: mockResendSend } }));
jest.mock('resend', () => ({ Resend: mockResendCtor }));

const ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const ENV_KEYS = [
  'FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST',
  'MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'RESEND_API_KEY',
] as const;
const saved: Record<string, string | undefined> = {};
let outbox: string;

beforeAll(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-'));
  jest.spyOn(process, 'cwd').mockReturnValue(outbox);
});
afterAll(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  fs.rmSync(outbox, { recursive: true, force: true });
});
beforeEach(() => {
  jest.clearAllMocks();
  // «Όσα κλειδιά κι αν έχει το .env» — ρυθμισμένα σε ΚΑΘΕ σενάριο.
  process.env.MAILGUN_API_KEY = 'key-δοκιμής';
  process.env.MAILGUN_DOMAIN = 'nestorconstruct.gr';
  process.env.RESEND_API_KEY = 're_δοκιμής';
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ id: 'mg_1' }), { status: 200 }));
});

/* eslint-disable @typescript-eslint/no-require-imports */
const mode = () => require('../email-delivery-mode') as typeof import('../email-delivery-mode');
const mailgun = () => require('../mailgun-transport') as typeof import('../mailgun-transport');
const sender = () => require('@/services/ai-pipeline/shared/mailgun-sender') as typeof import('@/services/ai-pipeline/shared/mailgun-sender');
const adapter = () => require('@/server/comms/email-adapter') as typeof import('@/server/comms/email-adapter');
const chain = () => require('@/server/comms/email-provider-chain') as typeof import('@/server/comms/email-provider-chain');
const providers = () => require('@/server/comms/email-providers') as typeof import('@/server/comms/email-providers');
const channel = () => require('@/subapps/procurement/services/channels/email-channel') as typeof import('@/subapps/procurement/services/channels/email-channel');
/* eslint-enable @typescript-eslint/no-require-imports */

/** Τα `.eml` του outbox (η πόρτα γράφει στο `<cwd>/.emulator-outbox`), παλαιότερο → νεότερο. */
const outboxFiles = (): string[] => {
  const dir = path.join(outbox, '.emulator-outbox');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.eml')).sort().map((n) => path.join(dir, n)) : [];
};

const invite = {
  inviteId: 'vi_1', vendorName: 'Προμηθευτής Α', recipient: 'vendor@golden.local', rfqTitle: 'Σκυρόδεμα',
  projectName: null, portalUrl: 'https://nestor.example/vendor/quote#t=x', expiresAt: '2026-10-01T00:00:00.000Z',
  locale: 'el' as const, declineUrl: null,
};

describe('Ε1 — η πολιτική: γεγονός του Firebase SDK, όχι διακόπτης', () => {
  it.each([
    [{ FIRESTORE_EMULATOR_HOST: 'localhost:8080' }, 'capture'],
    [{ FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' }, 'capture'],
    [{ FIRESTORE_EMULATOR_HOST: '   ' }, 'deliver'],
    [{ NODE_ENV: 'development' }, 'deliver'],
    [{}, 'deliver'],
  ])('%j ⇒ %s', (env, expected) => {
    expect(mode().emailDeliveryMode(env)).toBe(expected);
  });
});

describe('Ε2 — 🔴 σε emulator ΚΑΝΕΝΑΣ δρόμος δεν φτάνει στο δίκτυο', () => {
  beforeEach(() => {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  });

  it('οι τέσσερις δρόμοι + ο καθαρισμός bounce: μηδέν fetch, μηδέν SDK, όλα στο outbox', async () => {
    const before = outboxFiles().length;
    expect(await sender().sendReplyViaMailgun({ to: 'a@golden.local', subject: 'Α', textBody: 'σώμα Α' }))
      .toMatchObject({ success: true });
    expect(await new (adapter().EmailAdapter)().sendEmail({ id: 'j', to: 'b@golden.local', subject: 'Β', content: 'σώμα Β', attempts: 0, maxAttempts: 1 }))
      .toMatchObject({ success: true });
    expect(await chain().sendThroughChain(providers().defaultEmailChain(), { to: 'c@golden.local', subject: 'Γ', text: 'σώμα Γ' }))
      .toMatchObject({ kind: 'delivered', failedOver: false });
    expect(await channel().emailVendorInviteChannel.send(invite)).toMatchObject({ success: true });
    expect(await sender().clearMailgunBounce('d@golden.local')).toBe('not-listed');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockResendCtor).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(outboxFiles().length - before).toBe(4);
  });

  it('το .eml λέει ΑΚΡΙΒΩΣ ό,τι θα έφευγε (παραλήπτης · θέμα RFC 2047 · σώμα · σημάδι σύλληψης)', async () => {
    await sender().sendReplyViaMailgun({ to: 'e@golden.local', subject: 'Πρόσκληση υποβολής', textBody: 'ο σύνδεσμος' });
    const files = outboxFiles();
    const eml = fs.readFileSync(files[files.length - 1], 'utf8');
    expect(eml).toContain('To: e@golden.local');
    expect(eml).toContain(`Subject: =?UTF-8?B?${Buffer.from('Πρόσκληση υποβολής').toString('base64')}?=`);
    expect(eml).toContain(Buffer.from('ο σύνδεσμος', 'utf8').toString('base64'));
    expect(eml).toContain('X-Outbox-Captured: emulator');
  });
});

describe('Ε3 — εκτός emulator η πόρτα ΣΤΕΛΝΕΙ', () => {
  it('Mailgun: fetch με όριο χρόνου (σήμα ματαίωσης)', async () => {
    expect(await mailgun().mailgunSendMessage({ to: 'x@example.gr', subject: 's', text: 't' })).toEqual({ ok: true, messageId: 'mg_1' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v3\/nestorconstruct\.gr\/messages$/);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('Ε4 — ο παρονομαστής: ΜΟΝΟ οι δύο πόρτες μιλούν με πάροχο', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, '.ssot-registry.json'), 'utf8'));
  const patterns = (registry.modules['email-egress'].forbiddenPatterns as string[]).map((p) => new RegExp(p));
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

  it('κάθε αρχείο του src/ με mailgun.net ή resend SDK είναι μία από τις δύο πόρτες — και ΚΑΙ οι δύο βρίσκονται', () => {
    const hits = walk(path.join(ROOT, 'src'))
      .filter((file) => patterns.some((pattern) => pattern.test(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'))
      .sort();
    expect(hits).toEqual(['src/server/comms/egress/mailgun-transport.ts', 'src/server/comms/egress/resend-transport.ts']);
  });
});

describe('Ε5 — το κανάλι πρόσκλησης δεν διαβάζει την απόρριψη του Resend ως επιτυχία', () => {
  it('Resend { error } ⇒ μετάπτωση στον Mailgun', async () => {
    mockResendSend.mockResolvedValue({ data: null, error: { message: 'domain not verified' } });
    const result = await channel().emailVendorInviteChannel.send(invite);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, providerMessageId: 'mg_1', errorReason: null, channel: 'email' });
  });
});
