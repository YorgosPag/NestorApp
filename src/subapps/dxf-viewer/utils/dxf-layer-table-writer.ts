/**
 * DXF LAYER + LTYPE Table Writer — ADR-358 §5.x Phase 3B (G15 round-trip).
 *
 * Emits a minimal `TABLES` section (LTYPE first, then LAYER) suitable for the
 * round-trip integrity test in `__tests__/dxf-roundtrip-layers.test.ts`. This is
 * NOT a full DXF writer — production DXF export still flows through the ezdxf
 * Python microservice (see `types/dxf-export.types.ts`). The writer's purpose
 * is to guarantee that the in-app data model can survive a tokenised DXF round
 * trip at the layer-table level (lossless save → load).
 *
 * Mirror of the parsers:
 *   - LTYPE entries → `parseLinetypeTable()` recovers them.
 *   - LAYER entries → `parseLayerTable()` recovers them.
 *
 * Scaffold fields (Q15 bimCategory + Q16 vpOverrides) are emitted via Nestor
 * XDATA AppIds and resurrected by the parser, satisfying the §G15 round-trip
 * spec without unlocking active product-code use (ratchet still BLOCKs).
 */

import {
  encodeDxfCode370,
} from '../config/lineweight-iso-catalog';
import {
  isIsoBaselineLinetype,
  type LinetypeDef,
} from '../config/linetype-iso-catalog';
import type { SceneLayer } from '../types/entities';
import { clamp255 } from './scalar-math';

export interface WriteLayerTableInput {
  readonly layers: ReadonlyArray<SceneLayer>;
  /** Custom (non-ISO) linetypes referenced by any layer — emitted in LTYPE table. */
  readonly customLinetypes: ReadonlyArray<LinetypeDef>;
}

/**
 * Emit a tokenised DXF `TABLES` section containing the LTYPE table followed by
 * the LAYER table. Wrapped in `SECTION` / `ENDSEC` markers so the output can be
 * fed directly to `parseLinetypeTable()` + `parseLayerTable()`.
 *
 * Output shape: alternating code/value lines (line `2i` = code, `2i+1` = value).
 */
export function writeLayerTable(input: WriteLayerTableInput): string[] {
  const out: string[] = [];

  emit(out, '0', 'SECTION');
  emit(out, '2', 'TABLES');

  emitLayerTableBody(out, input);

  emit(out, '0', 'ENDSEC');
  return out;
}

/**
 * Emit the LTYPE + LAYER `TABLE` blocks **without** the surrounding
 * `SECTION/TABLES … ENDSEC` wrapper — so a caller that already owns a single
 * `TABLES` section (the production writer `dxf-ascii-writer`, which also emits a
 * `DIMSTYLE` table) can inline LTYPE + LAYER into that **one** section, in the
 * correct DXF table order (LTYPE → LAYER → DIMSTYLE). ADR-636 Στάδιο 2 Φ2.1.
 *
 * `writeLayerTable` above stays the wrapped SSoT (byte-identical output) for the
 * round-trip parsers/tests.
 */
export function emitLayerTableBody(out: string[], input: WriteLayerTableInput): void {
  emitLtypeTable(out, input.customLinetypes);
  emitLayerTable(out, input.layers);
}

function emitLtypeTable(out: string[], linetypes: ReadonlyArray<LinetypeDef>): void {
  emit(out, '0', 'TABLE');
  emit(out, '2', 'LTYPE');
  emit(out, '70', String(linetypes.length));

  for (const lt of linetypes) {
    if (isIsoBaselineLinetype(lt.name)) continue; // ISO baseline implicit
    emit(out, '0', 'LTYPE');
    emit(out, '2', lt.name);
    emit(out, '70', '0');
    emit(out, '3', lt.description);
    emit(out, '72', '65');
    emit(out, '73', String(lt.pattern.length));
    emit(out, '40', String(totalPatternLength(lt.pattern)));
    for (const dash of lt.pattern) {
      emit(out, '49', toDxfNumber(dash));
    }
  }

  emit(out, '0', 'ENDTAB');
}

function emitLayerTable(out: string[], layers: ReadonlyArray<SceneLayer>): void {
  emit(out, '0', 'TABLE');
  emit(out, '2', 'LAYER');
  emit(out, '70', String(layers.length));

  for (const layer of layers) {
    emit(out, '0', 'LAYER');
    emit(out, '2', layer.name);

    const flag = (layer.frozen ? 1 : 0) | (layer.locked ? 4 : 0);
    emit(out, '70', String(flag));

    const aci = layer.colorAci ?? 7;
    const signedAci = layer.visible ? Math.abs(aci) : -Math.abs(aci);
    emit(out, '62', String(signedAci));

    emit(out, '6', layer.linetype ?? 'Continuous');
    emit(out, '370', String(encodeDxfCode370(layer.lineweight ?? -3)));
    emit(out, '290', layer.plottable === false ? '0' : '1');

    if (layer.colorTrueColor != null) {
      emit(out, '420', String(layer.colorTrueColor & 0xffffff));
    }

    emitLayerXData(out, layer);
  }

  emit(out, '0', 'ENDTAB');
}

function emitLayerXData(out: string[], layer: SceneLayer): void {
  // NestorLayerId — stable enterprise-id (`lyr_<ULID>`) round-trip (ADR-358 Phase 9C v2.13).
  // Preserves layer identity across save/load — undo/redo refs, Firestore audit, xref bindings survive.
  emit(out, '1001', 'NestorLayerId');
  emit(out, '1000', `id=${layer.id}`);

  // AcCmTransparency — only emit when non-zero (DXF convention: omit = opaque).
  if ((layer.transparency ?? 0) > 0) {
    const alpha = clamp255(Math.round((1 - layer.transparency! / 90) * 255));
    const encoded = 0x02000000 | alpha; // bit 25 = fixed transparency present
    emit(out, '1001', 'AcCmTransparency');
    emit(out, '1071', String(encoded));
  }

  // NestorAec — category + tags
  if ((layer.category && layer.category !== 'general') || (layer.tags && layer.tags.length > 0)) {
    emit(out, '1001', 'NestorAec');
    if (layer.category) {
      emit(out, '1000', `category=${layer.category}`);
    }
    for (const tag of layer.tags ?? []) {
      emit(out, '1000', `tag=${tag}`);
    }
  }

  // NestorLayerMeta — description
  if (layer.description) {
    emit(out, '1001', 'NestorLayerMeta');
    emit(out, '1000', `description=${layer.description}`);
  }

  // NestorBimCategory — Q15 scaffold round-trip
  if (layer.bimCategory) {
    emit(out, '1001', 'NestorBimCategory');
    emit(out, '1000', `category=${layer.bimCategory}`);
  }

  // NestorVpOverride — Q16 scaffold round-trip (JSON-encoded)
  if (layer.vpOverrides && Object.keys(layer.vpOverrides).length > 0) {
    emit(out, '1001', 'NestorVpOverride');
    emit(out, '1000', `vpOverrides=${JSON.stringify(layer.vpOverrides)}`);
  }
}

function emit(out: string[], code: string, value: string): void {
  out.push(code);
  out.push(value);
}

function totalPatternLength(pattern: ReadonlyArray<number>): number {
  let total = 0;
  for (const v of pattern) total += Math.abs(v);
  return total;
}

function toDxfNumber(n: number): string {
  // Match parser tolerance (parseFloat). Use enough precision for round-trip
  // without introducing exponential notation for typical mm values.
  if (Number.isInteger(n)) return n.toFixed(1);
  return String(n);
}
