/**
 * 🏢 ENTERPRISE: DXF Dimension Converter
 *
 * Converts DIMENSION entities to TEXT + geometry lines.
 * Extracted from dxf-entity-converters.ts for SRP compliance (ADR-065 Phase 4).
 *
 * Supports DIMSTYLE-aware text height calculation:
 * - Entity override (code 140)
 * - DIMSTYLE entry (dimStyles[styleName].dimtxt)
 * - Header $DIMTXT
 * - Fallback 0.18mm
 *
 * @see dxf-entity-converters.ts - Master converter
 * @see AutoCAD DXF Reference for DIMENSION entity codes
 */

import type { AnySceneEntity } from '../types/scene';
import type { DxfHeaderData, DimStyleMap } from './dxf-entity-parser';
import { calculateDistance, calculateAngle } from '../rendering/entities/shared/geometry-rendering-utils';
import { radToDeg } from '../rendering/entities/shared/geometry-utils';
import { extractEntityColor } from './dxf-converter-helpers';
import { dlog, dwarn } from '../debug';

// ============================================================================
// DEFAULT HEADER VALUES
// ============================================================================

const DEFAULT_HEADER: DxfHeaderData = {
  insunits: 4,      // mm (default)
  dimscale: 1,      // No scaling
  dimtxt: 2.5,      // AutoCAD Standard DIMTXT default (mm)
  annoScale: 1,     // 1:1
  measurement: 1    // Metric
};

// ============================================================================
// DIMENSION TEXT HEIGHT CALCULATION
// ============================================================================

/**
 * Calculate effective text height from DIMSTYLE priority chain.
 *
 * Priority:
 * 1. Entity code 140 (if non-zero = explicit override)
 * 2. DIMSTYLE entry dimtxt (from parsed TABLES section)
 * 3. Header $DIMTXT (global default)
 * 4. Fallback 0.18 (common architectural DXF default)
 */
function calculateDimensionTextHeight(
  data: Record<string, string>,
  header: DxfHeaderData,
  dimStyles?: DimStyleMap
): { textHeight: number; heightSource: string } {
  const styleName = data['3'] || 'Standard';
  const entityDimtxt = parseFloat(data['140']) || 0;

  let baseDimtxt: number;
  let heightSource: string;

  if (entityDimtxt > 0) {
    baseDimtxt = entityDimtxt;
    heightSource = 'entity-override';
  } else if (dimStyles && dimStyles[styleName]) {
    baseDimtxt = dimStyles[styleName].dimtxt;
    heightSource = `dimstyle:${styleName}`;
  } else if (dimStyles && dimStyles['Standard']) {
    baseDimtxt = dimStyles['Standard'].dimtxt;
    heightSource = 'dimstyle:Standard';
  } else if (header.dimtxt > 0) {
    baseDimtxt = header.dimtxt;
    heightSource = 'header-$DIMTXT';
  } else {
    baseDimtxt = 0.18;
    heightSource = 'fallback';
  }

  const dimscale = header.dimscale > 0 ? header.dimscale : 1;
  const textHeight = baseDimtxt * dimscale;

  return { textHeight, heightSource };
}

// ============================================================================
// DIMENSION GEOMETRY HELPERS
// ============================================================================

/**
 * Calculate projected dimension line endpoints based on dimension type.
 */
function calculateDimensionLinePoints(
  dimType: number,
  dimLineAngle: number,
  dimLineX: number,
  dimLineY: number,
  defPt1X: number,
  defPt1Y: number,
  defPt2X: number,
  defPt2Y: number,
): { p1: { x: number; y: number }; p2: { x: number; y: number } } {
  if (dimType === 1) {
    // Aligned: dimension line parallel to measured feature, offset perpendicular
    const featureDx = defPt2X - defPt1X;
    const featureDy = defPt2Y - defPt1Y;
    const featureLen = Math.sqrt(featureDx * featureDx + featureDy * featureDy);
    if (featureLen > 0) {
      const perpX = -featureDy / featureLen;
      const perpY = featureDx / featureLen;
      const dist = (dimLineX - defPt1X) * perpX + (dimLineY - defPt1Y) * perpY;
      return {
        p1: { x: defPt1X + dist * perpX, y: defPt1Y + dist * perpY },
        p2: { x: defPt2X + dist * perpX, y: defPt2Y + dist * perpY },
      };
    }
    return { p1: { x: defPt1X, y: defPt1Y }, p2: { x: defPt2X, y: defPt2Y } };
  }

  if (dimType === 0) {
    // Linear (horizontal/vertical/rotated)
    const absAngle = Math.abs(dimLineAngle % 360);
    if (absAngle < 1 || Math.abs(absAngle - 180) < 1 || Math.abs(absAngle - 360) < 1) {
      return { p1: { x: defPt1X, y: dimLineY }, p2: { x: defPt2X, y: dimLineY } };
    }
    if (Math.abs(absAngle - 90) < 1 || Math.abs(absAngle - 270) < 1) {
      return { p1: { x: dimLineX, y: defPt1Y }, p2: { x: dimLineX, y: defPt2Y } };
    }
    // Rotated — project definition points onto line through dimLine point
    const rad = dimLineAngle * Math.PI / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const t1 = (defPt1X - dimLineX) * dx + (defPt1Y - dimLineY) * dy;
    const t2 = (defPt2X - dimLineX) * dx + (defPt2Y - dimLineY) * dy;
    return {
      p1: { x: dimLineX + t1 * dx, y: dimLineY + t1 * dy },
      p2: { x: dimLineX + t2 * dx, y: dimLineY + t2 * dy },
    };
  }

  // Angular, radial, diameter — connect definition points directly
  return { p1: { x: defPt1X, y: defPt1Y }, p2: { x: defPt2X, y: defPt2Y } };
}

// ============================================================================
// MAIN DIMENSION CONVERTER
// ============================================================================

/**
 * Convert DIMENSION entity to TEXT + geometry lines.
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
): AnySceneEntity[] {
  const h = header || DEFAULT_HEADER;

  // Definition points (start and end of dimension)
  const x1 = parseFloat(data['13']) || parseFloat(data['10']);
  const y1 = parseFloat(data['23']) || parseFloat(data['20']);
  const x2 = parseFloat(data['14']) || parseFloat(data['11']);
  const y2 = parseFloat(data['24']) || parseFloat(data['21']);

  // Middle point (text position)
  const textX = parseFloat(data['11']);
  const textY = parseFloat(data['21']);

  // Dimension text and measurement
  const customText = data['1'] || '';
  const measurement = parseFloat(data['42']);

  // Angles
  const dimLineAngle = parseFloat(data['50']) || 0;
  const dimTextRotation = parseFloat(data['53']) || 0;

  // Calculate text height via DIMSTYLE priority chain
  const { textHeight, heightSource } = calculateDimensionTextHeight(data, h, dimStyles);

  dlog('EntityConverter', '📐 DIM HEIGHT CALC:', {
    entityId: `dimension_${index}`,
    code140: data['140'] || '(none)',
    styleName: data['3'] || 'Standard',
    dimStyleTxt: dimStyles?.[data['3'] || 'Standard']?.dimtxt || '(no style)',
    headerDimtxt: h.dimtxt,
    baseDimtxt: textHeight / (h.dimscale > 0 ? h.dimscale : 1),
    dimscale: h.dimscale,
    heightSource,
    finalHeight: textHeight
  });

  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
    dwarn('EntityConverter', `⚠️ Skipping DIMENSION ${index}: insufficient coordinate data`);
    return [];
  }

  const entities: AnySceneEntity[] = [];
  const color = extractEntityColor(data);

  // ── TEXT ENTITY ──
  let dimensionText = customText;
  if (!dimensionText && !isNaN(measurement)) {
    dimensionText = measurement.toFixed(2);
  }
  if (!dimensionText) {
    const distance = calculateDistance({ x: x1, y: y1 }, { x: x2, y: y2 });
    dimensionText = distance.toFixed(2);
  }

  let rotation = dimLineAngle;
  if (dimLineAngle === 0 && dimTextRotation === 0) {
    rotation = radToDeg(calculateAngle({ x: x1, y: y1 }, { x: x2, y: y2 }));
    if (rotation > 90) rotation -= 180;
    if (rotation < -90) rotation += 180;
  } else if (dimTextRotation !== 0) {
    rotation = dimTextRotation;
  }

  const posX = !isNaN(textX) ? textX : (x1 + x2) / 2;
  const posY = !isNaN(textY) ? textY : (y1 + y2) / 2;

  entities.push({
    id: `dimension_${index}`,
    type: 'text',
    layer,
    visible: true,
    position: { x: posX, y: posY },
    text: dimensionText,
    fontSize: textHeight,
    height: textHeight,
    rotation,
    alignment: 'center',
    ...(color && { color })
  });

  // ── DIMENSION GEOMETRY (lines + extension lines) ──
  const dimLineX = parseFloat(data['10']);
  const dimLineY = parseFloat(data['20']);
  const defPt1X = parseFloat(data['13']);
  const defPt1Y = parseFloat(data['23']);
  const defPt2X = parseFloat(data['14']);
  const defPt2Y = parseFloat(data['24']);
  const dimType = parseInt(data['70'] || '0', 10) & 0x07;

  const hasGeometryData = !isNaN(dimLineX) && !isNaN(dimLineY)
    && !isNaN(defPt1X) && !isNaN(defPt1Y)
    && !isNaN(defPt2X) && !isNaN(defPt2Y);

  if (hasGeometryData) {
    const { p1, p2 } = calculateDimensionLinePoints(
      dimType, dimLineAngle, dimLineX, dimLineY, defPt1X, defPt1Y, defPt2X, defPt2Y
    );

    // Dimension line
    entities.push({
      id: `dim_line_${index}`,
      type: 'line',
      layer,
      visible: true,
      start: p1,
      end: p2,
      ...(color && { color })
    });

    // Extension line 1
    const ext1Sq = (defPt1X - p1.x) ** 2 + (defPt1Y - p1.y) ** 2;
    if (ext1Sq > 0.001) {
      entities.push({
        id: `dim_ext1_${index}`,
        type: 'line',
        layer,
        visible: true,
        start: { x: defPt1X, y: defPt1Y },
        end: p1,
        ...(color && { color })
      });
    }

    // Extension line 2
    const ext2Sq = (defPt2X - p2.x) ** 2 + (defPt2Y - p2.y) ** 2;
    if (ext2Sq > 0.001) {
      entities.push({
        id: `dim_ext2_${index}`,
        type: 'line',
        layer,
        visible: true,
        start: { x: defPt2X, y: defPt2Y },
        end: p2,
        ...(color && { color })
      });
    }
  }

  return entities;
}
