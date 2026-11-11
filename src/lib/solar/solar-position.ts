/**
 * @fileoverview **ΘΕΣΗ ΤΟΥ ΗΛΙΟΥ (SSoT)** — αζιμούθιο + ύψος για ημερομηνία/ώρα και γεωγραφική θέση.
 * @related ADR-937 (ηλιασμός αγγελίας) · subapps/dxf-viewer/bim-3d/lighting/solar-position (επανεξάγει από εδώ)
 * @module lib/solar/solar-position
 *
 * Ζούσε στο `subapps/dxf-viewer/bim-3d/lighting/solar-position.ts` (φωτισμός 3D). Προωθήθηκε εδώ επειδή τη χρειάζεται
 * και η **δημόσια** αγγελία, που δεν επιτρέπεται να εισάγει από το subapp (CHECK 3.62) — ίδιο πρότυπο με το
 * `lib/geometry/scalar.ts`. Ο αλγόριθμος έμεινε **ταυτόσημος**.
 *
 * 🔑 Σύμβαση αζιμουθίου: 0° = Βορράς, κατά τη φορά του ρολογιού (90° = Ανατολή) — η ίδια με τη `polygon-azimuth-utils`
 *    και το `orientationOfAzimuth`.
 * ⚠️ Ακρίβεια ±5° (χωρίς εξίσωση του χρόνου): αρκεί για φωτισμό και για **εκτίμηση ωρών ήλιου**, όχι για αστρονομία.
 */

import { clamp } from '@/lib/geometry/scalar';

export interface SolarAngles {
  azimuthDeg: number;
  elevationDeg: number;
}

const DEG = Math.PI / 180;

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Θέση ήλιου σε **ηλιακή** ώρα (12 = ηλιακό μεσημέρι) — ανεξάρτητη από ζώνη ώρας και γεωγραφικό μήκος.
 * @param doy ημέρα του έτους (1 = 1 Ιανουαρίου)
 */
export function solarPositionAtSolarHour(doy: number, solarHour: number, latDeg: number): SolarAngles {
  const declinationDeg = 23.45 * Math.sin(DEG * (360 / 365) * (doy - 81));
  const hourAngleDeg = 15 * (solarHour - 12);

  const latRad = latDeg * DEG;
  const decRad = declinationDeg * DEG;
  const hRad = hourAngleDeg * DEG;

  const sinEl = clamp(
    Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hRad),
    -1,
    1,
  );
  const elevationRad = Math.asin(sinEl);
  const elevationDeg = elevationRad / DEG;

  const cosEl = Math.cos(elevationRad);
  const cosAz = cosEl < 1e-6
    ? 0
    : clamp((Math.sin(decRad) - sinEl * Math.sin(latRad)) / (cosEl * Math.cos(latRad)), -1, 1);

  let azimuthDeg = Math.acos(cosAz) / DEG;
  if (solarHour > 12) azimuthDeg = 360 - azimuthDeg;

  return { azimuthDeg, elevationDeg };
}

/**
 * Approximate solar position for a given date/time and lat/lng.
 * Athens default: lat=37.97, lng=23.73.
 * Accuracy: ±5° (sufficient for visual lighting, not astronomical use).
 */
export function computeSolarPosition(date: Date, latDeg: number, lngDeg: number): SolarAngles {
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return solarPositionAtSolarHour(dayOfYear(date), utcHour + lngDeg / 15, latDeg);
}

export function timeOfDayToDate(hourDecimal: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setHours(Math.floor(hourDecimal), Math.floor((hourDecimal % 1) * 60), 0, 0);
  return d;
}
