/**
 * ADR-650 M5α — Topography QA («καμπανάκι») domain types.
 *
 * Deterministic quality checks over the EXISTING survey data — no LLM, no cost, offline.
 * Philosophy (ADR-650 §9): AI-accelerant / human-certifier. A flag NEVER edits the survey;
 * it only points the engineer at something worth a second look. The engineer certifies.
 *
 * Big-player model (Civil 3D «Surface» statistics / Trimble Business Center blunder
 * detection): a QA pass produces a transient, discrete REPORT — «Run → review», never a
 * per-frame stream. Each flag carries a WORLD-space position so the report can both list it
 * (zoom-to) and drop a marker on it — the exact two surfaces Civil 3D/TBC offer.
 *
 * Types only — no logic (exempt from the 500-line rule).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { TopoSurfaceId } from '../topo-types';

/**
 * Severity triage, reusing the shared clash palette identifiers (`high`/`medium`/`low`) so
 * the QA marker glyph is byte-identical to the clash ⊙ (ADR-435 SSoT) — one attention-marker
 * shape across the app, zero drift. `high` = almost certainly wrong (red), `medium` = likely
 * (amber), `low` = worth a glance (yellow).
 */
export type TopoQaSeverity = 'high' | 'medium' | 'low';

/** WHICH deterministic rule raised the flag (drives the icon + message key). */
export type TopoQaKind =
  | 'elevation-bust'    // a surface node whose Z is an outlier vs its TIN neighbours
  | 'duplicate-point'   // two survey points at (almost) the same XY with incompatible Z
  | 'boundary-closure'  // a closed ring that is degenerate / does not form a valid loop
  | 'self-intersection' // a closed ring whose edges cross themselves
  | 'missing-breakline'; // a steep TIN edge with no breakline constraint (ridge/ditch?)

/**
 * One QA finding. `at` is WORLD canonical mm (ADR-462) — the same frame the contour
 * entities live in, so it doubles as the marker position AND the zoom-to focus point.
 * The message is an i18n key + params (N.11): the engine never bakes user-facing text.
 */
export interface TopoQaFlag {
  /** Stable per report (deterministic `${kind}:${n}`) — keeps the checks pure/testable. */
  readonly id: string;
  readonly kind: TopoQaKind;
  readonly severity: TopoQaSeverity;
  /** Marker + zoom-to position, WORLD canonical mm. */
  readonly at: Point2D;
  /** i18n key under `topography.qa.flag.*`. */
  readonly messageKey: string;
  /** Interpolation values, ALREADY in presentation units (metres, degrees, counts). */
  readonly messageParams: Readonly<Record<string, string | number>>;
}

/**
 * The full QA pass result. Transient — held by `topo-qa-store` under review, never persisted
 * (a snapshot of «what was true when you pressed Run», the Civil 3D/TBC model).
 */
export interface TopoQaReport {
  readonly surfaceId: TopoSurfaceId;
  readonly flags: readonly TopoQaFlag[];
  readonly counts: Readonly<Record<TopoQaSeverity, number>>;
  /**
   * How many flags each rule found beyond the per-report cap and therefore dropped from
   * `flags` — surfaced in the panel so a capped report never reads as «all clear» (the
   * no-silent-truncation rule). `0` when nothing was dropped.
   */
  readonly droppedByCap: number;
  /** True when the surface had fewer than 3 nodes — nothing to check, not «all clear». */
  readonly notEnoughData: boolean;
}
