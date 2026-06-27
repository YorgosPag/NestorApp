/**
 * ADR-537 β — buildDxfTextMesh: flat textured-plane 3D representation of a DXF text entity.
 *
 * The textured-plane geometry itself is browser-verified (jsdom has no 2D canvas backend, so
 * `getContext('2d')` is null → the builder returns null). Here we cover the guard logic that
 * does NOT need a canvas: empty / whitespace-only text yields no mesh.
 */

import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { buildDxfTextMesh } from '../dxf-text-3d';

const text = (t: string): DxfText =>
  ({ id: 't', type: 'text', visible: true, position: { x: 0, y: 0 }, height: 5, text: t }) as unknown as DxfText;

describe('buildDxfTextMesh', () => {
  it('returns null for empty text', () => {
    expect(buildDxfTextMesh(text(''), 0xffffff)).toBeNull();
  });

  it('returns null for whitespace-only text', () => {
    expect(buildDxfTextMesh(text('   '), 0xffffff)).toBeNull();
  });
});
