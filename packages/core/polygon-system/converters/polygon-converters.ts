/**
 * 🔄 POLYGON CONVERTERS
 *
 * Μετατροπείς polygon data μεταξύ διαφορετικών formats
 *
 * @module core/polygon-system/converters/polygon-converters
 */

import type {
  UniversalPolygon,
  PolygonPoint,
  PolygonExportOptions,
  PolygonImportResult,
  PolygonStyle,
  PolygonType
} from '../types';
import { DEFAULT_POLYGON_STYLES } from '../types';
import type * as GeoJSON from 'geojson';
 
type GeoProperties = Record<string, unknown>;
type ImportMetadata = NonNullable<UniversalPolygon['metadata']> & {
  type?: PolygonType;
  isClosed?: boolean;
};

const isPolygonType = (value: unknown): value is PolygonType => {
  if (typeof value !== 'string') return false;
  return value in DEFAULT_POLYGON_STYLES;
};

const isPolygonStyle = (value: unknown): value is PolygonStyle => {
  if (!value || typeof value !== 'object') return false;
  const style = value as Record<string, unknown>;
  return (
    typeof style.strokeColor === 'string' &&
    typeof style.fillColor === 'string' &&
    typeof style.strokeWidth === 'number' &&
    typeof style.fillOpacity === 'number' &&
    typeof style.strokeOpacity === 'number'
  );
};

const asStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every(item => typeof item === 'string')) return null;
  return value;
};

/**
 * Convert UniversalPolygon to GeoJSON Feature
 */
export function polygonToGeoJSON(
  polygon: UniversalPolygon,
  options: Partial<PolygonExportOptions> = {}
): GeoJSON.Feature {
  const {
    includeMetadata = true,
    precision = 6,
    properties = []
  } = options;

  // Convert points to coordinate array
  const coordinates: number[][] = polygon.points.map(point => [
    Number(point.x.toFixed(precision)),
    Number(point.y.toFixed(precision))
  ]);

  // Ensure polygon is closed for GeoJSON
  if (polygon.isClosed && coordinates.length >= 3) {
    const firstCoord = coordinates[0];
    const lastCoord = coordinates[coordinates.length - 1];

    // Check if already closed
    if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
      coordinates.push([...firstCoord]);
    }
  }

  // Build GeoJSON properties
  const geoProperties: GeoProperties = {
    id: polygon.id,
    type: polygon.type,
    isClosed: polygon.isClosed
  };

  // Add style properties
  if (polygon.style) {
    geoProperties.style = polygon.style;
  }

  // Add metadata if requested
  if (includeMetadata && polygon.metadata) {
    geoProperties.metadata = {
      ...polygon.metadata,
      area: polygon.metadata.area,
      perimeter: polygon.metadata.perimeter
    };

    // Add specific properties if requested
    if (properties.length > 0 && polygon.metadata.properties) {
      const filteredProps: GeoProperties = {};
      for (const prop of properties) {
        if (polygon.metadata.properties[prop] !== undefined) {
          filteredProps[prop] = polygon.metadata.properties[prop];
        }
      }
      geoProperties.customProperties = filteredProps;
    }
  }

  // Build GeoJSON Feature
  if (polygon.isClosed && coordinates.length >= 4) {
    // Polygon geometry
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates] // Exterior ring
      },
      properties: geoProperties
    };
  } else {
    // LineString geometry
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      },
      properties: geoProperties
    };
  }
}

/**
 * Convert GeoJSON Feature to UniversalPolygon
 */
export function geoJSONToPolygon(feature: GeoJSON.Feature): UniversalPolygon {
  const { geometry, properties } = feature;
  const safeProperties = (properties ?? {}) as GeoProperties;

  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'LineString')) {
    throw new Error('❌ Unsupported geometry type. Expected Polygon or LineString.');
  }

  // Extract coordinates
  let coordinates: number[][];
  if (geometry.type === 'Polygon') {
    coordinates = (geometry.coordinates as number[][][])[0]; // Exterior ring only
  } else {
    coordinates = geometry.coordinates as number[][];
  }

  // Convert to PolygonPoints
  const pointLabels = asStringArray(safeProperties.pointLabels);
  const points: PolygonPoint[] = coordinates.map((coord, index) => ({
    x: coord[0],
    y: coord[1],
    id: `point_${index}`,
    label: pointLabels?.[index] || `Point ${index + 1}`
  }));

  // Extract properties
  const polygonId = typeof safeProperties.id === 'string'
    ? safeProperties.id
    : `imported_${Date.now()}`;
  const polygonType = isPolygonType(safeProperties.type) ? safeProperties.type : 'simple';
  const isClosed = geometry.type === 'Polygon' || Boolean(safeProperties.isClosed);
  const style = isPolygonStyle(safeProperties.style) ? safeProperties.style : undefined;

  // Build UniversalPolygon
  const polygon: UniversalPolygon = {
    id: polygonId,
    type: polygonType,
    points,
    isClosed,
    style: style ?? {
      strokeColor: '#3b82f6',
      fillColor: '#3b82f6',
      strokeWidth: 2,
      fillOpacity: 0.2,
      strokeOpacity: 1
    },
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      ...(safeProperties.metadata as Record<string, unknown> | undefined)
    }
  };

  return polygon;
}

/**
 * Convert UniversalPolygon to SVG path
 */
export function polygonToSVG(
  polygon: UniversalPolygon,
  options: {
    viewBox?: { width: number; height: number };
    strokeWidth?: number;
    className?: string;
  } = {}
): string {
  const {
    viewBox = { width: 800, height: 600 },
    strokeWidth,
    className = 'polygon'
  } = options;

  if (polygon.points.length === 0) {
    return '';
  }

  // Build SVG path
  let pathData = `M ${polygon.points[0].x} ${polygon.points[0].y}`;

  for (let i = 1; i < polygon.points.length; i++) {
    pathData += ` L ${polygon.points[i].x} ${polygon.points[i].y}`;
  }

  if (polygon.isClosed) {
    pathData += ' Z';
  }

  // Build style attributes
  const style = polygon.style;
  const strokeWidthValue = strokeWidth || style.strokeWidth;

  const styleAttributes = [
    `stroke="${style.strokeColor}"`,
    `stroke-width="${strokeWidthValue}"`,
    `stroke-opacity="${style.strokeOpacity}"`,
    `fill="${polygon.isClosed ? style.fillColor : 'none'}"`,
    `fill-opacity="${polygon.isClosed ? style.fillOpacity : 0}"`
  ].join(' ');

  return `<path d="${pathData}" ${styleAttributes} class="${className}" data-polygon-id="${polygon.id}" />`;
}

/**
 * Convert UniversalPolygon to CSV format
 */
export function polygonToCSV(
  polygons: UniversalPolygon[],
  options: Partial<PolygonExportOptions> = {}
): string {
  const { includeMetadata = true, precision = 6 } = options;

  // CSV Headers
  const headers = ['polygon_id', 'type', 'point_index', 'x', 'y', 'is_closed'];

  if (includeMetadata) {
    headers.push('created_at', 'modified_at', 'area', 'perimeter', 'description');
  }

  const csvLines = [headers.join(',')];

  // Convert each polygon
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.points.length; i++) {
      const point = polygon.points[i];

      const row = [
        `"${polygon.id}"`,
        `"${polygon.type}"`,
        i.toString(),
        point.x.toFixed(precision),
        point.y.toFixed(precision),
        polygon.isClosed.toString()
      ];

      if (includeMetadata && polygon.metadata) {
        row.push(
          `"${polygon.metadata.createdAt.toISOString()}"`,
          `"${polygon.metadata.modifiedAt.toISOString()}"`,
          (polygon.metadata.area || 0).toFixed(precision),
          (polygon.metadata.perimeter || 0).toFixed(precision),
          `"${polygon.metadata.description || ''}"`
        );
      }

      csvLines.push(row.join(','));
    }
  }

  return csvLines.join('\n');
}

/**
 * Import polygons from CSV data
 */
export function importPolygonsFromCSV(csvData: string): PolygonImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const polygons: UniversalPolygon[] = [];
  let skipped = 0;

  try {
    const lines = csvData.trim().split('\n');

    if (lines.length < 2) {
      return {
        success: false,
        polygons: [],
        errors: ['CSV file is empty or has no data rows'],
        warnings: [],
        skipped: 0
      };
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const polygonMap = new Map<string, { points: PolygonPoint[]; metadata: ImportMetadata }>();

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const row = lines[i].split(',').map(cell => cell.replace(/"/g, '').trim());

        if (row.length < 6) {
          warnings.push(`Row ${i + 1}: Insufficient columns`);
          skipped++;
          continue;
        }

        const polygonId = row[0];
        const type = row[1];
        const pointIndex = parseInt(row[2]);
        const x = parseFloat(row[3]);
        const y = parseFloat(row[4]);
        const isClosed = row[5] === 'true';

        if (isNaN(x) || isNaN(y)) {
          warnings.push(`Row ${i + 1}: Invalid coordinates`);
          skipped++;
          continue;
        }

        // Initialize polygon if not exists
        if (!polygonMap.has(polygonId)) {
          polygonMap.set(polygonId, {
            points: [],
            metadata: {
              type: type as PolygonType,
              isClosed,
              createdAt: new Date(),
              modifiedAt: new Date()
            }
          });
        }

        // Add point
        const polygonData = polygonMap.get(polygonId)!;
        polygonData.points.push({
          x,
          y,
          id: `point_${pointIndex}`,
          label: `Point ${pointIndex + 1}`
        });

      } catch (error) {
        warnings.push(`Row ${i + 1}: Parse error`);
        skipped++;
      }
    }

    // Convert to UniversalPolygons
    for (const [polygonId, data] of Array.from(polygonMap.entries())) {
      try {
        const polygon: UniversalPolygon = {
          id: polygonId,
          type: data.metadata.type || 'simple',
          points: data.points.sort((a, b) => {
            const aIndex = parseInt(a.id!.split('_')[1]);
            const bIndex = parseInt(b.id!.split('_')[1]);
            return aIndex - bIndex;
          }),
          isClosed: data.metadata.isClosed ?? false,
          style: {
            strokeColor: '#3b82f6',
            fillColor: '#3b82f6',
            strokeWidth: 2,
            fillOpacity: 0.2,
            strokeOpacity: 1
          },
          metadata: data.metadata
        };

        polygons.push(polygon);
      } catch (error) {
        errors.push(`Failed to create polygon ${polygonId}: ${error}`);
      }
    }

  } catch (error) {
    return {
      success: false,
      polygons: [],
      errors: [`CSV parsing failed: ${error}`],
      warnings: [],
      skipped: 0
    };
  }

  return {
    success: errors.length === 0,
    polygons,
    errors,
    warnings,
    skipped
  };
}

/**
 * Export multiple polygons as GeoJSON FeatureCollection
 */
export function polygonsToGeoJSONCollection(
  polygons: UniversalPolygon[],
  options: Partial<PolygonExportOptions> = {}
): GeoJSON.FeatureCollection {
  const features = polygons.map(polygon => polygonToGeoJSON(polygon, options));

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Batch export polygons in specified format
 */
export function exportPolygons(
  polygons: UniversalPolygon[],
  options: PolygonExportOptions
): string {
  switch (options.format) {
    case 'geojson':
      return JSON.stringify(polygonsToGeoJSONCollection(polygons, options), null, 2);

    case 'csv':
      return polygonToCSV(polygons, options);

    case 'svg':
      const svgElements = polygons.map(polygon => polygonToSVG(polygon));
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">\n${svgElements.join('\n')}\n</svg>`;

    default:
      throw new Error(`❌ Unsupported export format: ${options.format}`);
  }
}
