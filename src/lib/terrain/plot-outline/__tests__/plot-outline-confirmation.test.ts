/**
 * @fileoverview Άγκυρα του επιβεβαιωμένου περιγράμματος (ADR-920 §14.11 Ζ3).
 * @related lib/terrain/plot-outline/plot-outline-confirmation
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | το αίτημα δέχεται δακτύλιο αντί για υποψήφιο | «το αίτημα» |
 * | η επιβεβαίωση παίρνει δακτύλιο από αλλού και όχι από το υποψήφιο | «από το υποψήφιο» |
 * | ο αναγνώστης δέχεται μισό/ξένο πεδίο | «ο αναγνώστης» |
 */

import {
  CONFIRMED_PLOT_OUTLINE_VERSION,
  amendedPlotOutline,
  confirmedPlotOutlineOf,
  parsePlotOutlineAmendment,
  parsePlotOutlineConfirmationRequest,
  plotOutlineChoiceOf,
  readConfirmedPlotOutline,
} from '../plot-outline-confirmation';
import type { PlotOutlineCandidate } from '../plot-outline-types';

const CANDIDATE: PlotOutlineCandidate = {
  id: 'dxf:P',
  origin: { source: 'dxf', handle: 'P', layer: 'ΟΡΙΟ', closure: 'flag' },
  ringWorldMm: [{ x: 400_005_000, y: 4_200_005_000 }, { x: 400_015_000, y: 4_200_005_000 }, { x: 400_015_000, y: 4_200_015_000 }],
  corners: [],
  areaM2: 50,
};
const SHA = 'f'.repeat(64);

describe('ADR-920 §14.11 Ζ3 — το επιβεβαιωμένο περίγραμμα', () => {
  it('το αίτημα: ΜΟΝΟ υποψήφιο + επιλογή κοινού — όχι δακτύλιος, όχι κάτι άλλο', () => {
    expect(parsePlotOutlineConfirmationRequest(JSON.stringify({ candidateId: ' dxf:P ', showInListing: false })))
      .toEqual({ candidateId: 'dxf:P', showInListing: false });
    expect(parsePlotOutlineConfirmationRequest(JSON.stringify({ ring: [[0, 0]], showInListing: true }))).toBeNull();
    expect(parsePlotOutlineConfirmationRequest(JSON.stringify({ candidateId: '', showInListing: true }))).toBeNull();
    expect(parsePlotOutlineConfirmationRequest(JSON.stringify({ candidateId: 'x'.repeat(201), showInListing: true }))).toBeNull();
    expect(parsePlotOutlineConfirmationRequest('{not json')).toBeNull();
    expect(parsePlotOutlineConfirmationRequest(undefined)).toBeNull();
  });

  it('η επιβεβαίωση κρατά τον δακτύλιο ΤΟΥ ΥΠΟΨΗΦΙΟΥ, την προέλευση και το αποτύπωμα του σχεδίου', () => {
    const confirmed = confirmedPlotOutlineOf(CANDIDATE, { candidateId: 'dxf:P', showInListing: true }, { drawingSha256: SHA, drawingUnit: 'm' });
    expect(confirmed).toEqual({
      version: CONFIRMED_PLOT_OUTLINE_VERSION,
      ring: CANDIDATE.ringWorldMm,
      showInListing: true,
      areaM2: 50,
      candidateId: 'dxf:P',
      origin: CANDIDATE.origin,
      drawingUnit: 'm',
      drawingSha256: SHA,
    });
    expect(plotOutlineChoiceOf(confirmed)).toEqual({ ringWorldMm: CANDIDATE.ringWorldMm, showInListing: true });
  });

  it('ο αναγνώστης: ό,τι γράφτηκε διαβάζεται αυτούσιο (αποθήκευση σε Firestore)', () => {
    const confirmed = confirmedPlotOutlineOf(CANDIDATE, { candidateId: 'dxf:P', showInListing: false }, { drawingSha256: SHA, drawingUnit: null });
    expect(readConfirmedPlotOutline(JSON.parse(JSON.stringify(confirmed)))).toEqual(confirmed);
  });

  it.each([
    ['απόν', undefined],
    ['άλλη έκδοση', { version: 2 }],
    ['λιγότερες από 3 κορυφές', { ring: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    ['μη πεπερασμένο', { ring: [{ x: Number.NaN, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] }],
    ['άγνωστη μονάδα', { drawingUnit: 'yd' }],
    ['ψεύτικο αποτύπωμα', { drawingSha256: 'not-a-digest' }],
    ['άγνωστη προέλευση', { origin: { source: 'dwg' } }],
  ])('ο αναγνώστης αρνείται: %s ⇒ null', (_label, patch) => {
    const confirmed = confirmedPlotOutlineOf(CANDIDATE, { candidateId: 'dxf:P', showInListing: true }, { drawingSha256: SHA, drawingUnit: 'm' });
    const raw = patch === undefined ? undefined : { ...confirmed, ...patch };
    expect(readConfirmedPlotOutline(raw)).toBeNull();
  });
});

describe('ADR-920 §14.11 Ζ3c — αλλαγή περιγράμματος χωρίς νέο σχέδιο', () => {
  const CURRENT = { ringWorldMm: CANDIDATE.ringWorldMm, showInListing: true };

  it('δέχεται ΑΚΡΙΒΩΣ τα δύο σχήματα — ποτέ δακτύλιο, ποτέ άγνωστο κλειδί', () => {
    expect(parsePlotOutlineAmendment({ kind: 'visibility', showInListing: false })).toEqual({ kind: 'visibility', showInListing: false });
    expect(parsePlotOutlineAmendment({ kind: 'remove' })).toEqual({ kind: 'remove' });
    expect(parsePlotOutlineAmendment({ kind: 'remove', ring: [] })).toBeNull();
    expect(parsePlotOutlineAmendment({ kind: 'visibility', showInListing: 'no' })).toBeNull();
    expect(parsePlotOutlineAmendment({ kind: 'visibility' })).toBeNull();
    expect(parsePlotOutlineAmendment(null)).toBeNull();
  });

  it('Π9 κρατά τον ΙΔΙΟ δακτύλιο· η αφαίρεση δίνει `null`', () => {
    expect(amendedPlotOutline(CURRENT, { kind: 'visibility', showInListing: false })).toEqual({
      ringWorldMm: CANDIDATE.ringWorldMm, showInListing: false,
    });
    expect(amendedPlotOutline(CURRENT, { kind: 'remove' })).toBeNull();
  });
});
