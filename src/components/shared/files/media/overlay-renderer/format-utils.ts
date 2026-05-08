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

/** Distance label — "<value> <unit>". */
export function formatDistance(meters: number, unit: string = 'm'): string {
  return `${trimDecimals(meters)} ${unit}`;
}

/** Area label — "<value> m²" by default. */
export function formatArea(squareMeters: number, unit: string = 'm²'): string {
  return `${trimDecimals(squareMeters)} ${unit}`;
}

/** Angle label — degrees with ° symbol. */
export function formatAngle(degrees: number): string {
  return `${trimDecimals(degrees, 1)}°`;
}
