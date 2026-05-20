/**
 * metric-formatters — ADR-366 §B.5
 * Pure helpers for formatting Performance HUD metric values.
 * No React, no side effects.
 */

/** Format megabytes as human-readable string: "1.2 GB" / "512 MB" */
export function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

/** Format large counts: "1.2M" / "482K" / "482" */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

/** Format milliseconds: "17.3 ms" */
export function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}

/**
 * Render a block-character progress bar.
 * @param pct  — 0-100 percentage
 * @param width — total character width
 * @returns e.g. "▰▰▰▱▱▱▱▱"
 */
export function formatProgressBar(pct: number, width: number): string {
  const clamped = Math.min(100, Math.max(0, pct));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}
