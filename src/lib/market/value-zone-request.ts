/**
 * @fileoverview **Το συμβόλαιο του `GET /api/market/value-zone`** — η διαδρομή για τον client και η ανάγνωση του σημείου
 * για τον server, σε **ένα** αρχείο ώστε τα ονόματα παραμέτρων να μη γράφονται δύο φορές (ADR-898 Φ2).
 * @related `app/api/market/value-zone/route.ts` · `lib/market/value-zone-at-point.ts`
 * @module lib/market/value-zone-request
 */

import type { GeoPoint } from '@/types/geo/coordinates';

import type { ValueZoneVerdict } from './value-zone-at-point';

const ROUTE = '/api/market/value-zone';
const LAT = 'lat';
const LNG = 'lng';

/** 6 δεκαδικά ≈ 11 εκ.: πολύ κάτω από την ανοχή των ζωνών, και κοινά κλειδιά CDN για ίδιες πινέζες. */
const COORDINATE_DECIMALS = 6;

/** Η απάντηση 200 (τα `unavailable` φεύγουν ως 503, ποτέ ως σώμα). */
export interface ValueZoneResponse {
  readonly verdict: ValueZoneVerdict;
}

function rounded(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

/** Η δημόσια διαδρομή για ένα σημείο — ΜΙΑ δήλωση για client και tests. */
export function valueZoneAtPath(point: GeoPoint): string {
  const query = new URLSearchParams({ [LAT]: String(rounded(point.lat)), [LNG]: String(rounded(point.lng)) });
  return `${ROUTE}?${query.toString()}`;
}

function coordinate(raw: string | null, limit: number): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > limit) return null;
  return rounded(value);
}

/**
 * Το σημείο του αιτήματος, ή `null` αν λείπει ή είναι εκτός ορίων WGS84. ⚠️ **Κανένα ελληνικό bbox**: «εκτός
 * Ελλάδας» το λένε τα ίδια τα αρχεία ζωνών (`outside`), όχι ένα σκληροκωδικοποιημένο ορθογώνιο (ADR-332 D27).
 */
export function readValueZoneRequestPoint(params: URLSearchParams): GeoPoint | null {
  const lat = coordinate(params.get(LAT), 90);
  const lng = coordinate(params.get(LNG), 180);
  return lat === null || lng === null ? null : { lat, lng };
}
