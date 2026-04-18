/**
 * Unit tests for the SSoT DXF → SVG serializer.
 *
 * These tests pin the exact SVG output for representative geometry so any
 * future edit that breaks the contract (e.g. drops Y-flip, forgets layer
 * colour resolution, loses closed-polyline → <polygon>) is caught before it
 * ships. Since this serializer is mirrored into `functions/src/shared/`, a
 * test failure here is also an early warning that the two copies diverged.
 */

import { serializeDxfSceneToSvg } from '../svg-from-dxf-scene';

describe('serializeDxfSceneToSvg', () => {
  it('produces an empty SVG when there are no entities', () => {
    const { svg, renderedEntities, skippedEntities } = serializeDxfSceneToSvg({ entities: [] });
    expect(renderedEntities).toBe(0);
    expect(skippedEntities).toBe(0);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
    expect(svg).not.toContain('<line');
  });

  it('renders a single line with Y-flipped coordinates and bounds-derived scale', () => {
    const { svg, renderedEntities } = serializeDxfSceneToSvg({
      entities: [
        { type: 'line', layer: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      ],
      bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
    }, { width: 200, height: 200, paddingRatio: 0 });
    expect(renderedEntities).toBe(1);
    expect(svg).toMatch(/<line[^>]*x1="0"[^>]*y1="200"[^>]*x2="200"[^>]*y2="0"/);
  });

  it('emits <polygon> for closed polylines and <polyline> for open ones', () => {
    const { svg, renderedEntities } = serializeDxfSceneToSvg({
      entities: [
        { type: 'polyline', layer: '0', vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], closed: true },
        { type: 'polyline', layer: '0', vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false },
      ],
      bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
    });
    expect(renderedEntities).toBe(2);
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<polyline');
  });

  it('resolves layer colour from scene.layers (falls back to defaultStroke)', () => {
    const { svg } = serializeDxfSceneToSvg({
      entities: [
        { type: 'line', layer: 'A', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        { type: 'line', layer: 'B', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
      ],
      layers: { A: { color: '#ff0000', visible: true } },
      bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
    });
    expect(svg).toMatch(/<line[^>]*stroke="#ff0000"/);
    expect(svg).toMatch(/<line[^>]*stroke="#64748b"/);
  });

  it('skips entities on invisible layers', () => {
    const { renderedEntities, skippedEntities } = serializeDxfSceneToSvg({
      entities: [
        { type: 'line', layer: 'hidden', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
      ],
      layers: { hidden: { visible: false } },
      bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
    });
    expect(renderedEntities).toBe(0);
    expect(skippedEntities).toBe(1);
  });

  it('XML-escapes text content', () => {
    const { svg } = serializeDxfSceneToSvg({
      entities: [
        { type: 'text', layer: '0', position: { x: 0, y: 0 }, text: 'A & B <C>', height: 1 },
      ],
      bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
    });
    expect(svg).toContain('A &amp; B &lt;C&gt;');
    expect(svg).not.toContain('A & B <C>');
  });

  it('computes bounds when the scene omits them', () => {
    const { svg, renderedEntities } = serializeDxfSceneToSvg({
      entities: [
        { type: 'line', layer: '0', start: { x: -5, y: -5 }, end: { x: 5, y: 5 } },
      ],
    });
    expect(renderedEntities).toBe(1);
    expect(svg).toContain('<line');
  });
});
