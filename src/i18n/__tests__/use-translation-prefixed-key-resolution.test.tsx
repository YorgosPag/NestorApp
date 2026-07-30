/**
 * ADR-635 Φ C.23 — Ο wrapper του `useTranslation` έκρινε την επιτυχία με `result !== key`.
 *
 * Το i18next όμως, όταν **αστοχεί** σε κλειδί με πρόθεμα namespace, επιστρέφει το κλειδί
 * **χωρίς** το πρόθεμα. Άρα κάθε αστοχία σε `ns:key` περνούσε για επιτυχία:
 *   - το ωμό κλειδί ζωγραφιζόταν στην οθόνη (μετρημένο: `import.warnings.summary`, 2026-07-29)·
 *   - το compat στρώμα του ADR-280 **δεν δοκιμαζόταν ΠΟΤΕ** για τη σύμβαση `ns:key` —
 *     δηλαδή για ΟΛΑ τα `NOTIFICATION_KEYS` του έργου.
 *
 * ⚠️ Τα tests φορτώνουν **σκόπιμα** μόνο το split namespace (`building-timeline`) και ΟΧΙ το
 * legacy (`building`): αυτή ακριβώς είναι η κατάσταση που το compat στρώμα υπάρχει να σώσει.
 * Αν κάποιος ξαναγράψει τον έλεγχο ως `result !== key`, το πρώτο test γίνεται κόκκινο.
 */
import React from 'react';
import { renderHook } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { useTranslation } from '../hooks/useTranslation';

jest.mock('../lazy-config', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
  CRITICAL_NAMESPACES: [],
}));

const instance = i18next.createInstance();

beforeAll(async () => {
  await instance.use(initReactI18next).init({
    lng: 'el',
    fallbackLng: 'el',
    resources: {},
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });
  // ΜΟΝΟ το split namespace — το legacy `building` μένει σκόπιμα άδειο.
  instance.addResourceBundle('el', 'building-timeline', { tabs: { timeline: 'Χρονολόγιο' } }, true, true);

  // ADR-716 Φ5 — το μετρημένο περιστατικό: το `files-media` ΦΟΡΤΩΜΕΝΟ, δεύτερο στον πίνακα.
  instance.addResourceBundle('el', 'files-media', {
    floorplanImport: { drawingUnits: { title: 'Μονάδες Σχεδίου DXF', auto: 'Αυτόματα' } },
  }, true, true);
  // Ομώνυμο κλειδί στο ΠΡΩΤΕΥΟΝ ns — για να αποδειχθεί ποιος κερδίζει.
  instance.addResourceBundle('el', 'dxf-viewer', {
    floorplanImport: { drawingUnits: { auto: 'ΠΡΩΤΕΥΟΝ' } },
  }, true, true);
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={instance}>{children}</I18nextProvider>
);

const translate = (namespaces: string[], key: string): string => {
  const { result } = renderHook(() => useTranslation(namespaces), { wrapper });
  return result.current.t(key) as unknown as string;
};

describe('useTranslation — κλειδί με πρόθεμα namespace', () => {
  it('αστοχία σε `ns:key` ΑΝΑΓΝΩΡΙΖΕΤΑΙ και πέφτει στο compat remap (ADR-280)', () => {
    expect(translate(['building'], 'building:tabs.timeline')).toBe('Χρονολόγιο');
  });

  it('το ίδιο κλειδί ΧΩΡΙΣ πρόθεμα εξακολουθεί να λύνεται (καμία παλινδρόμηση)', () => {
    expect(translate(['building'], 'tabs.timeline')).toBe('Χρονολόγιο');
  });

  it('κλειδί που όντως ΔΕΝ υπάρχει πουθενά επιστρέφει το κλειδί — δεν σκάει, δεν εφευρίσκει', () => {
    const out = translate(['building'], 'building:tabs.doesNotExistAnywhere');
    expect(out).toContain('doesNotExistAnywhere');
  });

  it('επιτυχής άμεση μετάφραση επιστρέφεται αυτούσια χωρίς περιπλάνηση στο compat', () => {
    expect(translate(['building-timeline'], 'building-timeline:tabs.timeline')).toBe('Χρονολόγιο');
  });
});

/**
 * ADR-716 Φ5 — Ο πίνακας namespaces ΔΕΝ κάνει lookup, μόνο φόρτωση.
 *
 * Το react-i18next δένει το `t` στο `namespaces[0]` (useTranslation.js:56 —
 * `nsMode === 'fallback' ? namespaces : namespaces[0]`). Το `DxfImportModal` πέρασε το
 * `files-media` στον πίνακα και το bundle **φόρτωσε** («files-media=loaded» στο console),
 * αλλά κανείς δεν κοίταξε μέσα του: ο χρήστης είδε 8 ωμά `floorplanImport.drawingUnits.*`
 * στην οθόνη (μετρημένο 2026-07-31). Το compat στρώμα δεν έσωζε, γιατί καλύπτει μόνο
 * καταγεγραμμένες ρίζες και το `floorplanImport` δεν είναι κάτω από `dxf-viewer`.
 *
 * ⚠️ Αν κάποιος αφαιρέσει το `resolveAcrossNamespaces`, το πρώτο test εδώ γίνεται κόκκινο.
 */
describe('useTranslation — κλειδί σε ΜΗ πρωτεύον namespace του πίνακα', () => {
  it('λύνεται από δεύτερο φορτωμένο ns χωρίς πρόθεμα στο κλειδί', () => {
    expect(translate(['dxf-viewer', 'files-media'], 'floorplanImport.drawingUnits.title'))
      .toBe('Μονάδες Σχεδίου DXF');
  });

  it('το ΠΡΩΤΕΥΟΝ ns κερδίζει σε ομώνυμο κλειδί — η σειρά του πίνακα είναι η προτεραιότητα', () => {
    expect(translate(['dxf-viewer', 'files-media'], 'floorplanImport.drawingUnits.auto'))
      .toBe('ΠΡΩΤΕΥΟΝ');
  });

  it('κλειδί ανύπαρκτο σε ΟΛΑ τα ns του πίνακα επιστρέφει το κλειδί — δεν εφευρίσκει', () => {
    const out = translate(['dxf-viewer', 'files-media'], 'floorplanImport.drawingUnits.nope');
    expect(out).toContain('nope');
  });
});
