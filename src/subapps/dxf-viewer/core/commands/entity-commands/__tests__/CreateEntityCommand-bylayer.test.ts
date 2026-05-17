/**
 * ADR-358 §G7 Phase 6.5 — CreateEntityCommand sentinel forward.
 *
 * Validates that `CreateEntityCommand.execute()`:
 *   1. Forwards the ByLayer sentinel via `options.colorMode` → `entity.colorMode`
 *   2. SKIPS `entity.color` flatten when caller declared ByLayer/ByBlock, even
 *      if `options.color` carries a stale hex (defensive — prevents UI bugs
 *      from leaking concrete colour into a layer-inherited entity).
 *   3. Forwards every other Phase 6.5 sentinel (colorAci, colorTrueColor,
 *      linetypeName, lineweightMm, transparency).
 *   4. Preserves the legacy concrete path when `colorMode='Concrete'` or absent.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { CreateEntityCommand } from '../CreateEntityCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';

function makeFakeSceneManager(): ISceneManager & { added: SceneEntity[] } {
  const added: SceneEntity[] = [];
  return {
    added,
    addEntity: jest.fn((e: SceneEntity) => { added.push(e); }),
    removeEntity: jest.fn(),
    updateEntity: jest.fn(),
    getEntity: jest.fn(),
    getAllEntities: jest.fn(() => added),
  } as unknown as ISceneManager & { added: SceneEntity[] };
}

const baseLine: Omit<SceneEntity, 'id'> = {
  type: 'line',
  layer: 'WALLS',
  layerId: 'lyr_test_default',
  start: { x: 0, y: 0 },
  end: { x: 10, y: 0 },
  visible: true,
} as unknown as Omit<SceneEntity, 'id'>;

describe('CreateEntityCommand — Phase 6.5 ByLayer sentinel forward', () => {
  it('colorMode=ByLayer → entity.colorMode set, entity.color NOT flattened', () => {
    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseLine, sm, {
      colorMode: 'ByLayer',
      color: '#STALE99', // Should be ignored because of ByLayer
    });
    cmd.execute();
    const created = cmd.getEntity()!;
    expect(created.colorMode).toBe('ByLayer');
    expect(created.color).toBeUndefined();
  });

  it('colorMode=ByBlock → identical contract (sentinel forward + color skip)', () => {
    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseLine, sm, {
      colorMode: 'ByBlock',
      color: '#STALE99',
    });
    cmd.execute();
    const created = cmd.getEntity()!;
    expect(created.colorMode).toBe('ByBlock');
    expect(created.color).toBeUndefined();
  });

  it('colorMode=Concrete + color → flattens entity.color (legacy concrete path)', () => {
    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseLine, sm, {
      colorMode: 'Concrete',
      color: '#ABCDEF',
    });
    cmd.execute();
    const created = cmd.getEntity()!;
    expect(created.colorMode).toBe('Concrete');
    expect(created.color).toBe('#ABCDEF');
  });

  it('colorMode absent + color present → legacy behaviour preserved (entity.color flattens)', () => {
    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseLine, sm, { color: '#112233' });
    cmd.execute();
    const created = cmd.getEntity()!;
    expect(created.color).toBe('#112233');
    expect(created.colorMode).toBeUndefined();
  });

  it('forwards every Phase 6.5 sentinel: colorAci, colorTrueColor, linetypeName, lineweightMm, transparency', () => {
    const sm = makeFakeSceneManager();
    const cmd = new CreateEntityCommand(baseLine, sm, {
      colorMode: 'ByLayer',
      colorAci: 5,
      colorTrueColor: 0x123456,
      linetypeName: 'DASHED',
      lineweightMm: -2,
      transparency: 30,
    });
    cmd.execute();
    const created = cmd.getEntity()!;
    expect(created.colorAci).toBe(5);
    expect(created.colorTrueColor).toBe(0x123456);
    expect(created.linetypeName).toBe('DASHED');
    expect(created.lineweightMm).toBe(-2);
    expect(created.transparency).toBe(30);
  });
});
