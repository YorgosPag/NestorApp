/**
 * Bathroom auto-arrange **flow core** tests · ADR-638 (Στάδιο 2b).
 *
 * Covers `arrangeBathroomForRoom` — the reusable glue the hover→click region-pick
 * tool calls: door-marker extraction → solver → commit → success/warning toast.
 * Uses the null-level accessor stub (like the Στάδιο 2 commit tests): the commit
 * counts the built entities without needing a live scene, so the flow's branching
 * (solution vs no-solution) is exercised end-to-end without touching command history.
 *
 * The React wrappers (`useBathroomAutoArrangeTool` / `useBathroomAutoArrangeMouseMove`)
 * are thin imperative shells over already-tested SSoT (`pickRegionPerimeterAt`,
 * `RegionPerimeterPreviewStore`) and are validated by browser-verify.
 */

import type { TFunction } from 'i18next';
import type { NotificationContextValue } from '@/types/notifications';
import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { SceneAppendAccessor } from '../../../bim/scene/append-entity-to-scene';
import { arrangeBathroomForRoom } from '../run-bathroom-auto-arrange-flow';

/** A closed rectangular room in millimetres (scene coords are canonical mm, ADR-462). */
function rectRoomMm(w: number, d: number): Point2D[] {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }];
}

/** Null-level accessor: commit builds + counts entities without a live scene (mirror commit tests). */
const nullAccessor: SceneAppendAccessor = {
  currentLevelId: null,
  getLevelScene: () => null,
  setLevelScene: () => undefined,
};

/** A door opening entity on the bottom wall (only what `extractDoorMarkers` reads). */
function doorEntity(x: number, width: number): Entity {
  return {
    type: 'opening',
    params: { kind: 'door', width },
    geometry: { position: { x, y: 0 } },
  } as unknown as Entity;
}

function makeDeps() {
  const notifications = {
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  const t = ((key: string) => key) as unknown as TFunction;
  return {
    deps: { notifications: notifications as unknown as NotificationContextValue, t },
    notifications,
  };
}

describe('arrangeBathroomForRoom — pick → solve → commit → notify', () => {
  it('commits fixtures for a normal bathroom and toasts success (no warning)', () => {
    const { deps, notifications } = makeDeps();
    const committed = arrangeBathroomForRoom(nullAccessor, rectRoomMm(2400, 2400), [], deps);

    expect(committed).toBeGreaterThan(0);
    expect(notifications.success).toHaveBeenCalledTimes(1);
    expect(notifications.warning).not.toHaveBeenCalled();
  });

  it('warns + commits nothing when no arrangement fits (tiny room)', () => {
    const { deps, notifications } = makeDeps();
    const committed = arrangeBathroomForRoom(nullAccessor, rectRoomMm(300, 300), [], deps);

    expect(committed).toBe(0);
    expect(notifications.warning).toHaveBeenCalledTimes(1);
    expect(notifications.success).not.toHaveBeenCalled();
  });

  it('still arranges when a door is present (door keep-clear path integrates)', () => {
    const { deps, notifications } = makeDeps();
    // Door centred on the bottom wall → solver routes fixtures around its keep-clear.
    const entities = [doorEntity(1200, 800)];
    const committed = arrangeBathroomForRoom(nullAccessor, rectRoomMm(2400, 2400), entities, deps);

    expect(committed).toBeGreaterThan(0);
    expect(notifications.success).toHaveBeenCalledTimes(1);
    expect(notifications.warning).not.toHaveBeenCalled();
  });

  it('passes the committed count to the success toast interpolation', () => {
    const { deps } = makeDeps();
    const t = jest.fn((key: string) => key) as unknown as TFunction;
    const committed = arrangeBathroomForRoom(nullAccessor, rectRoomMm(2400, 2400), [], { ...deps, t });

    expect((t as jest.Mock)).toHaveBeenCalledWith(
      'callbacks.bathroomAutoArrange.done',
      { count: committed },
    );
  });
});
