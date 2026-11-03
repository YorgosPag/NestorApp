/**
 * @jest-environment node
 */

/**
 * Το κοινό της εξαγωγής xChange από το ερώτημα (ADR-923 §5.14.1 Ζ24): ό,τι **δεν μπορεί** να είναι τιμοκατάλογος
 * είναι λάθος αίτημα (400), όχι «δεν βρέθηκε» (404).
 */

import { ApiError } from '@/lib/api/api-error-types';
import { xchangeAudienceOf } from '../xchange-export-params';

jest.mock('server-only', () => ({}));

const search = (priceListId?: string) => new URLSearchParams(priceListId === undefined ? {} : { priceListId });
const VALID = 'cprl_3f2b8c1e-9a4d-4b7e-8c21-5d6e7f8a9b0c';

function statusOf(run: () => unknown): number | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.statusCode : -1;
  }
}

describe('xchangeAudienceOf', () => {
  it('χωρίς παράμετρο ⇒ δημόσιο κοινό', () => {
    expect(xchangeAudienceOf(search())).toEqual({ kind: 'public' });
  });

  it('έγκυρη ταυτότητα τιμοκαταλόγου ⇒ κοινό της λίστας, αυτούσια', () => {
    expect(xchangeAudienceOf(search(VALID))).toEqual({ kind: 'priceList', priceListId: VALID });
  });

  it.each([
    ['σκουπίδι', 'bogus!'],
    ['κενό', ''],
    ['άλλο πρόθεμα', 'cpub_3f2b8c1e-9a4d-4b7e-8c21-5d6e7f8a9b0c'],
    ['πρόθεμα χωρίς uuid', 'cprl_123'],
    ['κενά γύρω', ` ${VALID} `],
  ])('%s ⇒ 400', (_name, raw) => {
    expect(statusOf(() => xchangeAudienceOf(search(raw)))).toBe(400);
  });
});
