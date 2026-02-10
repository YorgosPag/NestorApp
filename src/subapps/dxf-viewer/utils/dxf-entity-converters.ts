/**
 * 🏢 ENTERPRISE: DXF Entity Converters
 *
 * Centralized converters for DXF entities to scene entities.
 * Uses helpers from dxf-converter-helpers.ts.
 *
 * Supports:
 * - LINE, LWPOLYLINE (geometry)
 * - CIRCLE, ARC, ELLIPSE (curves)
 * - TEXT, MTEXT (annotations)
 * - SPLINE, DIMENSION (complex)
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ 🏢 ENTERPRISE DIMSCALE SUPPORT (2026-01-03)                              ║
 * ║                                                                          ║
 * ║ Υποστηρίζει σωστό scaling για DIMENSION text heights:                   ║
 * ║ - DIMSCALE ($DIMSCALE από HEADER) - Overall dimension scale factor      ║
 * ║ - INSUNITS ($INSUNITS) - Drawing units (mm, m, inches, etc.)            ║
 * ║                                                                          ║
 * ║ Formula: effectiveHeight = DIMTXT / DIMSCALE                            ║
 * ║ Αυτό εξασφαλίζει consistent text sizes ανεξάρτητα από το DXF source.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * @see dxf-converter-helpers.ts - Types and helper functions
 * @see dxf-entity-parser.ts - Parsing orchestrator
 * @see AutoCAD DXF Reference for entity codes
 */

import type { AnySceneEntity } from '../types/scene';
import type { DxfHeaderData, DimStyleMap } from './dxf-entity-parser';
// 🏢 ADR-065: Centralized Distance Calculation
// 🏢 ADR-078: Centralized Angle Calculation
// 🏢 ADR-163: Centralized Vector Magnitude (replaces inline Math.sqrt patterns)
import { calculateDistance, calculateAngle, vectorMagnitude } from '../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { radToDeg } from '../rendering/entities/shared/geometry-utils';

// 🏢 ENTERPRISE: Import centralized helpers
import {
  type EntityData,
  parseVerticesFromData,
  decodeGreekText,
  mapHorizontalAlignment,
  mapMTextAlignment,
  extractEntityColor
} from './dxf-converter-helpers';

// Re-export types for backward compatibility
export type { EntityData, TextAlignment, EntityConverter } from './dxf-converter-helpers';

// ============================================================================
// 🏢 ENTERPRISE: DEFAULT HEADER VALUES
// ============================================================================

/**
 * Default header values when no header is provided
 * Based on AutoCAD defaults for metric drawings
 */
const DEFAULT_HEADER: DxfHeaderData = {
  insunits: 4,      // mm (default)
  dimscale: 1,      // No scaling
  dimtxt: 2.5,      // AutoCAD Standard DIMTXT default (mm)
  annoScale: 1,     // 1:1
  measurement: 1    // Metric
};

// ============================================================================
// 🏢 ENTERPRISE: GEOMETRY CONVERTERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Convert LINE entity
 *
 * DXF Codes:
 * - 10, 20: Start point (X, Y)
 * - 11, 21: End point (X, Y)
 */
export function convertLine(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const x1 = parseFloat(data['10']);
  const y1 = parseFloat(data['20']);
  const x2 = parseFloat(data['11']);
  const y2 = parseFloat(data['21']);

  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
    console.warn(`⚠️ Skipping LINE ${index}: missing coordinates`, {
      x1, y1, x2, y2, available: Object.keys(data)
    });
    return null;
  }

  // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
  const color = extractEntityColor(data);

  return {
    id: `line_${index}`,
    type: 'line',
    layer,
    visible: true,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    ...(color && { color })
  };
}

/**
 * 🏢 ENTERPRISE: Convert LWPOLYLINE entity
 *
 * DXF Codes:
 * - 10, 20: Vertex points (repeated)
 * - 70: Polyline flag (1 = closed)
 */
export function convertLwPolyline(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const isClosed = data['70'] === '1';
  const vertices = parseVerticesFromData(data);

  if (vertices.length < 2) {
    console.warn(`⚠️ Skipping LWPOLYLINE ${index}: insufficient vertices`, vertices.length);
    return null;
  }

  // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
  const color = extractEntityColor(data);

  return {
    id: `polyline_${index}`,
    type: 'polyline',
    layer,
    visible: true,
    vertices,
    closed: isClosed,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: CURVE CONVERTERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Convert CIRCLE entity
 *
 * DXF Codes:
 * - 10, 20: Center point (X, Y)
 * - 40: Radius
 */
export function convertCircle(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const centerX = parseFloat(data['10']);
  const centerY = parseFloat(data['20']);
  const radius = parseFloat(data['40']);

  if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
    console.warn(`⚠️ Skipping CIRCLE ${index}: invalid parameters`, {
      centerX, centerY, radius
    });
    return null;
  }

  // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
  const color = extractEntityColor(data);

  return {
    id: `circle_${index}`,
    type: 'circle',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius,
    ...(color && { color })
  };
}

/**
 * 🏢 ENTERPRISE: Convert ARC entity
 *
 * DXF Codes:
 * - 10, 20: Center point (X, Y)
 * - 40: Radius
 * - 50: Start angle (degrees)
 * - 51: End angle (degrees)
 */
export function convertArc(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const centerX = parseFloat(data['10']);
  const centerY = parseFloat(data['20']);
  const radius = parseFloat(data['40']);
  const startAngle = parseFloat(data['50']) || 0;
  const endAngle = parseFloat(data['51']) || 360;

  if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
    console.warn(`⚠️ Skipping ARC ${index}: invalid parameters`, {
      centerX, centerY, radius
    });
    return null;
  }

  // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
  const color = extractEntityColor(data);

  return {
    id: `arc_${index}`,
    type: 'arc',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius,
    startAngle,
    endAngle,
    ...(color && { color })
  };
}

/**
 * 🏢 ENTERPRISE: Convert ELLIPSE entity to circle approximation
 *
 * DXF Codes:
 * - 10, 20: Center point (X, Y)
 * - 11, 21: Major axis endpoint relative to center
 * - 40: Ratio of minor to major axis
 */
export function convertEllipse(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const centerX = parseFloat(data['10']);
  const centerY = parseFloat(data['20']);
  const majorAxisX = parseFloat(data['11']) || 0;
  const majorAxisY = parseFloat(data['21']) || 0;
  const ratio = parseFloat(data['40']) || 1;

  if (isNaN(centerX) || isNaN(centerY)) {
    console.warn(`⚠️ Skipping ELLIPSE ${index}: invalid center`, { centerX, centerY });
    return null;
  }

  // Calculate radius as average of major and minor axes
  // 🏢 ADR-163: Centralized vectorMagnitude (replaces inline Math.sqrt)
  const majorRadius = vectorMagnitude({ x: majorAxisX, y: majorAxisY });
  const minorRadius = majorRadius * ratio;
  const approxRadius = (majorRadius + minorRadius) / 2;

  if (approxRadius <= 0) {
    console.warn(`⚠️ Skipping ELLIPSE ${index}: invalid radius`, { approxRadius });
    return null;
  }

  // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
  const color = extractEntityColor(data);

  return {
    id: `ellipse_${index}`,
    type: 'circle',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius: approxRadius,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: TEXT CONVERTERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Convert TEXT entity with full CAD property extraction
 *
 * DXF Codes:
 * - 10, 20: Position (X, Y)
 * - 1: Text content
 * - 40: Text height (fontSize)
 * - 50: Rotation angle in degrees
 * - 72: Horizontal justification
 *
 * @see AutoCAD DXF Reference: TEXT Entity
 */
export function convertText(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const x = parseFloat(data['10']);
  const y = parseFloat(data['20']);
  let text = data['1'] || '';
  const rawHeight = data['40'];
  const height = parseFloat(rawHeight) || 1;
  const rotation = parseFloat(data['50']) || 0;

  // Extract horizontal alignment (DXF code 72)
  const horizontalJustification = parseInt(data['72']) || 0;
  const alignment = mapHorizontalAlignment(horizontalJustification);

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    console.warn(`⚠️ Skipping TEXT ${index}: missing position or text`, { x, y, text });
    return null;
  }

  // Decode Greek text using centralized helper
  text = decodeGreekText(text);

  // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
  const color = extractEntityColor(data);

  return {
    id: `text_${index}`,
    type: 'text',
    layer,
    visible: true,
    position: { x, y },
    text: text.trim(),
    fontSize: height,
    height: height, // 🔧 ALSO ADD height property
    rotation,
    alignment,
    ...(color && { color })
  };
}

/**
 * 🏢 ENTERPRISE: Convert MTEXT/MULTILINETEXT entity
 *
 * DXF Codes:
 * - 10, 20: Insertion point (X, Y)
 * - 1 or 3: Text content
 * - 40: Text height (fontSize)
 * - 50: Rotation angle in degrees
 * - 71: Attachment point (determines alignment)
 *
 * @see AutoCAD DXF Reference: MTEXT Entity
 */
export function convertMText(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const x = parseFloat(data['10']);
  const y = parseFloat(data['20']);
  let text = data['1'] || data['3'] || ''; // MTEXT can use code 1 or 3
  const rawHeight = data['40'];
  const height = parseFloat(rawHeight) || 1;
  const rotation = parseFloat(data['50']) || 0;

  // Extract attachment point (DXF code 71) for alignment
  const attachmentPoint = parseInt(data['71']) || 1;
  const alignment = mapMTextAlignment(attachmentPoint);

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    console.warn(`⚠️ Skipping MTEXT ${index}: missing position or text`, { x, y, text });
    return null;
  }

  // Decode Greek text using centralized helper
  text = decodeGreekText(text);

  // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
  const color = extractEntityColor(data);

  return {
    id: `mtext_${index}`,
    type: 'text',
    layer,
    visible: true,
    position: { x, y },
    text: text.trim(),
    fontSize: height,
    height: height, // 🔧 ALSO ADD height property
    rotation,
    alignment,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: COMPLEX ENTITY CONVERTERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Convert SPLINE entity to polyline approximation
 *
 * DXF Codes:
 * - 10, 20: Control points (repeated)
 */
export function convertSpline(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const vertices = parseVerticesFromData(data);

  if (vertices.length < 2) {
    console.warn(`⚠️ Skipping SPLINE ${index}: insufficient control points`, vertices.length);
    return null;
  }

  // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
  const color = extractEntityColor(data);

  return {
    id: `spline_${index}`,
    type: 'polyline',
    layer,
    visible: true,
    vertices,
    closed: false,
    ...(color && { color })
  };
}

/**
 * 🏢 ENTERPRISE: Convert DIMENSION entity to TEXT with proper rotation
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ 🏢 ENTERPRISE DIMSTYLE SUPPORT (2026-01-03)                              ║
 * ║                                                                          ║
 * ║ ΚΡΙΣΙΜΗ ΑΛΛΑΓΗ: Χρησιμοποιεί τα parsed DIMSTYLE entries!                ║
 * ║                                                                          ║
 * ║ Προτεραιότητα text height:                                               ║
 * ║ 1. Entity override (code 140 αν ≠ 0)                                     ║
 * ║ 2. DIMSTYLE entry (dimStyles[styleName].dimtxt)                          ║
 * ║ 3. Fallback (2.5mm - AutoCAD Standard default)                           ║
 * ║                                                                          ║
 * ║ Το DIMSTYLE name βρίσκεται στο code 3 του DIMENSION entity.             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * DXF Codes:
 * - 3: Dimension style name (references DIMSTYLE table)
 * - 13, 23: First definition point (start of dimension)
 * - 14, 24: Second definition point (end of dimension)
 * - 11, 21: Middle point of dimension line (text position)
 * - 1: Dimension text override (custom text)
 * - 42: Actual measurement value
 * - 140: DIMTXT override (usually 0 = use style)
 * - 50: Rotation of dimension text
 * - 53: Rotation of dimension extension line
 *
 * ΚΡΙΣΙΜΟ: Τα DIMENSION entities πρέπει να γίνουν TEXT με rotation
 * ώστε να ακολουθούν τη διεύθυνση της γραμμής διάστασης.
 *
 * @param data - Raw DXF entity data
 * @param layer - Layer name
 * @param index - Entity index for ID generation
 * @param header - Optional DXF header data for DIMSCALE normalization
 * @param dimStyles - Optional parsed DIMSTYLE map with real DIMTXT values
 */
export function convertDimension(
  data: Record<string, string>,
  layer: string,
  index: number,
  header?: DxfHeaderData,
  dimStyles?: DimStyleMap
): AnySceneEntity | null {
  // Use provided header or defaults
  const h = header || DEFAULT_HEADER;

  // Definition points (start and end of dimension)
  const x1 = parseFloat(data['13']) || parseFloat(data['10']);
  const y1 = parseFloat(data['23']) || parseFloat(data['20']);
  const x2 = parseFloat(data['14']) || parseFloat(data['11']);
  const y2 = parseFloat(data['24']) || parseFloat(data['21']);

  // Middle point (text position) - DXF code 11, 21
  const textX = parseFloat(data['11']);
  const textY = parseFloat(data['21']);

  // Dimension text and measurement
  const customText = data['1'] || ''; // Custom text override
  const measurement = parseFloat(data['42']); // Actual measurement value

  // Rotation angles
  const textRotation = parseFloat(data['50']) || 0; // Text rotation
  const lineRotation = parseFloat(data['53']) || 0; // Extension line rotation

  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║ 🏢 ENTERPRISE: DIMSTYLE-aware text height calculation (2026-01-03)     ║
  // ║                                                                        ║
  // ║ Priority order:                                                        ║
  // ║ 1. Entity code 140 (if non-zero = explicit override)                   ║
  // ║ 2. DIMSTYLE entry dimtxt (from parsed TABLES section)                  ║
  // ║ 3. Header $DIMTXT (global default from HEADER)                         ║
  // ║ 4. Fallback 0.18 (common architectural DXF default)                    ║
  // ║                                                                        ║
  // ║ Formula: effectiveHeight = DIMTXT * DIMSCALE (AutoCAD spec!)           ║
  // ║ ΣΗΜΑΝΤΙΚΟ: Πολλαπλασιασμός, ΟΧΙ διαίρεση!                              ║
  // ╚════════════════════════════════════════════════════════════════════════╝

  // Get style name from entity (code 3)
  const styleName = data['3'] || 'Standard';

  // Get entity override (code 140) - 0 means "use style"
  const entityDimtxt = parseFloat(data['140']) || 0;

  // Determine base text height from appropriate source
  let baseDimtxt: number;
  let heightSource: string;

  if (entityDimtxt > 0) {
    // Priority 1: Entity has explicit override
    baseDimtxt = entityDimtxt;
    heightSource = 'entity-override';
  } else if (dimStyles && dimStyles[styleName]) {
    // Priority 2: Use DIMSTYLE entry
    baseDimtxt = dimStyles[styleName].dimtxt;
    heightSource = `dimstyle:${styleName}`;
  } else if (dimStyles && dimStyles['Standard']) {
    // Priority 2b: Use "Standard" style as fallback
    baseDimtxt = dimStyles['Standard'].dimtxt;
    heightSource = 'dimstyle:Standard';
  } else if (h.dimtxt > 0) {
    // Priority 3: Use $DIMTXT from HEADER
    baseDimtxt = h.dimtxt;
    heightSource = 'header-$DIMTXT';
  } else {
    // Priority 4: Hardcoded fallback (common architectural default)
    baseDimtxt = 0.18;
    heightSource = 'fallback';
  }

  // Get DIMSCALE from header (overall scale factor)
  const dimscale = h.dimscale > 0 ? h.dimscale : 1;

  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║ 🔧 FIX: DIMTXT * DIMSCALE (not divide!)                                ║
  // ║ AutoCAD: effective height = DIMTXT * DIMSCALE                          ║
  // ║ Σε scaled drawings (1:50), dims πρέπει να είναι μεγαλύτερα            ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  const textHeight = baseDimtxt * dimscale;

  // 🔧 DEBUG LOG: Uncomment to diagnose dimension height issues
  console.log('📐 DIM HEIGHT CALC:', {
    entityId: `dimension_${index}`,
    code140: data['140'] || '(none)',
    styleName,
    dimStyleTxt: dimStyles?.[styleName]?.dimtxt || '(no style)',
    headerDimtxt: h.dimtxt,
    baseDimtxt,
    dimscale,
    heightSource,
    finalHeight: textHeight
  });

  if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
    // Calculate text content
    let dimensionText = customText;
    if (!dimensionText && !isNaN(measurement)) {
      // Format measurement value with 2 decimal places
      dimensionText = measurement.toFixed(2);
    }
    if (!dimensionText) {
      // 🏢 ADR-065: Use centralized distance calculation
      const distance = calculateDistance({ x: x1, y: y1 }, { x: x2, y: y2 });
      dimensionText = distance.toFixed(2);
    }

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🔧 DIMENSION ROTATION CALCULATION (2026-01-03)                         ║
    // ║ Υπολογίζει τη γωνία του κειμένου από τη διεύθυνση της γραμμής         ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    let rotation = textRotation;

    // If no explicit text rotation, calculate from dimension line direction
    if (textRotation === 0 && lineRotation === 0) {
      // Calculate angle from definition points
      // 🏢 ADR-078: Use centralized calculateAngle
      // 🏢 ADR-067: Use centralized angle conversion
      rotation = radToDeg(calculateAngle({ x: x1, y: y1 }, { x: x2, y: y2 }));

      // Normalize to keep text readable (not upside down)
      // Text should be readable from bottom-left to top-right
      if (rotation > 90) rotation -= 180;
      if (rotation < -90) rotation += 180;
    } else if (lineRotation !== 0) {
      rotation = lineRotation;
    }

    // Calculate text position (middle of dimension line or use explicit position)
    let posX = !isNaN(textX) ? textX : (x1 + x2) / 2;
    let posY = !isNaN(textY) ? textY : (y1 + y2) / 2;

    // 🏢 ENTERPRISE: Extract ACI color from DXF code 62
    const color = extractEntityColor(data);

    // Return as TEXT entity with rotation
    return {
      id: `dimension_${index}`,
      type: 'text',
      layer,
      visible: true,
      position: { x: posX, y: posY },
      text: dimensionText,
      fontSize: textHeight,
      height: textHeight,
      rotation: rotation,
      alignment: 'center',
      ...(color && { color })
    };
  }

  console.warn(`⚠️ Skipping DIMENSION ${index}: insufficient coordinate data`);
  return null;
}

// ============================================================================
// 🏢 ENTERPRISE: MASTER CONVERTER
// ============================================================================

/**
 * 🏢 ENTERPRISE: Master converter function
 *
 * Routes entity types to appropriate converter functions.
 * Single point of entry for all entity conversions.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ 🏢 ENTERPRISE DIMSTYLE SUPPORT (2026-01-03)                              ║
 * ║                                                                          ║
 * ║ Δέχεται:                                                                 ║
 * ║ - header: DXF HEADER data (DIMSCALE, INSUNITS)                          ║
 * ║ - dimStyles: Parsed DIMSTYLE entries με πραγματικά DIMTXT values        ║
 * ║                                                                          ║
 * ║ Τα dimStyles περνάνε στο convertDimension για σωστό text sizing.        ║
 * ║ Backward compatible: Αν δεν δοθούν, χρησιμοποιεί defaults.              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * @param entityData - Parsed entity data from DxfEntityParser
 * @param index - Entity index for unique ID generation
 * @param header - Optional DXF header data for DIMSCALE normalization
 * @param dimStyles - Optional parsed DIMSTYLE map with real DIMTXT values
 * @returns Converted scene entity or null
 */
export function convertEntityToScene(
  entityData: EntityData,
  index: number,
  header?: DxfHeaderData,
  dimStyles?: DimStyleMap
): AnySceneEntity | null {
  const { type, layer, data } = entityData;

  switch (type) {
    case 'LINE':
      return convertLine(data, layer, index);
    case 'LWPOLYLINE':
      return convertLwPolyline(data, layer, index);
    case 'CIRCLE':
      return convertCircle(data, layer, index);
    case 'ARC':
      return convertArc(data, layer, index);
    case 'ELLIPSE':
      return convertEllipse(data, layer, index);
    case 'TEXT':
      return convertText(data, layer, index);
    case 'MTEXT':
    case 'MULTILINETEXT':
      return convertMText(data, layer, index);
    case 'SPLINE':
      return convertSpline(data, layer, index);
    case 'DIMENSION':
      // 🏢 ENTERPRISE: Pass header AND dimStyles for proper text sizing
      return convertDimension(data, layer, index, header, dimStyles);
    default:
      return null;
  }
}
