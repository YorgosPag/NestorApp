/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΔΗΛΩΜΕΝΗΣ ΒΑΘΜΙΔΑΣ** — ADR-855 §10 (Π1 · Ρ1 · Ρ2 · Ρ3).
 * @related lib/middleware/with-rate-limit.ts · lib/middleware/rate-limiter.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΤΟ «0 = ΚΑΝΕΙΣ ΔΕΝ ΚΟΙΤΑΞΕ», ΜΕΤΡΗΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 * Πριν από αυτό, ένα `grep` για `checkRateLimit|getEndpointCategory|RATE_LIMIT_CATEGORIES`
 * μέσα σε **κάθε** αρχείο `*.test.*` ολόκληρου του δέντρου επέστρεφε **ΚΕΝΟ**. Η μηχανή που
 * φυλά **449** διαδρομές δεν είχε **καμία** δοκιμή — και ακριβώς γι' αυτό το
 * `options.category` μπορούσε να αγνοείται επί μήνες με κάθε πύλη πράσινη.
 *
 * ⚠️ **ΤΟ ΚΡΙΣΙΜΟ ΕΙΝΑΙ ΤΟ ΟΡΙΟ ΠΟΥ ΦΤΑΝΕΙ ΣΤΟΝ STORE, ΟΧΙ ΤΟ ΟΤΙ ΚΛΗΘΗΚΕ Ο WRAPPER.**
 * Μια άγκυρα που ρωτούσε «κλήθηκε το `withHeavyRateLimit`;» θα ήταν **πράσινη πάνω στο
 * ελάττωμα** — ο wrapper **καλούνταν** κανονικά, απλώς δεν άλλαζε τίποτα. Είναι το ίδιο
 * σχήμα με τα δεκατρία πράσινα tests του CHECK 3.77, που ρωτούσαν «κλήθηκε το `flyTo`;»
 * αντί για «πέταξε;». Εδώ ρωτάμε **πόσο** όριο δεσμεύτηκε.
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ** (Π1): χωρίς αυτόν, ένα «όλα δίνουν 10» θα
 * περνούσε ως επιτυχία ενώ θα σήμαινε ότι ο πίνακας έπαψε να λειτουργεί.
 */

jest.mock('server-only', () => ({}));

import type { NextRequest } from 'next/server';

import { RATE_LIMIT_CATEGORIES, type RateLimitCategory } from '../rate-limit-config';

// =============================================================================
// Ο ΠΛΑΣΤΟΣ STORE — καταγράφει ΤΟ ΟΡΙΟ που του ζητήθηκε
// =============================================================================

/**
 * ⚠️ Καταγράφει `{ key, limit, windowMs }` ανά κλήση, και **επιτρέπει πάντα**: το ερώτημα
 * αυτού του αρχείου είναι *«ποιο όριο έφτασε εδώ;»*, όχι *«μπλόκαρε;»*. Ένα store που
 * αρνείται θα ανακάτευε δύο ερωτήματα σε μία μέτρηση.
 */
const seen: Array<{ key: string; limit: number; windowMs: number }> = [];

jest.mock('../rate-limit-store', () => ({
  getRateLimitStore: () => ({
    check: async (key: string, limit: number, windowMs: number) => {
      seen.push({ key, limit, windowMs });
      return { allowed: true, current: 1, limit, resetMs: windowMs };
    },
    reset: async () => undefined,
    getCount: async () => 0,
  }),
}));

// ⚠️ Το όριο ρυθμού είναι **απενεργοποιημένο σε development** (`enableRateLimiting`), και ο
//    wrapper επιστρέφει τότε **πριν** αγγίξει τον store. Χωρίς αυτό το mock η σουίτα θα
//    μετρούσε **μηδέν** κλήσεις και θα ήταν πράσινη χωρίς να εκτελέσει τίποτα — ακριβώς το
//    σχήμα «0 = κανείς δεν κοίταξε» που αυτό το αρχείο υπάρχει για να κλείσει.
jest.mock('@/config/environment-security-config', () => ({
  getCurrentSecurityPolicy: () => ({ enableRateLimiting: true }),
  getCurrentRuntimeEnvironment: () => 'production',
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import {
  withRateLimit,
  withAssetRateLimit,
  withHighRateLimit,
  withStandardRateLimit,
  withSensitiveRateLimit,
  withHeavyRateLimit,
  withWebhookRateLimit,
  withTelegramRateLimit,
} from '../with-rate-limit';

// =============================================================================
// ΒΟΗΘΗΜΑΤΑ
// =============================================================================

function request(pathname: string): NextRequest {
  return {
    url: `https://app.test${pathname}`,
    method: 'GET',
    headers: new Headers(),
  } as unknown as NextRequest;
}

const handler = async (): Promise<Response> => new Response('ok', { status: 200 });

/** Το όριο που δεσμεύτηκε στην **τελευταία** κλήση — ή σφάλμα αν δεν έγινε καμία. */
async function limitFor(
  wrapped: (req: NextRequest) => Promise<Response> | Response,
  pathname: string,
): Promise<number> {
  const before = seen.length;
  await wrapped(request(pathname));
  if (seen.length === before) {
    throw new Error(`ο store ΔΕΝ ρωτήθηκε για ${pathname} — η μέτρηση δεν έγινε`);
  }
  return seen[seen.length - 1].limit;
}

beforeEach(() => {
  seen.length = 0;
});

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο πίνακας εξακολουθεί να αποφασίζει όταν κανείς δεν δηλώνει
// =============================================================================

describe('Π — ο παρονομαστής', () => {
  it('Π1 — ΧΩΡΙΣ δήλωση, αποφασίζει ο πίνακας προθεμάτων (αμετάβλητη συμπεριφορά)', async () => {
    // `/api/admin` → SENSITIVE(20) · `/api/reports` → HEAVY(10) · άγνωστο → STANDARD(60).
    const bare = withRateLimit(handler);

    expect(await limitFor(bare, '/api/admin/backup/list')).toBe(RATE_LIMIT_CATEGORIES.SENSITIVE);
    expect(await limitFor(bare, '/api/reports/financial')).toBe(RATE_LIMIT_CATEGORIES.HEAVY);
    expect(await limitFor(bare, '/api/workspace-invitations')).toBe(RATE_LIMIT_CATEGORIES.STANDARD);
  });

  it('Π2 — ο store ρωτιέται ΠΡΑΓΜΑΤΙΚΑ (αλλιώς κάθε άγκυρα παρακάτω είναι κενή)', async () => {
    await withStandardRateLimit(handler)(request('/api/anything'));

    expect(seen).toHaveLength(1);
    expect(seen[0].windowMs).toBe(60_000);
  });
});

// =============================================================================
// Ρ — Η ΔΗΛΩΣΗ ΤΗΣ ΔΙΑΔΡΟΜΗΣ ΚΕΡΔΙΖΕΙ
// =============================================================================

describe('Ρ — η δηλωμένη βαθμίδα', () => {
  /**
   * 🔴 Η ΑΓΚΥΡΑ ΤΟΥ ΠΕΡΙΣΤΑΤΙΚΟΥ. Πριν τη διόρθωση αυτό επέστρεφε **60**.
   *
   * ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΤΟ ΡΙΞΕΙ: αφαίρεσε το τρίτο όρισμα από την κλήση
   * `checkRateLimit(identifier, endpointPath, options.category)` στο `with-rate-limit.ts`.
   */
  it('🔴 Ρ1 — `withHeavyRateLimit` σε αδήλωτο πρόθεμα δίνει 10, ΟΧΙ 60', async () => {
    expect(await limitFor(withHeavyRateLimit(handler), '/api/vendor/quote/abc123'))
      .toBe(RATE_LIMIT_CATEGORIES.HEAVY);
  });

  it('🔴 Ρ1β — `withSensitiveRateLimit` στο /api/auth/* δίνει 20, ΟΧΙ 60', async () => {
    // Η επιφάνεια ταυτότητας: το ADR-068 §6 τη δήλωνε SENSITIVE και ο πίνακας δεν την είχε.
    expect(await limitFor(withSensitiveRateLimit(handler), '/api/auth/password-reset'))
      .toBe(RATE_LIMIT_CATEGORIES.SENSITIVE);
  });

  /**
   * 🔑 Η ΑΛΛΗ ΚΑΤΕΥΘΥΝΣΗ — και είναι **μισή** από τη βλάβη: 24 διαδρομές έτρεχαν
   * **αυστηρότερα** από όσο ζήτησαν. Οι 13 `/api/reports/*` ζητούσαν 60 και έπαιρναν 10.
   */
  it('🔴 Ρ1γ — `withStandardRateLimit` στο /api/reports/* δίνει 60, ΟΧΙ 10 (οι πνιγμένες)', async () => {
    expect(await limitFor(withStandardRateLimit(handler), '/api/reports/financial'))
      .toBe(RATE_LIMIT_CATEGORIES.STANDARD);
  });

  it('🔴 Ρ2 — οι ΕΠΤΑ wrappers δίνουν ΕΠΤΑ διαφορετικά όρια, όχι ένα', async () => {
    const measured: Record<string, number> = {
      ASSET: await limitFor(withAssetRateLimit(handler), '/api/x'),
      HIGH: await limitFor(withHighRateLimit(handler), '/api/x'),
      STANDARD: await limitFor(withStandardRateLimit(handler), '/api/x'),
      SENSITIVE: await limitFor(withSensitiveRateLimit(handler), '/api/x'),
      HEAVY: await limitFor(withHeavyRateLimit(handler), '/api/x'),
      WEBHOOK: await limitFor(withWebhookRateLimit(handler), '/api/x'),
      TELEGRAM: await limitFor(withTelegramRateLimit(handler), '/api/x'),
    };

    // ⚠️ Σύγκριση με το SSoT, ΠΟΤΕ με αντιγραμμένους αριθμούς: αλλιώς η άγκυρα θα
    //    επικύρωνε τον εαυτό της αντί για τον κατάλογο (μάθημα ADR-790 §9.1).
    expect(measured).toEqual({
      ASSET: RATE_LIMIT_CATEGORIES.ASSET,
      HIGH: RATE_LIMIT_CATEGORIES.HIGH,
      STANDARD: RATE_LIMIT_CATEGORIES.STANDARD,
      SENSITIVE: RATE_LIMIT_CATEGORIES.SENSITIVE,
      HEAVY: RATE_LIMIT_CATEGORIES.HEAVY,
      WEBHOOK: RATE_LIMIT_CATEGORIES.WEBHOOK,
      TELEGRAM: RATE_LIMIT_CATEGORIES.TELEGRAM,
    });

    // Και ότι είναι όντως **επτά διακριτά** — μια μελλοντική ισοπέδωση του καταλόγου
    // (δύο βαθμίδες με το ίδιο νούμερο) θα έκανε το παραπάνω πράσινο και άχρηστο.
    expect(new Set(Object.values(measured)).size).toBe(7);
  });

  it('🔴 Ρ3 — ρητό `category` υπερισχύει του πίνακα, ΚΑΙ στις δύο κατευθύνσεις', async () => {
    const asHeavy = withRateLimit(handler, { category: 'HEAVY' });
    const asStandard = withRateLimit(handler, { category: 'STANDARD' });

    // `/api/admin` λέει SENSITIVE(20)· η δήλωση λέει HEAVY(10) — σφίγγει.
    expect(await limitFor(asHeavy, '/api/admin/anything')).toBe(RATE_LIMIT_CATEGORIES.HEAVY);
    // `/api/reports` λέει HEAVY(10)· η δήλωση λέει STANDARD(60) — χαλαρώνει.
    expect(await limitFor(asStandard, '/api/reports/sales')).toBe(RATE_LIMIT_CATEGORIES.STANDARD);
  });

  it('🔑 Ρ3β — το `getKey` ΚΑΙ το `category` τιμώνται ΜΑΖΙ (ήταν το μισό που δούλευε)', async () => {
    // Η τηλεμετρία BIM περνά **και τα δύο** στο ίδιο αντικείμενο· μέχρι σήμερα μόνο το
    // πρώτο έφτανε κάπου. Η άγκυρα κρατά τα δύο **δεμένα**.
    const wrapped = withRateLimit(handler, {
      category: 'HEAVY',
      getKey: () => 'session:abc',
    });

    await wrapped(request('/api/telemetry/bim-performance/erase'));

    const last = seen[seen.length - 1];
    expect(last.limit).toBe(RATE_LIMIT_CATEGORIES.HEAVY);
    expect(last.key).toContain('session:abc');
  });
});

// =============================================================================
// Κ — Ο ΚΑΤΑΛΟΓΟΣ: κάθε βαθμίδα είναι θετικός αριθμός, και το σύνολο κλειστό
// =============================================================================

describe('Κ — ο κατάλογος βαθμίδων', () => {
  it('Κ1 — κάθε βαθμίδα έχει θετικό όριο (fail-closed σε χαλασμένη εγγραφή)', () => {
    for (const [name, limit] of Object.entries(RATE_LIMIT_CATEGORIES)) {
      expect({ name, positive: Number.isInteger(limit) && limit > 0 })
        .toEqual({ name, positive: true });
    }
  });

  it('Κ2 — ο τύπος `RateLimitCategory` καλύπτει ΑΚΡΙΒΩΣ τα κλειδιά του καταλόγου', () => {
    const keys = Object.keys(RATE_LIMIT_CATEGORIES) as RateLimitCategory[];
    expect(keys.length).toBe(7);
  });
});
