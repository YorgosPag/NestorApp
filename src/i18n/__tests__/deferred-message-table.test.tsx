/**
 * ADR-744 §34 — ΠΙΝΑΚΕΣ ΜΗΝΥΜΑΤΩΝ ΕΚΤΟΣ ΠΡΩΤΟΥ ΚΑΡΕ.
 *
 * Τι πρέπει να ισχύει, και τι κοκκινίζει αν σπάσει:
 *   · ΠΟΤΕ ωμό κλειδί: χωρίς πίνακα **ή** χωρίς πλήρες bundle ⇒ η λέξη `pending`, ποτέ `t(undefined)` / κλειδί.
 *   · μία φόρτωση ανά πίνακα (single-flight)· μετά από αποτυχία, η επόμενη ζήτηση ξαναδοκιμάζει.
 *   · `needed` ⇒ φόρτωση αμέσως· αλλιώς σε αδράνεια (με κλήση **ως μέθοδος** — αποσπασμένο το
 *     `window.requestIdleCallback` πετά «Illegal invocation»).
 */
import { act, renderHook } from '@testing-library/react';

import { defineDeferredMessageTable, whenIdle, type IdleHost } from '../deferred-message-table';
import { useDeferredMessage } from '../hooks/useDeferredMessageTable';
import { recordLoaderInstall, resetBundleRegistry } from '../bundle-registry';
import { resetNamespaceLoadState } from '../namespace-load';
import type { Namespace } from '../lazy-config';

const mockLoadNamespace = jest.fn((_namespace: string, _language?: string) => Promise.resolve());

jest.mock('../lazy-config', () => ({
  loadNamespace: (namespace: string, language?: string) => mockLoadNamespace(namespace, language),
}));

// Μία απόπειρα ανά φόρτωση: η πολιτική επανάληψης έχει δικά της tests (ADR-744 §25).
jest.mock('../namespace-load', () => {
  const actual = jest.requireActual('../namespace-load') as typeof import('../namespace-load');
  return { ...actual, importWithRetry: <T,>(loader: () => Promise<T>) => loader() };
});

type Code = 'tooShort' | 'tooLong';
const KEYS: Readonly<Record<Code, string>> = { tooShort: 'issues.tooShort', tooLong: 'issues.tooLong' };
const NAMESPACES = ['catalog'] as unknown as readonly Namespace[];

const t = (key: string): string => `«${key}»`;
const PENDING = 'pending';

function deferred(loader: () => Promise<Readonly<Record<Code, string>>> = () => Promise.resolve(KEYS)) {
  return defineDeferredMessageTable<Readonly<Record<Code, string>>>(`test-${Math.random()}`, NAMESPACES, loader);
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  resetBundleRegistry();
  resetNamespaceLoadState();
  mockLoadNamespace.mockClear();
});

describe('defineDeferredMessageTable', () => {
  it('φορτώνει ΜΙΑ φορά, όσες ζητήσεις κι αν έρθουν μαζί, και ζητά και τα namespaces του', async () => {
    const loader = jest.fn(() => Promise.resolve(KEYS));
    const table = deferred(loader);
    await Promise.all([table.load(), table.load(), table.load()]);
    await table.load();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(mockLoadNamespace).toHaveBeenCalledWith('catalog', undefined);
    expect(table.getTable()).toBe(KEYS);
  });

  it('ειδοποιεί τους συνδρομητές όταν φτάσει ο πίνακας', async () => {
    const table = deferred();
    const listener = jest.fn();
    table.subscribe(listener);
    await table.load();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('αποτυχία ⇒ κανένας πίνακας, καμία απόρριψη, και η ΕΠΟΜΕΝΗ ζήτηση ξαναδοκιμάζει', async () => {
    const loader = jest.fn()
      .mockRejectedValueOnce(new Error('Failed to load chunk'))
      .mockResolvedValueOnce(KEYS);
    const table = deferred(loader);
    await expect(table.load()).resolves.toBeUndefined();
    expect(table.getTable()).toBeNull();
    await table.load();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(table.getTable()).toBe(KEYS);
  });
  it('αστοχία στο αίτημα namespace ΔΕΝ μπλοκάρει τον πίνακα — η πληρότητα κρίνεται χωριστά, στο μητρώο', async () => {
    mockLoadNamespace.mockImplementationOnce(() => Promise.reject(new TypeError('addResourceBundle is not a function')));
    const table = deferred();
    await table.load();
    expect(table.getTable()).toBe(KEYS);
  });
});

describe('whenIdle', () => {
  const timerHost = (): IdleHost => ({
    setTimeout: jest.fn(() => 7),
    clearTimeout: jest.fn(),
  });

  it('καλεί το requestIdleCallback ΩΣ ΜΕΘΟΔΟ του host, με ανώτατο όριο αναμονής', () => {
    const host: IdleHost = {
      ...timerHost(),
      requestIdleCallback(this: IdleHost, callback: () => void, options?: { timeout: number }) {
        if (this !== host) throw new TypeError('Illegal invocation');
        expect(options?.timeout).toBeGreaterThan(0);
        callback();
        return 3;
      },
      cancelIdleCallback: jest.fn(),
    };
    const run = jest.fn();
    const cancel = whenIdle(host, run);
    expect(run).toHaveBeenCalledTimes(1);
    cancel();
    expect(host.cancelIdleCallback).toHaveBeenCalledWith(3);
  });

  it('χωρίς requestIdleCallback ⇒ setTimeout, και η ακύρωση το καθαρίζει', () => {
    const host = timerHost();
    const cancel = whenIdle(host, jest.fn());
    expect(host.setTimeout).toHaveBeenCalledTimes(1);
    cancel();
    expect(host.clearTimeout).toHaveBeenCalledWith(7);
  });
});

describe('useDeferredMessage — ποτέ ωμό κλειδί', () => {
  const render = (table: ReturnType<typeof deferred>, needed: boolean) =>
    renderHook(() => useDeferredMessage(table, { language: 'el', needed, t, pending: PENDING }));

  it('πριν τον πίνακα: η λέξη pending', () => {
    const { result } = render(deferred(() => new Promise(() => undefined)), true);
    expect(result.current('tooShort')).toBe(PENDING);
  });

  it('πίνακας ΧΩΡΙΣ πλήρες bundle: ακόμη pending (τα κλειδιά του λείπουν επίτηδες από το slice)', async () => {
    const { result } = render(deferred(), true);
    await flush();
    expect(result.current('tooShort')).toBe(PENDING);
  });

  it('πίνακας ΚΑΙ πλήρες bundle: το ακριβές μήνυμα', async () => {
    const { result } = render(deferred(), true);
    await flush();
    act(() => recordLoaderInstall('el', 'catalog'));
    expect(result.current('tooLong')).toBe('«issues.tooLong»');
  });

  it('needed ⇒ φόρτωση αμέσως, χωρίς να περιμένει αδράνεια', async () => {
    const loader = jest.fn(() => Promise.resolve(KEYS));
    render(deferred(loader), true);
    await flush();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('χωρίς ανάγκη ⇒ ΚΑΜΙΑ φόρτωση στο render· μόνο όταν έρθει η αδράνεια', async () => {
    jest.useFakeTimers();
    try {
      const loader = jest.fn(() => Promise.resolve(KEYS));
      render(deferred(loader), false);
      expect(loader).not.toHaveBeenCalled();
      act(() => { jest.runOnlyPendingTimers(); });
      expect(loader).toHaveBeenCalledTimes(1);
      await flush();
    } finally {
      jest.useRealTimers();
    }
  });
});
