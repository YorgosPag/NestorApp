/**
 * ADR-920 §14.12 Β0 — τα καθαρά μαθηματικά του πρωτοτύπου σύντηξης. Χωρίς I/O, χωρίς DOM: τρέχουν ίδια σε Worker και
 * στο κύριο νήμα.
 *
 * ⚠️ **Πρωτότυπο δοκιμής εφικτότητας.** Ο πυρήνας της παραγωγής γράφεται στο Β3 (`src/lib/terrain/`), με άγκυρες.
 */

/** Όλα τα πλακίδια του πρωτοκόλλου έχουν το ίδιο μέγεθος — η MapLibre πετά `dem dimension mismatch` αλλιώς. */
export const FUSION_TILE_SIZE = 512;

export interface TileId {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

export interface LngLat {
  readonly lng: number;
  readonly lat: number;
}

export function tileKey(tile: TileId): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

/** Γεωγραφικό μήκος → οριζόντια συντεταγμένη Web Mercator στο [0, 1). */
export function mercatorXOfLng(lng: number): number {
  return (lng + 180) / 360;
}

/** Γεωγραφικό πλάτος → κατακόρυφη συντεταγμένη Web Mercator στο [0, 1], με το 0 στον βορρά. */
export function mercatorYOfLat(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

export function lngOfMercatorX(u: number): number {
  return u * 360 - 180;
}

export function latOfMercatorY(v: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * v))) * 180) / Math.PI;
}

/** Το πλακίδιο του επιπέδου `zoom` που περιέχει το σημείο. */
export function tileOfLngLat(point: LngLat, zoom: number): TileId {
  const n = 2 ** zoom;
  const clamp = (value: number): number => Math.min(n - 1, Math.max(0, Math.floor(value)));
  return { z: zoom, x: clamp(mercatorXOfLng(point.lng) * n), y: clamp(mercatorYOfLat(point.lat) * n) };
}

/** Ο πρόγονος ενός πλακιδίου στο (ρηχότερο ή ίσο) επίπεδο `zoom`. */
export function ancestorTile(tile: TileId, zoom: number): TileId {
  if (zoom >= tile.z) return tile;
  const shift = tile.z - zoom;
  return { z: zoom, x: Math.floor(tile.x / 2 ** shift), y: Math.floor(tile.y / 2 ** shift) };
}

/** Terrarium: ύψος = R·256 + G + B/256 − 32768 (βήμα 1/256 m). Γράφει 4 bytes στο `out[offset…]`, αδιαφανές. */
export function writeTerrarium(out: Uint8ClampedArray, offset: number, heightM: number): void {
  const shifted = Math.min(65535.996, Math.max(0, heightM + 32768));
  const whole = Math.floor(shifted);
  out[offset] = whole >> 8;
  out[offset + 1] = whole & 255;
  out[offset + 2] = Math.floor((shifted - whole) * 256);
  out[offset + 3] = 255;
}

export function readTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** `3t² − 2t³`, με το `t` κομμένο στο [0, 1]. */
export function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Ποσοστημόριο ταξινομημένου πίνακα (πλησιέστερη θέση). Κενός πίνακας ⇒ `null`. */
function quantile(sortedAscending: readonly number[], q: number): number | null {
  if (sortedAscending.length === 0) return null;
  const index = Math.min(sortedAscending.length - 1, Math.max(0, Math.round(q * (sortedAscending.length - 1))));
  return sortedAscending[index];
}

export interface NumberSummary {
  readonly count: number;
  readonly min: number | null;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly max: number | null;
  readonly mean: number | null;
}

export function summarize(values: readonly number[]): NumberSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (value: number | null): number | null => (value === null ? null : Number(value.toFixed(3)));
  const mean = sorted.length === 0 ? null : sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    count: sorted.length,
    min: round(quantile(sorted, 0)),
    p50: round(quantile(sorted, 0.5)),
    p95: round(quantile(sorted, 0.95)),
    max: round(quantile(sorted, 1)),
    mean: round(mean),
  };
}
