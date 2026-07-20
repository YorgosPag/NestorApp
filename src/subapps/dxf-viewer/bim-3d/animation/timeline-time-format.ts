/**
 * ADR-366 §C.1.b — Timeline time formatting SSoT.
 *
 * Shared by TimelineEditor (waypoint list) και TimelineScrubber (playhead
 * readout). Ζει σε δικό του module ώστε να ΜΗΝ διπλασιαστεί ο formatter
 * όταν ο scrubber έγινε ξεχωριστό component (N.18 — no sibling clones).
 *
 * Format: `mm:ss.mmm` (millisecond precision — NLE convention, ό,τι δείχνει
 * το Premiere/AE timecode readout σε non-drop mode).
 */

/** `mm:ss.mmm`. Negative input clamps to zero. */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  return `${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
}

/**
 * Evenly-spaced keyframe times για `count` waypoints σε `durationSec`.
 *
 * SSoT για το "πού κάθεται το waypoint #i στον χρόνο" — καταναλώνεται και
 * από την κάθετη λίστα και από τα ticks του scrubber, ώστε τα δύο να ΜΗΝ
 * μπορούν να διαφωνήσουν.
 *
 * Guards: count <= 1 ή μη-θετικό durationSec → όλα στο 0 (no divide-by-zero).
 */
export function waypointTimesSec(count: number, durationSec: number): readonly number[] {
  const safeCount = Math.max(0, Math.floor(count));
  const stepSec = safeCount > 1 && durationSec > 0 ? durationSec / (safeCount - 1) : 0;
  return Array.from({ length: safeCount }, (_, i) => stepSec * i);
}

function pad(n: number, width: number): string {
  return `${n}`.padStart(width, '0');
}
