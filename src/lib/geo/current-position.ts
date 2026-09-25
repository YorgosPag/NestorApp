/**
 * **«Πού είμαι;»** — η ΜΙΑ ερώτηση προς τον browser για τη θέση του ανθρώπου.
 *
 * @related ADR-882 (Ανάκληση τόπου: τρέχουσα θέση + ιστορικό) · ADR-170 (check-in GPS)
 *
 * 🔴 **ΔΙΑΚΡΙΤΗ ΕΤΥΜΗΓΟΡΙΑ, ΠΟΤΕ ΚΕΙΜΕΝΟ.** Ο προηγούμενος `useGeolocation` επέστρεφε
 * **ελληνική πρόταση** ως σφάλμα (παραβίαση N.11 — ο Άγγλος χρήστης διάβαζε ελληνικά), και
 * κανένας καλών δεν μπορούσε να ρωτήσει *«αρνήθηκε ή απλώς δεν βρήκε σήμα;»* — ενώ οι δύο
 * έχουν **διαφορετική θεραπεία**: το πρώτο θέλει ρύθμιση browser, το δεύτερο νέα προσπάθεια.
 * Η μετάφραση ανήκει στον καλούντα (`common-shared:geolocation.<reason>`).
 *
 * ⚠️ **ΚΑΛΕΙΤΑΙ ΜΟΝΟ ΑΠΟ ΧΕΙΡΟΝΟΜΙΑ ΤΟΥ ΑΝΘΡΩΠΟΥ** — ποτέ στο φόρτωμα ή στην εστίαση.
 * Chrome/Lighthouse το χαρακτηρίζουν παράβαση («Only request geolocation information in
 * response to a user gesture»), και οι μελέτες χρηστών δείχνουν δυσπιστία σε σελίδες που
 * ζητούν θέση χωρίς λόγο. Γι' αυτό το «Τρέχουσα τοποθεσία» είναι **επιλογή**, όχι αυτόματο.
 */

import type { GeoPoint } from '@/types/geo/coordinates';

export type CurrentPositionFailure = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export type CurrentPositionOutcome =
  | { readonly kind: 'found'; readonly point: GeoPoint; readonly accuracyMeters: number }
  | { readonly kind: 'failed'; readonly reason: CurrentPositionFailure };

export interface CurrentPositionOptions {
  readonly enableHighAccuracy?: boolean;
  readonly maximumAge?: number;
  readonly timeout?: number;
}

/**
 * Η κατάσταση της **άδειας**, χωρίς να ζητηθεί.
 *
 * `'unknown'` όταν ο browser δεν έχει Permissions API (παλιό Safari): τότε ΔΕΝ τεκμαίρεται
 * τίποτα — η επιλογή μένει ενεργή και η απάντηση έρχεται από το ίδιο το αίτημα.
 */
export type GeolocationPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * **Το ΕΝΑ λεξικό αιτία → κλειδί i18n** — στατικά κλειδιά, ώστε οι πύλες 3.8/3.13 να τα
 * βλέπουν (ένα `t(\`…${reason}\`)` είναι αόρατο στη στατική ανάλυση).
 */
export const GEOLOCATION_FAILURE_I18N_KEYS: Readonly<Record<CurrentPositionFailure, string>> = {
  unsupported: 'common-shared:geolocation.unsupported',
  denied: 'common-shared:geolocation.denied',
  unavailable: 'common-shared:geolocation.unavailable',
  timeout: 'common-shared:geolocation.timeout',
};

const DEFAULTS:Required<CurrentPositionOptions> = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

function failureOf(error: GeolocationPositionError): CurrentPositionFailure {
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'unavailable';
}

export function requestCurrentPosition(
  options: CurrentPositionOptions = {},
): Promise<CurrentPositionOutcome> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ kind: 'failed', reason: 'unsupported' });
  }
  const settings = { ...DEFAULTS, ...options };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          kind: 'found',
          point: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracyMeters: position.coords.accuracy,
        }),
      (error) => resolve({ kind: 'failed', reason: failureOf(error) }),
      settings,
    );
  });
}

export async function queryGeolocationPermission(): Promise<GeolocationPermission> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'unknown';
  }
}
