/**
 * Integration test for the SSoT DXF rasterizer.
 *
 * Feeds a tiny synthetic scene to `rasterizeDxfScene` and asserts that the
 * returned Buffer carries the PNG magic bytes `89 50 4e 47 0d 0a 1a 0a` and
 * is non-trivial (more than ~200 bytes — empty backgrounds alone are tens
 * of bytes; any rendered geometry pushes the buffer over). Proves the SVG
 * serializer + resvg WASM decode path work end-to-end on Node so we don't
 * discover runtime failures only after deploying the Cloud Function.
 */

import { rasterizeDxfScene } from '../dxf-raster-generator';

describe('rasterizeDxfScene (integration, @resvg/resvg-js)', () => {
  it('returns a PNG buffer with the correct magic header', () => {
    const result = rasterizeDxfScene({
      entities: [
        { type: 'line', layer: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
        { type: 'circle', layer: '0', center: { x: 5, y: 5 }, radius: 3 },
      ],
      bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
    }, { width: 400, height: 400 });

    expect(result.png.byteLength).toBeGreaterThan(200);
    expect(result.png[0]).toBe(0x89);
    expect(result.png[1]).toBe(0x50);
    expect(result.png[2]).toBe(0x4e);
    expect(result.png[3]).toBe(0x47);
    expect(result.png[4]).toBe(0x0d);
    expect(result.png[5]).toBe(0x0a);
    expect(result.png[6]).toBe(0x1a);
    expect(result.png[7]).toBe(0x0a);
    expect(result.svgStats.renderedEntities).toBe(2);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
});
