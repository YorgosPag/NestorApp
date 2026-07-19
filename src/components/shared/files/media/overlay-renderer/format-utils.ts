/**
 * Overlay renderer — number formatting helpers.
 *
 * Renderer-internal only. Locale-agnostic — i18n strings come pre-formatted
 * from the caller via `OverlayLabel`. These helpers handle dimension /
 * measurement value annotations (e.g. "3.42 m", "8.50 m²").
 *
 * @module components/shared/files/media/overlay-renderer/format-utils
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

function trimDecimals(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value
    .toFixed(decimals)
    .replace(/\.?0+$/, '')
    .replace(/\.$/, '');
}

/** Fixed decimals, no trailing-zero trim (surveyor style — always "3.50", not "3.5"). */
function fixedDecimals(value: number, decimals: number = 2): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '—';
}

/** Distance label — "<value> <unit>" with EXACTLY 2 decimals (e.g. "3.50 μ"). */
export function formatDistance(meters: number, unit: string = 'm'): string {
  return `${fixedDecimals(meters)} ${unit}`;
}

/** Area label — "<value> m²" with EXACTLY 2 decimals (e.g. "8.50 μ²"). */
export function formatArea(squareMeters: number, unit: string = 'm²'): string {
  return `${fixedDecimals(squareMeters)} ${unit}`;
}

/** Angle label — degrees with ° symbol (1 decimal, CAD convention). */
export function formatAngle(degrees: number): string {
  return `${trimDecimals(degrees, 1)}°`;
}
