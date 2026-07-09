/**
 * ADR-617 — entity-command SSoT parity tests.
 *
 * Verifies the three migrated entity-command families keep their shared
 * `BaseCommand` contract (id/timestamp/serialize envelope, redo=execute,
 * affected-ids) plus their execute / undo / redo lifecycle against a real
 * Map-backed `ISceneManager`:
 *
 *   - Batch derived-patch  → `SetComponentVisibilityCommand`
 *     (extends SignalingBatchEntityPatchCommand)
 *   - Entity field override → `SetFaceAppearanceCommand` /
 *     `SetEntityFaceAppearanceMapCommand` (extends EntityFieldOverrideCommand)
 *   - Assign family type    → `AssignSlabTypeCommand`
 *     (extends AssignTypeCommandBase)
 *
 * Complements the per-command behaviour suites (which stay the primary net).
 */

import { describe, it, expect } from '@jest/globals';
import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';
import { SetComponentVisibilityCommand } from '../SetComponentVisibilityCommand';
import { SetFaceAppearanceCommand } from '../SetFaceAppearanceCommand';
import { SetEntityFaceAppearanceMapCommand } from '../SetEntityFaceAppearanceMapCommand';
import { AssignSlabTypeCommand, type SlabTypeAssignment } from '../AssignSlabTypeCommand';
import type { SlabParams } from '../../../bim/types/slab-types';

const solid = (id: string, extra: Record<string, unknown> = {}): SceneEntity =>
  ({ id, type: 'column', visible: true, ...extra }) as unknown as SceneEntity;

describe('ADR-617 entity-command SSoT', () => {
  describe('BaseCommand envelope (shared by all three families)', () => {
    it('mints an id + timestamp and a well-formed serialize envelope', () => {
      const sm = createMockSceneManager([solid('e1')]);
      const cmd = new SetComponentVisibilityCommand(['e1'], 'core', false, sm);
      expect(typeof cmd.id).toBe('string');
      expect(cmd.id.length).toBeGreaterThan(0);
      expect(typeof cmd.timestamp).toBe('number');

      const s = cmd.serialize();
      expect(s).toMatchObject({
        type: 'set-component-visibility',
        id: cmd.id,
        name: 'SetComponentVisibility',
        version: 1,
      });
      expect(s.data).toEqual({ entityIds: ['e1'], component: 'core', value: false });
    });
  });

  describe('Batch derived-patch — SetComponentVisibility', () => {
    it('execute writes styleOverride on every entity; undo restores; redo re-applies', () => {
      const sm = createMockSceneManager([solid('a'), solid('b')]);
      const cmd = new SetComponentVisibilityCommand(['a', 'b'], 'core', false, sm);
      expect(cmd.getAffectedEntityIds()).toEqual(['a', 'b']);

      cmd.execute();
      const cvOf = (id: string) =>
        (sm.store.get(id) as unknown as { styleOverride?: { componentVisibility?: Record<string, boolean> } })
          .styleOverride?.componentVisibility?.core;
      expect(cvOf('a')).toBe(false);
      expect(cvOf('b')).toBe(false);

      cmd.undo();
      expect(cvOf('a')).toBeUndefined();

      cmd.redo();
      expect(cvOf('a')).toBe(false);
    });

    it('undo is inert when nothing matched (wasExecuted guard)', () => {
      const sm = createMockSceneManager([]); // no such entity
      const cmd = new SetComponentVisibilityCommand(['ghost'], 'core', true, sm);
      cmd.execute();
      expect(() => cmd.undo()).not.toThrow();
      expect(sm.store.size).toBe(0);
    });
  });

  describe('Entity field override — face appearance', () => {
    it('per-face set → undo → redo cycles the faceAppearance map', () => {
      const sm = createMockSceneManager([solid('f')]);
      const cmd = new SetFaceAppearanceCommand('f', 'side:0', { colorHex: '#C0392B' }, sm);
      cmd.execute();
      const faOf = () => (sm.store.get('f') as unknown as { faceAppearance?: Record<string, unknown> }).faceAppearance;
      expect(faOf()).toEqual({ 'side:0': { colorHex: '#C0392B' } });
      cmd.undo();
      expect(faOf()).toBeUndefined();
      cmd.redo();
      expect(faOf()).toEqual({ 'side:0': { colorHex: '#C0392B' } });
    });

    it('entity-level replace map (paste appearance) is a single undoable step', () => {
      const sm = createMockSceneManager([solid('g', { faceAppearance: { top: { colorHex: '#111' } } })]);
      const cmd = new SetEntityFaceAppearanceMapCommand('g', { 'side:1': { colorHex: '#2ECC71' } }, sm);
      cmd.execute();
      const faOf = () => (sm.store.get('g') as unknown as { faceAppearance?: Record<string, unknown> }).faceAppearance;
      expect(faOf()).toEqual({ 'side:1': { colorHex: '#2ECC71' } });
      cmd.undo();
      expect(faOf()).toEqual({ top: { colorHex: '#111' } });
    });

    it('aborts with no history effect when the entity is missing', () => {
      const sm = createMockSceneManager([]);
      const cmd = new SetFaceAppearanceCommand('nope', 'side:0', { colorHex: '#000' }, sm);
      expect(() => { cmd.execute(); cmd.undo(); cmd.redo(); }).not.toThrow();
      expect(sm.store.size).toBe(0);
    });
  });

  describe('Assign family type — envelope + serialize (AssignTypeCommandBase)', () => {
    it('exposes the affected id and the domain-keyed serialize payload', () => {
      const sm = createMockSceneManager([solid('slab1', { type: 'slab' })]);
      const params = { thickness: 200 } as unknown as SlabParams;
      const next: SlabTypeAssignment = { typeId: 'st_1', typeOverrides: undefined, params };
      const previous: SlabTypeAssignment = { typeId: undefined, typeOverrides: undefined, params };
      const cmd = new AssignSlabTypeCommand('slab1', next, previous, sm);

      expect(cmd.name).toBe('AssignSlabType');
      expect(cmd.getAffectedEntityIds()).toEqual(['slab1']);
      expect(cmd.getDescription()).toBe('Assign slab type (st_1)');
      const s = cmd.serialize();
      expect(s.type).toBe('assign-slab-type');
      expect(s.data).toEqual({ slabId: 'slab1', next, previous });
      expect(s.version).toBe(1);
    });
  });
});
