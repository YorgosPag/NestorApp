/**
 * ADR-900 §8 #2 (βήμα 2α) · ADR-884 §9.1 Α4 — μια τεμπέλικη σελίδα `ssr: false` που βάφει κείμενο **εκτός** κελύφους
 * στο πρώτο της καρέ πρέπει να **περιμένει** το namespace του: αλλιώς το chunk φτάνει πρώτο και η οθόνη δείχνει ωμά
 * κλειδιά (μετρημένο ζωντανά 2026-10-05 στην ουρά επαληθεύσεων: 560ms → 2.586ms).
 *
 * Η άγκυρα εκτελεί τον **πραγματικό** loader του μητρώου — όχι αντίγραφο της δήλωσης.
 *
 * Μετάλλαξη (2026-10-05): αφαίρεση του `namespaces` από την εγγραφή ⇒ Π1 + Π2 κοκκινίζουν.
 */

type Loader = () => Promise<{ default: unknown }>;

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: Loader) => Object.assign(() => null, { loader }),
}));

const pendingNamespaces: Array<() => void> = [];
const loadNamespace = jest.fn(
  (_namespace: string) => new Promise<void>((resolve) => { pendingNamespaces.push(resolve); }),
);
jest.mock('@/i18n/lazy-config', () => ({ loadNamespace: (namespace: string) => loadNamespace(namespace) }));

const Page = (): null => null;
jest.mock('@/components/admin/pages/OwnershipVerificationsPageContent', () => ({
  OwnershipVerificationsPageContent: Page,
}));

import { lazyRoutesAdr294 } from '../lazyRoutesAdr294';

const loaderOf = (route: unknown): Loader => (route as { loader: Loader }).loader;

beforeEach(() => {
  pendingNamespaces.length = 0;
  loadNamespace.mockClear();
});

describe('LazyRoutes.AdminOwnershipVerifications — πρώτο καρέ χωρίς ωμά κλειδιά', () => {
  it('Π1 — το chunk ζητά το `property-market` (οι καρτέλες της ουράς ζουν εκεί)', () => {
    void loaderOf(lazyRoutesAdr294.AdminOwnershipVerifications)();
    expect(loadNamespace).toHaveBeenCalledWith('property-market');
  });

  it('Π2 — η σελίδα ΔΕΝ αποδίδεται πριν φτάσει το namespace', async () => {
    let settled = false;
    const done = loaderOf(lazyRoutesAdr294.AdminOwnershipVerifications)().then((mod) => { settled = true; return mod; });
    await Promise.resolve(); await Promise.resolve();
    expect(settled).toBe(false);
    pendingNamespaces.forEach((resolve) => resolve());
    await expect(done).resolves.toEqual({ default: Page });
  });
});
