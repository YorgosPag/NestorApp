/**
 * las-exporter tests — ADR-358 §5.9 Q12 Phase 13A.
 *
 * Covers: structural emission (group code pairs), CRLF line endings, full
 * flag-mask 91, multi-state batch, TrueColor optional emission, filename
 * builder.
 */

import { describe, it, expect } from '@jest/globals';
import { buildLasFilename, serializeLasContent } from '../las-exporter';
import { LAS_STATE_FLAGS } from '../las-parser';
import { createLayerState, createLayerStateEntry } from '../../types/layer-state';

function makeState(name: string, partial: Partial<Parameters<typeof createLayerStateEntry>[0]> = {}) {
  return createLayerState({
    name,
    snapshot: [
      createLayerStateEntry({
        layerId: 'lyr_1',
        layerName: 'Walls',
        visible: true,
        locked: false,
        color: '#FF0000',
        colorAci: 1,
        linetype: 'Continuous',
        lineweight: 0.25,
        ...partial,
      }),
    ],
    createdByUserId: 'u',
  });
}

describe('serializeLasContent — structure', () => {
  it('emits CRLF line endings and group-code pairs', () => {
    const text = serializeLasContent([makeState('W')]);
    const lines = text.split(/\r\n/);
    expect(lines[0]).toBe('0');
    expect(lines[1]).toBe('LAYERSTATE');
    expect(lines[2]).toBe('1');
    expect(lines[3]).toBe('W');
    expect(lines[4]).toBe('91');
    // full flag-mask: on/freeze/lock/plottable/color/linetype/lineweight/transparency
    const fullMask = 0x01 | 0x02 | 0x04 | 0x08 | 0x10 | 0x20 | 0x40 | 0x200;
    expect(lines[5]).toBe(String(fullMask));
    expect(text.endsWith('ENDLAYERSTATE\r\n')).toBe(true);
  });

  it('emits 301 description only when present', () => {
    const withDesc = serializeLasContent([
      createLayerState({
        name: 'D',
        description: 'has-desc',
        snapshot: [
          createLayerStateEntry({
            layerId: 'l',
            layerName: 'L',
            visible: true,
            locked: false,
            color: '#fff',
            colorAci: 7,
          }),
        ],
        createdByUserId: 'u',
      }),
    ]);
    expect(withDesc).toContain('\r\n301\r\nhas-desc\r\n');

    const noDesc = serializeLasContent([makeState('N')]);
    expect(noDesc).not.toContain('\r\n301\r\n');
  });

  it('encodes per-layer state flags correctly', () => {
    const text = serializeLasContent([
      makeState('F', {
        visible: false,
        frozen: true,
        locked: true,
        plottable: false,
      }),
    ]);
    const expected =
      0 |
      LAS_STATE_FLAGS.FROZEN |
      LAS_STATE_FLAGS.LOCKED;
    expect(text).toContain(`\r\n90\r\n${expected}\r\n`);
  });

  it('emits 420 TrueColor when defined, omits when null', () => {
    const withTc = serializeLasContent([
      makeState('TC', { colorTrueColor: 0x336699 }),
    ]);
    expect(withTc).toContain(`\r\n420\r\n${0x336699}\r\n`);

    const noTc = serializeLasContent([makeState('NoTC')]);
    expect(noTc).not.toContain('\r\n420\r\n');
  });

  it('emits 370 lineweight × 100 for concrete values and -3 for DEFAULT', () => {
    const concrete = serializeLasContent([makeState('C', { lineweight: 0.7 })]);
    expect(concrete).toContain('\r\n370\r\n70\r\n');

    const sentinel = serializeLasContent([makeState('S', { lineweight: -3 })]);
    expect(sentinel).toContain('\r\n370\r\n-3\r\n');
  });

  it('clamps transparency to 0-90 and rounds', () => {
    const t1 = serializeLasContent([makeState('T', { transparency: 200 })]);
    expect(t1).toContain('\r\n440\r\n90\r\n');
    const t2 = serializeLasContent([makeState('T', { transparency: -50 })]);
    expect(t2).toContain('\r\n440\r\n0\r\n');
    const t3 = serializeLasContent([makeState('T', { transparency: 33.7 })]);
    expect(t3).toContain('\r\n440\r\n34\r\n');
  });

  it('emits multiple LAYERSTATE blocks in order', () => {
    const text = serializeLasContent([makeState('A'), makeState('B'), makeState('C')]);
    const blocks = text.match(/LAYERSTATE\r\n1\r\n([A-Z])/g);
    expect(blocks).toEqual(['LAYERSTATE\r\n1\r\nA', 'LAYERSTATE\r\n1\r\nB', 'LAYERSTATE\r\n1\r\nC']);
    const ends = text.match(/ENDLAYERSTATE/g);
    expect(ends).toHaveLength(3);
  });
});

describe('buildLasFilename', () => {
  it('uses sanitized single-state name when only one state', () => {
    const filename = buildLasFilename([makeState('MEP Coordination Plan')], new Date('2026-05-17T14:30:00Z'));
    expect(filename).toMatch(/^MEP_Coordination_Plan-\d{4}-\d{2}-\d{2}-\d{4}\.las$/);
  });

  it('uses "layer-states" when multiple states are exported', () => {
    const filename = buildLasFilename(
      [makeState('A'), makeState('B')],
      new Date('2026-05-17T14:30:00Z'),
    );
    expect(filename).toMatch(/^layer-states-\d{4}-\d{2}-\d{2}-\d{4}\.las$/);
  });

  it('falls back to "layer-state" when name sanitizes to empty', () => {
    const filename = buildLasFilename([makeState('@@@@')], new Date('2026-05-17T14:30:00Z'));
    expect(filename).toMatch(/^layer-state-\d{4}-\d{2}-\d{2}-\d{4}\.las$/);
  });
});
