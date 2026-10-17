/**
 * @tests ADR-915 §29.1 — `isClientRefusal`: ο ΕΝΑΣ κριτής «άρνηση (4xx) ή βλάβη;» για το επίπεδο του log.
 *
 * Το ελάττωμα (μετρημένο σε browser 2026-10-17): η αναμενόμενη άρνηση `NO_EMAIL` καταγραφόταν ως `error` στον πελάτη
 * του μητρώου ⇒ κόκκινο overlay στον dev server και ψεύτικη «βλάβη» στην τηλεμετρία, ενώ ο `apiClient` την έγραφε
 * σωστά ως `warn` — δύο κριτές για την ίδια ερώτηση.
 */

import { ApiClientError, isClientRefusal } from '../api-client-types';

describe('isClientRefusal', () => {
  it.each([400, 401, 403, 404, 409, 422, 499])('%i ⇒ άρνηση', (status) => {
    expect(isClientRefusal(new ApiClientError('x', status, 'NO_EMAIL'))).toBe(true);
  });

  it.each([0, 399, 500, 502, 503])('%i ⇒ όχι άρνηση', (status) => {
    expect(isClientRefusal(new ApiClientError('x', status))).toBe(false);
  });

  it('σφάλμα δικτύου ή άγνωστη τιμή ⇒ όχι άρνηση (βλάβη)', () => {
    expect(isClientRefusal(new TypeError('Failed to fetch'))).toBe(false);
    expect(isClientRefusal('NO_EMAIL')).toBe(false);
    expect(isClientRefusal(null)).toBe(false);
  });
});
