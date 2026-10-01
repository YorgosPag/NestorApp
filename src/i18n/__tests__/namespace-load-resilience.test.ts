/**
 * ADR-744 §25 — ΤΟ CHUNK ΠΟΥ ΑΠΕΤΥΧΕ ΚΑΙ ΚΑΝΕΙΣ ΔΕΝ ΞΑΝΑΖΗΤΗΣΕ.
 *
 * Μετρημένο σε Chrome (2026-10-01): `Failed to load chunk …properties-detail_json…`
 * ⇒ το `loadTranslations` επέστρεφε `{}` ⇒ το bundle έμενε `absent` ⇒ 184 ωμά κλειδιά
 * στην καρτέλα ακινήτου, αθεράπευτα. Αυτό το αρχείο φυλά τα τρία μισά της θεραπείας:
 * επανάληψη, μία φόρτωση ανά κλειδί, ρητή αποτυχία + ανάκτηση.
 *
 * ⚠️ Ο loader εδώ **απορρίπτει πραγματικά** (όπως το `import()` ενός chunk που δεν
 * ήρθε) — δεν μαρκάρουμε το μητρώο με το χέρι. Ένα test που έγραφε `failed` μόνο του
 * θα ήταν πράσινο πάνω από loader που ακόμα κατάπινε το σφάλμα.
 */
import i18n from 'i18next';

import { loadNamespace } from '../lazy-config';
import { getNamespaceLoader } from '../namespace-loaders';
import { getBundleState, getFailedBundles, resetBundleRegistry } from '../bundle-registry';
import {
  NAMESPACE_RETRY_POLICY,
  armBundleRecovery,
  importWithRetry,
  resetNamespaceLoadState,
  singleFlight,
  type RecoveryHost,
} from '../namespace-load';

jest.mock('../namespace-loaders', () => ({ getNamespaceLoader: jest.fn() }));

const getLoaderMock = getNamespaceLoader as jest.MockedFunction<typeof getNamespaceLoader>;
const CHUNK_ERROR = new Error('Failed to load chunk /_next/static/chunks/src_i18n_locales_el_spatial-tour_json.js');
const TRANSLATIONS = { upload: { title: 'Ανέβασμα λήψης' } };
const noSleep = (): Promise<void> => Promise.resolve();

/** Loader που αποτυγχάνει τις πρώτες `failures` φορές και μετά φέρνει το αρχείο. */
function flakyLoader(failures: number): jest.Mock<Promise<{ default: typeof TRANSLATIONS }>> {
  let calls = 0;
  return jest.fn(() => {
    calls += 1;
    return calls <= failures ? Promise.reject(CHUNK_ERROR) : Promise.resolve({ default: TRANSLATIONS });
  });
}

beforeAll(async () => {
  await i18n.init({ lng: 'el', fallbackLng: 'el', resources: {}, interpolation: { escapeValue: false } });
});

beforeEach(() => {
  jest.useRealTimers();
  resetBundleRegistry();
  resetNamespaceLoadState();
  getLoaderMock.mockReset();
  i18n.removeResourceBundle('el', 'spatial-tour');
});

describe('importWithRetry — επανάληψη με εκθετική αναμονή', () => {
  it('επιστρέφει την πρώτη επιτυχία μετά από παροδικές αποτυχίες', async () => {
    const loader = flakyLoader(2);
    await expect(importWithRetry(loader, NAMESPACE_RETRY_POLICY, noSleep)).resolves.toEqual({ default: TRANSLATIONS });
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('αναμονές 300 → 900 → 2700 ms (τριπλασιασμός)', async () => {
    const waits: number[] = [];
    const sleep = (ms: number): Promise<void> => { waits.push(ms); return Promise.resolve(); };
    await expect(importWithRetry(flakyLoader(99), NAMESPACE_RETRY_POLICY, sleep)).rejects.toBe(CHUNK_ERROR);
    expect(waits).toEqual([300, 900, 2700]);
  });

  it('🔴 ΑΓΚΥΡΑ — εξαντλημένες απόπειρες ΠΕΤΟΥΝ το σφάλμα, ποτέ σιωπηλό κενό', async () => {
    const loader = flakyLoader(99);
    await expect(importWithRetry(loader, NAMESPACE_RETRY_POLICY, noSleep)).rejects.toBe(CHUNK_ERROR);
    expect(loader).toHaveBeenCalledTimes(NAMESPACE_RETRY_POLICY.attempts);
  });
});

describe('singleFlight — μία φόρτωση ανά κλειδί', () => {
  it('ταυτόχρονες ζητήσεις του ίδιου κλειδιού μοιράζονται ΕΝΑ promise', async () => {
    const run = jest.fn(() => Promise.resolve());
    const a = singleFlight('el:x', run);
    const b = singleFlight('el:x', run);
    expect(a).toBe(b);
    await a;
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('μετά από αποτυχία το κλειδί ελευθερώνεται — η επόμενη ζήτηση είναι ΝΕΑ απόπειρα', async () => {
    const run = jest.fn().mockRejectedValueOnce(CHUNK_ERROR).mockResolvedValueOnce(undefined);
    await expect(singleFlight('el:x', run)).rejects.toBe(CHUNK_ERROR);
    await expect(singleFlight('el:x', run)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('loadNamespace — η αποτυχία ΔΗΛΩΝΕΤΑΙ και ΑΝΑΚΤΑΤΑΙ', () => {
  it('παροδική αποτυχία chunk ⇒ επανάληψη ⇒ complete και το κλειδί λύνεται', async () => {
    jest.useFakeTimers();
    getLoaderMock.mockReturnValue(flakyLoader(1));

    const done = loadNamespace('spatial-tour', 'el');
    await jest.advanceTimersByTimeAsync(NAMESPACE_RETRY_POLICY.baseDelayMs);
    await done;

    expect(getBundleState('el', 'spatial-tour')).toBe('complete');
    expect(i18n.t('spatial-tour:upload.title')).toBe('Ανέβασμα λήψης');
  });

  it('🔴 ΑΓΚΥΡΑ — εξαντλημένη αποτυχία ⇒ `failed` στο μητρώο, και το promise ΔΕΝ απορρίπτει', async () => {
    jest.useFakeTimers();
    getLoaderMock.mockReturnValue(flakyLoader(99));

    // `forceReload`: παρακάμπτει το `translationCache` που γέμισε το προηγούμενο test.
    const done = loadNamespace('spatial-tour', 'el', true);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(done).resolves.toBeUndefined();

    expect(getBundleState('el', 'spatial-tour')).toBe('failed');
    expect(getFailedBundles()).toEqual([{ language: 'el', namespace: 'spatial-tour' }]);
  });

  it('ταυτόχρονα mounts ⇒ ΕΝΑ import, όχι ένα ανά καλούντα (μετρημένο: έως 4)', async () => {
    const loader = flakyLoader(0);
    getLoaderMock.mockReturnValue(loader);
    await Promise.all([1, 2, 3, 4].map(() => loadNamespace('spatial-tour', 'el', true)));
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('armBundleRecovery — ό,τι έμεινε failed ξαναζητείται', () => {
  function fakeHost(visible: boolean): RecoveryHost & { fire: (type: 'online' | 'visibilitychange') => void } {
    const handlers = new Map<string, Array<() => void>>();
    return {
      addEventListener: (type, listener) => handlers.set(type, [...(handlers.get(type) ?? []), listener]),
      isVisible: () => visible,
      fire: (type) => (handlers.get(type) ?? []).forEach((handler) => handler()),
    };
  }

  it('online / ορατή καρτέλα ⇒ ανάκτηση· κρυφή καρτέλα ⇒ τίποτα', () => {
    const recover = jest.fn();
    const visibleHost = fakeHost(true);
    armBundleRecovery(visibleHost, recover);
    visibleHost.fire('online');
    visibleHost.fire('visibilitychange');
    expect(recover).toHaveBeenCalledTimes(2);

    resetNamespaceLoadState();
    const hiddenRecover = jest.fn();
    const hiddenHost = fakeHost(false);
    armBundleRecovery(hiddenHost, hiddenRecover);
    hiddenHost.fire('visibilitychange');
    expect(hiddenRecover).not.toHaveBeenCalled();
  });

  it('οπλίζεται ΜΙΑ φορά — δεύτερη αποτυχία δεν διπλασιάζει τους listeners', () => {
    const recover = jest.fn();
    const host = fakeHost(true);
    armBundleRecovery(host, recover);
    armBundleRecovery(host, recover);
    host.fire('online');
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it('🔴 ΑΓΚΥΡΑ — από άκρη σε άκρη: failed ⇒ `online` ⇒ complete', async () => {
    jest.useFakeTimers();
    getLoaderMock.mockReturnValue(flakyLoader(NAMESPACE_RETRY_POLICY.attempts));
    const onlineHandlers: Array<() => void> = [];
    const addListener = jest.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'online') onlineHandlers.push(handler as () => void);
    });

    const first = loadNamespace('spatial-tour', 'el', true);
    await jest.advanceTimersByTimeAsync(10_000);
    await first;
    expect(getBundleState('el', 'spatial-tour')).toBe('failed');

    onlineHandlers.forEach((handler) => handler());
    await jest.advanceTimersByTimeAsync(10_000);

    expect(getBundleState('el', 'spatial-tour')).toBe('complete');
    addListener.mockRestore();
  });
});
