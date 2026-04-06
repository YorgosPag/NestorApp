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
  LayerColorEntry,
  LayerColorMap,
} from './dxf-parser-types';
export { SUPPORTED_ENTITY_TYPES, DXF_SECTION_MARKERS, INSUNITS_TO_MM } from './dxf-parser-types';

import type { DxfHeaderData, DimStyleMap } from './dxf-parser-types';
import { SUPPORTED_ENTITY_TYPES, DXF_SECTION_MARKERS, INSUNITS_TO_MM, INSUNITS_NAMES } from './dxf-parser-types';

// Re-export table parsers for backward compatibility
export { parseDimStyles, parseLayerColors } from './dxf-table-parsers';
import { parseDimStyles as _parseDimStyles, parseLayerColors as _parseLayerColors } from './dxf-table-parsers';
import type { LayerColorMap } from './dxf-parser-types';

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
      measurement: 1
    };

    let inHeader = false;
    let currentVariable = '';

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
      }
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
    const entityType = lines[startIndex + 1].trim();
    const data: Record<string, string> = {};
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
      i += 2;
    }

    return { type: entityType, layer, data };
  }

  /**
   * Parse all entities from DXF lines.
   * Uses state machine to find and parse all supported entities.
   */
  static parseEntities(lines: string[]): EntityData[] {
    const entities: EntityData[] = [];
    let i = 0;

    while (i < lines.length - 1) {
      const code = lines[i].trim();
      const value = lines[i + 1].trim();

      if (code === '0' && SUPPORTED_ENTITY_TYPES.includes(value as typeof SUPPORTED_ENTITY_TYPES[number])) {
        const entity = DxfEntityParser.parseEntity(lines, i);
        if (entity) {
          entities.push(entity);
        }
        i = DxfEntityParser.findNextEntity(lines, i + 2);
      } else if (code === '0') {
        if (!DXF_SECTION_MARKERS.includes(value as typeof DXF_SECTION_MARKERS[number])) {
          // Unknown entity type — skip silently
        }
        i += 2;
      } else {
        i += 2;
      }
    }

    return entities;
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
   * Convert parsed entity to scene entity.
   * Routes to centralized converters in dxf-entity-converters.ts.
   */
  static convertToSceneEntity(
    entityData: EntityData,
    index: number,
    header?: DxfHeaderData,
    dimStyles?: DimStyleMap
  ): AnySceneEntity | AnySceneEntity[] | null {
    return convertEntityToScene(entityData, index, header, dimStyles);
  }
}
