/**
 * ADR-884 §9.1 Α7 — ΤΟ ΙΧΝΟΣ «raw key reached the UI» ΛΕΕΙ ΑΛΗΘΕΙΑ.
 *
 * Μετρημένο ζωντανά (2026-09-26, `/properties/[id]`): η κονσόλα κατήγγελλε
 * `properties:deletionGuard.confirm.*` με `properties=absent`, ενώ ο διάλογος ήταν
 * **κλειστός** και τα κείμενα δεν ζωγραφίστηκαν ποτέ — ο hook τα υπολογίζει σε κάθε
 * render. Μετά τη φόρτωση **όλα** λύνονταν (επαληθευμένο στο στιγμιότυπο i18next).
 *
 * Διπλή βλάβη: (1) ψευδής συναγερμός σε κάθε πρώτη επίσκεψη· (2) το κλειδί
 * **σφραγιζόταν** στο `warnedUnresolvedKeys`, άρα αν έλειπε **πραγματικά** μετά τη
 * φόρτωση, το ίχνος θα σώπαινε — το αντίθετο από αυτό που υπάρχει να κάνει.
 *
 * 🔴 ΚΑΘΕ TEST ΧΡΗΣΙΜΟΠΟΙΕΙ ΔΙΚΟ ΤΟΥ ΚΛΕΙΔΙ: το `warnedUnresolvedKeys` ζει σε
 * εμβέλεια module και επιβιώνει ανάμεσα στα tests.
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';

import { useTranslation } from '../hooks/useTranslation';
import { loadNamespace } from '../lazy-config';
import { recordLoaderInstall, recordShellBootstrap, resetBundleRegistry } from '../bundle-registry';

const mockWarn = jest.fn();

// ⚠️ Βέλος, όχι `warn: mockWarn`: ο hook καλεί `createModuleLogger` σε εμβέλεια module,
// δηλαδή ΠΡΙΝ εκτελεστεί η δήλωση `const mockWarn` (TDZ).
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../lazy-config', () => ({
  loadNamespace: jest.fn(),
  CRITICAL_NAMESPACES: [],
}));

const loadNamespaceMock = loadNamespace as jest.MockedFunction<typeof loadNamespace>;
const instance = i18next.createInstance();

/**
 * `dashboard`: **καμία** εγγραφή στο `COMPAT_NAMESPACE_MAP` (βλ. αδελφή σουίτα
 * `use-translation-partial-bundle`) ⇒ φορτώνεται ακριβώς ένα namespace, και η
 * πληρότητά του είναι το μόνο που κρίνει.
 */
const NS = 'dashboard';

/** Ελεγχόμενη φόρτωση: το test αποφασίζει ΠΟΤΕ τελειώνει. */
function deferredLoad(): { finish: (bundle: Record<string, unknown>) => void } {
  let resolve: () => void = () => undefined;
  loadNamespaceMock.mockImplementation(
    () => new Promise<void>((r) => { resolve = r; }),
  );
  return {
    finish: (bundle) => {
      instance.addResourceBundle('el', NS, bundle, true, true);
      recordLoaderInstall('el', NS);
      resolve();
    },
  };
}

function warnedKeys(): string[] {
  return mockWarn.mock.calls.map(([message]) => String(message));
}

beforeAll(async () => {
  await instance.use(initReactI18next).init({
    lng: 'el',
    fallbackLng: 'el',
    resources: { el: { [NS]: { tabs: { overview: 'Επισκόπηση' } } } },
    ns: [NS],
    defaultNS: NS,
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  mockWarn.mockClear();
  loadNamespaceMock.mockReset();
  resetBundleRegistry();
  // Κομμένο από το shell slice ⇒ ο hook παραγγέλνει φόρτωση.
  recordShellBootstrap('el', [NS], []);
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={instance}>{children}</I18nextProvider>
);

describe('useTranslation — ίχνος ανεπίλυτου κλειδιού', () => {
  it('🔴 ΑΓΚΥΡΑ — ΣΙΩΠΑ όσο το namespace φορτώνεται (κλειστός διάλογος ≠ ωμό κλειδί)', () => {
    deferredLoad();
    const { result } = renderHook(() => useTranslation([NS]), { wrapper });

    expect(result.current.isNamespaceReady).toBe(false);
    result.current.t('deletionGuard.loadingWindow');

    expect(warnedKeys().filter((m) => m.includes('deletionGuard.loadingWindow'))).toEqual([]);
  });

  it('🔴 ΑΓΚΥΡΑ — ΚΑΤΑΓΓΕΛΛΕΙ κλειδί που λείπει και ΜΕΤΑ τη φόρτωση (η σιωπή δεν το σφράγισε)', async () => {
    const load = deferredLoad();
    const { result } = renderHook(() => useTranslation([NS]), { wrapper });

    result.current.t('deletionGuard.trulyMissing');
    await act(async () => { load.finish({ tabs: { overview: 'Επισκόπηση' } }); });
    await waitFor(() => expect(result.current.isNamespaceReady).toBe(true));

    result.current.t('deletionGuard.trulyMissing');

    expect(warnedKeys().filter((m) => m.includes('deletionGuard.trulyMissing'))).toHaveLength(1);
  });

  it('δεν καταγγέλλει κλειδί που η φόρτωση ΕΦΕΡΕ', async () => {
    const load = deferredLoad();
    const { result } = renderHook(() => useTranslation([NS]), { wrapper });

    result.current.t('deletionGuard.arrives');
    await act(async () => { load.finish({ deletionGuard: { arrives: 'Έφτασε' } }); });
    await waitFor(() => expect(result.current.isNamespaceReady).toBe(true));

    expect(result.current.t('deletionGuard.arrives')).toBe('Έφτασε');
    expect(warnedKeys().filter((m) => m.includes('deletionGuard.arrives'))).toEqual([]);
  });
});
