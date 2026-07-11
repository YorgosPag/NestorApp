/**
 * viewport-autofit-policy — pure SSoT for the «WHEN does the viewport auto-fit?»
 * decision (ADR-399 / ADR-400 / ADR-418).
 *
 * ONE place owns the rule, so the three legacy auto-fit TRIGGERS collapse into a
 * single, unit-testable policy:
 *   - `useCanvasEffects` DXF scene auto-fit          (per-level)
 *   - `useFloorplanAutoFit` floorplan-background fit (per-background)
 *   - `useAutoFitOnFileChange` file-record fit       (per-file)
 * — each previously decided «should I fit now?» on its own, which is why a viewport
 * bug had three independent causes. This policy is the SSoT for the decision; the
 * matching {@link import('../../hooks/canvas/useViewportAutoFit')} hook owns the
 * state and performs the fit via the existing calculation SSoT (`FitToViewService`
 * through the `canvas-fit-to-view` EventBus path / `zoomToFit`).
 *
 * Revit/AutoCAD behaviour: the camera auto-frames ONCE on the first content of the
 * session (restore the persisted view or fit-to-extents), fits again ONLY on a
 * genuine re-import (a new file bound under the SAME level), and otherwise stays
 * put — so navigating floor→floor never moves the viewport.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 * @see services/FitToViewService.ts — the calculation SSoT (bounds → transform)
 */

export type AutoFitAction = 'initial' | 'fit' | 'skip';

export interface AutoFitPolicyInput {
  /** There is something to frame (DXF entities and/or a floorplan background). */
  readonly hasContent: boolean;
  /** The viewer has already made its one-time initial restore/fit decision. */
  readonly hasFittedOnce: boolean;
  /** The active level changed since the last evaluation (= floor navigation). */
  readonly levelChanged: boolean;
  /** The bound file record changed to a new non-null id since the last evaluation. */
  readonly fileChanged: boolean;
  /**
   * A USER-INITIATED file import just committed its scene (Giorgio 2026-07-11).
   * Overrides restore/skip → ALWAYS fit-to-extents, so loading ANY file (.dxf/.tek/…)
   * frames every entity (DXF/BIM/MEP/…). A hard-refresh RELOAD does NOT set this, so
   * it keeps the ADR-400 persisted-viewport restore. Sourced from `viewport-fit-intent`.
   */
  readonly freshImport: boolean;
}

/**
 * The single auto-fit decision:
 *   - no content yet                       → 'skip'    (nothing to frame)
 *   - user-initiated file import           → 'fit'     (ALWAYS Zoom Extents — Giorgio)
 *   - first content of the session         → 'initial' (ADR-400 restore-or-fit)
 *   - new file under the SAME level        → 'fit'     (genuine re-import = Zoom Extents)
 *   - everything else (navigation, drawing,→ 'skip'    (keep the viewport stable)
 *     subsequent scene mutations)
 *
 * `freshImport` wins FIRST (after the empty guard): loading any file always frames
 * its content, overriding a persisted-viewport restore that would otherwise fire on
 * the session's first content. A file change that coincides with a level change is
 * NAVIGATION (the user switched floors to one that owns a different file), NOT a
 * re-import — hence the explicit `!levelChanged` guard that keeps the viewport stable
 * across floors.
 */
export function resolveAutoFitAction(input: AutoFitPolicyInput): AutoFitAction {
  if (!input.hasContent) return 'skip';
  if (input.freshImport) return 'fit';
  if (!input.hasFittedOnce) return 'initial';
  if (input.fileChanged && !input.levelChanged) return 'fit';
  return 'skip';
}

/**
 * 🏢 ADR-418 — a persisted transform is degenerate when the WHOLE drawing would
 * project below `minVisiblePx` along its diagonal (the legacy 1px·unit «dot»
 * pathology that used to stick across reloads). Such a restore is rejected in
 * favour of a fresh fit. Viewport-independent: content too small to see is unusable
 * wherever it sits. Pure — the caller supplies the content diagonal (world units)
 * and the persisted scale.
 */
export function isDegenerateRestoreScale(
  contentDiagonalUnits: number,
  scale: number,
  minVisiblePx: number,
): boolean {
  if (!Number.isFinite(contentDiagonalUnits) || contentDiagonalUnits <= 0) return false;
  if (!Number.isFinite(scale) || scale <= 0) return false;
  const diagonalPx = contentDiagonalUnits * scale;
  return Number.isFinite(diagonalPx) && diagonalPx > 0 && diagonalPx < minVisiblePx;
}
