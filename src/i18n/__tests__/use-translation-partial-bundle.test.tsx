/**
 * ADR-744 §11 — ΤΟ ΔΕΥΤΕΡΟ ΣΗΜΕΙΟ ΑΠΟΦΑΣΗΣ.
 *
 * Το `loadNamespace` δεν είναι το μόνο που ρωτούσε «υπάρχει κάτι;» αντί για
 * «υπάρχει ΟΛΟ;». Το `useTranslation` το ρωτούσε **δύο φορές**: στο αρχικό
 * `useState` και στο `useEffect` που παραγγέλνει τη φόρτωση. Το δεύτερο είναι το
 * επικίνδυνο — είναι το `return` που ακυρώνει τη μοναδική δεύτερη ευκαιρία που
 * έχει ένα κομμένο bundle να γίνει πλήρες.
 *
 * ⚠️ ΤΟ NODE_ENV ΕΙΝΑΙ ΜΕΡΟΣ ΤΟΥ TEST. Στο `development` ο hook περνά
 * `forceReload` και φορτώνει **ούτως ή άλλως**, οπότε το μονοπάτι που έσπαγε δεν
 * εκτελείται καν — γι' αυτό το bug φαινόταν παροδικό τοπικά και ήταν μόνιμο στην
 * παραγωγή. Ο jest τρέχει με `NODE_ENV=test`, δηλαδή στο μονοπάτι της
 * παραγωγής, που είναι ακριβώς αυτό που πρέπει να ελεγχθεί.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';

import { useTranslation } from '../hooks/useTranslation';
import { loadNamespace } from '../lazy-config';
import { recordShellBootstrap, resetBundleRegistry } from '../bundle-registry';

jest.mock('../lazy-config', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
  CRITICAL_NAMESPACES: [],
}));

const loadNamespaceMock = loadNamespace as jest.MockedFunction<typeof loadNamespace>;
const instance = i18next.createInstance();

/**
 * 🔴 ΤΑ ΟΝΟΜΑΤΑ ΕΙΝΑΙ ΜΕΡΟΣ ΤΟΥ TEST — ΜΗΝ ΤΑ ΑΛΛΑΞΕΙΣ ΣΕ `projects` / `common`.
 *
 * Η πρώτη γραφή αυτού του αρχείου χρησιμοποιούσε `projects`, και **επέζησε και
 * των δύο μεταλλάξεων**: το `projects` έχει compat splits (`projects-data`,
 * `projects-ika`, ADR-280) που ο hook φορτώνει μαζί του και που το instance του
 * test δεν έχει, άρα `allLoaded` έβγαινε `false` **ανεξάρτητα** από το κριτήριο.
 * Το test ήταν πράσινο επειδή δεν ρωτούσε τίποτα.
 *
 * `dashboard` και `landing` δεν έχουν καμία εγγραφή στο `COMPAT_NAMESPACE_MAP`,
 * οπότε `allNamespacesToLoad` έχει **ακριβώς ένα** στοιχείο και το κριτήριο
 * πληρότητας είναι το **μόνο** πράγμα που κρίνει το αποτέλεσμα.
 */
/** Κομμένο από το shell slice — όπως το πραγματικό `dashboard`: 1 από 8 κλειδιά. */
const SLICED_DASHBOARD = { tabs: { overview: 'Επισκόπηση' } };
/** Namespace που το slice φέρνει ΟΛΟΚΛΗΡΟ. */
const WHOLE_LANDING = { hero: { title: 'Νέστωρ' } };

beforeAll(async () => {
  await instance.use(initReactI18next).init({
    lng: 'el',
    fallbackLng: 'el',
    resources: { el: { dashboard: SLICED_DASHBOARD, landing: WHOLE_LANDING } },
    ns: ['dashboard', 'landing'],
    defaultNS: 'landing',
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  loadNamespaceMock.mockClear();
  resetBundleRegistry();
  // Ό,τι δηλώνει ο bootstrap στην παραγωγή: και τα δύο εγκατεστημένα, μόνο το
  // `landing` ολόκληρο.
  recordShellBootstrap('el', ['dashboard', 'landing'], ['landing']);
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={instance}>{children}</I18nextProvider>
);

describe('useTranslation — κομμένο shell-slice bundle', () => {
  it('🔴 ΑΓΚΥΡΑ — παραγγέλνει φόρτωση για namespace που είναι ΜΟΝΟ shell-partial', async () => {
    // Η προϋπόθεση που έκανε το bug αόρατο: το i18next λέει ήδη «το έχω».
    expect(instance.hasResourceBundle('el', 'dashboard')).toBe(true);

    renderHook(() => useTranslation(['dashboard']), { wrapper });

    await waitFor(() => {
      expect(loadNamespaceMock).toHaveBeenCalledWith('dashboard', 'el', false);
    });
  });

  it('ΔΕΝ ξαναπαραγγέλνει namespace που ο bootstrap έφερε ΟΛΟΚΛΗΡΟ', async () => {
    renderHook(() => useTranslation(['landing']), { wrapper });

    // Δίνουμε στο effect χρόνο να τρέξει· η απουσία κλήσης είναι το ζητούμενο.
    await waitFor(() => expect(loadNamespaceMock).not.toHaveBeenCalled());
  });

  it('τα κλειδιά που ΥΠΑΡΧΟΥΝ στο κομμένο bundle εξακολουθούν να λύνονται', () => {
    const { result } = renderHook(() => useTranslation(['dashboard']), { wrapper });
    expect(result.current.t('tabs.overview')).toBe('Επισκόπηση');
  });

  it('isNamespaceReady λέει ΟΧΙ όσο το bundle είναι μισό — δεν το βαφτίζει έτοιμο', () => {
    const { result } = renderHook(() => useTranslation(['dashboard']), { wrapper });
    expect(result.current.isNamespaceReady).toBe(false);
  });

  /**
   * 🔴 ΤΟ ΠΡΩΤΟ ΚΑΡΕ ΕΙΝΑΙ ΤΟ ΚΑΡΕ ΠΟΥ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ.
   *
   * Το `useEffect` προλαβαίνει να διορθώσει το `namespaceLoaded` πριν το
   * `renderHook` επιστρέψει, οπότε το προηγούμενο test **δεν** μπορεί να δει τι
   * είπε το αρχικό `useState` — μετρημένο: με το αρχικό state μεταλλαγμένο σε
   * `hasResourceBundle` και τα υπόλοιπα σωστά, όλα τα από πάνω παραμένουν
   * πράσινα. Άρα η τιμή του **πρώτου** render πρέπει να καταγραφεί τη στιγμή
   * που παράγεται.
   *
   * Και έχει σημασία επειδή αυτό ακριβώς είναι ένα καρέ με ωμό κλειδί: οι ~38
   * καταναλωτές του `isNamespaceReady` βάφουν με βάση αυτή την τιμή.
   */
  it('🔴 ΑΓΚΥΡΑ — ούτε στο ΠΡΩΤΟ render δηλώνει έτοιμο ένα μισό bundle', () => {
    const perRender: boolean[] = [];
    renderHook(
      () => {
        const value = useTranslation(['dashboard']);
        perRender.push(value.isNamespaceReady);
        return value;
      },
      { wrapper },
    );

    expect(perRender.length).toBeGreaterThan(0);
    expect(perRender[0]).toBe(false);
  });
});
