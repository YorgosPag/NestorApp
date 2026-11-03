/**
 * ADR-923 §5.11 «3γ» Βήμα 2 — κωδικός του server ⇒ μήνυμα στη γλώσσα του χρήστη.
 * Ό,τι δεν έχει κωδικό περνά αυτούσιο: η φόρμα δεν καταπίνει σφάλματα που δεν ξέρει.
 */

import { ApiClientError } from '@/lib/api/api-client-types';
import { explainProcurementError } from '../explain-procurement-error';

const refused = (errorCode: string) =>
  new ApiClientError('raw english from the server', 409, errorCode);

describe('explainProcurementError', () => {
  it('a known code becomes the translated message, not the raw server text', async () => {
    const save = () => Promise.reject(refused('MATERIAL_CODE_TAKEN'));
    await expect(explainProcurementError(save, { MATERIAL_CODE_TAKEN: 'μεταφρασμένο' })).rejects.toThrow('μεταφρασμένο');
  });

  it('an unknown code passes through as the same error', async () => {
    const error = refused('SOMETHING_ELSE');
    await expect(explainProcurementError(() => Promise.reject(error), { MATERIAL_CODE_TAKEN: 'x' })).rejects.toBe(error);
  });

  it('a non-API error passes through as the same error', async () => {
    const error = new Error('network');
    await expect(explainProcurementError(() => Promise.reject(error), { MATERIAL_CODE_TAKEN: 'x' })).rejects.toBe(error);
  });

  it('success returns the result', async () => {
    await expect(explainProcurementError(() => Promise.resolve(7), {})).resolves.toBe(7);
  });
});
