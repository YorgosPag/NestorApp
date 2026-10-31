/**
 * ADR-884 §9.1 Α4 — μια τεμπέλικη διαδρομή `ssr: false` είναι εκτός route slice (ADR-744)· το chunk της **περιμένει**
 * τα δηλωμένα namespaces, ώστε το πρώτο καρέ να μη δείξει ωμά κλειδιά — χωρίς φραγμό `isNamespaceReady` στη σελίδα.
 *
 * Μετάλλαξη (2026-09-26): `load = importFn` πάντα ⇒ Ν1 + Ν2 κοκκινίζουν.
 */

type Loader = () => Promise<{ default: unknown }>;

let capturedLoader: Loader | null = null;
let capturedOptions: { loading: () => unknown; ssr: boolean } | null = null;
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: Loader, options: { loading: () => unknown; ssr: boolean }) => {
    capturedLoader = loader;
    capturedOptions = options;
    return () => null;
  },
}));

const pendingNamespaces: Array<() => void> = [];
const loadNamespace = jest.fn(
  () => new Promise<void>((resolve) => { pendingNamespaces.push(resolve); }),
);
jest.mock('@/i18n/lazy-config', () => ({
  ...jest.requireActual<Record<string, unknown>>('@/i18n/lazy-config'),
  loadNamespace: (...args: unknown[]) => loadNamespace(...(args as [])),
}));

// ADR-280 §11.8 — ο παραγόμενος χάρτης, ντετερμινιστικός: ένα κλειδί με γραμμή, ένα με όνομα που ο loader δεν ξέρει.
jest.mock('@/i18n/generated/lazy-route-namespaces.json', () => ({
  Mapped: ['spatial-tour', 'cash-flow'],
  Foreign: ['not-a-namespace'],
}));

import { createLazyRoute, defineLazyRoutes, defineLazySurfaces } from '../lazyRouteFactory';

const Page = (): null => null;
const importFn = (): Promise<{ default: typeof Page }> => Promise.resolve({ default: Page });

beforeEach(() => {
  capturedLoader = null;
  capturedOptions = null;
  pendingNamespaces.length = 0;
  loadNamespace.mockClear();
});

describe('createLazyRoute({ namespaces })', () => {
  it('Ν1 — ζητά κάθε δηλωμένο namespace', async () => {
    createLazyRoute(importFn, { namespaces: ['spatial-tour'] });
    void capturedLoader!();
    expect(loadNamespace).toHaveBeenCalledWith('spatial-tour');
  });

  it('Ν2 — το chunk ΔΕΝ επιλύεται πριν φτάσει το namespace', async () => {
    createLazyRoute(importFn, { namespaces: ['spatial-tour'] });
    let settled = false;
    const done = capturedLoader!().then((mod) => { settled = true; return mod; });
    await Promise.resolve(); await Promise.resolve();
    expect(settled).toBe(false);
    pendingNamespaces.forEach((resolve) => resolve());
    await expect(done).resolves.toEqual({ default: Page });
  });

  it('Ν3 — χωρίς namespaces: ο loader είναι ο ίδιος ο importFn (καμία φόρτωση)', () => {
    createLazyRoute(importFn);
    expect(capturedLoader).toBe(importFn);
    expect(loadNamespace).not.toHaveBeenCalled();
  });
});

/**
 * ADR-744 §27.10 #1 · ADR-280 §11.8 — το μητρώο περιμένει τη γραμμή του **παραγόμενου** χάρτη.
 * Μετάλλαξη: `awaitedNamespaces` επιστρέφει μόνο τη δήλωση ⇒ Χ1 + Χ2 κοκκινίζουν· χωρίς φρουρό ⇒ Χ3.
 */
describe('defineLazyRoutes — η γραμμή του lazy-route-namespaces.json', () => {
  const requested = (): unknown[] => loadNamespace.mock.calls.map((call: unknown[]) => call[0]);

  it('Χ1 — κλειδί με γραμμή: ζητά κάθε namespace της, χωρίς δήλωση', () => {
    defineLazyRoutes({ Mapped: { load: importFn } });
    void capturedLoader!();
    expect(requested()).toEqual(['spatial-tour', 'cash-flow']);
  });

  it('Χ2 — ένωση με τη δήλωση, χωρίς διπλή λήψη· η δήλωση πρώτη', () => {
    defineLazyRoutes({ Mapped: { load: importFn, namespaces: ['property-market', 'cash-flow'] } });
    void capturedLoader!();
    expect(requested()).toEqual(['property-market', 'cash-flow', 'spatial-tour']);
  });

  it('Χ3 — όνομα που ο loader δεν ξέρει ΔΕΝ ζητείται (ποτέ άδειο bundle)', () => {
    defineLazyRoutes({ Foreign: { load: importFn } });
    expect(capturedLoader).not.toBeNull();
    void capturedLoader!();
    expect(loadNamespace).not.toHaveBeenCalled();
  });

  it('Χ4 — κλειδί χωρίς γραμμή: μόνο η δήλωση', () => {
    defineLazyRoutes({ Unmapped: { load: importFn, namespaces: ['cash-flow'] } });
    void capturedLoader!();
    expect(requested()).toEqual(['cash-flow']);
  });
});

/**
 * ADR-280 §11.8 Β4.1 — μια **επιφάνεια** (διάλογος, καρτέλα) περνά από την ΙΔΙΑ μηχανή με τη διαδρομή.
 * Μετάλλαξη Μ14: το `defineLazySurfaces` παρακάμπτει το `awaitedNamespaces` ⇒ Σ7 κοκκινίζει.
 */
describe('defineLazySurfaces — η ΙΔΙΑ γραμμή, χωρίς skeleton διαδρομής', () => {
  const requested = (): unknown[] => loadNamespace.mock.calls.map((call: unknown[]) => call[0]);
  const Fallback = (): null => null;

  it('Σ7 — ζητά γραμμή ∪ δήλωση, και το chunk περιμένει τα κείμενα', async () => {
    defineLazySurfaces({ Mapped: { load: importFn, namespaces: ['property-market'] } });
    let settled = false;
    const done = capturedLoader!().then((mod) => { settled = true; return mod; });
    expect(requested()).toEqual(['property-market', 'spatial-tour', 'cash-flow']);
    await Promise.resolve(); await Promise.resolve();
    expect(settled).toBe(false);
    pendingNamespaces.forEach((resolve) => resolve());
    await expect(done).resolves.toEqual({ default: Page });
  });

  it('Σ8 — πάντα client· fallback = τίποτα, ή ό,τι δηλώθηκε', () => {
    defineLazySurfaces({ Unmapped: { load: importFn } });
    expect(capturedOptions!.ssr).toBe(false);
    expect(capturedOptions!.loading()).toBeNull();
    defineLazySurfaces({ Unmapped: { load: importFn, fallback: Fallback } });
    expect(capturedOptions!.loading()).toEqual(<Fallback />);
  });
});

/**
 * ADR-280 §11.8 Β4.3 — το prefetch περνά από τον ΙΔΙΟ φορτωτή του μητρώου (React Router `route.lazy` / Remix `intent`).
 * Μετάλλαξη: `preload` = σκέτο `importFn` (κώδικας χωρίς κείμενα) ⇒ Σ9 κοκκινίζει.
 */
describe('preload — ο ΙΔΙΟΣ φορτωτής, κώδικας + κείμενα', () => {
  const requested = (): unknown[] => loadNamespace.mock.calls.map((call: unknown[]) => call[0]);

  it('Σ9 — το preload() ζητά τη γραμμή και επιλύεται μόνο όταν φτάσουν κώδικας ΚΑΙ κείμενα', async () => {
    const { Mapped } = defineLazySurfaces({ Mapped: { load: importFn } });
    let settled = false;
    const done = Mapped.preload().then(() => { settled = true; });
    expect(requested()).toEqual(['spatial-tour', 'cash-flow']);
    await Promise.resolve(); await Promise.resolve();
    expect(settled).toBe(false);
    pendingNamespaces.forEach((resolve) => resolve());
    await expect(done).resolves.toBeUndefined();
  });

  it('Σ10 — και η διαδρομή προφορτώνεται με τον ίδιο τρόπο (ένας πυρήνας)', () => {
    const { Mapped } = defineLazyRoutes({ Mapped: { load: importFn } });
    void Mapped.preload();
    expect(requested()).toEqual(['spatial-tour', 'cash-flow']);
  });
});
