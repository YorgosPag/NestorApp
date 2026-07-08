import { clamp } from '../../utils/scalar-math';

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
 * Approximate solar position for a given date/time and lat/lng.
 * Athens default: lat=37.97, lng=23.73.
 * Accuracy: ±5° (sufficient for visual lighting, not astronomical use).
 */
export function computeSolarPosition(
  date: Date,
  latDeg: number,
  lngDeg: number,
): SolarAngles {
  const doy = dayOfYear(date);
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarHour = utcHour + lngDeg / 15;

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

export function timeOfDayToDate(hourDecimal: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setHours(Math.floor(hourDecimal), Math.floor((hourDecimal % 1) * 60), 0, 0);
  return d;
}
