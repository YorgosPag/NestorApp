/**
 * @fileoverview Άγκυρες των **«Στοιχείων ΓΕΜΗ»** της βιτρίνας — ADR-841 §7 Α23.9 Φέτα Β.
 * @related components/mandate/ShowcaseRegistryContent.tsx · ShowcaseRegistrySections.tsx · ShowcaseRegistryDoor.tsx
 *
 *   Κ1  🔴 κλειστή στο ΓΕΜΗ ⇒ μόνιμη ένδειξη με «Διόρθωση αριθμού» (→ προφίλ) και «Απόσυρση» (→ η ΙΔΙΑ πράξη)
 *   Κ2  🔑 ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: η ΙΔΙΑ βιτρίνα ενεργή ⇒ καμία ένδειξη
 *   Υ1  🔴 `name-mismatch` ⇒ η προεπισκόπηση ΕΙΝΑΙ ό,τι ταξιδεύει ως `expectedLegalName`
 *   Υ2  🔑 ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: επαληθευμένη ⇒ κανένα κουμπί υιοθέτησης, γραμμή με ημερομηνία
 *   Ρ1  όχι διαχειριστής ⇒ λέγεται, και καμία πράξη
 *   Ρ2  χωρίς αριθμό ΓΕΜΗ ⇒ διόρθωση, ΟΧΙ επαλήθευση · με αριθμό ⇒ η επαλήθευση καλεί το hook
 *   Π1  ⚖️ η πηγή (GDPR άρθ. 14(2)(στ)) φαίνεται σε κάθε κατάσταση
 *   Θ1-3 η πόρτα λέει την κατάσταση: κλειστή · επαληθευμένη · ουδέτερη όταν δεν ξέρουμε
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: τα δύο hooks είναι πλαστά — έχουν δικές τους άγκυρες (`useCompanyRegistryIdentity.test.tsx`
 * Χ1–Χ5 · `agency-showcase-*`). Εδώ κρίνεται **η απόδοση**: ποιο κλειδί, ποιος σύνδεσμος, ποια κλήση.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { legalIdentityFixture, showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';
import { registryCheck } from '@/lib/company/__fixtures__/registry-record-fixture';
import type { CompanyRegistryIdentity, CompanyRegistryIdentityState } from '@/hooks/company/useCompanyRegistryIdentity';
import type { AgencyShowcase } from '@/hooks/mandate/useAgencyShowcase';
import type { CompanyRegistryDeclaration, RegistryIdentityJudgment } from '@/types/company-registry';

import { ShowcaseRegistryContent } from '../ShowcaseRegistryContent';
import { ShowcaseRegistryDoor } from '../ShowcaseRegistryDoor';
import { SHOWCASE_KEYS } from '../agency-showcase-labels';
import { SHOWCASE_REGISTRY_DOOR_KEYS, SHOWCASE_REGISTRY_KEYS } from '../agency-showcase-registry-labels';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/i18n/route-slice', () => ({ registerRouteSlice: () => undefined }));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, 'data-testid': testId }: { href: string; children: React.ReactNode; 'data-testid'?: string }) => (
    <a href={href} data-testid={testId}>
      {children}
    </a>
  ),
}));

let mockShowcase: AgencyShowcase;
let mockRegistry: CompanyRegistryIdentity;

jest.mock('@/hooks/mandate/useAgencyShowcase', () => ({ useAgencyShowcase: () => mockShowcase }));
jest.mock('@/hooks/company/useCompanyRegistryIdentity', () => ({ useCompanyRegistryIdentity: () => mockRegistry }));

const CLOSURE = { issuer: 'gemi', checkedAt: '2026-09-14T11:00:00.000Z' } as const;
const CHECK = registryCheck({ registrationNumber: '123456789000', legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ' });
const DECLARATION: CompanyRegistryDeclaration = { entityType: 'ae', businessName: 'Παγώνης Α.Ε.', gemiNumber: '123456789000' };

function showcaseWith(closed: boolean): AgencyShowcase {
  const profile = showcaseFixture({ legalIdentity: legalIdentityFixture({ registryClosure: closed ? CLOSURE : null }) });
  return { state: { phase: 'published', profile }, busy: null, failure: null, publish: jest.fn(), withdraw: jest.fn() };
}

function ready(judgment: RegistryIdentityJudgment, declaration = DECLARATION): CompanyRegistryIdentityState {
  return { kind: 'ready', report: { declaration, judgment, freshness: { kind: 'not-asked' } } };
}

function registryWith(state: CompanyRegistryIdentityState): CompanyRegistryIdentity {
  return { state, verifying: false, verify: jest.fn(), adopting: false, adoption: 'none', adoptLegalName: jest.fn() };
}

const VERIFIED = ready({ state: 'verified', issuer: 'gemi', check: CHECK });
const MISMATCH = ready({ state: 'declared', gap: 'name-mismatch', check: CHECK });

beforeEach(() => {
  mockShowcase = showcaseWith(false);
  mockRegistry = registryWith(VERIFIED);
});

describe('Κ — κλειστή στο ΓΕΜΗ', () => {
  it('Κ1 🔴 μόνιμη ένδειξη, με διόρθωση στο προφίλ και απόσυρση μέσω της ΙΔΙΑΣ πράξης', () => {
    mockShowcase = showcaseWith(true);
    render(<ShowcaseRegistryContent />);

    const notice = screen.getByTestId('showcase-registry-closed');
    expect(notice).toHaveTextContent(SHOWCASE_REGISTRY_KEYS.closedTitle);
    expect(screen.getAllByTestId('showcase-registry-fix-number')[0]).toHaveAttribute('href', '/accounting/setup');
    fireEvent.click(screen.getByRole('button', { name: SHOWCASE_KEYS.withdraw }));
    expect(mockShowcase.withdraw).toHaveBeenCalledTimes(1);
  });

  it('Κ2 🔑 ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: η ίδια βιτρίνα ενεργή ⇒ καμία ένδειξη, κανένα «Απόσυρση»', () => {
    render(<ShowcaseRegistryContent />);
    expect(screen.queryByTestId('showcase-registry-closed')).toBeNull();
    expect(screen.queryByRole('button', { name: SHOWCASE_KEYS.withdraw })).toBeNull();
  });
});

describe('Υ — υιοθέτηση επωνυμίας ΓΕΜΗ', () => {
  it('Υ1 🔴 η προεπισκόπηση ΕΙΝΑΙ ό,τι ταξιδεύει ως `expectedLegalName`', () => {
    mockRegistry = registryWith(MISMATCH);
    render(<ShowcaseRegistryContent />);

    expect(screen.getByTestId('showcase-registry-adopt-name')).toHaveTextContent(CHECK.record.legalName);
    fireEvent.click(screen.getByRole('button', { name: SHOWCASE_REGISTRY_KEYS.adopt }));
    expect(mockRegistry.adoptLegalName).toHaveBeenCalledWith(CHECK.record.legalName);
  });

  it('Υ2 🔑 ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: επαληθευμένη ⇒ καμία υιοθέτηση, γραμμή επαλήθευσης', () => {
    render(<ShowcaseRegistryContent />);
    expect(screen.queryByTestId('showcase-registry-adopt')).toBeNull();
    expect(screen.getByTestId('showcase-registry-verified')).toHaveTextContent(SHOWCASE_REGISTRY_KEYS.verifiedOn);
  });
});

describe('Ρ — ρόλος και αριθμός', () => {
  it('Ρ1 όχι διαχειριστής ⇒ λέγεται, και καμία πράξη', () => {
    mockRegistry = registryWith({ kind: 'forbidden' });
    render(<ShowcaseRegistryContent />);
    expect(screen.getByTestId('showcase-registry-forbidden')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SHOWCASE_REGISTRY_KEYS.verify })).toBeNull();
  });

  it('Ρ2 χωρίς αριθμό ⇒ διόρθωση χωρίς επαλήθευση · με αριθμό ⇒ η επαλήθευση καλεί το hook', () => {
    mockRegistry = registryWith(ready({ state: 'declared', gap: 'no-registration-number', check: null }, { ...DECLARATION, gemiNumber: null }));
    const { unmount } = render(<ShowcaseRegistryContent />);
    expect(screen.queryByRole('button', { name: SHOWCASE_REGISTRY_KEYS.verify })).toBeNull();
    expect(screen.getByTestId('showcase-registry-fix-number')).toHaveAttribute('href', '/accounting/setup');
    unmount();

    mockRegistry = registryWith(ready({ state: 'declared', gap: 'not-checked', check: null }));
    render(<ShowcaseRegistryContent />);
    fireEvent.click(screen.getByRole('button', { name: SHOWCASE_REGISTRY_KEYS.verify }));
    expect(mockRegistry.verify).toHaveBeenCalledTimes(1);
  });
});

describe('Π — ⚖️ η πηγή φαίνεται πάντα', () => {
  it.each([
    ['επαληθευμένη', VERIFIED],
    ['όχι διαχειριστής', { kind: 'forbidden' } as const],
    ['βλάβη', { kind: 'unavailable' } as const],
  ])('Π1 — %s ⇒ «Πηγή: ΓΕΜΗ»', (_label, state) => {
    mockRegistry = registryWith(state);
    render(<ShowcaseRegistryContent />);
    expect(screen.getByTestId('showcase-registry-source')).toHaveTextContent(SHOWCASE_REGISTRY_KEYS.source);
  });
});

describe('Θ — η πόρτα λέει την κατάσταση', () => {
  it('Θ1 🔴 κλειστή ⇒ η γραμμή κλεισίματος, ακόμη και με επαληθευμένη κρίση', () => {
    mockShowcase = showcaseWith(true);
    render(<ShowcaseRegistryDoor published={mockShowcase.state.phase === 'published' ? mockShowcase.state.profile : null} />);
    expect(screen.getByTestId('showcase-registry-door-status')).toHaveTextContent(SHOWCASE_REGISTRY_DOOR_KEYS.closed);
  });

  it('Θ2 🔑 ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ενεργή και επαληθευμένη ⇒ «επαληθεύτηκε»', () => {
    render(<ShowcaseRegistryDoor published={showcaseFixture()} />);
    expect(screen.getByTestId('showcase-registry-door-status')).toHaveTextContent(SHOWCASE_REGISTRY_DOOR_KEYS.verified);
  });

  it('Θ3 δεν ξέρουμε (όχι διαχειριστής, χωρίς βιτρίνα) ⇒ ουδέτερη περιγραφή, ποτέ «όλα καλά»', () => {
    mockRegistry = registryWith({ kind: 'forbidden' });
    render(<ShowcaseRegistryDoor published={null} />);
    expect(screen.getByTestId('showcase-registry-door-status')).toHaveTextContent(SHOWCASE_REGISTRY_DOOR_KEYS.unknown);
  });
});
