/**
 * @fileoverview Άγκυρα — **ΟΙ ΦΟΡΜΕΣ ΔΗΜΙΟΥΡΓΙΑΣ ΑΝΟΙΓΟΥΝ ΣΕ ΚΑΘΕ ΠΛΑΤΟΣ** (ADR-900 §8 #3 · ADR-777 Α8 περιορισμένη).
 * @related components/shared/CreationPageShell.tsx · OwnerPropertyCreationGate · DemandCreationGate
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Κ1 | το κέλυφος ζωγραφίζει `lead` + φόρμα σε **ένα** `<main>`, χωρίς καμία μέτρηση οθόνης | επιστροφή μέτρησης / δεύτερο `main` |
 * | Κ2 | και οι δύο σελίδες (προσφορά · ζήτηση) περνούν από το κέλυφος, με φόρτωση που **λέει** τι περιμένουμε | ξεχασμένη πύλη · `loading` κενό |
 * | Κ3 | **η κλάση**: καμία φόρμα του προϊόντος δεν ξαναγίνεται «μόνο από υπολογιστή» — ούτε κώδικας ούτε κείμενο | επιστροφή `DesktopOnly*` / κλειδιού `desktopOnly` |
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

import { CreationPageShell } from '../CreationPageShell';
import { listRepoSourceFiles, readRepoCode, readRepoFile } from '@/test-utils/read-source';

describe('Κ — το κέλυφος της σελίδας δημιουργίας', () => {
  it('Κ1: lead + φόρμα σε ΕΝΑ <main>, χωρίς μέτρηση οθόνης', () => {
    render(
      <CreationPageShell lead={<p>lead</p>}>
        <form aria-label="form" />
      </CreationPageShell>,
    );
    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toContainElement(screen.getByText('lead'));
    expect(mains[0]).toContainElement(screen.getByRole('form'));
    expect(readRepoCode('src/components/shared/CreationPageShell.tsx')).not.toMatch(/useViewportClass|matchMedia|useIsMobile/);
  });

  it.each([
    'src/components/owner-property/OwnerPropertyCreationGate.tsx',
    'src/components/demand/DemandCreationGate.tsx',
  ])('Κ2: %s περνά από το κέλυφος, με φόρτωση που λέει τι περιμένουμε', (file) => {
    const code = readRepoCode(file);
    expect(code).toContain('<CreationPageShell');
    expect(code).toMatch(/ssr:\s*false,\s*loading:\s*CreationFormLoading/);
  });

  it('Κ3: η ΚΛΑΣΗ — κανένα «μόνο από υπολογιστή» για φόρμα του προϊόντος, σε κώδικα ή λεξιλόγιο', () => {
    const files = listRepoSourceFiles('src').filter((file) => !file.includes('/__tests__/'));
    // Φράχτης ενάντια στο κενό σύμπαν.
    expect(files.length).toBeGreaterThan(5000);
    expect(files.filter((file) => /DesktopOnly(Gate|Notice)/.test(readRepoCode(file)))).toEqual([]);

    for (const lang of ['el', 'en']) {
      const market = readRepoFile(`src/i18n/locales/${lang}/property-market.json`);
      expect([lang, /"desktopOnly"|"desktopNote"/.test(market)]).toEqual([lang, false]);
    }
  });
});
