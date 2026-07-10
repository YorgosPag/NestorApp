/**
 * ADR-622 — smoke coverage for the 3D-capture SSoT wiring.
 *
 * The offscreen capture functions need a WebGL context, so they are not exercised
 * end-to-end here; but the four member captures now delegate to the shared
 * `detail-3d-capture-core` (camera / prism / `captureDetail3d` flow, plus the
 * relocated capture result types). This test loads every capture module + the core
 * and asserts the SSoT surface is exported and wired — catching a broken import /
 * missing re-export from the de-duplication without needing a GPU.
 */

import * as core from '../render/detail-3d-capture-core';
import { captureBeamDetail3d } from '../render/beam-detail-3d-capture';
import { captureColumnDetail3d } from '../render/column-detail-3d-capture';
import { captureFootingDetail3d } from '../render/footing-detail-3d-capture';
import { captureSlabDetail3d } from '../render/slab-detail-3d-capture';

describe('detail-3d-capture SSoT wiring (ADR-622)', () => {
  it('exports the shared capture core surface', () => {
    expect(typeof core.captureDetail3d).toBe('function');
    expect(typeof core.bboxDimSpecs).toBe('function');
    expect(typeof core.projectDims).toBe('function');
    expect(typeof core.projectMarks).toBe('function');
    expect(typeof core.buildConcretePrism).toBe('function');
    expect(typeof core.frameCamera).toBe('function');
    expect(typeof core.renderSceneToDataUrl).toBe('function');
  });

  it('exposes every member capture entry point', () => {
    expect(typeof captureBeamDetail3d).toBe('function');
    expect(typeof captureColumnDetail3d).toBe('function');
    expect(typeof captureFootingDetail3d).toBe('function');
    expect(typeof captureSlabDetail3d).toBe('function');
  });

  it('bboxDimSpecs emits three footprint dims (X / Y / H) from a unit-square footprint', () => {
    const specs = core.bboxDimSpecs(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      { x: 1000, y: 2000, h: 300 },
      0.3,
    );
    expect(specs).toHaveLength(3);
    expect(specs.map((s) => s.text)).toEqual(['1000', '2000', '300']);
  });
});
