/**
 * @fileoverview ADR-915 §21 — οι άδειες στην οθόνη: η κάρτα λέει «δήλωση» + δρόμο ελέγχου, το τσιπ «ποιος μπορεί να
 * εκδώσει» λέει το κριτήριο, η πόρτα λέει τι ισχύει. Το `t` επιστρέφει το κλειδί (+ παραμέτρους).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import type { ShowcaseLicence } from '@/types/agency-profile';
import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';

import { CREDIBILITY_KEYS, DIRECTORY_KEYS } from '../agency-directory-labels';
import { SHOWCASE_KEYS } from '../agency-showcase-labels';
import { DocumentIssuerFilter } from '../DocumentIssuerFilter';
import { LicenceStatement } from '../LicenceStatement';
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
