/**
 * Ambient module declaration για το `vitest`.
 *
 * Το έργο τρέχει **Jest**, όχι Vitest. Δύο tests όμως γράφτηκαν με το vitest API
 * (`src/lib/audit/__tests__/audit-diff.test.ts`, `bim-3d/converters/__tests__/
 * envelope-to-three.test.ts`) και εκτελούνται κανονικά επειδή τα ονόματα
 * (`describe`/`it`/`expect`/`vi`) ταιριάζουν στα globals του Jest. Το `vitest` δεν
 * είναι εγκατεστημένο ως dependency, άρα το import χρειάζεται ambient δήλωση για
 * να μη σκάσει TS2307.
 *
 * ## Πού ζει και γιατί εδώ
 *
 * Καταναλώνεται **και από τα δύο** TypeScript programs (ένα test στο `src/lib`, ένα
 * στο subapp), άρα ιδιοκτήτης είναι το root κατά ADR-719 — το subapp program το
 * βλέπει μέσω του `src/subapps/dxf-viewer/types/root-ambient.d.ts`.
 *
 * Οι τύποι είναι σκόπιμα χαλαροί: σκοπός είναι να αναλυθεί το module, όχι να
 * αναπαραχθεί η επιφάνεια του Vitest.
 *
 * 💡 Η σωστή μακροπρόθεσμη κίνηση είναι να μεταγραφούν τα δύο tests σε Jest API και
 * να **σβηστεί** αυτό το αρχείο — δεν έχει νόημα να συντηρείται δήλωση για framework
 * που δεν τρέχει.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-719-ambient-declaration-ssot.md
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'vitest' {
  type TestFn = (name: string, fn?: (...args: any[]) => any, timeout?: number) => void;
  type HookFn = (fn: (...args: any[]) => any, timeout?: number) => void;

  export const describe: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const test: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const it: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const expect: any;
  export const beforeAll: HookFn;
  export const afterAll: HookFn;
  export const beforeEach: HookFn;
  export const afterEach: HookFn;
  export const vi: any;
}
