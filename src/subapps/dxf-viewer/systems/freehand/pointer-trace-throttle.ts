/**
 * passesTraceThrottle — screen-space distance throttle for freehand pointer traces (ADR-658).
 *
 * Returns `true` (and advances `lastRef`) when the pointer has moved at least `minPx`
 * screen pixels since the previous accepted sample; `false` otherwise. Keeps freehand
 * traces from flooding the store with sub-pixel points on every `pointermove`.
 * SSoT for the «Μολύβι» sketch tool; the lasso trace can adopt it as an N.18 follow-up.
 */
export function passesTraceThrottle(
  sx: number,
  sy: number,
  lastRef: { current: { x: number; y: number } | null },
  minPx = 3,
): boolean {
  const last = lastRef.current;
  if (last) {
    const dx = sx - last.x;
    const dy = sy - last.y;
    if (dx * dx + dy * dy < minPx * minPx) return false;
  }
  lastRef.current = { x: sx, y: sy };
  return true;
}
