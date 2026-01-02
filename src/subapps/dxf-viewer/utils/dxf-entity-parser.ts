/**
 * 🏢 ENTERPRISE: DXF Entity Parser
 *
 * Parsing orchestrator for DXF entity extraction.
 * Uses centralized converters from dxf-entity-converters.ts.
 *
 * Responsibilities:
 * - Parse DXF file structure (ENTITIES section)
 * - Extract entity data (type, layer, group codes)
 * - Route to appropriate converters
 *
 * @see dxf-entity-converters.ts - Entity conversion logic
 * @see AutoCAD DXF Reference for file format
 */

import type { AnySceneEntity } from '../types/scene';
import {
  type EntityData,
  convertEntityToScene
} from './dxf-entity-converters';

// Re-export for backward compatibility
export type { EntityData } from './dxf-entity-converters';

// ============================================================================
// 🏢 ENTERPRISE: SUPPORTED ENTITY TYPES
// ============================================================================

/**
 * DXF entity types supported by the parser
 */
const SUPPORTED_ENTITY_TYPES = [
  'LINE',
  'LWPOLYLINE',
  'CIRCLE',
  'ARC',
  'TEXT',
  'INSERT',
  'SPLINE',
  'ELLIPSE',
  'MTEXT',
  'MULTILINETEXT',
  'DIMENSION',
  'HATCH',
  'SOLID'
] as const;

/**
 * DXF section markers (not entities)
 */
const DXF_SECTION_MARKERS = [
  'SECTION',
  'ENDSEC',
  'EOF',
  'TABLE',
  'ENDTAB',
  'HEADER',
  'ENDHDR',
  'CLASSES',
  'OBJECTS',
  'BLOCKS',
  'ENDBLK',
  'BLOCK'
] as const;

// ============================================================================
// 🏢 ENTERPRISE: DXF ENTITY PARSER CLASS
// ============================================================================

/**
 * 🏢 ENTERPRISE: DXF Entity Parser
 *
 * Static class for parsing DXF file content into scene entities.
 * Uses state machine pattern for robust parsing.
 */
export class DxfEntityParser {
  /**
   * 🏢 ENTERPRISE: Parse single entity from DXF lines
   *
   * Extracts entity type, layer, and all group codes until next "0" marker.
   *
   * @param lines - All lines from DXF file
   * @param startIndex - Index of "0" marker for this entity
   * @returns Parsed entity data or null
   */
  static parseEntity(lines: string[], startIndex: number): EntityData | null {
    const entityType = lines[startIndex + 1].trim();
    const data: Record<string, string> = {};
    let layer = '0';

    let i = startIndex + 2;
    while (i < lines.length - 1) {
      const code = lines[i].trim();
      const value = lines[i + 1].trim();

      // Stop at next entity marker
      if (code === '0') break;

      // Extract layer (group code 8)
      if (code === '8') {
        layer = value || '0';
      }

      // Store all group codes
      data[code] = value;

      i += 2;
    }

    return { type: entityType, layer, data };
  }

  /**
   * 🏢 ENTERPRISE: Parse all entities from DXF lines
   *
   * Uses state machine to find and parse all supported entities.
   * Skips section markers and unsupported entity types.
   *
   * @param lines - All lines from DXF file
   * @returns Array of parsed entity data
   */
  static parseEntities(lines: string[]): EntityData[] {
    const entities: EntityData[] = [];
    let i = 0;

    while (i < lines.length - 1) {
      const code = lines[i].trim();
      const value = lines[i + 1].trim();

      // Check for entity start marker
      if (code === '0' && SUPPORTED_ENTITY_TYPES.includes(value as typeof SUPPORTED_ENTITY_TYPES[number])) {
        const entity = DxfEntityParser.parseEntity(lines, i);
        if (entity) {
          entities.push(entity);
        }
        // Skip to end of this entity
        i = DxfEntityParser.findNextEntity(lines, i + 2);
      } else if (code === '0') {
        // Skip section markers silently
        if (!DXF_SECTION_MARKERS.includes(value as typeof DXF_SECTION_MARKERS[number])) {
          // Unknown entity type (logged for debugging if needed)
        }
        i += 2;
      } else {
        i += 2;
      }
    }

    return entities;
  }

  /**
   * 🏢 ENTERPRISE: Find index of next entity marker
   *
   * Scans forward from startIndex to find next "0" group code.
   *
   * @param lines - All lines from DXF file
   * @param startIndex - Index to start searching from
   * @returns Index of next "0" marker, or end of file
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
   * 🏢 ENTERPRISE: Convert parsed entity to scene entity
   *
   * Routes to centralized converters in dxf-entity-converters.ts.
   *
   * @param entityData - Parsed entity data
   * @param index - Entity index for unique ID
   * @returns Converted scene entity or null
   */
  static convertToSceneEntity(entityData: EntityData, index: number): AnySceneEntity | null {
    return convertEntityToScene(entityData, index);
  }
}
