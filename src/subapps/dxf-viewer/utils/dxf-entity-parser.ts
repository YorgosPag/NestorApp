/**
 * 🏢 ENTERPRISE: DXF Entity Parser
 *
 * Parsing orchestrator for DXF entity extraction.
 * Uses centralized converters from dxf-entity-converters.ts.
 *
 * Split into 3 files for SRP compliance (ADR-065 Phase 4):
 * - dxf-parser-types.ts  — Types, interfaces, constants (EXEMPT)
 * - dxf-table-parsers.ts — DIMSTYLE & LAYER table parsers (state machines)
 * - dxf-entity-parser.ts — Main parser class (this file)
 *
 * @see dxf-entity-converters.ts - Entity conversion logic
 * @see AutoCAD DXF Reference for file format
 */

import type { AnySceneEntity } from '../types/scene';
import {
  type EntityData,
  convertEntityToScene
} from './dxf-entity-converters';

// Re-export all types for backward compatibility
export type { EntityData } from './dxf-entity-converters';
export type {
  DxfHeaderData,
  DimStyleEntry,
  DimStyleMap,
  StyleFontMap,
  LayerColorEntry,
  LayerColorMap,
} from './dxf-parser-types';
export { SUPPORTED_ENTITY_TYPES, DXF_SECTION_MARKERS, INSUNITS_TO_MM } from './dxf-parser-types';

import type { DxfHeaderData, DimStyleMap, StyleFontMap } from './dxf-parser-types';
import type { MlineStyleMap } from './dxf-mline-style-parser';
import {
  SUPPORTED_ENTITY_TYPES,
  DXF_SECTION_MARKERS,
  DXF_STRUCTURAL_SUBMARKERS,
  INSUNITS_TO_MM,
  INSUNITS_NAMES,
} from './dxf-parser-types';
// ADR-635 Φ3 follow-up — parser-level skipped-warning: genuinely-unsupported entity TYPES
// (REGION/3DSOLID/…) are dropped BEFORE the scene-builder's converter loop, so only the parser
// can record them. Reuses the ImportDiagnostics SSoT (no twin collector) — no-op when absent.
import { recordSkipped, type ImportDiagnostics } from './dxf-import-diagnostics';

// Re-export table parsers for backward compatibility
export { parseDimStyles, parseLayerColors } from './dxf-table-parsers';
import { parseDimStyles as _parseDimStyles, parseLayerColors as _parseLayerColors } from './dxf-table-parsers';
import type { LayerColorMap } from './dxf-parser-types';

/**
 * Safe (code\nvalue) line accessor — SSoT for boundary-tolerant reads. DXF is a fixed 2-line
 * stride; a truncated / odd-line-count file (or a `0` marker on the very last line) can push
 * `i+1` past the end. Returning '' instead of letting `lines[i+1].trim()` throw
 * "Cannot read properties of undefined" keeps the parser fault-tolerant (ADR-635 Φ3).
 * Shared by this parser and the BLOCKS-section parser — no twin.
 */
export function lineAt(lines: string[], i: number): string {
  const v = lines[i];
  return v === undefined ? '' : v.trim();
}

/**
 * Record a genuinely-unsupported entity TYPE that the top-level dispatch is about to drop, so a
 * Revit-style "Import Warnings" toast reports the silent data loss (ADR-635 Φ3 follow-up).
 * No-ops when no collector is threaded (mirrors the dxf-block-expander optional-collector pattern).
 * Section markers (ENDSEC/BLOCK/…) and structural sub-markers (VERTEX/SEQEND, consumed by the
 * compound parsers) are NOT user-facing entities → never warned; empty values (odd-line
 * truncation) are ignored too.
 */
function noteUnsupportedType(diagnostics: ImportDiagnostics | undefined, value: string): void {
  if (!diagnostics || !value) return;
  if ((DXF_SECTION_MARKERS as readonly string[]).includes(value)) return;
  if ((DXF_STRUCTURAL_SUBMARKERS as readonly string[]).includes(value)) return;
  recordSkipped(diagnostics, value);
}

// ============================================================================
// 🏢 ENTERPRISE: DXF ENTITY PARSER CLASS
// ============================================================================

/**
 * Static class for parsing DXF file content into scene entities.
 * Uses state machine pattern for robust parsing.
 */
export class DxfEntityParser {
  /**
   * Parse HEADER section — extracts variables that affect entity interpretation.
   *
   * @param lines - All lines from DXF file
   * @returns Parsed header data with defaults
   */
  static parseHeader(lines: string[]): DxfHeaderData {
    const header: DxfHeaderData = {
      insunits: 4,
      dimscale: 1,
      dimtxt: 2.5,
      annoScale: 1,
      measurement: 1,
      // ADR-635 Φάση C — point display: 0 = dot figure, 0 = 5%-viewport size (AutoCAD defaults).
      pdmode: 0,
      pdsize: 0
    };

    let inHeader = false;
    let currentVariable = '';

    // ADR-362 Round 20 — accumulate $EXTMIN/$EXTMAX point coords (code 10=X, 20=Y). Both are
    // point sysvars (9/$VAR then 10/x, 20/y, 30/z pairs) so they stay aligned with the fixed
    // 2-line stride. Assigned onto the header AFTER the loop, only when finite & non-sentinel.
    let extMinX = NaN, extMinY = NaN, extMaxX = NaN, extMaxY = NaN;

    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = lines[i].trim();
      const value = lines[i + 1]?.trim() || '';

      if (code === '2' && value === 'HEADER') {
        inHeader = true;
        continue;
      }

      if (code === '0' && value === 'ENDSEC' && inHeader) {
        break;
      }

      if (!inHeader) continue;

      if (code === '9') {
        currentVariable = value;
        continue;
      }

      switch (currentVariable) {
        case '$INSUNITS':
          if (code === '70') header.insunits = parseInt(value) || 4;
          break;
        case '$DIMSCALE':
          if (code === '40') header.dimscale = parseFloat(value) || 1;
          break;
        case '$DIMTXT':
          if (code === '40') header.dimtxt = parseFloat(value) || 2.5;
          break;
        case '$CANNOSCALEVALUE':
          if (code === '40') header.annoScale = parseFloat(value) || 1;
          break;
        case '$MEASUREMENT':
          if (code === '70') header.measurement = parseInt(value) || 1;
          break;
        // ADR-635 Φάση C — point display sysvars (drawing-wide glyph mode + size).
        case '$PDMODE':
          if (code === '70') header.pdmode = parseInt(value) || 0;
          break;
        case '$PDSIZE':
          if (code === '40') header.pdsize = parseFloat(value) || 0;
          break;
        // ADR-635 Φ C.4 — global linetype scale. Parsed for fidelity/round-trip; NOT
        // applied at import (see DxfHeaderData.ltscale). Only a finite positive value
        // is stored (AutoCAD rejects LTSCALE <= 0); absent/invalid stays undefined.
        case '$LTSCALE':
          if (code === '40') {
            const lts = parseFloat(value);
            if (Number.isFinite(lts) && lts > 0) header.ltscale = lts;
          }
          break;
        // ADR-362 Round 20 — stored drawing extents (unit-detection input only, never a transform).
        case '$EXTMIN':
          if (code === '10') extMinX = parseFloat(value);
          else if (code === '20') extMinY = parseFloat(value);
          break;
        case '$EXTMAX':
          if (code === '10') extMaxX = parseFloat(value);
          else if (code === '20') extMaxY = parseFloat(value);
          break;
      }
    }

    // ADR-362 Round 20 — commit the extents only when both corners are finite AND not the
    // uninitialized `±1e20` sentinel AutoCAD writes for a never-zoomed drawing (guarded by a
    // generous 1e15 magnitude ceiling — real surveys/plants never reach it). A degenerate or
    // inverted box (min > max) is also rejected so the heuristic falls back to computed bounds.
    const EXT_SENTINEL_CEILING = 1e15;
    const extFinite = [extMinX, extMinY, extMaxX, extMaxY].every(
      v => Number.isFinite(v) && Math.abs(v) < EXT_SENTINEL_CEILING,
    );
    if (extFinite && extMaxX >= extMinX && extMaxY >= extMinY) {
      header.extmin = { x: extMinX, y: extMinY };
      header.extmax = { x: extMaxX, y: extMaxY };
    }

    console.debug('📋 DXF HEADER parsed:', {
      insunits: header.insunits,
      insunitsName: DxfEntityParser.getUnitsName(header.insunits),
      dimscale: header.dimscale,
      dimtxt: header.dimtxt,
      annoScale: header.annoScale,
      measurement: header.measurement === 1 ? 'Metric' : 'English'
    });

    return header;
  }

  /**
   * Delegate to extracted table parsers (backward compatibility).
   * Prefer importing directly from dxf-table-parsers.ts for new code.
   */
  static parseDimStyles(lines: string[]): DimStyleMap {
    return _parseDimStyles(lines);
  }

  static parseLayerColors(lines: string[]): LayerColorMap {
    return _parseLayerColors(lines);
  }

  /**
   * Get unit scale factor (to mm)
   */
  static getUnitScale(insunits: number): number {
    return INSUNITS_TO_MM[insunits] ?? 1;
  }

  /**
   * Get unit name for logging
   */
  static getUnitsName(insunits: number): string {
    return INSUNITS_NAMES[insunits] || `Unknown (${insunits})`;
  }

  /**
   * Parse single entity from DXF lines.
   * Extracts entity type, layer, and all group codes until next "0" marker.
   */
  static parseEntity(lines: string[], startIndex: number): EntityData | null {
    const entityType = lineAt(lines, startIndex + 1);
    const data: Record<string, string> = {};
    // ADR-507 — ordered pairs διατηρούν επαναλαμβανόμενους κωδικούς (HATCH boundaries).
    const pairs: Array<readonly [string, string]> = [];
    let layer = '0';

    let i = startIndex + 2;
    while (i < lines.length - 1) {
      const code = lines[i].trim();
      const value = lines[i + 1].trim();

      if (code === '0') break;

      if (code === '8') {
        layer = value || '0';
      }

      data[code] = value;
      pairs.push([code, value]);
      i += 2;
    }

    return { type: entityType, layer, data, pairs };
  }

  /**
   * Locate a named DXF section (e.g. 'ENTITIES', 'BLOCKS') as a `[start,end)` line range.
   * `start` is the first line AFTER the `2/<name>` header pair; `end` is the index of the
   * closing `0/ENDSEC` marker. Returns null when the section is absent.
   */
  static findSectionRange(lines: string[], name: string): { start: number; end: number } | null {
    for (let i = 0; i + 3 < lines.length; i += 2) {
      if (lines[i].trim() === '0' && lines[i + 1].trim() === 'SECTION'
        && lines[i + 2].trim() === '2' && lines[i + 3].trim() === name) {
        const start = i + 4;
        for (let j = start; j < lines.length - 1; j += 2) {
          if (lines[j].trim() === '0' && lines[j + 1].trim() === 'ENDSEC') {
            return { start, end: j };
          }
        }
        return { start, end: lines.length };
      }
    }
    return null;
  }

  /**
   * Parse all entities from DXF lines.
   * Uses state machine to find and parse all supported entities.
   *
   * @param range - Optional `[start,end)` line window (e.g. the ENTITIES section from
   *   findSectionRange). Restricting to ENTITIES stops block-definition entities from being
   *   emitted standalone — they are instantiated only via INSERT expansion (ADR-635 Φ2).
   * @param diagnostics - Optional {@link ImportDiagnostics} collector. When present, an
   *   unsupported entity TYPE dropped here is recorded (ADR-635 Φ3 follow-up); when absent the
   *   parser behaves exactly as before (silent skip).
   */
  static parseEntities(
    lines: string[],
    range?: { start: number; end: number },
    diagnostics?: ImportDiagnostics,
  ): EntityData[] {
    const entities: EntityData[] = [];
    let i = range ? range.start : 0;
    const end = range ? range.end : lines.length - 1;

    while (i < end) {
      if (lines[i].trim() === '0') {
        const { entity, next } = DxfEntityParser.parseEntityAt(lines, i, diagnostics);
        if (entity) entities.push(entity);
        i = next;
      } else {
        i += 2;
      }
    }

    return entities;
  }

  /**
   * Dispatch a single entity at a `0` marker. Shared by parseEntities and the BLOCKS-section
   * parser so both handle POLYLINE-compound / supported / unknown identically (no twin logic).
   *
   * @param i - Index of a line whose value is `'0'` (caller guarantees)
   * @param diagnostics - Optional collector; a genuinely-unsupported entity TYPE is recorded here
   *   (ADR-635 Φ3 follow-up) instead of vanishing without a trace.
   * @returns The parsed entity (null for unsupported types / section markers) and the index to
   *   resume scanning from.
   */
  static parseEntityAt(
    lines: string[],
    i: number,
    diagnostics?: ImportDiagnostics,
  ): { entity: EntityData | null; next: number } {
    const value = lineAt(lines, i + 1);

    if (value === 'POLYLINE') {
      // Old-style POLYLINE is a COMPOUND entity (POLYLINE header + N×VERTEX + SEQEND, each
      // 0-delimited). parseEntity would stop at the first VERTEX and lose every vertex.
      return DxfEntityParser.parsePolylineGroup(lines, i);
    }
    if (SUPPORTED_ENTITY_TYPES.includes(value as typeof SUPPORTED_ENTITY_TYPES[number])) {
      return { entity: DxfEntityParser.parseEntity(lines, i), next: DxfEntityParser.findNextEntity(lines, i + 2) };
    }
    // Unknown entity type or section marker (e.g. ENDSEC/ENDBLK) — skip silently, but RECORD a
    // genuinely-unsupported entity (REGION/3DSOLID/MESH/…) so the import warns instead of losing it.
    noteUnsupportedType(diagnostics, value);
    return { entity: null, next: i + 2 };
  }

  /**
   * Find index of next entity marker.
   */
  static findNextEntity(lines: string[], startIndex: number): number {
    for (let i = startIndex; i < lines.length - 1; i += 2) {
      if (lines[i].trim() === '0') {
        return i;
      }
    }
    return lines.length;
  }

  /**
   * Parse an old-style POLYLINE compound entity (POLYLINE + N×VERTEX + SEQEND).
   *
   * AutoCAD R12/AC1009 (and any "Save As R12") writes polylines this way instead of
   * LWPOLYLINE. Each of POLYLINE / VERTEX / SEQEND is its own `0`-delimited record,
   * so the flat `parseEntity` (which stops at the next `0`) cannot capture the vertices.
   *
   * Collects ONLY the VERTEX blocks' 10/20/42 into ordered `pairs` — the POLYLINE
   * header's dummy elevation point (10/20/30 = 0,0,0) is intentionally excluded so it
   * does not become a spurious vertex. Header flags (70) and color (62) are kept in `data`.
   *
   * @param lines - All trimmed DXF lines
   * @param startIndex - Index of the `0` code line preceding the `POLYLINE` value
   * @returns The aggregated entity plus the index to resume scanning from (past SEQEND)
   */
  static parsePolylineGroup(
    lines: string[],
    startIndex: number
  ): { entity: EntityData; next: number } {
    // 1) POLYLINE header block — reuse parseEntity (reads layer + flags 70 + color 62). Its
    //    dummy elevation 10/20/30 lands in `data` but is never read as a vertex; vertices come
    //    exclusively from the VERTEX pairs aggregated below.
    const header = DxfEntityParser.parseEntity(lines, startIndex);
    const layer = header?.layer ?? '0';
    const data = header?.data ?? {};

    // 2) VERTEX blocks — aggregate their 10/20/42 into ordered pairs until SEQEND/other.
    let i = DxfEntityParser.findNextEntity(lines, startIndex + 2);
    const pairs: Array<readonly [string, string]> = [];
    while (i < lines.length - 1) {
      const code = lines[i].trim();
      const value = lines[i + 1].trim();
      if (code !== '0') { i += 2; continue; }
      if (value !== 'VERTEX') {
        // SEQEND (or a stray marker) terminates the polyline group.
        i = value === 'SEQEND' ? DxfEntityParser.findNextEntity(lines, i + 2) : i;
        break;
      }

      let vx: string | undefined;
      let vy: string | undefined;
      let vb: string | undefined;
      let j = i + 2;
      while (j < lines.length - 1) {
        const c = lines[j].trim();
        const v = lines[j + 1].trim();
        if (c === '0') break;
        if (c === '10') vx = v;
        else if (c === '20') vy = v;
        else if (c === '42') vb = v;
        j += 2;
      }
      if (vx !== undefined) pairs.push(['10', vx]);
      if (vy !== undefined) pairs.push(['20', vy]);
      if (vb !== undefined) pairs.push(['42', vb]);
      i = j;
    }

    return { entity: { type: 'POLYLINE', layer, data, pairs }, next: i };
  }

  /**
   * Convert parsed entity to scene entity.
   * Routes to centralized converters in dxf-entity-converters.ts.
   */
  static convertToSceneEntity(
    entityData: EntityData,
    index: number,
    header?: DxfHeaderData,
    dimStyles?: DimStyleMap,
    styleFonts?: StyleFontMap,
    mlineStyles?: MlineStyleMap
  ): AnySceneEntity | AnySceneEntity[] | null {
    return convertEntityToScene(entityData, index, header, dimStyles, styleFonts, mlineStyles);
  }
}
