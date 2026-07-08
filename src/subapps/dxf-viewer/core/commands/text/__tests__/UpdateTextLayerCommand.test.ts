/**
 * UpdateTextLayerCommand.test.ts (ADR-557 E-α) — moving a text entity to another layer.
 *
 * Covers: the top-level `layerId` patch + audit, symmetric undo/redo, the already-on-target
 * no-op, an unknown target no-op, and the source/target locked-layer guards (with the
 * `canUnlockLayer` escape). LayerStore is mocked so the target-name lookup + source-name
 * resolution are hermetic (no real store seeding).
 */

import { UpdateTextLayerCommand } from '../UpdateTextLayerCommand';
import { CanEditLayerError, type ILayerAccessProvider, type IDxfTextAuditRecorder } from '../types';
import type { ISceneManager } from '../../interfaces';

jest.mock('../../../../stores/LayerStore', () => ({
  // The command resolves the SOURCE layer name from the entity (id-first); fixed to 'Source'.
  resolveEntityLayerName: jest.fn(() => 'Source'),
  // ...and looks up the TARGET layer by id → its name (or null for an unknown id).
  getLayer: jest.fn((idOrName: string) => {
    const byId: Record<string, { id: string; name: string }> = {
      lyr_target: { id: 'lyr_target', name: 'Target' },
      lyr_old: { id: 'lyr_old', name: 'Source' },
    };
    return byId[idOrName] ?? null;
  }),
}));

/** Layer provider whose `getLayer` marks the given names as locked (frozen never set here). */
function makeProvider(lockedNames: string[] = [], canUnlockLayer = false): ILayerAccessProvider {
  return {
    getLayer: (name: string) => ({ name, locked: lockedNames.includes(name), frozen: false }),
    canUnlockLayer,
  };
}

function makeScene(entity: unknown) {
  const updateEntity = jest.fn();
  const getEntity = jest.fn(() => entity);
  return { manager: { getEntity, updateEntity } as unknown as ISceneManager, updateEntity, getEntity };
}

function makeAudit() {
  const record = jest.fn();
  return { recorder: { record } as IDxfTextAuditRecorder, record };
}

const textOn = (layerId?: string) => ({ id: 't1', type: 'text' as const, layerId });

describe('UpdateTextLayerCommand (ADR-557 E-α)', () => {
  it('patches the top-level layerId and records an `updated` audit event', () => {
    const { manager, updateEntity } = makeScene(textOn('lyr_old'));
    const { recorder, record } = makeAudit();
    const cmd = new UpdateTextLayerCommand({ entityId: 't1', layerId: 'lyr_target' }, manager, makeProvider(), recorder);

    cmd.execute();

    expect(updateEntity).toHaveBeenCalledWith('t1', { layerId: 'lyr_target' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 't1',
        action: 'updated',
        changes: [{ field: 'layerId', oldValue: 'lyr_old', newValue: 'lyr_target' }],
      }),
    );
  });

  it('undo restores the previous layerId; redo re-applies the target', () => {
    const { manager, updateEntity } = makeScene(textOn('lyr_old'));
    const cmd = new UpdateTextLayerCommand({ entityId: 't1', layerId: 'lyr_target' }, manager, makeProvider());

    cmd.execute();
    cmd.undo();
    expect(updateEntity).toHaveBeenLastCalledWith('t1', { layerId: 'lyr_old' });

    cmd.redo();
    expect(updateEntity).toHaveBeenLastCalledWith('t1', { layerId: 'lyr_target' });
  });

  it('is a no-op when the entity is already on the target layer', () => {
    const { manager, updateEntity } = makeScene(textOn('lyr_target'));
    const cmd = new UpdateTextLayerCommand({ entityId: 't1', layerId: 'lyr_target' }, manager, makeProvider());

    cmd.execute();
    expect(updateEntity).not.toHaveBeenCalled();
  });

  it('is a no-op when the target layer id does not resolve', () => {
    const { manager, updateEntity } = makeScene(textOn('lyr_old'));
    const cmd = new UpdateTextLayerCommand({ entityId: 't1', layerId: 'lyr_missing' }, manager, makeProvider());

    cmd.execute();
    expect(updateEntity).not.toHaveBeenCalled();
  });

  it('is a no-op when the entity is gone', () => {
    const { manager, updateEntity } = makeScene(undefined);
    const cmd = new UpdateTextLayerCommand({ entityId: 't1', layerId: 'lyr_target' }, manager, makeProvider());

    cmd.execute();
    expect(updateEntity).not.toHaveBeenCalled();
  });

  it('blocks a locked TARGET layer the user cannot unlock', () => {
    const { manager, updateEntity } = makeScene(textOn('lyr_old'));
    const cmd = new UpdateTextLayerCommand(
      { entityId: 't1', layerId: 'lyr_target' },
      manager,
      makeProvider(['Target'], false),
    );

    expect(() => cmd.execute()).toThrow(CanEditLayerError);
    expect(updateEntity).not.toHaveBeenCalled();
  });

  it('blocks a locked SOURCE layer the user cannot unlock', () => {
    const { manager, updateEntity } = makeScene(textOn('lyr_old'));
    const cmd = new UpdateTextLayerCommand(
      { entityId: 't1', layerId: 'lyr_target' },
      manager,
      makeProvider(['Source'], false),
    );

    expect(() => cmd.execute()).toThrow(CanEditLayerError);
    expect(updateEntity).not.toHaveBeenCalled();
  });

  it('allows a locked target when the user CAN unlock layers', () => {
    const { manager, updateEntity } = makeScene(textOn('lyr_old'));
    const cmd = new UpdateTextLayerCommand(
      { entityId: 't1', layerId: 'lyr_target' },
      manager,
      makeProvider(['Target'], true),
    );

    cmd.execute();
    expect(updateEntity).toHaveBeenCalledWith('t1', { layerId: 'lyr_target' });
  });

  it('validate() requires entityId and layerId', () => {
    const { manager } = makeScene(textOn('lyr_old'));
    const provider = makeProvider();
    expect(new UpdateTextLayerCommand({ entityId: '', layerId: 'lyr_target' }, manager, provider).validate())
      .toBe('entityId is required');
    expect(new UpdateTextLayerCommand({ entityId: 't1', layerId: '' }, manager, provider).validate())
      .toBe('layerId is required');
    expect(new UpdateTextLayerCommand({ entityId: 't1', layerId: 'lyr_target' }, manager, provider).validate())
      .toBeNull();
  });
});
