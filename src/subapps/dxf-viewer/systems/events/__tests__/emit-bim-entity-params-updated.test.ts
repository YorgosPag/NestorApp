/**
 * ADR-459 Φ7 — kind→event SSoT (`emitBimEntityParamsUpdated`) + the 3D-commit
 * skip-logic (`emitStructuralChangeAfterEdit`). Integration-style: real `EventBus`
 * subscriptions capture the emitted payloads (no mocking of the bus).
 */
import { EventBus } from '../EventBus';
import { emitBimEntityParamsUpdated } from '../emit-bim-entity-params-updated';
import { emitStructuralChangeAfterEdit } from '../../../bim-3d/animation/bim3d-edit-structural-emit';
import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../../../core/commands/entity-commands/MoveEntityCommand';
import { RotateEntityCommand } from '../../../core/commands/entity-commands/RotateEntityCommand';
import { CompoundCommand } from '../../../core/commands/CompoundCommand';

/** A non-move/non-compound command (rotate/resize/tilt/vertical) → must emit. */
type EditCmd = Parameters<typeof emitStructuralChangeAfterEdit>[0];

/** Subscribe, run `fn`, return the captured payload (or null), then unsubscribe. */
function captureEvent<T>(eventType: Parameters<typeof EventBus.on>[0], fn: () => void): T | null {
  let captured: T | null = null;
  const unsub = EventBus.on(eventType, (payload) => {
    captured = payload as T;
  });
  fn();
  unsub();
  return captured;
}

describe('emitBimEntityParamsUpdated — kind→event SSoT', () => {
  // type → [event, payloadKey] — every entry the helper maps (the SSoT table).
  const CASES: ReadonlyArray<[string, Parameters<typeof EventBus.on>[0], string]> = [
    ['wall', 'bim:wall-params-updated', 'wallId'],
    ['opening', 'bim:opening-params-updated', 'openingId'],
    ['beam', 'bim:beam-params-updated', 'beamId'],
    ['column', 'bim:column-params-updated', 'columnId'],
    ['foundation', 'bim:foundation-params-updated', 'foundationId'],
    ['slab', 'bim:slab-params-updated', 'slabId'],
    ['roof', 'bim:roof-params-updated', 'roofId'],
    ['slab-opening', 'bim:slab-opening-params-updated', 'slabOpeningId'],
    ['floor-finish', 'bim:floor-finish-params-updated', 'floorFinishId'],
    ['thermal-space', 'bim:thermal-space-params-updated', 'thermalSpaceId'],
    ['space-separator', 'bim:space-separator-params-updated', 'spaceSeparatorId'],
    ['railing', 'bim:railing-params-updated', 'railingId'],
    ['furniture', 'bim:furniture-params-updated', 'furnitureId'],
    ['mep-segment', 'bim:mep-segment-params-updated', 'segmentId'],
    ['mep-fixture', 'bim:mep-fixture-params-updated', 'fixtureId'],
    ['electrical-panel', 'bim:electrical-panel-params-updated', 'panelId'],
    ['mep-manifold', 'bim:mep-manifold-params-updated', 'manifoldId'],
    ['mep-radiator', 'bim:mep-radiator-params-updated', 'radiatorId'],
    ['mep-boiler', 'bim:mep-boiler-params-updated', 'boilerId'],
    ['mep-water-heater', 'bim:mep-water-heater-params-updated', 'waterHeaterId'],
    ['mep-underfloor', 'bim:mep-underfloor-params-updated', 'underfloorId'],
  ];

  it.each(CASES)('%s → emits %s with the right payload key', (type, event, key) => {
    const payload = captureEvent<Record<string, string>>(event, () => {
      const ok = emitBimEntityParamsUpdated(type, 'id-123');
      expect(ok).toBe(true);
    });
    expect(payload).toEqual({ [key]: 'id-123' });
  });

  it('returns false (no-op) for a type with no params-updated event (stair)', () => {
    const spy = jest.spyOn(EventBus, 'emit');
    expect(emitBimEntityParamsUpdated('stair', 'stair-1')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns false for an unknown type', () => {
    expect(emitBimEntityParamsUpdated('totally-unknown', 'x')).toBe(false);
  });
});

describe('emitStructuralChangeAfterEdit — 3D commit announcement + move skip', () => {
  // Minimal SceneManager stub — only `getEntity().type` is read by the helper.
  const smFor = (type: string) =>
    ({ getEntity: () => ({ type }) }) as unknown as Parameters<typeof emitStructuralChangeAfterEdit>[2];

  it('emits column-params-updated after a non-move edit (resize/tilt/vertical self-emit nothing)', () => {
    const resizeLike = {} as EditCmd; // not a Move*/Rotate/Compound → needs the explicit emit
    const payload = captureEvent<{ columnId: string }>('bim:column-params-updated', () => {
      emitStructuralChangeAfterEdit(resizeLike, ['col-1'], smFor('column'));
    });
    expect(payload).toEqual({ columnId: 'col-1' });
  });

  it('SKIPS the emit for a rotate (ADR-492 Φ2 — RotateEntityCommand self-emits bim:entities-moved)', () => {
    const rotate = Object.create(RotateEntityCommand.prototype) as RotateEntityCommand;
    const spy = jest.spyOn(EventBus, 'emit');
    emitStructuralChangeAfterEdit(rotate, ['col-1'], smFor('column'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('SKIPS the emit for a plan move (MoveEntityCommand self-emits bim:entities-moved)', () => {
    const move = Object.create(MoveEntityCommand.prototype) as MoveEntityCommand;
    const spy = jest.spyOn(EventBus, 'emit');
    emitStructuralChangeAfterEdit(move, ['col-1'], smFor('column'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('SKIPS for MoveMultipleEntitiesCommand too', () => {
    const move = Object.create(MoveMultipleEntitiesCommand.prototype) as MoveMultipleEntitiesCommand;
    const spy = jest.spyOn(EventBus, 'emit');
    emitStructuralChangeAfterEdit(move, ['a', 'b'], smFor('column'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('SKIPS a CompoundCommand whose first child is a move (MEP move + pipe-follow)', () => {
    const move = Object.create(MoveEntityCommand.prototype) as MoveEntityCommand;
    const compound = new CompoundCommand('Edit + connected pipes', [move]);
    const spy = jest.spyOn(EventBus, 'emit');
    emitStructuralChangeAfterEdit(compound, ['mep-1'], smFor('mep-fixture'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emits per edited entity for a non-move compound (e.g. vertical multi-select)', () => {
    const compound = new CompoundCommand('Vertical Move (2)', []);
    const events: string[] = [];
    const unsub = EventBus.on('bim:column-params-updated', (p) => events.push((p as { columnId: string }).columnId));
    emitStructuralChangeAfterEdit(compound, ['c1', 'c2'], smFor('column'));
    unsub();
    expect(events).toEqual(['c1', 'c2']);
  });
});
