/**
 * ADR-583 Φ2.3 — Scale-bar WYSIWYG rubber-band preview tests.
 *
 * Verifies `generatePreviewEntity('scale-bar', ...)`:
 *   - 0 clicks: unaffected regression — falls through to the shared start-dot branch
 *     (Φ2.2 wiring, `needsStartDot`).
 *   - 1 click: builds a FULL `ScaleBarEntity` via the SAME builder as commit
 *     (`buildScaleBarEntityFromLiveOptions`) + flags it `wysiwygPreview` so
 *     `PreviewCanvas`/`BimPreviewRenderer` routes it through the real `ScaleBarRenderer`
 *     (preview === commit, ADR-574) — including LIVE nice-number length snapping and the
 *     live options-store fields (unit/divisions/style/...).
 */

import { generatePreviewEntity } from '../drawing-preview-generator';
import { useScaleBarOptionsStore } from '../../../state/scale-bar-options-store';
import {
  DEFAULT_SCALE_BAR_DIVISIONS,
  DEFAULT_SCALE_BAR_STYLE,
  DEFAULT_SCALE_BAR_UNIT,
  DEFAULT_SCALE_BAR_HEIGHT_MM,
  DEFAULT_SCALE_BAR_LABEL_MM,
} from '../../../types/scale-bar';

interface PreviewScaleBar {
  readonly type: string;
  readonly id: string;
  readonly preview?: boolean;
  readonly wysiwygPreview?: boolean;
  readonly position: { readonly x: number; readonly y: number };
  readonly angleRad: number;
  readonly length: number;
  readonly unit: string;
  readonly divisions: number;
  readonly subdivisions: number;
  readonly style: string;
  readonly barHeightMm: number;
  readonly labelHeightMm: number;
  readonly layerId: string;
}

const noopCreateEntity = () => null;

describe('generatePreviewEntity — scale-bar WYSIWYG ghost (ADR-583 Φ2.3)', () => {
  afterEach(() => {
    // Reset the options store back to defaults so tests don't leak state.
    useScaleBarOptionsStore.setState({
      unit: DEFAULT_SCALE_BAR_UNIT,
      divisions: DEFAULT_SCALE_BAR_DIVISIONS,
      subdivisions: 0,
      style: DEFAULT_SCALE_BAR_STYLE,
      barHeightMm: DEFAULT_SCALE_BAR_HEIGHT_MM,
      labelHeightMm: DEFAULT_SCALE_BAR_LABEL_MM,
    });
  });

  it('0 clicks: falls through to the shared start-dot branch (regression, Φ2.2)', () => {
    const ghost = generatePreviewEntity('scale-bar', [], { x: 5, y: 5 }, false, noopCreateEntity);
    expect(ghost).not.toBeNull();
    expect((ghost as { type: string }).type).toBe('point');
    expect((ghost as { id: string }).id).toBe('preview_start');
  });

  it('1 click: builds a full WYSIWYG ScaleBarEntity ghost with LIVE nice-number length', () => {
    const p0 = { x: 0, y: 0 };
    const cursor = { x: 10000, y: 0 }; // 10000mm = 10m → exact nice number, no rounding ambiguity
    const ghost = generatePreviewEntity('scale-bar', [p0], cursor, false, noopCreateEntity) as unknown as PreviewScaleBar;

    expect(ghost).not.toBeNull();
    expect(ghost.type).toBe('scale-bar');
    expect(ghost.id).toBe('preview_scale_bar_ghost');
    // WYSIWYG placement flags — routes through BimPreviewRenderer → real ScaleBarRenderer
    // (preview-entity-paint.ts's `bimMeta.wysiwygPreview` gate), NOT the generic dispatch
    // (which has no 'scale-bar' case and would silently render nothing).
    expect(ghost.preview).toBe(true);
    expect(ghost.wysiwygPreview).toBe(true);
    // Two-formula split — the span/angle come straight from the real-distance formula.
    expect(ghost.position.x).toBeCloseTo(0);
    expect(ghost.position.y).toBeCloseTo(0);
    expect(ghost.angleRad).toBeCloseTo(0);
    expect(ghost.length).toBe(10);
    expect(ghost.unit).toBe('m');
    // Defaults passed through from the live options store.
    expect(ghost.divisions).toBe(DEFAULT_SCALE_BAR_DIVISIONS);
    expect(ghost.style).toBe(DEFAULT_SCALE_BAR_STYLE);
    expect(ghost.barHeightMm).toBe(DEFAULT_SCALE_BAR_HEIGHT_MM);
    expect(ghost.labelHeightMm).toBe(DEFAULT_SCALE_BAR_LABEL_MM);
    // `getDefaultLayerId()` may resolve to '' in a bare test env (no LayerStore
    // seeded) — assert only the type/wiring, not a specific store value.
    expect(typeof ghost.layerId).toBe('string');
  });

  it('1 click: reflects the LIVE options store (unit/divisions/style) into the ghost', () => {
    useScaleBarOptionsStore.getState().setUnit('ft');
    useScaleBarOptionsStore.getState().setDivisions(6);
    useScaleBarOptionsStore.getState().setStyle('hollow');

    const ghost = generatePreviewEntity(
      'scale-bar', [{ x: 0, y: 0 }], { x: 5000, y: 0 }, false, noopCreateEntity,
    ) as unknown as PreviewScaleBar;

    expect(ghost.unit).toBe('ft');
    expect(ghost.divisions).toBe(6);
    expect(ghost.style).toBe('hollow');
  });

  it('1 click: axis angle tracks the live cursor (rotates the ghost, not just its length)', () => {
    const ghost = generatePreviewEntity(
      'scale-bar', [{ x: 0, y: 0 }], { x: 0, y: 5000 }, false, noopCreateEntity,
    ) as unknown as PreviewScaleBar;
    expect(ghost.angleRad).toBeCloseTo(Math.PI / 2);
  });
});
