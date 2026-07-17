/**
 * ADR-507 §8 — `transform-command-factory`: the ONE seam that decides copy vs in-place.
 *
 * The transform commands no longer carry a copy flag; callers pass `copy` here and get
 * the right command back. This suite guards that routing (the thing 11 call sites now
 * depend on), NOT the commands' internals — those have their own suites.
 */
import { createRotateCommand, createScaleCommand, createMirrorCommand } from '../transform-command-factory';
import { CloneWithTransformCommand } from '../CloneWithTransformCommand';
import { RotateEntityCommand } from '../RotateEntityCommand';
import { ScaleEntityCommand } from '../ScaleEntityCommand';
import { MirrorEntityCommand } from '../MirrorEntityCommand';
import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

const line = (id: string): SceneEntity =>
  ({ id, type: 'line', layer: 'L0', visible: true, start: { x: 10, y: 10 }, end: { x: 20, y: 20 } } as unknown as SceneEntity);

const scene = () => createMockSceneManager([line('a')], { getEntityIndex: () => -1 });

const AXIS = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 100 } };
const UNIFORM = { mode: 'uniform' as const, factor: 2 };

describe('transform-command-factory — copy routing', () => {
  it('rotate: copy → CloneWithTransformCommand, in-place → RotateEntityCommand', () => {
    const sm = scene();
    const base = { entityIds: ['a'], pivot: { x: 0, y: 0 }, angleDeg: 90, sceneManager: sm };

    const copy = createRotateCommand({ ...base, copy: true });
    expect(copy).toBeInstanceOf(CloneWithTransformCommand);
    expect(copy.type).toBe('clone-rotate-entities');

    const inPlace = createRotateCommand({ ...base, copy: false });
    expect(inPlace).toBeInstanceOf(RotateEntityCommand);
    expect(inPlace.type).toBe('rotate-entities');
  });

  it('scale: copy → CloneWithTransformCommand, in-place → ScaleEntityCommand', () => {
    const sm = scene();
    const base = { entityIds: ['a'], basePoint: { x: 0, y: 0 }, params: UNIFORM, sceneManager: sm };

    expect(createScaleCommand({ ...base, copy: true })).toBeInstanceOf(CloneWithTransformCommand);
    expect(createScaleCommand({ ...base, copy: false })).toBeInstanceOf(ScaleEntityCommand);
  });

  it('mirror: copy → CloneWithTransformCommand, in-place → MirrorEntityCommand', () => {
    const sm = scene();
    const base = { entityIds: ['a'], axis: AXIS, sceneManager: sm };

    // `copy` is the former `keepOriginals` under its honest name — same polarity:
    // keep the sources → clones; drop them → mirror in place.
    expect(createMirrorCommand({ ...base, copy: true })).toBeInstanceOf(CloneWithTransformCommand);
    expect(createMirrorCommand({ ...base, copy: false })).toBeInstanceOf(MirrorEntityCommand);
  });
});

describe('transform-command-factory — behaviour of the routed command', () => {
  it('rotate copy leaves the source untouched; in-place mutates it', () => {
    const smCopy = scene();
    createRotateCommand({
      entityIds: ['a'], pivot: { x: 0, y: 0 }, angleDeg: 90, sceneManager: smCopy, copy: true,
    }).execute();
    expect(smCopy.store.size).toBe(2);
    expect(smCopy.store.get('a')).toBeDefined();

    const smInPlace = scene();
    createRotateCommand({
      entityIds: ['a'], pivot: { x: 0, y: 0 }, angleDeg: 90, sceneManager: smInPlace, copy: false,
    }).execute();
    expect(smInPlace.store.size).toBe(1);
  });

  it('mirror copy:false mirrors in place (no clone)', () => {
    const sm = scene();
    createMirrorCommand({ entityIds: ['a'], axis: AXIS, sceneManager: sm, copy: false }).execute();
    expect(sm.store.size).toBe(1);
  });
});

describe('transform-command-factory — degenerate params rejected on BOTH paths', () => {
  // Callers gate on `command.validate() !== null`; a zero-angle rotate must be
  // refused whether it would have mutated or cloned.
  it.each([true, false])('rotate 0° is invalid (copy=%s)', (copy) => {
    const sm = scene();
    const cmd = createRotateCommand({
      entityIds: ['a'], pivot: { x: 0, y: 0 }, angleDeg: 0, sceneManager: sm, copy,
    });
    expect(cmd.validate()).toBe('Rotation angle must be non-zero');
  });

  it.each([true, false])('scale ×0 is invalid (copy=%s)', (copy) => {
    const sm = scene();
    const cmd = createScaleCommand({
      entityIds: ['a'], basePoint: { x: 0, y: 0 }, params: { mode: 'uniform', factor: 0 },
      sceneManager: sm, copy,
    });
    expect(cmd.validate()).toBe('Scale factor cannot be zero');
  });

  it.each([true, false])('mirror across a degenerate axis is invalid (copy=%s)', (copy) => {
    const sm = scene();
    const cmd = createMirrorCommand({
      entityIds: ['a'], axis: { p1: { x: 5, y: 5 }, p2: { x: 5, y: 5 } }, sceneManager: sm, copy,
    });
    expect(cmd.validate()).toBe('Mirror axis points must be distinct');
  });
});
