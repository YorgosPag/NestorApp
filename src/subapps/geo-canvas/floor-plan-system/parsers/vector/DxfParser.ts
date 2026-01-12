/**
 * 📐 DXF PARSER - AutoCAD Drawing Exchange Format
 *
 * Parses DXF files και converts to GeoJSON για vector rendering
 *
 * @module floor-plan-system/parsers/vector/DxfParser
 *
 * Features:
 * - Parses DXF entities (lines, polylines, arcs, circles, text)
 * - Converts to GeoJSON FeatureCollection
 * - Extracts layer information
 * - Calculates local coordinate bounds
 * - Handles entity properties (color, lineType)
 */

import DxfParserLib, {
  IDxf,
  IEntity,
  ILineEntity,
  IPolylineEntity,
  ILwpolylineEntity,
  IArcEntity,
  ICircleEntity,
  ITextEntity,
  IMtextEntity,
  IPoint
} from 'dxf-parser';

import type { ParserResult } from '../../types';
import { generateDxfThumbnail } from '../../utils/dxf-thumbnail-generator';
import { GEO_COLORS } from '../../../config/color-config';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** DXF Entity properties for GeoJSON features */
export interface DxfEntityProperties {
  layer: string;
  color?: number;
  lineType?: string;
  entityType: string;
  closed?: boolean;
  radius?: number;
  text?: string;
  textHeight?: number;
}

/**
 * DXF Parser Implementation
 */
export class DxfParser {
  /**
   * Parse DXF file
   *
   * @param file - DXF file
   * @returns Promise<ParserResult>
   */
  async parse(file: File): Promise<ParserResult> {
    try {
      console.log('📐 DXF Parser: Starting parse...', file.name);

      // STEP A: Read file as text
      const text = await file.text();
      console.log('📄 DXF file loaded:', `${text.length} characters`);

      // STEP B: Parse με dxf-parser library
      const parser = new DxfParserLib();
      const dxf = parser.parseSync(text);

      if (!dxf) {
        throw new Error('DXF parsing failed - invalid file format');
      }

      console.log('✅ DXF parsed successfully:', {
        entities: dxf.entities?.length || 0,
        blocks: dxf.blocks?.length || 0,
        hasHeader: !!dxf.header
      });

      // STEP C: Extract entities
      const entities = dxf.entities || [];
      console.log(`📊 Extracting ${entities.length} entities...`);

      // STEP D: Extract layers
      const layers = this.extractLayers(dxf);
      console.log(`📋 Found ${layers.length} layers:`, layers);

      // STEP E: Convert to GeoJSON
      const geoJSON = this.entitiesToGeoJSON(entities);
      console.log(`🗺️ Converted to GeoJSON: ${geoJSON.features.length} features`);

      // STEP F: Calculate bounds
      const bounds = this.calculateBounds(geoJSON.features);
      console.log('📏 Bounds calculated:', bounds);

      // STEP G: Generate thumbnail
      const thumbnail = await generateDxfThumbnail(geoJSON, bounds, {
        width: 400,
        height: 400,
        backgroundColor: GEO_COLORS.CAD.FLOOR_PLAN_BG,
        strokeColor: GEO_COLORS.CAD.FLOOR_PLAN_STROKE,
        strokeWidth: 0.8,  // Visible lines (0.8px on screen) - ensures small arcs are visible
        padding: 20
      });
      console.log('🖼️ Thumbnail generated');

      // STEP H: Return result
      return {
        success: true,
        format: 'DXF',
        geoJSON,
        bounds,
        layers,
        entities: entities.length,
        thumbnail
      };

    } catch (error) {
      console.error('❌ DXF Parser error:', error);

      return {
        success: false,
        format: 'DXF',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Extract layer names από DXF
   */
  private extractLayers(dxf: IDxf): string[] {
    const layerSet = new Set<string>();

    // From entities
    dxf.entities?.forEach((entity: IEntity) => {
      if (entity.layer) {
        layerSet.add(entity.layer);
      }
    });

    // From tables (if available)
    if (dxf.tables?.layer?.layers) {
      Object.keys(dxf.tables.layer.layers).forEach(layerName => {
        layerSet.add(layerName);
      });
    }

    return Array.from(layerSet).sort();
  }

  /**
   * Convert DXF entities to GeoJSON FeatureCollection
   */
  private entitiesToGeoJSON(entities: IEntity[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    const entityTypeCounts: Record<string, number> = {};

    entities.forEach((entity, index) => {
      try {
        // Count entity types
        entityTypeCounts[entity.type] = (entityTypeCounts[entity.type] || 0) + 1;

        const feature = this.entityToGeoJSON(entity);
        if (feature) {
          features.push(feature);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to convert entity ${index}:`, error);
      }
    });

    console.log('📊 DXF Entity types:', entityTypeCounts);

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Convert single entity to GeoJSON Feature
   */
  private entityToGeoJSON(entity: IEntity): GeoJSON.Feature | null {
    const properties = {
      layer: entity.layer || '0',
      color: entity.color,
      lineType: entity.lineType,
      entityType: entity.type
    };

    switch (entity.type) {
      case 'LINE':
        return this.lineToGeoJSON(entity as ILineEntity, properties);

      case 'POLYLINE':
      case 'LWPOLYLINE':
        return this.polylineToGeoJSON(entity as IPolylineEntity | ILwpolylineEntity, properties);

      case 'ARC':
        return this.arcToGeoJSON(entity as IArcEntity, properties);

      case 'CIRCLE':
        return this.circleToGeoJSON(entity as ICircleEntity, properties);

      case 'TEXT':
      case 'MTEXT':
        return this.textToGeoJSON(entity as ITextEntity | IMtextEntity, properties);

      default:
        console.warn(`⚠️ Unsupported entity type: ${entity.type}`);
        return null;
    }
  }

  /**
   * Convert LINE entity to GeoJSON LineString
   */
  private lineToGeoJSON(entity: ILineEntity, properties: DxfEntityProperties): GeoJSON.Feature {
    const start = entity.vertices[0];
    const end = entity.vertices[1];

    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [start.x, start.y],
          [end.x, end.y]
        ]
      },
      properties
    };
  }

  /**
   * Convert POLYLINE/LWPOLYLINE to GeoJSON LineString or Polygon
   */
  private polylineToGeoJSON(
    entity: IPolylineEntity | ILwpolylineEntity,
    properties: DxfEntityProperties
  ): GeoJSON.Feature {
    const coordinates = entity.vertices.map(v => [v.x, v.y]);

    // Check if closed (polygon)
    const isClosed = entity.shape || (
      coordinates.length > 2 &&
      coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
      coordinates[0][1] === coordinates[coordinates.length - 1][1]
    );

    if (isClosed && coordinates.length > 3) {
      // Polygon
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        },
        properties: { ...properties, closed: true }
      };
    } else {
      // LineString
      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates
        },
        properties
      };
    }
  }

  /**
   * Convert ARC to GeoJSON LineString (approximated)
   */
  private arcToGeoJSON(entity: IArcEntity, properties: DxfEntityProperties): GeoJSON.Feature {
    const segments = 32; // Number of segments to approximate arc
    const coordinates: number[][] = [];

    let startAngle = (entity.startAngle * Math.PI) / 180;
    let endAngle = (entity.endAngle * Math.PI) / 180;

    // Handle arcs that cross 0° (e.g., 350° to 10°)
    if (endAngle < startAngle) {
      endAngle += 2 * Math.PI;
    }

    const angleStep = (endAngle - startAngle) / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + angleStep * i;
      const x = entity.center.x + entity.radius * Math.cos(angle);
      const y = entity.center.y + entity.radius * Math.sin(angle);
      coordinates.push([x, y]);
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates
      },
      properties: { ...properties, entityType: 'ARC' }
    };
  }

  /**
   * Convert CIRCLE to GeoJSON Polygon (approximated)
   */
  private circleToGeoJSON(entity: ICircleEntity, properties: DxfEntityProperties): GeoJSON.Feature {
    const segments = 64; // Number of segments for circle
    const coordinates: number[][] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      const x = entity.center.x + entity.radius * Math.cos(angle);
      const y = entity.center.y + entity.radius * Math.sin(angle);
      coordinates.push([x, y]);
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      },
      properties: { ...properties, entityType: 'CIRCLE', radius: entity.radius }
    };
  }

  /**
   * Convert TEXT/MTEXT to GeoJSON Point με text property
   */
  private textToGeoJSON(entity: ITextEntity | IMtextEntity, properties: DxfEntityProperties): GeoJSON.Feature {
    // TEXT uses startPoint, MTEXT uses position
    const isText = entity.type === 'TEXT';
    const position = isText
      ? (entity as ITextEntity).startPoint
      : (entity as IMtextEntity).position;

    // TEXT uses textHeight, MTEXT uses height
    const textHeight = isText
      ? (entity as ITextEntity).textHeight
      : (entity as IMtextEntity).height;

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [position.x, position.y]
      },
      properties: {
        ...properties,
        text: entity.text,
        textHeight,
        entityType: entity.type
      }
    };
  }

  /**
   * Calculate bounds από GeoJSON features
   */
  private calculateBounds(features: GeoJSON.Feature[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    features.forEach(feature => {
      this.updateBoundsFromGeometry(feature.geometry, bounds => {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      });
    });

    // Handle empty case
    if (!isFinite(minX)) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Update bounds από geometry
   */
  private updateBoundsFromGeometry(
    geometry: GeoJSON.Geometry,
    callback: (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => void
  ): void {
    switch (geometry.type) {
      case 'Point':
        const [x, y] = geometry.coordinates;
        callback({ minX: x, minY: y, maxX: x, maxY: y });
        break;

      case 'LineString':
        geometry.coordinates.forEach(([x, y]) => {
          callback({ minX: x, minY: y, maxX: x, maxY: y });
        });
        break;

      case 'Polygon':
        geometry.coordinates.forEach(ring => {
          ring.forEach(([x, y]) => {
            callback({ minX: x, minY: y, maxX: x, maxY: y });
          });
        });
        break;
    }
  }
}

/**
 * Factory function
 */
export async function parseDxf(file: File): Promise<ParserResult> {
  const parser = new DxfParser();
  return parser.parse(file);
}
