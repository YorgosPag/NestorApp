/**
 * GRIP MODE CYCLE — ADR-349 Phase 1c-A (SSoT)
 *
 * Pure metadata + cycle order for grip-hot modes (spacebar-toggleable).
 * Industry standard (AutoCAD / BricsCAD): cycle order is
 *   Stretch → Move → Rotate → Scale → Mirror → (back to Stretch)
 *
 * Phase 1c-A: `stretch` and `move` commit in place via StretchEntityCommand /
 * `moveEntities`. Phase 1c-B2: `rotate`, `scale`, `mirror` commit via
 * `GripHandoffStore.set(mode, grip.position)` + `onToolChange(mode)` — the
 * grip drag pre-seeds the target tool's base point and switches `activeTool`.
 * All 5 modes are fully implemented end-to-end (ADR-357 Phase 11 fix
 * 2026-05-18 — previous `implemented: false` flags were stale).
 *
 * @see GripModeStore
 * @see useGripSpacebarCycle
 */

export type GripMode = 'stretch' | 'move' | 'rotate' | 'scale' | 'mirror';

export interface GripModeMeta {
  readonly id: GripMode;
  /** Translation key under `tool-hints:gripMode.*` */
  readonly labelKey: string;
  /** Whether the mode has a real commit handler (vs deferred-toast stub). */
  readonly implemented: boolean;
}

const ORDER: ReadonlyArray<GripMode> = ['stretch', 'move', 'rotate', 'scale', 'mirror'];

const META: Readonly<Record<GripMode, GripModeMeta>> = {
  stretch: { id: 'stretch', labelKey: 'gripMode.stretch', implemented: true },
  move:    { id: 'move',    labelKey: 'gripMode.move',    implemented: true },
  rotate:  { id: 'rotate',  labelKey: 'gripMode.rotate',  implemented: true },
  scale:   { id: 'scale',   labelKey: 'gripMode.scale',   implemented: true },
  mirror:  { id: 'mirror',  labelKey: 'gripMode.mirror',  implemented: true },
};

export const DEFAULT_GRIP_MODE: GripMode = 'stretch';

export function gripModeMeta(mode: GripMode): GripModeMeta {
  return META[mode];
}

export function nextGripMode(current: GripMode): GripMode {
  const idx = ORDER.indexOf(current);
  return ORDER[(idx + 1) % ORDER.length];
}
