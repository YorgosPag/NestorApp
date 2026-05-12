/**
 * ADR-344 Phase 11.E — Tests for resolveAnnotativeEntity().
 *
 * Verifies the upstream height-override path that keeps TextRenderer.ts
 * untouched (per its lockdown).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { TextEntity, MTextEntity, EntityAnnotationScale, LineEntity } from '../../../types/entities';

// Mock the frame scheduler so importing ViewportStore via the resolver does
// not pull in canvas runtime dependencies.
jest.mock('../../core/UnifiedFrameScheduler', () => ({
  markSystemsDirty: jest.fn(),
}));

import { resolveAnnotativeEntity } from '../annotative-resolver';
import { setActiveScale, setScaleList, __resetViewportStoreForTests } from '../../../systems/viewport/ViewportStore';

const SCALE_1_100: EntityAnnotationScale = { name: '1:100', paperHeight: 2.5, modelHeight: 250 };
const SCALE_1_50: EntityAnnotationScale = { name: '1:50', paperHeight: 2.5, modelHeight: 125 };

function makeAnnotativeText(overrides: Partial<TextEntity> = {}): TextEntity {
  return {
    id: 'text_1',
    type: 'text',
    position: { x: 0, y: 0 },
    text: 'Hello',
    height: 999, // baseline (should be overridden when annotative)
    isAnnotative: true,
    annotationScales: [SCALE_1_100, SCALE_1_50],
    ...overrides,
  };
}

function makeNonAnnotativeMText(): MTextEntity {
  return {
    id: 'mtext_1',
    type: 'mtext',
    position: { x: 0, y: 0 },
    text: 'World',
    width: 100,
    height: 42,
  };
}

describe('resolveAnnotativeEntity', () => {
  beforeEach(() => {
    __resetViewportStoreForTests();
    setScaleList([SCALE_1_100, SCALE_1_50]);
  });

  it('overrides height with active scale modelHeight for annotative TEXT', () => {
    setActiveScale('1:100');
    const entity = makeAnnotativeText();

    const resolved = resolveAnnotativeEntity(entity) as TextEntity;

    expect(resolved).not.toBe(entity); // shallow clone
    expect(resolved.height).toBe(250);
  });

  it('picks the matching scale when viewport active changes', () => {
    setActiveScale('1:50');
    const entity = makeAnnotativeText();

    const resolved = resolveAnnotativeEntity(entity) as TextEntity;

    expect(resolved.height).toBe(125);
  });

  it('falls back to the first scale when active name is absent', () => {
    setActiveScale('NonExistent');
    const entity = makeAnnotativeText();

    const resolved = resolveAnnotativeEntity(entity) as TextEntity;

    expect(resolved.height).toBe(SCALE_1_100.modelHeight);
  });

  it('returns the original entity untouched when isAnnotative is false', () => {
    const entity: TextEntity = makeAnnotativeText({ isAnnotative: false });

    const resolved = resolveAnnotativeEntity(entity);

    expect(resolved).toBe(entity);
  });

  it('returns the original entity untouched when annotationScales is empty', () => {
    const entity: TextEntity = makeAnnotativeText({ annotationScales: [] });

    const resolved = resolveAnnotativeEntity(entity);

    expect(resolved).toBe(entity);
  });

  it('returns non-text entities untouched', () => {
    const line: LineEntity = {
      id: 'line_1',
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    };
    expect(resolveAnnotativeEntity(line)).toBe(line);
  });

  it('returns non-annotative MTEXT untouched', () => {
    const mtext = makeNonAnnotativeMText();
    expect(resolveAnnotativeEntity(mtext)).toBe(mtext);
  });
});
