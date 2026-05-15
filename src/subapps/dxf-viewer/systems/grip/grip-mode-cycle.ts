/**
 * GRIP MODE CYCLE — ADR-349 Phase 1c-A (SSoT)
 *
 * Pure metadata + cycle order for grip-hot modes (spacebar-toggleable).
 * Industry standard (AutoCAD / BricsCAD): cycle order is
 *   Stretch → Move → Rotate → Scale → Mirror → (back to Stretch)
 *
 * Phase 1c-A: only `stretch` and `move` have full commit handlers; the other
 * three are present in the cycle UI for industry parity but currently emit a
 * "deferred" status hint instead of committing.
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
  rotate:  { id: 'rotate',  labelKey: 'gripMode.rotate',  implemented: false },
  scale:   { id: 'scale',   labelKey: 'gripMode.scale',   implemented: false },
  mirror:  { id: 'mirror',  labelKey: 'gripMode.mirror',  implemented: false },
};

export const DEFAULT_GRIP_MODE: GripMode = 'stretch';

export function gripModeMeta(mode: GripMode): GripModeMeta {
  return META[mode];
}

export function nextGripMode(current: GripMode): GripMode {
  const idx = ORDER.indexOf(current);
  return ORDER[(idx + 1) % ORDER.length];
}
