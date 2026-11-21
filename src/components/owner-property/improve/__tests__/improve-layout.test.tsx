/**
 * ADR-946 · ADR-842 Φ4 — **η «Βελτίωσε την αγγελία σου» σε διάταξη λίστα → ενότητα → πλαϊνό**.
 *
 *   Λ1  κοινόχρηστα: η κατάσταση διαβάζει τον ΙΔΙΟ αναγνώστη με την ενότητα (`readCommonCharges`) — αδήλωτο · 0 · ποσό
 *   Λ2  ΠΕΑ: κλάση · απουσία με λόγο · τίποτα
 *   Λ3  αντικειμενική: φορτώνει · δεν υπολογίζεται · όρια + ερωτήσεις που μένουν
 *   Λ4  η λίστα: μετρητής ΜΟΝΟ για τις ερωτήσεις της αντικειμενικής, με προσοχή· «δεν δηλώθηκε» με δικά μας κλειδιά
 *   Λ5  ένα αντίτυπο: με `preview={false}` η ενότητα δείχνει τον διακόπτη, όχι την προεπισκόπηση (ζει στο πλαϊνό)
 */

import { render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { IMPROVE_SECTIONS, type ImproveContext } from '../improve-sections';
import { useImproveSectionEntries } from '../improve-section-entries';
import { ObjectiveValueVisibility } from '../ObjectiveValueVisibility';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values === undefined ? key : `${key} ${JSON.stringify(values)}`),
    isNamespaceReady: true,
  }),
}));
jest.mock('@/components/listing-detail/ListingObjectiveValue', () => ({ ListingObjectiveValue: () => <p>buyer-preview</p> }));

const RANGE = { kind: 'range', low: 60000, high: 80000, open: ['frontage'] } as const;

/** Ό,τι διαβάζει η κατάσταση κάθε ενότητας — μόνο τα πεδία που αγγίζει. */
function contextOf(parts: { charges?: unknown; certificate?: unknown; zone?: unknown }): ImproveContext {
  return {
    subjects: {
      commonCharges: { charges: parts.charges },
      energyCertificate: { certificate: parts.certificate },
    },
    objectiveValue: { zone: parts.zone ?? { kind: 'loading' } },
    publicListing: { state: 'absent' },
  } as unknown as ImproveContext;
}

const READY_ZONE = {
  kind: 'answered',
  // Δύο ανοιχτές + μία απαντημένη: η λίστα της μηχανής κρατά ΚΑΙ τις απαντημένες, ο μετρητής μετρά μόνο τις ανοιχτές
  // (στην παραγωγή έλεγε «5» εκεί που η ενότητα έλεγε «καμία», ADR-946 §7 · ADR-898 §23).
  improvement: {
    kind: 'ready',
    bounds: RANGE,
    questions: [{ state: 'open' }, { state: 'answered' }, { state: 'open' }],
    levelBasis: { kind: 'none' },
  },
};

describe('«Βελτίωσε» — κατάσταση ενοτήτων και διάταξη (ADR-946)', () => {
  it('Λ1 κοινόχρηστα', () => {
    const status = (charges: unknown) => IMPROVE_SECTIONS.commonCharges.status(contextOf({ charges }));
    expect(status(null)).toStrictEqual({ kind: 'commonCharges', monthlyAmount: null });
    expect(status({ monthlyAmount: 0 })).toStrictEqual({ kind: 'commonCharges', monthlyAmount: 0 });
    expect(status({ monthlyAmount: 120 })).toStrictEqual({ kind: 'commonCharges', monthlyAmount: 120 });
  });

  it('Λ2 ΠΕΑ', () => {
    const status = (certificate: unknown) => IMPROVE_SECTIONS.energyCertificate.status(contextOf({ certificate }));
    expect(status({ class: 'B' })).toStrictEqual({ kind: 'energyCertificate', energyClass: 'B', absence: null });
    expect(status({ absence: 'pending' })).toStrictEqual({ kind: 'energyCertificate', energyClass: null, absence: 'pending' });
    expect(status(null)).toStrictEqual({ kind: 'energyCertificate', energyClass: null, absence: null });
  });

  it('Λ3 αντικειμενική', () => {
    const status = (zone: unknown) => IMPROVE_SECTIONS.objectiveValue.status(contextOf({ zone }));
    expect(status({ kind: 'loading' })).toStrictEqual({ kind: 'loading' });
    expect(status({ kind: 'failed' })).toStrictEqual({ kind: 'unavailable' });
    expect(status({ kind: 'answered', improvement: { kind: 'unsupported' } })).toStrictEqual({ kind: 'unavailable' });
    expect(status(READY_ZONE)).toStrictEqual({ kind: 'objectiveValue', bounds: RANGE, openQuestions: 2 });
  });

  it('Λ4 η λίστα: μετρητής μόνο για τις ερωτήσεις που μένουν', () => {
    const context = contextOf({ charges: null, certificate: null, zone: READY_ZONE });
    const { result } = renderHook(() => useImproveSectionEntries(['commonCharges', 'energyCertificate', 'objectiveValue'], context));
    const [charges, energy, value] = result.current;
    expect(charges).toMatchObject({ summary: 'objective-value:improve.summary.commonChargesUndeclared', count: 0, attention: false });
    expect(energy).toMatchObject({ summary: 'objective-value:improve.summary.energyUndeclared', count: 0 });
    expect(value).toMatchObject({ label: 'objective-value:improve.sections.objectiveValue.title', count: 2, attention: true });
  });

  it('Λ5 ένα αντίτυπο της προεπισκόπησης', () => {
    const props = {
      display: 'shown' as const,
      buyerView: { kind: 'evaluated' } as never,
      onAnswer: () => undefined,
      back: null,
    };
    const { unmount } = render(<ObjectiveValueVisibility {...props} preview={false} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.queryByText('buyer-preview')).not.toBeInTheDocument();
    expect(screen.queryByText('objective-value:improve.visibility.previewTitle')).not.toBeInTheDocument();
    unmount();

    render(<ObjectiveValueVisibility {...props} />);
    expect(screen.getByText('buyer-preview')).toBeInTheDocument();
  });
});
