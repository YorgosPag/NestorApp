/**
 * ADR-777 §8.93 — **η ενότητα «Κοινόχρηστα»** της οθόνης «Βελτίωσε την αγγελία σου», πάνω στις πραγματικές μηχανές
 * (αναγνώστης · διόρθωση · ουρά): στέλεχος μόνο ο server.
 *
 * Τι αποδεικνύει: (1) η απάντηση φαίνεται **αμέσως**, πριν απαντήσει ο server · (2) αποτυχία ⇒ επιστροφή στην αλήθεια
 * + «Δοκιμάστε ξανά» · (3) ο καταχωρητής κρεμά την ενότητα **μόνο** όπου η προβολή λέει ότι τίθεται η ερώτηση.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { placeKnowledgeFromOwnerProperty, projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { projectListingShape } from '@/services/listings/public-listing-projection';
import type { OwnerListingResult } from '@/services/owner-property/owner-property.service';
import type { OwnerProperty } from '@/types/owner-property';

import { CommonChargesImproveSection } from '../CommonChargesImproveSection';
import { applicableImproveSections, IMPROVE_SECTION_IDS } from '../improve-sections';
import { useOwnerImproveSubjects } from '../owner-improve-subject';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

/** Ο server απαντά όταν του πούμε. */
const pending: { patch: unknown; answer: (result: OwnerListingResult) => void }[] = [];
jest.mock('@/services/owner-property/owner-property.service', () => ({
  setOwnerListingObjectiveValue: jest.fn(),
  setOwnerListingCommonCharges: (_id: string, patch: unknown) =>
    new Promise<OwnerListingResult>((resolve) => {
      pending.push({ patch, answer: resolve });
    }),
}));

const AT = '2026-10-13T09:00:00.000Z';

beforeEach(() => {
  pending.length = 0;
});

/** Ο ιδιώτης ως κάτοχος — ο ίδιος προσαρμογέας με την οθόνη. */
function OwnerSection({ owner }: { readonly owner: OwnerProperty }) {
  return <CommonChargesImproveSection subject={useOwnerImproveSubjects(owner).commonCharges} />;
}

const amountInput = () => screen.getByLabelText('properties-enums:commonCharges.form.amount') as HTMLInputElement;

function typeAmount(raw: string) {
  fireEvent.change(amountInput(), { target: { value: raw } });
  fireEvent.blur(amountInput());
}

async function answer(result: OwnerListingResult) {
  await act(async () => {
    pending[pending.length - 1].answer(result);
  });
}

describe('Ε1 — κάθε απάντηση αποθηκεύεται αμέσως', () => {
  it('🔴 το ποσό φεύγει ως ΜΕΡΙΚΗ διόρθωση, και η οθόνη το δείχνει πριν απαντήσει ο server', () => {
    render(<OwnerSection owner={validOwnerProperty()} />);

    typeAmount('120');

    expect(pending).toHaveLength(1);
    expect(pending[0].patch).toEqual({ monthlyAmount: 120 });
    // Αισιόδοξη επικάλυψη: η ερώτηση «τι περιλαμβάνουν» ανοίγει ήδη — προϋποθέτει θετικό ποσό.
    expect(screen.getByText('properties-enums:commonCharges.form.includesLegend')).toBeInTheDocument();
    expect(amountInput().value).toBe('120');
  });

  it('δεύτερη απάντηση («περιλαμβάνουν θέρμανση») φεύγει ΧΩΡΙΣΤΑ — δεν ξαναστέλνει το ποσό', async () => {
    const owner = validOwnerProperty({ commonCharges: { monthlyAmount: 120, includes: null } });
    render(<OwnerSection owner={owner} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'properties-enums:commonCharges.inclusion.heating' }));

    expect(pending).toHaveLength(1);
    expect(pending[0].patch).toEqual({ includes: ['heating'] });
  });
});

describe('Ε2 — αποτυχία', () => {
  it('ο server δεν αποθήκευσε ⇒ η οθόνη γυρίζει στην αλήθεια και προσφέρει επανάληψη', async () => {
    render(<OwnerSection owner={validOwnerProperty()} />);
    typeAmount('120');

    await answer({ kind: 'failed', message: 'network' });

    expect(screen.getByRole('alert')).toHaveTextContent('objective-value:improve.failed');
    expect(amountInput().value).toBe('');
    expect(screen.queryByText('properties-enums:commonCharges.form.includesLegend')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'objective-value:improve.retry' }));
    expect(pending).toHaveLength(2);
    expect(pending[1].patch).toEqual({ monthlyAmount: 120 });
  });
});

describe('Ε3 — ο καταχωρητής κρεμά την ενότητα μόνο όπου τίθεται η ερώτηση', () => {
  const sectionsOf = (owner: OwnerProperty) =>
    applicableImproveSections(
      projectListingShape(projectableFromOwnerProperty(owner, AT), placeKnowledgeFromOwnerProperty(owner, AT), AT),
    );

  it('κατοικία προς διάθεση ⇒ τα κοινόχρηστα υπάρχουν, και είναι ΠΡΩΤΑ', () => {
    expect(IMPROVE_SECTION_IDS[0]).toBe('commonCharges');
    expect(sectionsOf(validOwnerProperty())).toContain('commonCharges');
  });

  it('🔴 γη ⇒ καμία ενότητα κοινοχρήστων — ο ίδιος κριτής με τη δημόσια αγγελία', () => {
    expect(sectionsOf(validOwnerProperty({ type: 'land' }))).not.toContain('commonCharges');
  });
});
