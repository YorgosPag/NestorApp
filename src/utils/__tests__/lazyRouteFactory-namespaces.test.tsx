/**
 * ADR-884 §9.1 Α4 — μια τεμπέλικη διαδρομή `ssr: false` είναι εκτός route slice (ADR-744)· το chunk της **περιμένει**
 * τα δηλωμένα namespaces, ώστε το πρώτο καρέ να μη δείξει ωμά κλειδιά — χωρίς φραγμό `isNamespaceReady` στη σελίδα.
 *
 * Μετάλλαξη (2026-09-26): `load = importFn` πάντα ⇒ Ν1 + Ν2 κοκκινίζουν.
 */

type Loader = () => Promise<{ default: unknown }>;

let capturedLoader: Loader | null = null;
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: Loader) => {
    capturedLoader = loader;
    return () => null;
  },
}));

const pendingNamespaces: Array<() => void> = [];
const loadNamespace = jest.fn(
  () => new Promise<void>((resolve) => { pendingNamespaces.push(resolve); }),
);
jest.mock('@/i18n/lazy-config', () => ({ loadNamespace: (...args: unknown[]) => loadNamespace(...(args as [])) }));

import { createLazyRoute } from '../lazyRouteFactory';

const Page = (): null => null;
const importFn = (): Promise<{ default: typeof Page }> => Promise.resolve({ default: Page });

beforeEach(() => {
  capturedLoader = null;
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
