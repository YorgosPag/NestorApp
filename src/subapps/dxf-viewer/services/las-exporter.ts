/**
 * las-exporter.ts — AutoCAD `.las` (Layer State) ASCII serializer SSoT
 * (ADR-358 §5.9 Q12 FULL Enterprise, Phase 13A).
 *
 * Serializes `LayerState[]` to AutoCAD-compatible `.las` ASCII text. One file
 * may carry multiple states (batch export) — each rendered as a
 * `LAYERSTATE`...`ENDLAYERSTATE` block. Line endings are `\r\n` (Windows
 * AutoCAD default); encoding is UTF-8.
 *
 * Group codes emitted (mirror of `las-parser.ts`):
 *   `0/1/91/301/302/90/62/420/6/370/440`. `91` flag-mask declares which
 *   per-layer properties are stored — Phase 13A always sets the full mask
 *   (visible/freeze/lock/plottable/color/linetype/lineweight/transparency)
 *   so the round-trip is lossless.
 *
 * Pre-commit ratchet `layer-state-system` allowlists this file for `.las`
 * serialization. No other module may emit `.las` content.
 */

import { encodeDxfCode370 } from '../config/lineweight-iso-catalog';
import type { LayerState, LayerStateEntry } from '../types/layer-state';
import { LAS_STATE_FLAGS } from './las-parser';

const NEWLINE = '\r\n';

/** Bit-mask 91 indicating all per-layer properties are stored in the block. */
const FULL_FLAG_MASK_91 =
  0x01 /* on/off */ |
  0x02 /* freeze */ |
  0x04 /* lock */ |
  0x08 /* plottable */ |
  0x10 /* color */ |
  0x20 /* linetype */ |
  0x40 /* lineweight */ |
  0x200 /* transparency */;

/**
 * Serialize one or more layer states to `.las` text. Order of `states`
 * is preserved.
 */
export function serializeLasContent(states: ReadonlyArray<LayerState>): string {
  return states.map(serializeStateBlock).join('') + '';
}

function serializeStateBlock(state: LayerState): string {
  const out: string[] = [];
  pushPair(out, 0, 'LAYERSTATE');
  pushPair(out, 1, state.name);
  pushPair(out, 91, String(FULL_FLAG_MASK_91));
  if (state.description) pushPair(out, 301, state.description);
  for (const entry of state.snapshot) {
    serializeEntry(out, entry);
  }
  pushPair(out, 0, 'ENDLAYERSTATE');
  return out.join('');
}

function serializeEntry(out: string[], entry: LayerStateEntry): void {
  pushPair(out, 302, entry.layerName);
  pushPair(out, 90, String(encodeStateFlags(entry)));
  pushPair(out, 62, String(entry.colorAci ?? 7));
  if (entry.colorTrueColor !== null && entry.colorTrueColor !== undefined) {
    pushPair(out, 420, String(entry.colorTrueColor & 0xffffff));
  }
  pushPair(out, 6, entry.linetype);
  pushPair(out, 370, String(encodeDxfCode370(entry.lineweight)));
  pushPair(out, 440, String(clampTransparency(entry.transparency)));
}

function encodeStateFlags(entry: LayerStateEntry): number {
  let flags = 0;
  if (entry.visible) flags |= LAS_STATE_FLAGS.VISIBLE;
  if (entry.frozen) flags |= LAS_STATE_FLAGS.FROZEN;
  if (entry.locked) flags |= LAS_STATE_FLAGS.LOCKED;
  if (entry.plottable) flags |= LAS_STATE_FLAGS.PLOTTABLE;
  return flags;
}

function clampTransparency(t: number): number {
  if (!Number.isFinite(t) || t < 0) return 0;
  if (t > 90) return 90;
  return Math.round(t);
}

function pushPair(out: string[], code: number, value: string): void {
  out.push(String(code));
  out.push(NEWLINE);
  out.push(value);
  out.push(NEWLINE);
}

/** Suggested file name for export: `{state-name}-{YYYY-MM-DD-HHmm}.las`. Pure fn. */
export function buildLasFilename(states: ReadonlyArray<LayerState>, now: Date = new Date()): string {
  const base = states.length === 1 ? sanitize(states[0].name) : 'layer-states';
  const stamp = formatStamp(now);
  return `${base}-${stamp}.las`;
}

function sanitize(value: string): string {
  const replaced = value
    .replace(/[^A-Za-z0-9_\-]+/g, '_')
    .replace(/^[_\-]+|[_\-]+$/g, '');
  return replaced.slice(0, 60) || 'layer-state';
}

function formatStamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
