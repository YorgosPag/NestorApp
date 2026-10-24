/**
 * @fileoverview 🖼️ **ADR-922 — DXF → PNG σε ποιότητα αγγελίας** (πραγματικό resvg, κανένα mock).
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | σταθερό πλαίσιο αντί αναλογιών σχεδίου | «αναλογίες» |
 * | χωρίς όριο αναλογίας (λωρίδα 1×40) | «όριο» |
 * | η μονοχρωμία ανοίγει κρυφά επίπεδα | «κρυφά επίπεδα» |
 * | το PNG δεν είναι PNG / λάθος διαστάσεις | «απόδοση» |
 */

import { DXF_PUBLISH_LONG_EDGE_PX, publishCanvasOf, rasterizeDxfForPublication } from '../dxf-publish-rasterizer';

const bounds = (w: number, h: number) => ({ min: { x: 0, y: 0 }, max: { x: w, y: h } });

describe('publishCanvasOf — το πλαίσιο έχει τις αναλογίες του σχεδίου', () => {
  it('οριζόντιο 3:2 · κατακόρυφο 1:2 — η μακριά πλευρά είναι πάντα το ίδιο μήκος', () => {
    expect(publishCanvasOf(bounds(30, 20))).toEqual({ width: DXF_PUBLISH_LONG_EDGE_PX, height: 2000 });
    expect(publishCanvasOf(bounds(10, 20))).toEqual({ width: 1500, height: DXF_PUBLISH_LONG_EDGE_PX });
  });

  it('όριο αναλογίας 4:1 — μια λωρίδα δεν γίνεται εικόνα 3000×75', () => {
    expect(publishCanvasOf(bounds(400, 10))).toEqual({ width: DXF_PUBLISH_LONG_EDGE_PX, height: 750 });
    expect(publishCanvasOf(bounds(10, 400))).toEqual({ width: 750, height: DXF_PUBLISH_LONG_EDGE_PX });
  });

  it('χωρίς όρια / εκφυλισμένα όρια ⇒ 4:3', () => {
    expect(publishCanvasOf(undefined)).toEqual({ width: DXF_PUBLISH_LONG_EDGE_PX, height: 2250 });
    expect(publishCanvasOf(bounds(0, 10))).toEqual({ width: DXF_PUBLISH_LONG_EDGE_PX, height: 2250 });
  });
});

describe('rasterizeDxfForPublication — απόδοση', () => {
  const scene = {
    entities: [
      { type: 'line', layer: 'WALLS', start: { x: 0, y: 0 }, end: { x: 30, y: 20 } },
      { type: 'circle', layer: 'WALLS', center: { x: 15, y: 10 }, radius: 4 },
      { type: 'line', layer: 'PRIVATE', start: { x: 0, y: 20 }, end: { x: 30, y: 0 } },
    ],
    layers: { WALLS: { color: '#ffffff' }, PRIVATE: { color: '#ff0000', visible: false } },
    bounds: bounds(30, 20),
  };

  it('PNG με τις διαστάσεις του πλαισίου', () => {
    const raster = rasterizeDxfForPublication(scene);
    expect(raster.width).toBe(DXF_PUBLISH_LONG_EDGE_PX);
    expect(raster.height).toBe(2000);
    expect(Buffer.from(raster.png).subarray(1, 4).toString('ascii')).toBe('PNG');
  });

  it('🔒 τα κρυφά επίπεδα ΜΕΝΟΥΝ κρυφά — η μονοχρωμία αφαιρεί μόνο το χρώμα', () => {
    const raster = rasterizeDxfForPublication(scene);
    expect(raster.svgStats).toEqual({ renderedEntities: 2, skippedEntities: 1 });
  });
});
