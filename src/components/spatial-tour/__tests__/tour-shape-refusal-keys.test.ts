/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΑΡΝΗΣΕΙΣ ΣΧΗΜΑΤΩΝ ΖΟΥΝ ΜΟΝΟ ΣΤΟΝ ΕΠΕΞΕΡΓΑΣΤΗ** (ADR-884 Φ2στ-γ Γ3γ-1 · AIP-193 · CHECK 3.34).
 *
 * 🔒 Δύο πίνακες, **διαμέριση**: κάθε άρνηση σε ακριβώς έναν (κανένα κενό = κανένα ωμό κλειδί· καμία επικάλυψη = ένα κείμενο).
 * 🔒 Ο γενικός αναγνώστης (`tourCall`) **δεν** ονομάζει άρνηση σχήματος — μόνο ο γράφος (`tourGraphCall`).
 */

import {
  TOUR_REFUSALS,
  TOUR_SHAPE_REFUSALS,
  isTourShapeRefusal,
} from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { tourCall, tourGraphCall } from '@/services/spatial-tour/spatial-tour.client';

import { TOUR_REFUSAL_KEY } from '../spatial-tour-labels';
import { TOUR_SHAPE_REFUSAL_KEY, tourGraphRefusalKey } from '../editor/tour-shape-labels';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {},
  apiErrorBodyOf: (cause: unknown) => cause,
}));

const refusing = (reason: string) => () => Promise.reject({ error: 'TOUR_REFUSED', reason });

it('κάθε άρνηση του λεξιλογίου έχει λέξεις σε ΑΚΡΙΒΩΣ έναν πίνακα', () => {
  for (const reason of TOUR_REFUSALS) {
    const inGeneral = Object.prototype.hasOwnProperty.call(TOUR_REFUSAL_KEY, reason);
    const inShape = Object.prototype.hasOwnProperty.call(TOUR_SHAPE_REFUSAL_KEY, reason);
    expect([reason, inGeneral !== inShape]).toEqual([reason, true]);
    expect(inShape).toBe(isTourShapeRefusal(reason));
  }
});

it('`tourGraphRefusalKey` (Γ3γ-2β — μήνυμα ΚΑΙ προέλεγχος): κάθε άρνηση ⇒ το κλειδί του ΣΩΣΤΟΥ πίνακα', () => {
  for (const reason of TOUR_REFUSALS) {
    const expected = isTourShapeRefusal(reason) ? TOUR_SHAPE_REFUSAL_KEY[reason] : TOUR_REFUSAL_KEY[reason];
    expect([reason, tourGraphRefusalKey(reason)]).toEqual([reason, expected]);
  }
  expect(tourGraphRefusalKey('space-overlap')).toBe('spatial-tour:refusal.spaceOverlap');
});

it('ο πίνακας σχημάτων έχει ΜΟΝΟ τις αρνήσεις σχημάτων', () => {
  expect(Object.keys(TOUR_SHAPE_REFUSAL_KEY).sort()).toEqual([...TOUR_SHAPE_REFUSALS].sort());
});

describe('ποιος αναγνώστης ονομάζει άρνηση σχήματος', () => {
  it('ο γενικός (`tourCall`) ⇒ `failed` — εκεί δεν φτάνει ποτέ', async () => {
    await expect(tourCall(refusing('space-overlap'))).resolves.toEqual({ kind: 'failed' });
  });

  it('ο γενικός κρατά κάθε γενική άρνηση', async () => {
    await expect(tourCall(refusing('graph-full'))).resolves.toEqual({ kind: 'refused', reason: 'graph-full' });
  });

  it('ο γράφος (`tourGraphCall`) ονομάζει και τις δύο', async () => {
    await expect(tourGraphCall(refusing('space-overlap'))).resolves.toEqual({ kind: 'refused', reason: 'space-overlap' });
    await expect(tourGraphCall(refusing('graph-full'))).resolves.toEqual({ kind: 'refused', reason: 'graph-full' });
  });

  it('άγνωστος λόγος ⇒ `failed` και στους δύο', async () => {
    await expect(tourGraphCall(refusing('made-up'))).resolves.toEqual({ kind: 'failed' });
  });
});
