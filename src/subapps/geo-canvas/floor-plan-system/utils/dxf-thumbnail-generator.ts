/**
 * 🖼️ DXF THUMBNAIL GENERATOR
 *
 * Generates thumbnail preview από DXF GeoJSON data
 *
 * @module floor-plan-system/utils/dxf-thumbnail-generator
 *
 * Features:
 * - Renders GeoJSON features to canvas
 * - Automatic scaling to fit thumbnail
 * - Layer-based rendering
 * - High-quality antialiasing
 */

/**
 * Thumbnail generation options
 */
export interface ThumbnailOptions {
  /** Thumbnail width (default: 400px) */
  width?: number;
  /** Thumbnail height (default: 400px) */
  height?: number;
  /** Background color (default: '#ffffff') */
  backgroundColor?: string;
  /** Entity stroke color (default: '#000000') */
  strokeColor?: string;
  /** Entity stroke width (default: 1) */
  strokeWidth?: number;
  /** Padding around drawing (default: 20px) */
  padding?: number;
  /** Image quality 0-1 (default: 0.9) */
  quality?: number;
}

/**
 * Default thumbnail options
 */
const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  width: 400,
  height: 400,
  backgroundColor: '#f8fafc', // ✅ ENTERPRISE: Light gray instead of pure white for better contrast
  strokeColor: '#1e293b',      // ✅ ENTERPRISE: Dark gray instead of black for softer contrast
  strokeWidth: 1,
  padding: 20,
  quality: 0.9
};

/**
 * Generate thumbnail από DXF GeoJSON data
 *
 * @param geoJSON - GeoJSON FeatureCollection from DXF parser
 * @param bounds - Bounding box { minX, minY, maxX, maxY }
 * @param options - Thumbnail options
 * @returns Data URL of thumbnail image
 *
 * @example
 * const thumbnail = await generateDxfThumbnail(geoJSON, bounds, {
 *   width: 400,
 *   height: 400,
 *   backgroundColor: '#f5f5f5'
 * });
 */
export async function generateDxfThumbnail(
  geoJSON: GeoJSON.FeatureCollection,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ThumbnailOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log('🖼️ Generating DXF thumbnail...', {
    features: geoJSON.features.length,
    bounds,
    size: `${opts.width}x${opts.height}`
  });

  // STEP 1: Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  // STEP 2: Fill background
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, opts.width, opts.height);

  // STEP 3: Calculate scaling
  const drawingWidth = bounds.maxX - bounds.minX;
  const drawingHeight = bounds.maxY - bounds.minY;

  if (drawingWidth === 0 || drawingHeight === 0) {
    console.warn('⚠️ Empty drawing bounds - returning blank thumbnail');
    return canvas.toDataURL('image/png', opts.quality);
  }

  // Calculate scale to fit drawing in canvas (με padding)
  const availableWidth = opts.width - opts.padding * 2;
  const availableHeight = opts.height - opts.padding * 2;

  const scaleX = availableWidth / drawingWidth;
  const scaleY = availableHeight / drawingHeight;
  const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit both dimensions

  // Calculate offset to center drawing
  const scaledWidth = drawingWidth * scale;
  const scaledHeight = drawingHeight * scale;
  const offsetX = (opts.width - scaledWidth) / 2;
  const offsetY = (opts.height - scaledHeight) / 2;

  // Calculate adaptive line width (stays constant in screen pixels)
  // Divide by scale so lines appear same thickness regardless of drawing size
  const adaptiveLineWidth = opts.strokeWidth / scale;

  console.log('📐 Thumbnail scaling:', {
    drawingSize: `${drawingWidth.toFixed(2)} x ${drawingHeight.toFixed(2)}`,
    scale: scale.toFixed(4),
    offset: `${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}`,
    lineWidth: adaptiveLineWidth.toFixed(4)
  });

  // STEP 4: Setup canvas rendering
  ctx.strokeStyle = opts.strokeColor;
  ctx.lineWidth = adaptiveLineWidth;  // Use adaptive line width
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Enable antialiasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Transform coordinate system:
  // - Translate to offset (centering)
  // - Scale to fit
  // - Flip Y axis (DXF Y increases upward, Canvas Y increases downward)
  // - Translate origin to bounds minimum
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, -scale); // Negative Y scale flips axis
  ctx.translate(-bounds.minX, -bounds.maxY); // Move origin to drawing bounds

  // STEP 5: Render GeoJSON features
  let renderedCount = 0;
  let smallArcsCount = 0;
  const geometryTypes: Record<string, number> = {};

  geoJSON.features.forEach(feature => {
    try {
      // Count geometry types
      const geomType = feature.geometry.type;
      geometryTypes[geomType] = (geometryTypes[geomType] || 0) + 1;

      // Check if this is a small ARC that needs special treatment
      const isSmallArc = feature.properties?.entityType === 'ARC' && isSmallArcEntity(feature);
      if (isSmallArc) {
        smallArcsCount++;
      }

      renderFeature(ctx, feature, scale, adaptiveLineWidth, isSmallArc);
      renderedCount++;
    } catch (error) {
      console.warn('⚠️ Failed to render feature:', error);
    }
  });

  ctx.restore();

  console.log(`✅ Rendered ${renderedCount}/${geoJSON.features.length} features to thumbnail`);
  console.log('📊 Geometry types:', geometryTypes);
  if (smallArcsCount > 0) {
    console.log(`🎯 Small ARCs detected: ${smallArcsCount} (enhanced with 3× stroke width)`);
  }

  // STEP 6: Convert to data URL
  return canvas.toDataURL('image/png', opts.quality);
}

/**
 * Check if a feature is a small ARC entity (< 10 degrees)
 * Small ARCs need enhanced visibility in thumbnails
 */
function isSmallArcEntity(feature: GeoJSON.Feature): boolean {
  if (feature.properties?.entityType !== 'ARC') {
    return false;
  }

  // For ARCs, calculate arc length by analyzing the LineString coordinates
  if (feature.geometry.type !== 'LineString') {
    return false;
  }

  const coords = feature.geometry.coordinates;
  if (coords.length < 2) {
    return false;
  }

  // Calculate arc angle from number of segments
  // We use 32 segments for full 360° arc in DxfParser
  // So if arc has < 1 segment (< 32 points for 360°), it's small
  // Small arc threshold: < 10° means < (32 * 10/360) ≈ 1 segment
  const arcSegments = coords.length - 1;
  const isSmall = arcSegments < 5; // < 5 segments ≈ < 56° (conservative threshold)

  return isSmall;
}

/**
 * Render single GeoJSON feature to canvas
 */
function renderFeature(
  ctx: CanvasRenderingContext2D,
  feature: GeoJSON.Feature,
  scale: number,
  baseLineWidth: number,
  isSmallArc: boolean = false
): void {
  const geometry = feature.geometry;

  // Enterprise: Apply enhanced stroke for small ARCs
  if (isSmallArc && geometry.type === 'LineString') {
    const enhancedLineWidth = baseLineWidth * 3; // 3× thicker for visibility
    ctx.save();
    ctx.lineWidth = enhancedLineWidth;
    renderLineString(ctx, geometry);
    ctx.restore();
    return;
  }

  switch (geometry.type) {
    case 'Point':
      renderPoint(ctx, geometry);
      break;

    case 'LineString':
      renderLineString(ctx, geometry);
      break;

    case 'Polygon':
      renderPolygon(ctx, geometry);
      break;

    default:
      console.warn(`⚠️ Unsupported geometry type: ${geometry.type}`);
  }
}

/**
 * Render Point geometry (TEXT/MTEXT entities)
 *
 * Note: Points represent text labels in DXF.
 * We don't render them as visible dots because they clutter the drawing.
 * Text rendering would require font support which is complex.
 */
function renderPoint(ctx: CanvasRenderingContext2D, geometry: GeoJSON.Point): void {
  // Skip rendering text points - they clutter technical drawings
  // In future: could render actual text if needed
  return;
}

/**
 * Render LineString geometry
 */
function renderLineString(ctx: CanvasRenderingContext2D, geometry: GeoJSON.LineString): void {
  if (geometry.coordinates.length < 2) {
    return;
  }

  ctx.beginPath();

  // Move to first point
  const [startX, startY] = geometry.coordinates[0];
  ctx.moveTo(startX, startY);

  // Draw lines to subsequent points
  for (let i = 1; i < geometry.coordinates.length; i++) {
    const [x, y] = geometry.coordinates[i];
    ctx.lineTo(x, y);
  }

  ctx.stroke();
}

/**
 * Render Polygon geometry
 */
function renderPolygon(ctx: CanvasRenderingContext2D, geometry: GeoJSON.Polygon): void {
  if (geometry.coordinates.length === 0 || geometry.coordinates[0].length < 3) {
    return;
  }

  ctx.beginPath();

  // Render exterior ring
  const exteriorRing = geometry.coordinates[0];
  const [startX, startY] = exteriorRing[0];
  ctx.moveTo(startX, startY);

  for (let i = 1; i < exteriorRing.length; i++) {
    const [x, y] = exteriorRing[i];
    ctx.lineTo(x, y);
  }

  // Close path
  ctx.closePath();

  // Render holes (interior rings)
  for (let ringIndex = 1; ringIndex < geometry.coordinates.length; ringIndex++) {
    const hole = geometry.coordinates[ringIndex];
    const [holeStartX, holeStartY] = hole[0];
    ctx.moveTo(holeStartX, holeStartY);

    for (let i = 1; i < hole.length; i++) {
      const [x, y] = hole[i];
      ctx.lineTo(x, y);
    }

    ctx.closePath();
  }

  // Stroke polygon (don't fill - keeps it clean for technical drawings)
  ctx.stroke();
}

/**
 * Generate thumbnail με custom layer colors
 *
 * @param geoJSON - GeoJSON FeatureCollection
 * @param bounds - Bounding box
 * @param layerColors - Map of layer name to color
 * @param options - Thumbnail options
 */
export async function generateDxfThumbnailWithLayers(
  geoJSON: GeoJSON.FeatureCollection,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  layerColors: Map<string, string>,
  options: ThumbnailOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log('🎨 Generating DXF thumbnail with layer colors...', {
    features: geoJSON.features.length,
    layers: layerColors.size
  });

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  // Fill background
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, opts.width, opts.height);

  // Calculate scaling (same as above)
  const drawingWidth = bounds.maxX - bounds.minX;
  const drawingHeight = bounds.maxY - bounds.minY;

  if (drawingWidth === 0 || drawingHeight === 0) {
    return canvas.toDataURL('image/png', opts.quality);
  }

  const availableWidth = opts.width - opts.padding * 2;
  const availableHeight = opts.height - opts.padding * 2;
  const scaleX = availableWidth / drawingWidth;
  const scaleY = availableHeight / drawingHeight;
  const scale = Math.min(scaleX, scaleY);

  const scaledWidth = drawingWidth * scale;
  const scaledHeight = drawingHeight * scale;
  const offsetX = (opts.width - scaledWidth) / 2;
  const offsetY = (opts.height - scaledHeight) / 2;

  // Calculate adaptive line width
  const adaptiveLineWidth = opts.strokeWidth / scale;

  // Setup canvas
  ctx.lineWidth = adaptiveLineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, -scale);
  ctx.translate(-bounds.minX, -bounds.maxY);

  // Render features με layer colors
  let smallArcsCount = 0;
  geoJSON.features.forEach(feature => {
    const layerName = feature.properties?.layer || '0';
    const color = layerColors.get(layerName) || opts.strokeColor;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    try {
      const isSmallArc = feature.properties?.entityType === 'ARC' && isSmallArcEntity(feature);
      if (isSmallArc) {
        smallArcsCount++;
      }
      renderFeature(ctx, feature, scale, adaptiveLineWidth, isSmallArc);
    } catch (error) {
      console.warn('⚠️ Failed to render feature:', error);
    }
  });

  if (smallArcsCount > 0) {
    console.log(`🎯 Small ARCs detected: ${smallArcsCount} (enhanced with 3× stroke width)`);
  }

  ctx.restore();

  return canvas.toDataURL('image/png', opts.quality);
}
