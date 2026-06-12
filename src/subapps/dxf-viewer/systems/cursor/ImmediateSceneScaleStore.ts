/**
 * Non-React SSoT mirror of the active scene's **mm → scene (canvas) unit scale**.
 *
 * Canvas/world coordinates are expressed in the drawing's native units, which may
 * be mm / cm / m / in / ft (resolved per-scene via `resolveSceneUnits` /
 * ADR-368 `userDrawingUnits`). BIM scalars are authored in mm and converted with
 * `mmToSceneUnits(units)`. Event-time, non-React consumers — notably the grip-drag
 * step snap (`grip-step-quantize.applyGripStepSnap`, ADR-040 orchestrator-decoupled)
 * — need this scale synchronously to turn a user-typed **mm** step into the scene
 * units the drag delta lives in. Without it a 50 mm step on a metre-scale drawing
 * (scale 0.001) would quantize a ~metre delta to multiples of 50 → always 0 → the
 * entity would never move.
 *
 * Sole writer: `useDxfSceneConversion` (on every resolved-units change). Default 1
 * (mm scene, 1 canvas unit = 1 mm) until a scene loads.
 *
 * @see hooks/canvas/useDxfSceneConversion.ts — sole writer
 * @see bim/grips/grip-step-quantize.ts — reader (mm step → scene units)
 * @see utils/scene-units.ts — mmToSceneUnits SSoT
 */

let mmToScene = 1;

export const immediateSceneScale = {
  /** Writer — `valueMm * scale = valueCanvas`. Non-positive input ignored. */
  set(scale: number): void {
    if (Number.isFinite(scale) && scale > 0) mmToScene = scale;
  },
  /** Live mm → scene (canvas) unit multiplier for the active scene. */
  getMmToScene(): number {
    return mmToScene;
  },
};
