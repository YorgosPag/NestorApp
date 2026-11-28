/**
 * ADR-920 §14.11 «Ζ4 — αμφίδρομη επισήμανση» Π2 — κλικ στο σχέδιο ⇒ η κάρτα έρχεται ΜΠΡΟΣΤΑ στα μάτια.
 * (ψεύτικα ΜΟΝΟ: οι λέξεις και η πράξη κύλισης — το jsdom δεν έχει διάταξη, άρα κρίνεται ΤΙ ζητήθηκε, όχι πού κάθισε.)
 *
 *   Κ1  αίτημα αποκάλυψης ⇒ η ΣΩΣΤΗ κάρτα, `requested` + `start` (όχι `nearest`: σταματούσε στην κάτω άκρη, εύρημα 2026-11-28)
 *   Κ2  το εφήμερο ΠΟΤΕ δεν κυλά: χωρίς αίτημα · αλλαγή `peekedId` · δείκτης πάνω στην κάρτα
 *   Κ3  νέο κλικ στην ίδια κάρτα (νέο `seq`) ⇒ ξανά αποκάλυψη· ίδιο αίτημα σε ξανα-απόδοση ⇒ όχι
 *   Κ4  η κάρτα κρατά το `scroll-mt` ⇒ το `start` την αφήνει ΚΑΤΩ από την κολλημένη όψη, όχι από κάτω της
 */

import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import type { PlotCandidateRevealRequest } from '@/hooks/listings/usePlotDrawingImport';
import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';
import type { PlotOutlineCandidate, PlotOutlineRanking } from '@/lib/terrain/plot-outline/plot-outline-types';

import { PlotCandidateList, type PlotCandidateListProps } from '../PlotCandidateList';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t, isNamespaceReady: true, i18n: { language: 'el' } }) };
});
jest.mock('@/lib/a11y/reveal-in-scroll', () => ({ revealInScroll: jest.fn() }));

const reveal = revealInScroll as jest.MockedFunction<typeof revealInScroll>;

/** Αρχή μεγέθους ΕΓΣΑ'87 (WORLD mm)· κάθε υποψήφιο άλλο τετράγωνο ⇒ κανένα «ίδιο σχήμα». */
function candidate(id: string, sideM: number): PlotOutlineCandidate {
  const s = sideM * 1000;
  const ring = [[0, 0], [s, 0], [s, s], [0, s]].map(([x, y]) => ({ x: 410000000 + x, y: 4498000000 + y }));
  return {
    id, origin: { source: 'dxf', handle: id, layer: id, closure: 'flag' }, ringWorldMm: ring,
    corners: ring.map((at) => ({ at, label: null })), areaM2: sideM * sideM,
  };
}

const ranking: PlotOutlineRanking = {
  ranked: [10, 20, 30].map((side, i) => ({ candidate: candidate(`c${i}`, side), evidence: [], standing: 0 })),
  proposedId: null,
  noProposalReason: 'no-evidence',
};

function props(overrides: Partial<PlotCandidateListProps> = {}): PlotCandidateListProps {
  return {
    ranking, selectedId: null, peekedId: null, revealRequest: null, rejectedCount: 0,
    onSelect: jest.fn(), onPeek: jest.fn(), ...overrides,
  };
}

const request = (candidateId: string, seq: number): PlotCandidateRevealRequest => ({ candidateId, seq });

beforeEach(() => reveal.mockClear());

describe('Κ1 — κλικ στο σχέδιο ⇒ η κάρτα έρχεται μπροστά', () => {
  it('η ΣΩΣΤΗ κάρτα, σκόπιμη κύλιση, στην ΑΡΧΗ της θέας', () => {
    render(<PlotCandidateList {...props({ selectedId: 'c2', revealRequest: request('c2', 1) })} />);
    expect(reveal).toHaveBeenCalledTimes(1);
    const [element, options] = reveal.mock.calls[0];
    expect(element).toHaveAttribute('data-plot-candidate-id', 'c2');
    expect(options).toEqual({ urgency: 'requested', block: 'start' });
  });
});

describe('Κ2 — το εφήμερο ποτέ δεν κυλά', () => {
  it('χωρίς αίτημα ⇒ καμία κύλιση, ούτε όταν αλλάζει το `peekedId`', () => {
    const { rerender } = render(<PlotCandidateList {...props()} />);
    rerender(<PlotCandidateList {...props({ peekedId: 'c1' })} />);
    rerender(<PlotCandidateList {...props({ peekedId: 'c2' })} />);
    expect(reveal).not.toHaveBeenCalled();
  });

  it('δείκτης πάνω στην κάρτα ⇒ προ-τονισμός, όχι κύλιση', () => {
    const onPeek = jest.fn();
    const { container } = render(<PlotCandidateList {...props({ onPeek })} />);
    const card = container.querySelector('[data-plot-candidate-id="c1"]');
    expect(card).not.toBeNull();
    fireEvent.pointerEnter(card as Element, { pointerType: 'mouse' });
    expect(onPeek).toHaveBeenCalledWith('c1');
    expect(reveal).not.toHaveBeenCalled();
  });
});

describe('Κ3 — ένα κλικ, μία αποκάλυψη', () => {
  it('νέο `seq` στην ίδια κάρτα ⇒ ξανά· ίδιο αίτημα σε ξανα-απόδοση ⇒ όχι', () => {
    const first = request('c0', 1);
    const { rerender } = render(<PlotCandidateList {...props({ revealRequest: first })} />);
    rerender(<PlotCandidateList {...props({ revealRequest: first, peekedId: 'c1' })} />);
    expect(reveal).toHaveBeenCalledTimes(1);
    rerender(<PlotCandidateList {...props({ revealRequest: request('c0', 2) })} />);
    expect(reveal).toHaveBeenCalledTimes(2);
    expect(reveal.mock.calls[1][0]).toHaveAttribute('data-plot-candidate-id', 'c0');
  });
});

describe('Κ4 — η κάρτα κάθεται κάτω από την κολλημένη όψη', () => {
  it('κάθε κάρτα κρατά το περιθώριο κύλισης της όψης', () => {
    const { container } = render(<PlotCandidateList {...props({ peekedId: 'c1', selectedId: 'c2' })} />);
    const cards = Array.from(container.querySelectorAll('[data-plot-candidate-id]'));
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(card).toHaveClass('scroll-mt-[calc(45vh_+_4rem)]');
  });
});
