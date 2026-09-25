/**
 * @jest-environment jsdom
 *
 * ADR-882 — η ΜΙΑ ερώτηση θέσης: διακριτή ετυμηγορία, ποτέ κείμενο.
 */

import {
  GEOLOCATION_FAILURE_I18N_KEYS,
  queryGeolocationPermission,
  requestCurrentPosition,
} from '../current-position';
import elCommonShared from '@/i18n/locales/el/common-shared.json';
import enCommonShared from '@/i18n/locales/en/common-shared.json';

type Success = (position: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
type Failure = (error: { code: number; PERMISSION_DENIED: 1; POSITION_UNAVAILABLE: 2; TIMEOUT: 3 }) => void;

function installGeolocation(respond: (ok: Success, fail: Failure) => void): jest.Mock {
  const getCurrentPosition = jest.fn((ok: Success, fail: Failure) => respond(ok, fail));
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
  return getCurrentPosition;
}

function failWith(code: 1 | 2 | 3) {
  return (_ok: Success, fail: Failure) =>
    fail({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
}

afterEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

describe('requestCurrentPosition', () => {
  it('βρέθηκε ⇒ σημείο WGS84 + ακρίβεια', async () => {
    installGeolocation((ok) => ok({ coords: { latitude: 40.6, longitude: 22.9, accuracy: 30 } }));
    await expect(requestCurrentPosition()).resolves.toEqual({
      kind: 'found',
      point: { lat: 40.6, lng: 22.9 },
      accuracyMeters: 30,
    });
  });

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ] as const)('κωδικός %d ⇒ «%s»', async (code, reason) => {
    installGeolocation(failWith(code));
    await expect(requestCurrentPosition()).resolves.toEqual({ kind: 'failed', reason });
  });

  it('χωρίς Geolocation API ⇒ «unsupported», χωρίς εξαίρεση', async () => {
    await expect(requestCurrentPosition()).resolves.toEqual({ kind: 'failed', reason: 'unsupported' });
  });

  it('περνά τις ρυθμίσεις του καλούντα πάνω στις προεπιλογές', async () => {
    const spy = installGeolocation(failWith(3));
    await requestCurrentPosition({ enableHighAccuracy: false, timeout: 5 });
    expect(spy.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, maximumAge: 0, timeout: 5 });
  });
});

describe('queryGeolocationPermission', () => {
  it('χωρίς Permissions API ⇒ «unknown»', async () => {
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
    await expect(queryGeolocationPermission()).resolves.toBe('unknown');
  });

  it('επιστρέφει την κατάσταση χωρίς να ζητήσει τίποτα', async () => {
    const query = jest.fn().mockResolvedValue({ state: 'denied' });
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query } });
    await expect(queryGeolocationPermission()).resolves.toBe('denied');
    expect(query).toHaveBeenCalledWith({ name: 'geolocation' });
  });
});

describe('κλειδιά i18n αιτίας', () => {
  it.each([
    ['el', elCommonShared],
    ['en', enCommonShared],
  ])('κάθε αιτία έχει κείμενο στα %s', (_lang, bundle) => {
    for (const key of Object.values(GEOLOCATION_FAILURE_I18N_KEYS)) {
      const path = key.replace('common-shared:', '').split('.');
      const value = path.reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        bundle,
      );
      expect(typeof value).toBe('string');
    }
  });
});
