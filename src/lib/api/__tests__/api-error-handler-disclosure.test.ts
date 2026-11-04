/**
 * @jest-environment node
 */

/**
 * ADR-603 §Ασπίδα — το `ApiErrorHandler` (ο δρόμος του `withAuth` για αδιάχειριστο throw) δεν στέλνει στον πελάτη το
 * όνομα και το μήνυμα του σφάλματος έξω από `development`. Μέχρι 2026-11-04 τα έστελνε σε **κάθε** κατηγορία εκτός
 * `security`, και στην παραγωγή (OWASP ASVS 4.0.3 V7.4.1).
 */

jest.mock('@/services/ErrorTracker', () => ({ errorTracker: { captureError: () => 'err_1' } }));
jest.mock('@/services/enterprise-id.service', () => ({ generateRequestId: () => 'req_handler_1' }));

import { NextRequest } from 'next/server';

import { ApiError, ApiErrorHandler } from '../ApiErrorHandler';

const INTERNAL = 'Firestore: document companies/c_1/secrets/k missing';

async function handle(error: unknown) {
  const response = await ApiErrorHandler.getInstance().handleError(error, new NextRequest('https://app.test/api/x'));
  return { response, body: (await response.json()) as Record<string, unknown> };
}

describe('ApiErrorHandler — τι μαθαίνει ο πελάτης για μια απρόβλεπτη βλάβη', () => {
  it('έξω από development: χωρίς `details`, χωρίς το εσωτερικό μήνυμα, με κωδικό + requestId', async () => {
    const { response, body } = await handle(new Error(INTERNAL));
    expect(response.status).toBe(500);
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('secrets');
    expect(body).toMatchObject({ success: false, errorCode: 'INTERNAL_SERVER_ERROR', requestId: 'req_handler_1' });
    expect(response.headers.get('X-Request-ID')).toBe('req_handler_1');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('αναμενόμενο `ApiError` ⇒ κρατά το μήνυμά του (το διάλεξε ο κώδικας για τον πελάτη)', async () => {
    const { response, body } = await handle(new ApiError(409, 'Already exists', 'DUPLICATE'));
    expect(response.status).toBe(409);
    expect(body).toMatchObject({ error: 'Already exists', errorCode: 'DUPLICATE' });
  });
});
