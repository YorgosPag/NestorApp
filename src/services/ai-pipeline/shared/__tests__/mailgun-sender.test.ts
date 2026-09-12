/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΑΠΟΣΤΟΛΕΑΣ MAILGUN — ΤΟ ΟΡΙΟ ΧΡΟΝΟΥ ΠΟΥ ΕΛΕΙΠΕ** (ADR-853 Φ5 · N.0.2).
 * @related services/ai-pipeline/shared/mailgun-sender.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ ΑΥΤΗ Η ΣΟΥΙΤΑ — ΚΑΙ ΓΙΑΤΙ ΤΟΣΟ ΑΡΓΑ
 * ────────────────────────────────────────────────────────────────────────────
 * Ο αποστολέας έχει **εννέα** καταναλωτές *(email λογαριασμού · πρώτη επαφή · τιμολόγια ·
 * βεβαιώσεις ΑΠΥ · ειδοποιήσεις επαγγελματία · προσφορές προμηθευτών × 2 · λογιστήριο ·
 * και πλέον η πρόσκληση χώρου)* και **καμία** άγκυρα — μετρημένο 2026-09-12: **8** σουίτες
 * τον αναφέρουν, **όλες** τον κάνουν mock. Δηλαδή ο ίδιος ο αποστολέας **δεν εκτελούνταν
 * ποτέ** σε δοκιμή.
 *
 * Αυτό επέτρεψε να ζήσει ένα πραγματικό ελάττωμα: η κλήση ήταν **γυμνό `fetch` χωρίς
 * χρονικό όριο**. Η συνηθέστερη βλάβη παρόχου δεν είναι το «όχι» — είναι η **σιωπή**, και
 * χωρίς όριο η σιωπή γίνεται αίτημα που **δεν τελειώνει**. Το ίδιο περιστατικό είναι ήδη
 * γραμμένο στο έργο *(2026-04-19, «Resend hung silently → 408 in UI»)* και γέννησε το
 * `PROVIDER_TIMEOUT_MS` — που όμως φύλαγε **μόνο** την αλυσίδα παρόχων.
 *
 * ⚠️ **Φρουρός χωρίς άγκυρα είναι σχόλιο** (ADR-587 §6.1): χωρίς αυτό το αρχείο, η επόμενη
 * «απλοποίηση» σβήνει το `signal:` και **κανείς δεν το μαθαίνει**.
 */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  }),
}));

import { PROVIDER_TIMEOUT_MS } from '@/server/comms/email-provider-chain';

import { sendReplyViaMailgun } from '../mailgun-sender';

const ENV_KEYS = ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'MAILGUN_FROM_EMAIL', 'MAILGUN_REGION'] as const;
const ORIGINAL: Record<string, string | undefined> = {};

const MESSAGE = { to: 'nikos@example.com', subject: 'Θέμα', textBody: 'Κείμενο' };

/** Το `init` που πήρε ο πραγματικός `fetch`. */
function fetchInit(): RequestInit {
  return (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
}

beforeAll(() => {
  for (const key of ENV_KEYS) ORIGINAL[key] = process.env[key];
});

beforeEach(() => {
  process.env.MAILGUN_API_KEY = 'key-δοκιμής';
  process.env.MAILGUN_DOMAIN = 'nestorconstruct.gr';
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (ORIGINAL[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL[key];
  }
});

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Π — ο παρονομαστής: ο ρυθμισμένος αποστολέας στέλνει', () => {
  it('Π1 — ρυθμισμένος + πάροχος OK ⇒ επιτυχία με αναγνωριστικό μηνύματος', async () => {
    const result = await sendReplyViaMailgun(MESSAGE);

    expect(result).toEqual({ success: true, messageId: 'msg_1' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('Π2 — ΧΩΡΙΣ ρύθμιση δεν αγγίζει καν το δίκτυο (αλλιώς το Χ2 δεν σημαίνει τίποτα)', async () => {
    delete process.env.MAILGUN_API_KEY;

    const result = await sendReplyViaMailgun(MESSAGE);

    expect(result.success).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Χ — ΤΟ ΧΡΟΝΙΚΟ ΟΡΙΟ
// =============================================================================

describe('Χ — ο φρουρός του χρόνου', () => {
  it('🔴 Χ1 — ζητά ΤΗΝ ΙΔΙΑ σταθερά της αλυσίδας, ποτέ δεύτερο αριθμό (ADR-749)', async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    await sendReplyViaMailgun(MESSAGE);

    // Μετάλλαξη σε χειρόγραφο `30_000` εδώ ⇒ ΚΟΚΚΙΝΟ: δύο όρια για το ίδιο ερώτημα
    // αποκλίνουν με την πρώτη ρύθμιση.
    expect(timeoutSpy).toHaveBeenCalledWith(PROVIDER_TIMEOUT_MS);
  });

  it('🔴 Χ2 — το σήμα ματαίωσης ΦΤΑΝΕΙ στο `fetch` (μετάλλαξη: σβήσε το `signal:` ⇒ κόκκινο)', async () => {
    await sendReplyViaMailgun(MESSAGE);

    const signal = fetchInit().signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  it('🔑 Χ3 — η ματαίωση γίνεται ΟΝΟΜΑΣΜΕΝΗ αποτυχία, ποτέ εξαίρεση προς τα πάνω', async () => {
    // Ακριβώς ό,τι πετά το `fetch` όταν λήξει το `AbortSignal.timeout`.
    global.fetch = jest.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });

    const result = await sendReplyViaMailgun(MESSAGE);

    // Ο καλών **δεν** μαθαίνει εξαίρεση: μαθαίνει ότι δεν έφυγε, και συνεχίζει.
    expect(result.success).toBe(false);
    expect(result.error).toContain('aborted');
  });
});

// =============================================================================
// Α — Η ΑΡΝΗΣΗ ΤΟΥ ΠΑΡΟΧΟΥ
// =============================================================================

describe('Α — ο πάροχος αρνείται', () => {
  it('Α1 — μη-OK απόκριση ⇒ αποτυχία με τον κωδικό μέσα, ποτέ σιωπηλή επιτυχία', async () => {
    global.fetch = jest.fn(async () => new Response('Forbidden', { status: 401 }));

    const result = await sendReplyViaMailgun(MESSAGE);

    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });
});
