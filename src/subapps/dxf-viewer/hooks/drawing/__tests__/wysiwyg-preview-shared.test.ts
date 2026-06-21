/**
 * ADR-398 §3.8 — WYSIWYG preview shared-glue SSoT tests.
 *
 * Covers the two helpers extracted από τα beam/wall/foundation/column preview-helpers
 * (de-dup, Giorgio SSoT audit): snapped-or-raw cursor read + WYSIWYG entity wrapper.
 */

import {
  resolveEffectivePreviewCursor,
  toWysiwygPreviewEntity,
} from '../wysiwyg-preview-shared';
import { setImmediateSnap, clearImmediateSnap } from '../../../systems/cursor/ImmediateSnapStore';
import { resolveGhostStatusColor } from '../../../bim/ghosts/ghost-status-color';

describe('resolveEffectivePreviewCursor', () => {
  afterEach(() => clearImmediateSnap());

  it('returns the snapped point when a snap is armed (= committed click point)', () => {
    setImmediateSnap({ found: true, point: { x: 42, y: 99 }, mode: 'endpoint' });
    expect(resolveEffectivePreviewCursor({ x: 0, y: 0 })).toEqual({ x: 42, y: 99 });
  });

  it('falls back to the raw cursor when no snap is armed', () => {
    clearImmediateSnap();
    expect(resolveEffectivePreviewCursor({ x: 7, y: 8 })).toEqual({ x: 7, y: 8 });
  });

  it('falls back to the raw cursor when the snap is not found', () => {
    setImmediateSnap({ found: false, point: { x: 1, y: 1 }, mode: 'none' });
    expect(resolveEffectivePreviewCursor({ x: 5, y: 6 })).toEqual({ x: 5, y: 6 });
  });
});

describe('toWysiwygPreviewEntity', () => {
  it('flags the entity as a WYSIWYG preview ghost with the given id', () => {
    const out = toWysiwygPreviewEntity({ type: 'column', params: {} }, 'preview_x') as {
      id: string; type: string; preview?: boolean; wysiwygPreview?: boolean; ghostStatusColor?: unknown;
    };
    expect(out.id).toBe('preview_x');
    expect(out.type).toBe('column');
    expect(out.preview).toBe(true);
    expect(out.wysiwygPreview).toBe(true);
    expect('ghostStatusColor' in out).toBe(false);
  });

  it('attaches ghostStatusColor only when provided (🔴 overlap)', () => {
    const red = resolveGhostStatusColor('overlap');
    const out = toWysiwygPreviewEntity({ type: 'beam' }, 'preview_y', red) as {
      ghostStatusColor?: { stroke: string };
    };
    expect(out.ghostStatusColor).toEqual(red);
  });

  it('omits ghostStatusColor when null (🟢/neutral → full WYSIWYG)', () => {
    const out = toWysiwygPreviewEntity({ type: 'wall' }, 'preview_z', null) as Record<string, unknown>;
    expect('ghostStatusColor' in out).toBe(false);
  });
});
