/**
 * ADR-744 §25 — Ο ΚΑΤΑΝΑΛΩΤΗΣ ΞΑΝΑΖΩΓΡΑΦΙΖΕΙ ΟΤΑΝ ΤΟ BUNDLE ΤΟΥ ΟΛΟΚΛΗΡΩΘΕΙ ΑΠΟ ΑΛΛΟΥ.
 *
 * Ο hook ξαναζωγράφιζε **μόνο** όταν τελείωνε η **δική του** φόρτωση. Μετρημένο
 * (Chrome, 2026-10-01): η δική του φόρτωση αποτυγχάνει (`Failed to load chunk`),
 * ο hook δηλώνει «φορτώθηκε», το ωμό κλειδί ζωγραφίζεται — και όταν το bundle
 * ολοκληρώνεται αργότερα από **άλλο** μονοπάτι (ανάκτηση, άλλο mount, boot preload),
 * η οθόνη **δεν το μαθαίνει ποτέ**.
 *
 * ⚠️ `dashboard` επίτηδες: χωρίς compat splits (βλ. `use-translation-partial-bundle`),
 * ώστε η πληρότητα του ΕΝΟΣ namespace να είναι το μόνο που κρίνει.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';

import { useTranslation } from '../hooks/useTranslation';
import { recordLoaderFailure, recordLoaderInstall, resetBundleRegistry } from '../bundle-registry';

// Η ΔΙΚΗ του φόρτωση του hook αποτυγχάνει — όπως το chunk που δεν ήρθε.
jest.mock('../lazy-config', () => ({
  loadNamespace: jest.fn((namespace: string, language: string) => {
    const registry = jest.requireActual('../bundle-registry') as typeof import('../bundle-registry');
    registry.recordLoaderFailure(language, namespace);
    return Promise.resolve();
  }),
  CRITICAL_NAMESPACES: [],
}));

const instance = i18next.createInstance();
const RAW_KEY = 'tabs.photos';

beforeAll(async () => {
  await instance.use(initReactI18next).init({
    lng: 'el',
    fallbackLng: 'el',
    resources: { el: {} },
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  resetBundleRegistry();
  instance.removeResourceBundle('el', 'dashboard');
});

/**
 * Σκόπιμα **χωρίς** `useMemo` γύρω από το `t`: το ελάττωμα δεν είναι καταναλωτής
 * που απομνημονεύει λάθος — είναι ότι **κανένα** render δεν συμβαίνει.
 */
function PhotosTab(): React.ReactElement {
  const { t } = useTranslation(['dashboard']);
  return <span data-testid="label">{t(RAW_KEY)}</span>;
}

const renderTab = () =>
  render(
    <I18nextProvider i18n={instance}>
      <PhotosTab />
    </I18nextProvider>,
  );

describe('useTranslation — ξαναζωγραφίζει όταν το bundle ολοκληρωθεί από άλλο μονοπάτι', () => {
  it('προϋπόθεση: με αποτυχημένη τη δική του φόρτωση, το κλειδί είναι ωμό', async () => {
    renderTab();
    await act(async () => undefined);
    expect(screen.getByTestId('label').textContent).toBe(RAW_KEY);
  });

  it('🔴 ΑΓΚΥΡΑ — ανάκτηση από άλλο μονοπάτι ⇒ η ετικέτα μεταφράζεται ΧΩΡΙΣ νέο mount', async () => {
    renderTab();
    await act(async () => undefined);
    expect(screen.getByTestId('label').textContent).toBe(RAW_KEY);

    // Ό,τι κάνει το `installNamespace` όταν πετύχει η ανάκτηση.
    act(() => {
      instance.addResourceBundle('el', 'dashboard', { tabs: { photos: 'Φωτογραφίες' } }, true, true);
      recordLoaderInstall('el', 'dashboard');
    });

    expect(screen.getByTestId('label').textContent).toBe('Φωτογραφίες');
  });

  it('άσχετο bundle που ολοκληρώνεται ΔΕΝ προκαλεί render (στιγμιότυπο boolean ανά καταναλωτή)', async () => {
    let renders = 0;
    function Counting(): React.ReactElement {
      renders += 1;
      const { t } = useTranslation(['dashboard']);
      return <span>{t(RAW_KEY)}</span>;
    }
    render(<I18nextProvider i18n={instance}><Counting /></I18nextProvider>);
    await act(async () => undefined);
    const settled = renders;

    act(() => {
      recordLoaderInstall('el', 'unrelated-namespace');
      recordLoaderFailure('el', 'another-unrelated');
    });

    expect(renders).toBe(settled);
  });
});
