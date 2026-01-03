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
// 🏢 ENTERPRISE: DXF HEADER DATA TYPE
// ============================================================================

/**
 * 🏢 ENTERPRISE: DXF Header Data
 *
 * Parsed values from HEADER section that affect entity interpretation.
 * Critical for correct text/dimension scaling.
 */
export interface DxfHeaderData {
  /** $INSUNITS - Drawing units (0=Unitless, 1=Inches, 2=Feet, 4=mm, 5=cm, 6=m) */
  insunits: number;
  /** $DIMSCALE - Overall dimension scale factor */
  dimscale: number;
  /** $CANNOSCALEVALUE - Current annotation scale value */
  annoScale: number;
  /** $MEASUREMENT - Drawing units (0=English, 1=Metric) */
  measurement: number;
}

/**
 * 🏢 ENTERPRISE: INSUNITS to scale factor mapping
 * Converts DXF units to mm (internal base unit)
 */
const INSUNITS_TO_MM: Record<number, number> = {
  0: 1,       // Unitless - assume mm
  1: 25.4,    // Inches → mm
  2: 304.8,   // Feet → mm
  3: 1609344, // Miles → mm
  4: 1,       // Millimeters → mm (base)
  5: 10,      // Centimeters → mm
  6: 1000,    // Meters → mm
  7: 1000000, // Kilometers → mm
  8: 0.0000254, // Microinches → mm
  9: 0.0254,  // Mils → mm
  10: 914.4,  // Yards → mm
  11: 1e-7,   // Angstroms → mm
  12: 1e-6,   // Nanometers → mm
  13: 0.001,  // Microns → mm
  14: 100,    // Decimeters → mm
  15: 10000,  // Decameters → mm
  16: 100000, // Hectometers → mm
  17: 1852000, // Gigameters → mm (nautical mile)
  18: 1.496e14, // Astronomical units → mm
  19: 9.461e18, // Light years → mm
  20: 3.086e19, // Parsecs → mm
};

// ============================================================================
// 🏢 ENTERPRISE: DXF ENTITY PARSER CLASS
// ============================================================================

/**
 * 🏢 ENTERPRISE: DXF Entity Parser
 *
 * Static class for parsing DXF file content into scene entities.
 * Uses state machine pattern for robust parsing.
 *
 * Now includes HEADER parsing for proper unit/scale handling.
 */
export class DxfEntityParser {
  /**
   * 🏢 ENTERPRISE: Parse HEADER section
   *
   * Extracts critical variables that affect entity interpretation:
   * - $INSUNITS - Drawing units
   * - $DIMSCALE - Dimension scale factor
   * - $CANNOSCALEVALUE - Annotation scale
   * - $MEASUREMENT - Metric vs English
   *
   * @param lines - All lines from DXF file
   * @returns Parsed header data with defaults
   */
  static parseHeader(lines: string[]): DxfHeaderData {
    const header: DxfHeaderData = {
      insunits: 4,      // Default: mm
      dimscale: 1,      // Default: no scaling
      annoScale: 1,     // Default: 1:1
      measurement: 1    // Default: Metric
    };

    // Find HEADER section
    let inHeader = false;
    let currentVariable = '';

    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = lines[i].trim();
      const value = lines[i + 1]?.trim() || '';

      // Detect HEADER section start
      if (code === '2' && value === 'HEADER') {
        inHeader = true;
        continue;
      }

      // Detect HEADER section end
      if (code === '0' && value === 'ENDSEC' && inHeader) {
        break;
      }

      if (!inHeader) continue;

      // Variable name marker (group code 9)
      if (code === '9') {
        currentVariable = value;
        continue;
      }

      // Parse variable values based on current variable
      switch (currentVariable) {
        case '$INSUNITS':
          if (code === '70') {
            header.insunits = parseInt(value) || 4;
          }
          break;
        case '$DIMSCALE':
          if (code === '40') {
            header.dimscale = parseFloat(value) || 1;
          }
          break;
        case '$CANNOSCALEVALUE':
          if (code === '40') {
            header.annoScale = parseFloat(value) || 1;
          }
          break;
        case '$MEASUREMENT':
          if (code === '70') {
            header.measurement = parseInt(value) || 1;
          }
          break;
      }
    }

    // Log parsed header for debugging
    console.log('📋 DXF HEADER parsed:', {
      insunits: header.insunits,
      insunitsName: DxfEntityParser.getUnitsName(header.insunits),
      dimscale: header.dimscale,
      annoScale: header.annoScale,
      measurement: header.measurement === 1 ? 'Metric' : 'English'
    });

    return header;
  }

  /**
   * 🏢 ENTERPRISE: Get unit scale factor (to mm)
   */
  static getUnitScale(insunits: number): number {
    return INSUNITS_TO_MM[insunits] ?? 1;
  }

  /**
   * 🏢 ENTERPRISE: Get unit name for logging
   */
  static getUnitsName(insunits: number): string {
    const names: Record<number, string> = {
      0: 'Unitless', 1: 'Inches', 2: 'Feet', 4: 'Millimeters',
      5: 'Centimeters', 6: 'Meters', 7: 'Kilometers'
    };
    return names[insunits] || `Unknown (${insunits})`;
  }

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
