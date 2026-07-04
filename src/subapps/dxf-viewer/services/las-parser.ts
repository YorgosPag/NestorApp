/**
 * las-parser.ts — AutoCAD `.las` (Layer State) ASCII parser SSoT
 * (ADR-358 §5.9 Q12 FULL Enterprise, Phase 13A).
 *
 * Parses AutoCAD-compatible `.las` ASCII text into `LayerState[]`. Format is
 * DXF-group-code pairs (`code\nvalue\n`) framed by `LAYERSTATE` /
 * `ENDLAYERSTATE` blocks. Multiple states per file are supported (batch
 * export round-trip).
 *
 * Group codes consumed (industry-aligned):
 *   - `0`   record marker — `LAYERSTATE` / `ENDLAYERSTATE`
 *   - `1`   state name (required)
 *   - `91`  flag-mask uint32 (required; bits indicate which props are stored)
 *   - `301` description (optional)
 *   - `302` layer name (per-entry start marker)
 *   - `90`  per-entry state flags (bit0=visible, bit1=frozen, bit2=locked, bit3=plottable)
 *   - `62`  ACI color 1-255
 *   - `420` true-color 0xRRGGBB (optional extension, preserved for lossless round-trip)
 *   - `6`   linetype name (default `Continuous`)
 *   - `370` lineweight × 100 (mm; special sentinels -3/-2/-1 supported)
 *   - `440` transparency 0-90 (extension)
 *
 * Tolerance: unknown group codes inside an entry are silently skipped
 * (forward-compat with future AutoCAD versions). Empty lines + BOM tolerated.
 * Line endings `\r\n` (Windows AutoCAD default) and `\n` both accepted.
 *
 * `layerId` is intentionally empty on parsed entries — `.las` is a
 * cross-project format that carries `layerName` only. `applyLayerSnapshotEntries`
 * (LayerStore) falls back to case-insensitive name match for empty ids.
 *
 * Pre-commit ratchet `layer-state-system` allowlists this file for `.las`
 * parsing. No other module may parse `.las` content.
 */

import { getAciColor } from '../settings/standards/aci';
// 🏢 Color-Conversion SSoT (ADR-573): int(0xRRGGBB)→hex via canonical `dxf-true-color`.
import { trueColorToHex } from '../utils/dxf-true-color';
import {
  createLayerState,
  createLayerStateEntry,
  type LayerState,
  type LayerStateEntry,
} from '../types/layer-state';
import type { LineweightMm } from '../types/entities';
import { parseDxfCode370 } from '../config/lineweight-iso-catalog';

export interface LasParseError {
  readonly line: number;
  readonly message: string;
  readonly stateName?: string;
}

export interface LasParseResult {
  readonly states: ReadonlyArray<LayerState>;
  readonly errors: ReadonlyArray<LasParseError>;
}

const RECORD_LAYERSTATE = 'LAYERSTATE';
const RECORD_END = 'ENDLAYERSTATE';

/** Bit positions inside group 90 per-layer state flags. */
const FLAG_VISIBLE = 1 << 0;
const FLAG_FROZEN = 1 << 1;
const FLAG_LOCKED = 1 << 2;
const FLAG_PLOTTABLE = 1 << 3;

/**
 * Parse `.las` ASCII text into `LayerState[]`. Resilient to malformed input —
 * recoverable per-state errors are collected and parsing continues at the
 * next `LAYERSTATE` boundary.
 */
export function parseLasContent(
  content: string,
  createdByUserId: string = 'anonymous',
): LasParseResult {
  const pairs = tokenizeGroupCodes(content);
  const states: LayerState[] = [];
  const errors: LasParseError[] = [];

  let i = 0;
  while (i < pairs.length) {
    const pair = pairs[i];
    if (pair.code === 0 && pair.value === RECORD_LAYERSTATE) {
      const result = parseStateBlock(pairs, i, createdByUserId);
      if (result.state) states.push(result.state);
      errors.push(...result.errors);
      i = result.nextIndex;
      continue;
    }
    i++;
  }

  return { states, errors };
}

interface GroupPair {
  readonly code: number;
  readonly value: string;
  readonly line: number;
}

function tokenizeGroupCodes(content: string): ReadonlyArray<GroupPair> {
  const stripped = content.replace(/^﻿/, '');
  const lines = stripped.split(/\r?\n/);
  const pairs: GroupPair[] = [];
  for (let idx = 0; idx < lines.length - 1; idx++) {
    const codeLine = lines[idx].trim();
    if (codeLine === '') continue;
    const code = Number(codeLine);
    if (!Number.isInteger(code)) continue;
    const value = (lines[idx + 1] ?? '').replace(/\r$/, '');
    pairs.push({ code, value, line: idx + 1 });
    idx++;
  }
  return pairs;
}

interface StateBlockResult {
  readonly state: LayerState | null;
  readonly errors: ReadonlyArray<LasParseError>;
  readonly nextIndex: number;
}

function parseStateBlock(
  pairs: ReadonlyArray<GroupPair>,
  start: number,
  createdByUserId: string,
): StateBlockResult {
  const errors: LasParseError[] = [];
  let name = '';
  let description: string | undefined;
  let flagMask = 0;
  const entries: LayerStateEntry[] = [];
  let pendingEntry: MutableEntry | null = null;

  let i = start + 1;
  while (i < pairs.length) {
    const pair = pairs[i];
    if (pair.code === 0 && pair.value === RECORD_END) {
      if (pendingEntry) {
        entries.push(finalizeEntry(pendingEntry));
        pendingEntry = null;
      }
      i++;
      break;
    }
    if (pair.code === 0 && pair.value === RECORD_LAYERSTATE) {
      // Missing ENDLAYERSTATE — recover at next block.
      if (pendingEntry) {
        entries.push(finalizeEntry(pendingEntry));
        pendingEntry = null;
      }
      errors.push({ line: pair.line, message: 'Missing ENDLAYERSTATE before next state', stateName: name });
      break;
    }

    switch (pair.code) {
      case 1:
        name = pair.value;
        break;
      case 91: {
        const mask = Number.parseInt(pair.value, 10);
        if (Number.isFinite(mask)) flagMask = mask;
        break;
      }
      case 301:
        description = pair.value;
        break;
      case 302:
        if (pendingEntry) entries.push(finalizeEntry(pendingEntry));
        pendingEntry = { layerName: pair.value };
        break;
      case 90:
        if (pendingEntry) {
          const flags = Number.parseInt(pair.value, 10);
          if (Number.isFinite(flags)) pendingEntry.stateFlags = flags;
        }
        break;
      case 62:
        if (pendingEntry) {
          const aci = Number.parseInt(pair.value, 10);
          if (Number.isFinite(aci)) pendingEntry.colorAci = Math.abs(aci);
        }
        break;
      case 420:
        if (pendingEntry) {
          const tc = Number.parseInt(pair.value, 10);
          if (Number.isFinite(tc)) pendingEntry.colorTrueColor = tc & 0xffffff;
        }
        break;
      case 6:
        if (pendingEntry) pendingEntry.linetype = pair.value;
        break;
      case 370:
        if (pendingEntry) {
          const lw = parseDxfCode370(Number.parseInt(pair.value, 10));
          pendingEntry.lineweight = lw;
        }
        break;
      case 440:
        if (pendingEntry) {
          const t = Number.parseInt(pair.value, 10);
          if (Number.isFinite(t)) pendingEntry.transparency = clampTransparency(t);
        }
        break;
      default:
        // Forward-compat: unknown codes silently ignored.
        break;
    }
    i++;
  }

  if (!name) {
    errors.push({ line: pairs[start].line, message: 'LAYERSTATE block missing required name (group 1)' });
    return { state: null, errors, nextIndex: i };
  }
  if (entries.length === 0) {
    errors.push({ line: pairs[start].line, message: 'LAYERSTATE block has no layer entries', stateName: name });
    return { state: null, errors, nextIndex: i };
  }

  const state = createLayerState({
    name,
    description,
    snapshot: entries,
    source: 'las-import',
    createdByUserId,
  });
  return { state, errors, nextIndex: i };
}

interface MutableEntry {
  layerName: string;
  stateFlags?: number;
  colorAci?: number;
  colorTrueColor?: number;
  linetype?: string;
  lineweight?: LineweightMm;
  transparency?: number;
}

function finalizeEntry(entry: MutableEntry): LayerStateEntry {
  const flags = entry.stateFlags ?? FLAG_VISIBLE | FLAG_PLOTTABLE;
  const aci = entry.colorAci ?? 7;
  const hex = entry.colorTrueColor !== undefined
    ? trueColorToHex(entry.colorTrueColor)
    : getAciColor(aci);
  return createLayerStateEntry({
    layerId: '',
    layerName: entry.layerName,
    visible: (flags & FLAG_VISIBLE) !== 0,
    frozen: (flags & FLAG_FROZEN) !== 0,
    locked: (flags & FLAG_LOCKED) !== 0,
    color: hex,
    colorAci: aci,
    colorTrueColor: entry.colorTrueColor ?? null,
    linetype: entry.linetype ?? 'Continuous',
    lineweight: entry.lineweight ?? -3,
    transparency: entry.transparency ?? 0,
    plottable: (flags & FLAG_PLOTTABLE) !== 0,
  });
}

function clampTransparency(t: number): number {
  if (t < 0) return 0;
  if (t > 90) return 90;
  return t;
}

/** Public flag-bit helpers for the exporter + tests. */
export const LAS_STATE_FLAGS = Object.freeze({
  VISIBLE: FLAG_VISIBLE,
  FROZEN: FLAG_FROZEN,
  LOCKED: FLAG_LOCKED,
  PLOTTABLE: FLAG_PLOTTABLE,
});
