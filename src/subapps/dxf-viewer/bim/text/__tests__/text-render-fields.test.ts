/**
 * ADR-557 — anti-drift CONTRACT test for the TEXT/MTEXT flat render-field SSoT.
 *
 * Guards the class of bug that "keeps coming back" (Giorgio 2026-07-08): a text property is
 * written by the ribbon but a projection in the render/interaction chain forgot to carry it,
 * so the canvas never updates. Every scene→DxfText / DxfText→EntityModel projection now copies
 * the SINGLE `TEXT_RENDER_FIELDS` list; these tests fail the moment a projection drops a listed
 * field, so the drift cannot silently return.
 */

import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { TEXT_RENDER_FIELDS, pickTextRenderFields } from '../text-render-fields';
import { projectSceneTextToDxf, type TextSceneShape } from '../project-scene-text';
import { buildEntityModelFromDxf } from '../../../canvas-v2/dxf-canvas/dxf-renderer-entity-model';

/** A DxfText with EVERY render field set to a non-default, distinguishable value. */
const FULL_TEXT = {
  id: 't1',
  type: 'text',
  visible: true,
  position: { x: 3, y: 7 },
  text: 'AB',
  height: 12,
  rotation: 33,
  textStyle: { fontFamily: 'Arial', bold: true, obliqueAngle: 15, tracking: 1.3 },
  widthFactor: 1.5,
  lineSpacing: { mode: 'multiple', factor: 1.4 },
} as unknown as DxfText;

const RESOLVED = { colorHex: '#ffffff', lineWidthPx: 1, alpha: 1 };

describe('TEXT_RENDER_FIELDS — the single source of truth', () => {
  it('lists no duplicates', () => {
    expect(new Set(TEXT_RENDER_FIELDS).size).toBe(TEXT_RENDER_FIELDS.length);
  });

  it('pickTextRenderFields copies every present field and OMITS absent optionals', () => {
    const picked = pickTextRenderFields(FULL_TEXT) as Record<string, unknown>;
    for (const f of TEXT_RENDER_FIELDS) {
      expect(picked[f]).toEqual((FULL_TEXT as Record<string, unknown>)[f]);
    }
    // An absent optional (width — mutually exclusive with widthFactor here) is not written.
    expect('width' in picked).toBe(false);
    // No undefined-valued keys leak through (Firestore-safe).
    const minimal = pickTextRenderFields({ position: { x: 0, y: 0 }, text: 'x', height: 2 } as DxfText);
    expect(Object.keys(minimal).sort()).toEqual(['height', 'position', 'text']);
  });
});

describe('render projection preserves EVERY render field (contract)', () => {
  it('buildEntityModelFromDxf case text carries every TEXT_RENDER_FIELD unchanged', () => {
    const model = buildEntityModelFromDxf(FULL_TEXT, false, RESOLVED) as unknown as Record<string, unknown>;
    for (const f of TEXT_RENDER_FIELDS) {
      expect(model[f]).toEqual((FULL_TEXT as Record<string, unknown>)[f]);
    }
  });

  it('carries the MTEXT `width` frame when present', () => {
    const mtext = { ...FULL_TEXT, widthFactor: undefined, width: 200 } as unknown as DxfText;
    const model = buildEntityModelFromDxf(mtext, false, RESOLVED) as unknown as Record<string, unknown>;
    expect(model.width).toBe(200);
    expect('widthFactor' in model).toBe(false);
  });
});

describe('scene→DxfText SSoT (projectSceneTextToDxf) — no field drift vs the render converter', () => {
  it('carries node lineSpacing onto the flat DxfText (the grip/ghost gap that used to drift)', () => {
    const scene = {
      type: 'mtext',
      position: { x: 0, y: 0 },
      text: 'A\nB',
      height: 10,
      textNode: {
        lineSpacing: { mode: 'multiple', factor: 2 },
        paragraphs: [{ runs: [{ text: 'A', style: {} }] }],
      },
    } as unknown as TextSceneShape;
    const dxf = projectSceneTextToDxf(scene, 'x');
    expect(dxf.lineSpacing).toEqual({ mode: 'multiple', factor: 2 });
  });

  it('carries widthFactor for simple TEXT and rotation', () => {
    const scene = {
      type: 'text',
      position: { x: 0, y: 0 },
      text: 'A',
      height: 10,
      rotation: 45,
      widthFactor: 2,
    } as unknown as TextSceneShape;
    const dxf = projectSceneTextToDxf(scene, 'x');
    expect(dxf.widthFactor).toBe(2);
    expect(dxf.rotation).toBe(45);
  });
});
