/**
 * ADR-726 §13.5 — πολιτική έκθεσης των διαδρομών `/test-harness/**`.
 *
 * Είναι κανόνας **ασφάλειας**, όχι ευκολίας: μια διαδρομή δοκιμών που διαρρέει στην
 * παραγωγή εκθέτει ολόκληρο τον viewer χωρίς `AdminGuard`. Μέχρι το ADR-726 ο κανόνας
 * ζούσε σε **τέσσερα** inline αντίγραφα του `process.env.NODE_ENV === 'production'`.
 *
 * Το κρίσιμο συμβόλαιο που καρφώνεται εδώ: η νέα σημαία `ENABLE_PERF_HARNESS`
 * ανοίγει **ΜΟΝΟ** το harness μέτρησης — **δεν** διευρύνει τα άλλα τρία.
 */

import {
  isTestHarnessRouteEnabled,
  isPerfHarnessRouteEnabled,
  isTerrainFusionProbeRouteEnabled,
  TERRAIN_FUSION_PROBE_CLOSES_ON,
} from '../test-harness-access';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_PERF_FLAG = process.env.ENABLE_PERF_HARNESS;

/**
 * `NODE_ENV` είναι read-only στους τύπους του Next, οπότε χρειάζεται ρητό cast.
 *
 * ⚠️ **ΟΧΙ `Object.defineProperty`.** Το `process.env` του Node είναι ειδικό
 * αντικείμενο: ένας descriptor με `value` **δεν** αλλάζει την πραγματική τιμή — η
 * ανάγνωση συνεχίζει να επιστρέφει την παλιά. Μια δοκιμή γραμμένη έτσι «αποδεικνύει»
 * ότι ο φρουρός αγνοεί το `NODE_ENV`, ενώ στην πραγματικότητα η ίδια η δοκιμή δεν
 * άλλαξε ποτέ τίποτα (επαληθεύτηκε με computed-key ανάγνωση, 2026-07-29).
 */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string>).NODE_ENV = value;
}

describe('test-harness route access (ADR-726 §13.5)', () => {
  afterEach(() => {
    setNodeEnv(ORIGINAL_NODE_ENV ?? 'test');
    if (ORIGINAL_PERF_FLAG === undefined) {
      delete process.env.ENABLE_PERF_HARNESS;
    } else {
      process.env.ENABLE_PERF_HARNESS = ORIGINAL_PERF_FLAG;
    }
  });

  describe('isTestHarnessRouteEnabled — dev only, καμία εξαίρεση', () => {
    it.each(['development', 'test'])('%s → ανοιχτό', (env) => {
      setNodeEnv(env);
      expect(isTestHarnessRouteEnabled()).toBe(true);
    });

    it('production → κλειστό', () => {
      setNodeEnv('production');
      expect(isTestHarnessRouteEnabled()).toBe(false);
    });

    it('🔒 production + ENABLE_PERF_HARNESS=1 → ΠΑΡΑΜΕΝΕΙ κλειστό', () => {
      setNodeEnv('production');
      process.env.ENABLE_PERF_HARNESS = '1';
      // Η σημαία του perf harness ΔΕΝ είναι γενικό «άνοιξε τα πάντα».
      expect(isTestHarnessRouteEnabled()).toBe(false);
    });
  });

  describe('isPerfHarnessRouteEnabled — dev, ή production που το ζήτησε ρητά', () => {
    it('development → ανοιχτό χωρίς σημαία', () => {
      setNodeEnv('development');
      delete process.env.ENABLE_PERF_HARNESS;
      expect(isPerfHarnessRouteEnabled()).toBe(true);
    });

    it('production χωρίς σημαία → κλειστό (η προεπιλογή του nestorconstruct.gr)', () => {
      setNodeEnv('production');
      delete process.env.ENABLE_PERF_HARNESS;
      expect(isPerfHarnessRouteEnabled()).toBe(false);
    });

    it('production + ENABLE_PERF_HARNESS=1 → ανοιχτό (τοπική μέτρηση Φ5)', () => {
      setNodeEnv('production');
      process.env.ENABLE_PERF_HARNESS = '1';
      expect(isPerfHarnessRouteEnabled()).toBe(true);
    });

    it.each(['0', 'true', 'yes', '', 'TRUE'])(
      'production + ENABLE_PERF_HARNESS=%p → κλειστό (μόνο το ακριβές "1" ανοίγει)',
      (value) => {
        setNodeEnv('production');
        process.env.ENABLE_PERF_HARNESS = value;
        expect(isPerfHarnessRouteEnabled()).toBe(false);
      },
    );
  });

  describe('isTerrainFusionProbeRouteEnabled — παραγωγή μόνο ως τη δηλωμένη ημερομηνία (ADR-920 §14.12 Β0)', () => {
    const closesAt = Date.parse(`${TERRAIN_FUSION_PROBE_CLOSES_ON}T00:00:00Z`);

    it('production, ένα ms πριν από το κλείσιμο → ανοιχτό', () => {
      setNodeEnv('production');
      expect(isTerrainFusionProbeRouteEnabled(new Date(closesAt - 1))).toBe(true);
    });

    it('🔒 production, τη στιγμή του κλεισίματος και μετά → κλειστό', () => {
      setNodeEnv('production');
      expect(isTerrainFusionProbeRouteEnabled(new Date(closesAt))).toBe(false);
      expect(isTerrainFusionProbeRouteEnabled(new Date(closesAt + 365 * 86_400_000))).toBe(false);
    });

    it('development → ανοιχτό και μετά το κλείσιμο', () => {
      setNodeEnv('development');
      expect(isTerrainFusionProbeRouteEnabled(new Date(closesAt + 86_400_000))).toBe(true);
    });

    it('🔒 ΔΕΝ διευρύνει τα άλλα δύο: production πριν από το κλείσιμο ⇒ μένουν κλειστά', () => {
      setNodeEnv('production');
      delete process.env.ENABLE_PERF_HARNESS;
      expect(isTestHarnessRouteEnabled()).toBe(false);
      expect(isPerfHarnessRouteEnabled()).toBe(false);
    });

    it('η ημερομηνία κλεισίματος είναι έγκυρη ημερομηνία ISO', () => {
      expect(TERRAIN_FUSION_PROBE_CLOSES_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(closesAt)).toBe(false);
    });
  });
});
