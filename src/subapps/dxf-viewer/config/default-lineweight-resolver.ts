/**
 * Default Lineweight Resolver — ADR-358 §5.3.ter (Q5 Per-project configurable).
 *
 * Pure cascade resolver for the "Default" lineweight sentinel (DXF group 370 = -3).
 * Resolution priority (high → low):
 *   1. Project override   — Firestore `projects/{projectId}/dxfSettings.defaultLineweight`.
 *   2. User preference    — localStorage `dxf:defaultLineweight` (cross-project).
 *   3. System default     — `0.25mm` hardcoded (AutoCAD compatibility).
 *
 * Special sentinel values (-3 DEFAULT, -2 ByLayer, -1 ByBlock) at any cascade level
 * are *skipped* — a "default of default" would recurse; ByLayer/ByBlock as project
 * defaults make no semantic sense.
 *
 * `SYSTEM_DEFAULT_LINEWEIGHT = 0.25mm` is the canonical AutoCAD/BricsCAD default —
 * choosing the same value guarantees visual parity when files are opened in those
 * applications.
 *
 * Pre-commit ratchet for this resolver (`default-lineweight-resolver`) is deferred
 * to Phase 5 — render integration — where `resolveEntityStyle` becomes the single
 * call site and `0.25` hardcoding can be cleanly banned.
 */

import type { LineweightMm } from '../types/entities';
import { isConcreteLineweight } from './lineweight-iso-catalog';

/** AutoCAD/BricsCAD canonical default lineweight (mm). */
export const SYSTEM_DEFAULT_LINEWEIGHT: LineweightMm = 0.25;

export interface DefaultLineweightInput {
  /** Per-project override from Firestore `dxfSettings.defaultLineweight`. */
  projectSetting?: LineweightMm | null;
  /** User preference from localStorage `dxf:defaultLineweight`. */
  userPreference?: LineweightMm | null;
}

/**
 * Resolve the concrete default lineweight via the 3-level cascade.
 * Always returns a concrete mm value (never a special sentinel).
 */
export function resolveDefaultLineweight(
  input: DefaultLineweightInput,
): LineweightMm {
  if (isConcreteLineweight(input.projectSetting)) return input.projectSetting;
  if (isConcreteLineweight(input.userPreference)) return input.userPreference;
  return SYSTEM_DEFAULT_LINEWEIGHT;
}
