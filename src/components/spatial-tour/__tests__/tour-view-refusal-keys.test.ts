/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΛΕΞΕΙΣ ΤΗΣ ΠΥΛΗΣ ΘΕΑΣΗΣ = ΟΙ ΛΕΞΕΙΣ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ** (ADR-884 Κ3β · AIP-193).
 *
 * 🔒 Ο `TOUR_VIEW_REFUSAL_KEY` γράφεται ολόγραφα (ο γεννήτορας του slice δεν ακολουθεί `spread`) — άρα μπορεί να
 * αποκλίνει σιωπηλά από τον `TOUR_REFUSAL_KEY`. Αυτή η άγκυρα κρατά **ένα** κείμενο ανά άρνηση.
 */

import {
  TOUR_VIEW_SESSION_REFUSALS,
  isTourViewSessionRefusal,
} from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { narrowTourRefusal, type TourCallResult } from '@/services/spatial-tour/spatial-tour.client';

import { TOUR_REFUSAL_KEY, TOUR_VIEW_REFUSAL_KEY } from '../spatial-tour-labels';

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: {}, apiErrorBodyOf: () => null }));

it('κάθε άρνηση θέασης λέει ΑΚΡΙΒΩΣ το ίδιο κλειδί με τον μεγάλο πίνακα', () => {
  for (const reason of TOUR_VIEW_SESSION_REFUSALS) {
    expect(TOUR_VIEW_REFUSAL_KEY[reason]).toBe(TOUR_REFUSAL_KEY[reason]);
  }
});

it('ο πίνακας θέασης έχει ΜΟΝΟ τις αρνήσεις της πύλης — ούτε μία παραπάνω', () => {
  expect(Object.keys(TOUR_VIEW_REFUSAL_KEY).sort()).toEqual([...TOUR_VIEW_SESSION_REFUSALS].sort());
});

describe('narrowTourRefusal — λόγος εκτός συμβολαίου ⇒ γενική αποτυχία', () => {
  const refused = (reason: 'not-viewable' | 'graph-full'): TourCallResult<number> => ({ kind: 'refused', reason });

  it('κρατά άρνηση του συμβολαίου', () => {
    expect(narrowTourRefusal(refused('not-viewable'), isTourViewSessionRefusal)).toEqual({ kind: 'refused', reason: 'not-viewable' });
  });

  it('άρνηση ΑΛΛΗΣ λειτουργίας γίνεται `failed`, ποτέ ωμό κλειδί', () => {
    expect(narrowTourRefusal(refused('graph-full'), isTourViewSessionRefusal)).toEqual({ kind: 'failed' });
  });

  it('επιτυχία και αποτυχία περνούν αυτούσιες', () => {
    expect(narrowTourRefusal({ kind: 'ok', value: 7 }, isTourViewSessionRefusal)).toEqual({ kind: 'ok', value: 7 });
    expect(narrowTourRefusal({ kind: 'failed' }, isTourViewSessionRefusal)).toEqual({ kind: 'failed' });
  });
});
