/**
 * las-parser tests — ADR-358 §5.9 Q12 Phase 13A.
 *
 * Covers: group-code happy path, multi-state blocks, UTF-8/CRLF/LF tolerance,
 * unknown-code skip (forward-compat), missing required fields → errors,
 * malformed recovery, BOM tolerance, round-trip with exporter.
 */

import { describe, it, expect } from '@jest/globals';
import { LAS_STATE_FLAGS, parseLasContent } from '../las-parser';
import { serializeLasContent } from '../las-exporter';
import { createLayerState, createLayerStateEntry } from '../../types/layer-state';

const CRLF = '\r\n';
const LF = '\n';

function buildEntry(line: (code: number, value: string | number) => void): void {
  // helper used inside builders below
  void line;
}

describe('parseLasContent — happy path', () => {
  it('parses a minimal single-state file with one layer entry (CRLF)', () => {
    const content = [
      '0', 'LAYERSTATE',
      '1', 'Working',
      '91', String(0x01 | 0x02 | 0x04 | 0x08 | 0x10 | 0x20 | 0x40 | 0x200),
      '301', 'Default working state',
      '302', 'Walls',
      '90', String(
        LAS_STATE_FLAGS.VISIBLE | LAS_STATE_FLAGS.PLOTTABLE,
      ),
      '62', '5',
      '6', 'Continuous',
      '370', '25',
      '440', '0',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;

    const result = parseLasContent(content, 'u1');

    expect(result.errors).toEqual([]);
    expect(result.states).toHaveLength(1);
    const [state] = result.states;
    expect(state.name).toBe('Working');
    expect(state.description).toBe('Default working state');
    expect(state.source).toBe('las-import');
    expect(state.snapshot).toHaveLength(1);
    const [entry] = state.snapshot;
    expect(entry.layerId).toBe('');
    expect(entry.layerName).toBe('Walls');
    expect(entry.visible).toBe(true);
    expect(entry.frozen).toBe(false);
    expect(entry.locked).toBe(false);
    expect(entry.plottable).toBe(true);
    expect(entry.colorAci).toBe(5);
    expect(entry.linetype).toBe('Continuous');
    expect(entry.lineweight).toBe(0.25);
    expect(entry.transparency).toBe(0);
  });

  it('accepts LF line endings (non-Windows)', () => {
    const content = [
      '0', 'LAYERSTATE',
      '1', 'Plot',
      '91', '255',
      '302', 'L',
      '90', '15',
      '62', '7',
      '6', 'Hidden',
      '370', '50',
      '0', 'ENDLAYERSTATE',
    ].join(LF) + LF;

    const result = parseLasContent(content);

    expect(result.errors).toEqual([]);
    expect(result.states).toHaveLength(1);
    expect(result.states[0].snapshot[0].linetype).toBe('Hidden');
  });

  it('parses multiple LAYERSTATE blocks in one file', () => {
    const content = buildMulti([
      { name: 'A', layers: [{ name: 'L1', aci: 1 }] },
      { name: 'B', layers: [{ name: 'L2', aci: 2 }] },
      { name: 'C', layers: [{ name: 'L3', aci: 3 }] },
    ]);
    const result = parseLasContent(content);
    expect(result.errors).toEqual([]);
    expect(result.states.map((s) => s.name)).toEqual(['A', 'B', 'C']);
  });

  it('parses a 420 TrueColor extension (lossless round-trip)', () => {
    const content = [
      '0', 'LAYERSTATE',
      '1', 'TC',
      '91', '255',
      '302', 'L',
      '90', '15',
      '62', '7',
      '420', String(0x336699),
      '6', 'Continuous',
      '370', '25',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;
    const result = parseLasContent(content);
    expect(result.errors).toEqual([]);
    const entry = result.states[0].snapshot[0];
    expect(entry.colorTrueColor).toBe(0x336699);
    expect(entry.color).toBe('#336699');
  });

  it('decodes per-layer state flags (frozen + locked)', () => {
    const content = [
      '0', 'LAYERSTATE',
      '1', 'Locked',
      '91', '255',
      '302', 'Walls',
      '90', String(
        LAS_STATE_FLAGS.FROZEN | LAS_STATE_FLAGS.LOCKED,
      ),
      '62', '7',
      '6', 'Continuous',
      '370', '25',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;
    const result = parseLasContent(content);
    const entry = result.states[0].snapshot[0];
    expect(entry.frozen).toBe(true);
    expect(entry.locked).toBe(true);
    expect(entry.visible).toBe(false);
    expect(entry.plottable).toBe(false);
  });
});

describe('parseLasContent — tolerance', () => {
  it('silently skips unknown group codes (forward-compat)', () => {
    const content = [
      '0', 'LAYERSTATE',
      '1', 'Fwd',
      '91', '255',
      '999', 'future-extension',
      '302', 'L',
      '888', 'future-per-layer-prop',
      '90', '15',
      '62', '7',
      '6', 'Continuous',
      '370', '25',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;
    const result = parseLasContent(content);
    expect(result.errors).toEqual([]);
    expect(result.states).toHaveLength(1);
  });

  it('strips UTF-8 BOM at start', () => {
    const content = '﻿' + [
      '0', 'LAYERSTATE',
      '1', 'Boom',
      '91', '255',
      '302', 'L',
      '90', '15',
      '62', '7',
      '6', 'Continuous',
      '370', '25',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;
    const result = parseLasContent(content);
    expect(result.errors).toEqual([]);
    expect(result.states).toHaveLength(1);
  });

  it('accepts UTF-8 multibyte names (Greek)', () => {
    const content = [
      '0', 'LAYERSTATE',
      '1', 'Τοίχοι',
      '91', '255',
      '302', 'Τοίχος-1',
      '90', '15',
      '62', '7',
      '6', 'Continuous',
      '370', '25',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;
    const result = parseLasContent(content);
    expect(result.states[0].name).toBe('Τοίχοι');
    expect(result.states[0].snapshot[0].layerName).toBe('Τοίχος-1');
  });

  it('treats negative ACI as absolute', () => {
    const content = makeMinimal({ aci: '-5' });
    const result = parseLasContent(content);
    expect(result.states[0].snapshot[0].colorAci).toBe(5);
  });

  it('falls back to DEFAULT lineweight on unknown 370 code', () => {
    const content = makeMinimal({ lw: '9999' });
    const result = parseLasContent(content);
    expect(result.states[0].snapshot[0].lineweight).toBe(-3);
  });

  it('clamps transparency to 0-90', () => {
    const content = makeMinimal({ transparency: '999' });
    const result = parseLasContent(content);
    expect(result.states[0].snapshot[0].transparency).toBe(90);
  });
});

describe('parseLasContent — errors', () => {
  it('rejects a state without a name (group 1)', () => {
    const content = [
      '0', 'LAYERSTATE',
      '91', '255',
      '302', 'L',
      '90', '15',
      '62', '7',
      '6', 'Continuous',
      '370', '25',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;
    const result = parseLasContent(content);
    expect(result.states).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/missing required name/i);
  });

  it('rejects a state with zero layer entries', () => {
    const content = [
      '0', 'LAYERSTATE',
      '1', 'Empty',
      '91', '255',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;
    const result = parseLasContent(content);
    expect(result.states).toHaveLength(0);
    expect(result.errors[0].message).toMatch(/no layer entries/i);
  });

  it('recovers when ENDLAYERSTATE is missing before next LAYERSTATE', () => {
    const content = [
      '0', 'LAYERSTATE',
      '1', 'A',
      '91', '255',
      '302', 'L',
      '90', '15',
      '62', '7',
      '6', 'Continuous',
      '370', '25',
      // missing ENDLAYERSTATE
      '0', 'LAYERSTATE',
      '1', 'B',
      '91', '255',
      '302', 'L',
      '90', '15',
      '62', '7',
      '6', 'Continuous',
      '370', '25',
      '0', 'ENDLAYERSTATE',
    ].join(CRLF) + CRLF;
    const result = parseLasContent(content);
    expect(result.states).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].stateName).toBe('A');
  });

  it('returns empty result for non-LAS text', () => {
    const result = parseLasContent('this is not a las file');
    expect(result.states).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});

describe('round-trip — exporter → parser', () => {
  it('preserves all properties across export → import (single state)', () => {
    const original = createLayerState({
      name: 'RoundTrip',
      description: 'Test round-trip',
      snapshot: [
        createLayerStateEntry({
          layerId: 'lyr_a',
          layerName: 'Walls',
          visible: true,
          frozen: false,
          locked: true,
          color: '#FF0000',
          colorAci: 1,
          linetype: 'Hidden',
          lineweight: 0.7,
          transparency: 30,
          plottable: true,
        }),
        createLayerStateEntry({
          layerId: 'lyr_b',
          layerName: 'Dims',
          visible: false,
          frozen: true,
          locked: false,
          color: '#0066CC',
          colorAci: 5,
          colorTrueColor: 0x0066cc,
          linetype: 'Continuous',
          lineweight: 0.25,
          transparency: 0,
          plottable: false,
        }),
      ],
      createdByUserId: 'u1',
    });
    const text = serializeLasContent([original]);
    const parsed = parseLasContent(text, 'u2');

    expect(parsed.errors).toEqual([]);
    expect(parsed.states).toHaveLength(1);
    const re = parsed.states[0];
    expect(re.name).toBe('RoundTrip');
    expect(re.description).toBe('Test round-trip');
    expect(re.snapshot).toHaveLength(2);
    const [a, b] = re.snapshot;
    expect(a.layerName).toBe('Walls');
    expect(a.visible).toBe(true);
    expect(a.locked).toBe(true);
    expect(a.colorAci).toBe(1);
    expect(a.linetype).toBe('Hidden');
    expect(a.lineweight).toBe(0.7);
    expect(a.transparency).toBe(30);
    expect(a.plottable).toBe(true);
    expect(b.layerName).toBe('Dims');
    expect(b.frozen).toBe(true);
    expect(b.colorTrueColor).toBe(0x0066cc);
    expect(b.plottable).toBe(false);
  });

  it('preserves multi-state batch', () => {
    const states = ['A', 'B', 'C'].map((name) =>
      createLayerState({
        name,
        snapshot: [
          createLayerStateEntry({
            layerId: `lyr_${name}`,
            layerName: `Layer-${name}`,
            visible: true,
            locked: false,
            color: '#FFFFFF',
            colorAci: 7,
            linetype: 'Continuous',
            lineweight: 0.25,
          }),
        ],
        createdByUserId: 'u',
      }),
    );
    const text = serializeLasContent(states);
    const parsed = parseLasContent(text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.states.map((s) => s.name)).toEqual(['A', 'B', 'C']);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMinimal(overrides: {
  aci?: string;
  lw?: string;
  transparency?: string;
}): string {
  return [
    '0', 'LAYERSTATE',
    '1', 'M',
    '91', '255',
    '302', 'L',
    '90', '15',
    '62', overrides.aci ?? '7',
    '6', 'Continuous',
    '370', overrides.lw ?? '25',
    '440', overrides.transparency ?? '0',
    '0', 'ENDLAYERSTATE',
  ].join(CRLF) + CRLF;
}

function buildMulti(
  blocks: ReadonlyArray<{ name: string; layers: ReadonlyArray<{ name: string; aci: number }> }>,
): string {
  const out: string[] = [];
  for (const block of blocks) {
    out.push('0', 'LAYERSTATE', '1', block.name, '91', '255');
    for (const layer of block.layers) {
      out.push(
        '302', layer.name,
        '90', '15',
        '62', String(layer.aci),
        '6', 'Continuous',
        '370', '25',
      );
    }
    out.push('0', 'ENDLAYERSTATE');
  }
  return out.join(CRLF) + CRLF;
}

// Touch the unused helper to keep tsc happy with `noUnusedLocals` if enabled.
buildEntry((_c, _v) => undefined);
