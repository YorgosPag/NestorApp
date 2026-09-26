/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΛΕΞΙΛΟΓΙΟ ΑΡΝΗΣΕΩΝ = Ο ΠΙΝΑΚΑΣ HTTP** (ADR-884 §4.5 · Κ3α).
 *
 * 🔒 Η οθόνη δέχεται μόνο λόγους του `TOUR_REFUSALS`· ο διακομιστής απαντά μόνο λόγους του `Record<TourUploadRefusal, …>`.
 * Αν τα δύο αποκλίνουν, μια άρνηση φτάνει στον άνθρωπο ως «κάτι πήγε στραβά» — αυτή η άγκυρα το κοκκινίζει.
 */

import { STATUS_BY_TOUR_REFUSAL } from '@/app/api/spatial-tours/_shared/tour-route';

import { TOUR_REFUSALS, isTourRefusalName } from '../tour-refusal-vocabulary';

it('ίδιο σύνολο με τον πίνακα HTTP του διακομιστή — ούτε λόγος παραπάνω, ούτε λιγότερος', () => {
  expect([...TOUR_REFUSALS].sort()).toEqual(Object.keys(STATUS_BY_TOUR_REFUSAL).sort());
});

it('ο φρουρός δέχεται μόνο το λεξιλόγιο', () => {
  expect(isTourRefusalName('not-equirect')).toBe(true);
  expect(isTourRefusalName('drop-table')).toBe(false);
  expect(isTourRefusalName(42)).toBe(false);
});
