/**
 * @fileoverview Άγκυρα της **πύλης της φόρμας εντολής** — `/offers/mandate/new` (ADR-841 §7 Α5 · Α23 Φ3.3).
 * @related app/(me)/offers/mandate/new/page.tsx · lib/agency/showcase-registry-closure.ts (`mandateRefusalOf`)
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: μέχρι τη Φ3.3 η φόρμα **άνοιγε** για επιχείρηση κλειστή στο ΓΕΜΗ — ο άνθρωπος τη γέμιζε και ο
 * γραφέας αρνιόταν `agency-closed` μόνο στην υποβολή (N.7.2 #4). Η σελίδα εκτελείται **αληθινή**, με αληθινό κριτή·
 * πλαστά είναι μόνο τα σύνορα I/O (ψευδώνυμο, βάση, ανακατεύθυνση) και τα δύο components-αποδέκτες.
 */

import type React from 'react';

import { BROKER_CREDENTIAL, showcaseFixture, TRADE_CREDENTIAL } from '@/lib/agency/__fixtures__/showcase-fixture';
import type { PublicShowcase } from '@/types/agency-profile';

jest.mock('next/navigation', () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT ${href}`);
  },
}));
jest.mock('@/lib/workspace/alias-registry', () => ({
  resolveAlias: async () => ({ outcome: 'found', companyId: 'comp_alfa', form: 'alias', current: true, canonicalAlias: null }),
}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('@/services/mandate/agency-profile.service', () => ({
  lookupAgencyProfile: async () => ({ outcome: 'found', showcase: SHOWCASE_REF.current }),
}));
jest.mock('@/components/mandate/MandateRequestFormContent', () => ({
  MandateRequestFormContent: function MandateRequestFormContent() {
    return null;
  },
}));
jest.mock('@/components/mandate/MandateUnavailableNotice', () => ({
  MandateUnavailableNotice: function MandateUnavailableNotice() {
    return null;
  },
}));

/** Το `jest.mock` υψώνεται πάνω από τις σταθερές — η αναφορά γεμίζει μετά. */
const SHOWCASE_REF: { current: PublicShowcase } = { current: showcaseFixture() };

import MandateRequestPage from '@/app/(me)/offers/mandate/new/page';

const CLOSURE = { issuer: 'gemi', checkedAt: '2026-09-14T11:00:00.000Z' } as const;

function showcaseWith(closed: boolean, credential: PublicShowcase['credentials'][number]): PublicShowcase {
  return showcaseFixture({
    companyId: 'comp_alfa',
    credentials: [credential],
    legalIdentity: {
      publicName: 'legal-name',
      legalName: 'ΑΛΦΑ ΜΕΣΙΤΙΚΗ Α.Ε.',
      legalForm: 'ae',
      gemiNumber: '123456789000',
      seat: { disclosure: 'municipality', streetLine: null, postalCode: null, locality: 'Θεσσαλονίκη' },
      attestation: { state: 'declared' },
      registryClosure: closed ? CLOSURE : null,
    },
  });
}

async function renderPage(showcase: PublicShowcase): Promise<React.ReactElement<Record<string, unknown>>> {
  SHOWCASE_REF.current = showcase;
  return (await MandateRequestPage({ searchParams: Promise.resolve({ agency: 'alfa' }) })) as React.ReactElement<
    Record<string, unknown>
  >;
}

function componentName(element: React.ReactElement): string {
  return (element.type as { name: string }).name;
}

describe('Π — η φόρμα εντολής ανοίγει μόνο όταν ο γραφέας θα δεχόταν', () => {
  it.each([
    ['🔴 κλειστή μεσιτική', true, BROKER_CREDENTIAL, 'agency-closed'],
    ['🔴 κλειστή ΚΑΙ τεχνίτης — η σειρά του γραφέα', true, TRADE_CREDENTIAL, 'agency-closed'],
    ['ενεργή τεχνική (Α5)', false, TRADE_CREDENTIAL, 'agency-not-brokerage'],
  ] as const)('Π1 — %s ⇒ ειδοποίηση «%s», ΟΧΙ φόρμα', async (_label, closed, credential, reason) => {
    const element = await renderPage(showcaseWith(closed, credential));

    expect(componentName(element)).toBe('MandateUnavailableNotice');
    expect(element.props.reason).toBe(reason);
    expect(element.props.agencyHref).toContain('alfa');
  });

  it('🔑 Π2 — Ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ενεργή μεσιτική ⇒ η φόρμα', async () => {
    const element = await renderPage(showcaseWith(false, BROKER_CREDENTIAL));

    expect(componentName(element)).toBe('MandateRequestFormContent');
    expect(element.props.agencyCompanyId).toBe('comp_alfa');
  });
});
