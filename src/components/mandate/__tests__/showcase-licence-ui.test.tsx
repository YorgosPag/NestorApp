/**
 * @fileoverview ADR-915 §21 — οι άδειες στην οθόνη: η κάρτα λέει «δήλωση» + δρόμο ελέγχου, το τσιπ «ποιος μπορεί να
 * εκδώσει» λέει το κριτήριο, η πόρτα λέει τι ισχύει. Το `t` επιστρέφει το κλειδί (+ παραμέτρους).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import { CHAPTER_PRESENTATION } from '@/constants/professional-registries';
import type { ShowcaseLicence } from '@/types/agency-profile';
import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';

import { CREDIBILITY_KEYS, DIRECTORY_KEYS } from '../agency-directory-labels';
import { SHOWCASE_KEYS } from '../agency-showcase-labels';
import { DocumentIssuerFilter } from '../DocumentIssuerFilter';
import { LicenceStatement } from '../LicenceStatement';
import { licenceDraftsOf, licenceWireOf, NO_LICENCE_DRAFTS, ShowcaseLicenceField } from '../ShowcaseLicenceField';
import { ShowcaseLicencesDoor } from '../ShowcaseLicencesDoor';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const LICENCE: ShowcaseLicence = {
  licence: 'energy-inspector',
  attestation: { state: 'declared', registration: { authorityKind: 'national', authority: 'ypen', number: '4321' } },
};

describe('ADR-915 §21 — η κάρτα της άδειας', () => {
  it('λέει ΔΗΛΩΣΗ (ποτέ «επαληθευμένο») και δίνει σύνδεσμο προς το δημόσιο μητρώο, σε νέα καρτέλα', () => {
    render(<LicenceStatement licence={LICENCE} />);
    expect(screen.getByText(CREDIBILITY_KEYS.claimDeclared)).toBeTruthy();
    expect(screen.queryByText(CREDIBILITY_KEYS.claimVerified)).toBeNull();
    const link = screen.getByText(CREDIBILITY_KEYS.licenceLookup).closest('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(PROFESSIONAL_LICENCE_SPECS['energy-inspector'].registryLookupUrl);
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('ADR-915 §21 — το τσιπ «Μπορούν να εκδώσουν» λέει ΤΟ ΚΡΙΤΗΡΙΟ', () => {
  const criterion = (key: string) => screen.getByText((text) => text.startsWith(key));

  it('ΠΕΑ ⇒ κριτήριο μητρώου · ταυτότητα ⇒ κριτήριο ειδικοτήτων · φορολογική ⇒ δημόσια αρχή', () => {
    const { unmount } = render(<DocumentIssuerFilter documentKind="energy-certificate" onClear={jest.fn()} />);
    expect(criterion(DIRECTORY_KEYS.issuerCriterionLicence)).toBeTruthy();
    unmount();

    const second = render(<DocumentIssuerFilter documentKind="building-identity" onClear={jest.fn()} />);
    expect(criterion(DIRECTORY_KEYS.issuerCriterionOccupation)).toBeTruthy();
    second.unmount();

    render(<DocumentIssuerFilter documentKind="tax-clearance" onClear={jest.fn()} />);
    expect(screen.getByText(DIRECTORY_KEYS.issuerCriterionAuthority)).toBeTruthy();
  });
});

const INSTALLER: ShowcaseLicence = {
  licence: 'electrical-installer',
  attestation: {
    state: 'declared',
    registration: { authorityKind: 'chapter', authority: 'regional-authority', chapter: 'ΠΕ Λάρισας', number: '77' },
  },
};

describe('ADR-915 §34 — η άδεια ηλεκτρολόγου εγκαταστάτη στην οθόνη', () => {
  it('Ο1: η κάρτα λέει ΚΑΙ τον εκδότη (ΠΕ) — και ΚΑΝΕΝΑΝ σύνδεσμο: δημόσιο μητρώο δεν υπάρχει', () => {
    render(<LicenceStatement licence={INSTALLER} />);
    expect(screen.getByText((text) => text.startsWith(CREDIBILITY_KEYS.claimChapter) && text.includes('ΠΕ Λάρισας'))).toBeTruthy();
    expect(screen.queryByText(CREDIBILITY_KEYS.licenceLookup)).toBeNull();
    expect(document.querySelector('a')).toBeNull();
  });

  it('Ο2: «Μπορούν να εκδώσουν: ΥΔΕ» ⇒ κριτήριο ΑΔΕΙΑΣ, με τη Διεύθυνση Ανάπτυξης ως μητρώο', () => {
    render(<DocumentIssuerFilter documentKind="electrical-installation" onClear={jest.fn()} />);
    expect(
      screen.getByText(
        (text) => text.startsWith(DIRECTORY_KEYS.issuerCriterionLicence) && text.includes('registries.regionalAuthority.name'),
      ),
    ).toBeTruthy();
  });

  it('Ο3: η φόρμα — άδεια που δίνει ΗΔΗ η ειδικότητα ⇒ γραμμή, ΟΧΙ checkbox· η άλλη ⇒ checkbox', () => {
    render(<ShowcaseLicenceField value={NO_LICENCE_DRAFTS} onChange={jest.fn()} heldThrough={[INSTALLER]} />);
    expect(screen.getByText((text) => text.startsWith(SHOWCASE_KEYS.licenceHeldThroughChapter) && text.includes('ΠΕ Λάρισας'))).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('Ο4: δηλωμένη άδεια εγκαταστάτη ⇒ πεδίο εκδότη με την ετικέτα της ΠΕΡΙΦΕΡΕΙΑΚΗΣ ΕΝΟΤΗΤΑΣ (όχι «σύλλογος»)', () => {
    const drafts = { ...NO_LICENCE_DRAFTS, 'electrical-installer': { number: '', chapter: '' } };
    render(<ShowcaseLicenceField value={drafts} onChange={jest.fn()} heldThrough={[]} />);
    expect(screen.getByText(CHAPTER_PRESENTATION['regional-authority'].labelKey)).toBeTruthy();
    expect(screen.queryByText(CHAPTER_PRESENTATION['bar-association'].labelKey)).toBeNull();
  });

  it('Ο5: σύρμα — εκδότης ΜΟΝΟ σε αρχή με παραρτήματα · η άδεια της ειδικότητας ΔΕΝ ξαναστέλνεται (ενοποίηση)', () => {
    const drafts = {
      'energy-inspector': { number: '12', chapter: 'αγνοείται' },
      'electrical-installer': { number: '77', chapter: 'ΠΕ Λάρισας' },
    };
    expect(licenceWireOf(drafts, [])).toEqual([
      { licence: 'energy-inspector', registrationNumber: '12' },
      { licence: 'electrical-installer', registrationNumber: '77', registrationChapter: 'ΠΕ Λάρισας' },
    ]);
    expect(licenceWireOf(drafts, [INSTALLER])).toEqual([{ licence: 'energy-inspector', registrationNumber: '12' }]);
    expect(licenceDraftsOf([INSTALLER])['electrical-installer']).toEqual({ number: '77', chapter: 'ΠΕ Λάρισας' });
  });
});

describe('ADR-915 §21 — η πόρτα των αδειών', () => {
  it('χωρίς βιτρίνα ⇒ καμία πόρτα · καμία άδεια ⇒ «καμία» · με άδεια ⇒ πλήθος', () => {
    const { container, rerender } = render(<ShowcaseLicencesDoor published={null} />);
    expect(container.textContent).toBe('');

    rerender(<ShowcaseLicencesDoor published={showcaseFixture()} />);
    expect(screen.getByText(SHOWCASE_KEYS.licencesDoorNone)).toBeTruthy();

    rerender(<ShowcaseLicencesDoor published={showcaseFixture({ licences: [LICENCE] })} />);
    expect(screen.getByText(`${SHOWCASE_KEYS.licencesDoorCount} ${JSON.stringify({ count: 1 })}`)).toBeTruthy();
  });
});
