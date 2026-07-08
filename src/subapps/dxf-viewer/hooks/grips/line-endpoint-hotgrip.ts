/**
 * ADR-513 §grip-parity — plain-LINE endpoint → click-move-click hot-grip entry SSoT resolver.
 *
 * Giorgio's explicit choice: with Dynamic Input ON, extending a line's endpoint must work
 * EXACTLY like the wall/beam «Δαχτυλίδι Εντολών» — click the endpoint (release the button),
 * the end follows the cursor with the button FREE, click a «Μήκος»/«Γωνία» wedge, type, then
 * click the canvas to place. This replaces the press-drag gesture (where the button is held,
 * so the wedges can never be clicked) with the AutoCAD "hot grip" click-move-click flow, using
 * the SAME shared `wall-hot-grip-fsm` (op `'endpoint-stretch'`, terminal `tracking`) — no new
 * FSM, no new commit path.
 *
 * The plain endpoint grip (grips 0/1) carries NO grip kind, so it is absent from
 * `HOT_GRIP_OP_REGISTRY` and cannot be routed through the registry. This pure, DOM-free
 * resolver is the ONE decision point (unit-tested), mirroring `resolveCtrlEndpointRotateCopy`:
 * given the grabbed grip + its entity, it decides whether the gesture qualifies. The caller
 * additionally gates on `cadToggleState.isDynInputOn()` (kept out of here so the resolver stays
 * pure); with Dynamic Input OFF the endpoint keeps its press-drag path (zero regression).
 *
 * Strict gate: a PLAIN line endpoint only — `type: 'vertex'`, `movesEntity` falsy, no
 * `lineGripKind` (the rotation/move handles carry their own kind and keep their role), grip
 * index 0 (start) or 1 (end). Only for a `'line'` entity (arc/polyline reshape stay press-drag).
 *
 * @see hooks/grips/ctrl-endpoint-rotate-copy.ts — sibling bespoke-entry resolver (mirrored)
 * @see hooks/grips/wall-hot-grip-fsm.ts — `'endpoint-stretch'` op (terminal `tracking`)
 * @see systems/dynamic-input/grip-endpoint-lock.ts — the length/angle lock applied at ghost+commit
 * @see docs/centralized-systems/reference/adrs/ADR-513-radial-command-ring.md §grip-parity
 */

import type { UnifiedGripInfo } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';

/** Minimal structural view of the grabbed entity — keeps the resolver decoupled + pure. */
interface EndpointHotGripEntity {
  readonly type?: string;
}

/**
 * Decide whether pressing `grip` (belonging to `entity`) should start the plain-line
 * endpoint click-move-click hot-grip. Returns `false` when the gesture does not qualify;
 * the caller then keeps the normal press-drag path. The Dynamic-Input toggle is checked
 * by the caller (this stays a pure geometry/kind gate).
 */
export function resolveLineEndpointHotGrip(
  entity: EndpointHotGripEntity | null | undefined,
  grip: UnifiedGripInfo | null | undefined,
): boolean {
  if (!entity || !grip) return false;
  if (grip.source !== 'dxf') return false;
  if (entity.type !== 'line') return false;
  // A PLAIN endpoint / vertex only: a moving handle (movesEntity) or the rotation/move
  // handle (carries `lineGripKind`) must keep its own role.
  if (grip.type !== 'vertex' || grip.movesEntity === true || gripKindOf(grip, 'line')) return false;
  return grip.gripIndex === 0 || grip.gripIndex === 1;
}
