/**
 * viewport-fit-intent — SSoT one-shot flag: «the next viewport auto-fit evaluation
 * was triggered by a USER-INITIATED file import, so it MUST fit-to-extents,
 * overriding any persisted-viewport restore» (Giorgio 2026-07-11, ADR-399).
 *
 * WHY a module-level flag and not another EventBus event: the auto-fit decision
 * lives in the `useViewportAutoFit` effect, which reacts to the scene change the
 * import causes. A flag set SYNCHRONOUSLY right after `setLevelScene` (same call
 * stack, before React commits the render) is guaranteed visible when that effect
 * runs on the next render — with no event-vs-render ordering race. This is exactly
 * the double-controller race the old imperative `EventBus.emit('canvas-fit-to-view')`
 * in `useSceneState` fought against `useViewportAutoFit`'s restore path.
 *
 * ONE writer (the user-facing import paths → `markFreshImportFit`), ONE reader (the
 * single `useViewportAutoFit` controller → `consumeFreshImportFit`), consume-once.
 *
 * Distinguishes a fresh import from a hard-refresh reload: the reload path
 * (`useLevelSceneLoader.loadScene`, `setLevelScene(..., 'load')`) NEVER marks intent,
 * so it keeps the ADR-400 persisted-viewport restore (Revit-style resume).
 *
 * @see hooks/canvas/useViewportAutoFit.ts — the single auto-fit controller (reader)
 * @see systems/zoom/viewport-autofit-policy.ts — the pure decision (`freshImport` input)
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */

let freshImportFitPending = false;

/**
 * Mark that the NEXT auto-fit evaluation must fit-to-extents (a user-initiated
 * file import just committed its scene). Call SYNCHRONOUSLY after `setLevelScene`.
 */
export function markFreshImportFit(): void {
  freshImportFitPending = true;
}

/**
 * Read-and-clear the fresh-import flag. `true` ⇒ this evaluation is a genuine
 * user import and must fit (overrides restore/skip). Consume-once so a re-render
 * during the deferred fit never re-triggers it.
 */
export function consumeFreshImportFit(): boolean {
  const pending = freshImportFitPending;
  freshImportFitPending = false;
  return pending;
}

/** Test-only: reset the module flag between cases. */
export function __resetFreshImportFit(): void {
  freshImportFitPending = false;
}
