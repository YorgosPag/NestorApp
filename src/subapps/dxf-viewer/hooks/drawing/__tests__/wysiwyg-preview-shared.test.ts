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
import type { LineEntity } from '../../../types/entities';

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
  /**
   * A real scene entity — the wrapper is typed `<T extends AnySceneEntity>` precisely
   * because a bare `{ type: 'column' }` is not a ghost, and pretending otherwise is what
   * forced the old `as unknown as` return cast (ADR-663 §4 part 5).
   */
  const lineEntity = (): LineEntity => ({
    id: 'src_line', type: 'line', layerId: 'lyr_test',
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
  });

  it('flags the entity as a WYSIWYG preview ghost with the given id', () => {
    const out = toWysiwygPreviewEntity(lineEntity(), 'preview_x');
    expect(out.id).toBe('preview_x');
    expect(out.type).toBe('line');
    expect(out.preview).toBe(true);
    expect(out.wysiwygPreview).toBe(true);
    expect('ghostStatusColor' in out).toBe(false);
  });

  it('carries the source entity through untouched apart from the ghost flags', () => {
    const out = toWysiwygPreviewEntity(lineEntity(), 'preview_x') as LineEntity;
    expect(out.start).toEqual({ x: 0, y: 0 });
    expect(out.end).toEqual({ x: 10, y: 0 });
    expect(out.layerId).toBe('lyr_test');
  });

  it('attaches ghostStatusColor only when provided (🔴 overlap)', () => {
    const red = resolveGhostStatusColor('overlap');
    const out = toWysiwygPreviewEntity(lineEntity(), 'preview_y', { ghostStatusColor: red });
    expect(out.ghostStatusColor).toEqual(red);
  });

  it('omits ghostStatusColor when null (🟢/neutral → full WYSIWYG)', () => {
    const out = toWysiwygPreviewEntity(lineEntity(), 'preview_z', { ghostStatusColor: null });
    expect('ghostStatusColor' in out).toBe(false);
  });

  it('omits every overlay the caller leaves out — no empty keys on the ghost', () => {
    const out = toWysiwygPreviewEntity(lineEntity(), 'preview_w');
    for (const key of ['faceDimensions', 'openingConflict', 'wallHud', 'hudSpecLabel']) {
      expect(key in out).toBe(false);
    }
  });

  it('attaches hudSpecLabel without needing placeholders for the overlays before it', () => {
    // The regression the options object exists to prevent: this call used to read
    // `toWysiwygPreviewEntity(e, id, null, null, null, hud, label)`.
    const out = toWysiwygPreviewEntity(lineEntity(), 'preview_v', { hudSpecLabel: 'b·h' });
    expect(out.hudSpecLabel).toBe('b·h');
    expect('wallHud' in out).toBe(false);
  });
});
