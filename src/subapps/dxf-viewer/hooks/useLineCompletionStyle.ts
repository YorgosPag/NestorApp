/**
 * @module useLineCompletionStyle
 * @description ADR-056: Centralized Entity Completion Styles
 *
 * Mirror pattern of applyLinePreviewStyle() for the completion phase.
 * Provides centralized styling logic for entity completion.
 *
 * ENTERPRISE PATTERN:
 * - AutoCAD "Current Properties" style - all entities receive consistent styles
 * - Accepts styles from DxfSettingsContext (via useLineStyles('completion'))
 * - LineType conversion utility (centralized from inline code)
 *
 * @example
 * ```typescript
 * import { applyCompletionStyles } from './useLineCompletionStyle';
 * import { useLineStyles } from '../settings-provider';
 *
 * const lineCompletionStyles = useLineStyles('completion');
 * applyCompletionStyles(newEntity, lineCompletionStyles);
 * ```
 */

import type { LineType, LineSettings } from '../settings-core/types';

/**
 * Entity completion styles interface
 * Matches the properties available in drawing entities (BaseEntity)
 */
export interface EntityCompletionStyles {
  color: string;
  lineweight: number;
  opacity: number;
  lineType: 'solid' | 'dashed' | 'dotted' | 'dashdot';
  dashScale: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  dashOffset: number;
  breakAtCenter: boolean;
}

/**
 * Convert external LineType (from settings) to entity-compatible LineType format
 *
 * ENTERPRISE PATTERN: Centralized conversion (removes ad-hoc inline conversions)
 *
 * @param lineType - The line type string from settings (may include 'dash-dot', 'dash-dot-dot')
 * @returns Entity-compatible line type ('solid' | 'dashed' | 'dotted' | 'dashdot')
 */
export function convertLineTypeToEntityFormat(
  lineType: string | LineType
): 'solid' | 'dashed' | 'dotted' | 'dashdot' {
  const mapping: Record<string, 'solid' | 'dashed' | 'dotted' | 'dashdot'> = {
    'dash-dot': 'dashdot',
    'dash-dot-dot': 'dashdot', // Fallback to dashdot (closest match)
    'solid': 'solid',
    'dashed': 'dashed',
    'dotted': 'dotted',
    'dashdot': 'dashdot',
  };
  return mapping[lineType] ?? 'solid';
}

/**
 * Transform LineSettings to EntityCompletionStyles
 *
 * ENTERPRISE PATTERN: Converts DxfSettingsContext format to entity format
 *
 * @param settings - LineSettings from DxfSettingsContext (useLineStyles('completion'))
 * @returns EntityCompletionStyles ready for entity application
 */
export function transformToEntityStyles(settings: LineSettings): EntityCompletionStyles {
  return {
    color: settings.color,
    lineweight: settings.lineWidth,
    opacity: settings.opacity,
    lineType: convertLineTypeToEntityFormat(settings.lineType),
    dashScale: settings.dashScale ?? 1.0,
    lineCap: settings.lineCap ?? 'round',
    lineJoin: settings.lineJoin ?? 'round',
    dashOffset: settings.dashOffset ?? 0,
    breakAtCenter: settings.breakAtCenter ?? false,
  };
}

/**
 * Apply completion styles to an entity
 *
 * ENTERPRISE PATTERN: AutoCAD "Current Properties" style application
 * - Accepts styles from DxfSettingsContext (useLineStyles('completion'))
 * - Applies ALL properties consistently to any entity type
 * - Type-safe with proper generic constraint
 *
 * @param entity - The entity to apply styles to (modified in place for performance)
 * @param completionStyles - LineSettings from useLineStyles('completion')
 * @returns The same entity reference with styles applied
 *
 * @example
 * ```typescript
 * // In useUnifiedDrawing.tsx:
 * const lineCompletionStyles = useLineStyles('completion');
 *
 * // For drawing entities (line, circle, rectangle, polyline)
 * const newEntity = createEntityFromTool(tool, points);
 * applyCompletionStyles(newEntity, lineCompletionStyles);
 *
 * // For measurement entities (measure-distance, measure-angle)
 * const measurementEntity = createMeasurementEntity(points);
 * applyCompletionStyles(measurementEntity, lineCompletionStyles);
 * ```
 */
export function applyCompletionStyles<T extends Record<string, unknown>>(
  entity: T,
  completionStyles: LineSettings
): T {
  const styles = transformToEntityStyles(completionStyles);

  // Apply all completion style properties to the entity
  // Using Object.assign for performance (mutates in place, returns same reference)
  return Object.assign(entity, {
    color: styles.color,
    lineweight: styles.lineweight,
    opacity: styles.opacity,
    lineType: styles.lineType,
    dashScale: styles.dashScale,
    lineCap: styles.lineCap,
    lineJoin: styles.lineJoin,
    dashOffset: styles.dashOffset,
    breakAtCenter: styles.breakAtCenter,
  });
}

/**
 * Apply completion styles to a canvas context (for direct rendering)
 *
 * ENTERPRISE PATTERN: Mirrors applyLinePreviewStyle() for completion phase
 * Accepts styles from DxfSettingsContext for consistency with applyCompletionStyles()
 *
 * @param ctx - The canvas 2D rendering context
 * @param completionStyles - LineSettings from useLineStyles('completion')
 *
 * @example
 * ```typescript
 * const lineCompletionStyles = useLineStyles('completion');
 * applyCompletionStylesToContext(ctx, lineCompletionStyles);
 * ```
 */
export function applyCompletionStylesToContext(
  ctx: CanvasRenderingContext2D,
  completionStyles: LineSettings
): void {
  const styles = transformToEntityStyles(completionStyles);

  ctx.strokeStyle = styles.color;
  ctx.lineWidth = styles.lineweight;
  ctx.globalAlpha = styles.opacity;
  ctx.lineCap = styles.lineCap;
  ctx.lineJoin = styles.lineJoin;

  // Apply line dash based on lineType
  switch (styles.lineType) {
    case 'dashed':
      ctx.setLineDash([8 * styles.dashScale, 4 * styles.dashScale]);
      break;
    case 'dotted':
      ctx.setLineDash([2 * styles.dashScale, 2 * styles.dashScale]);
      break;
    case 'dashdot':
      ctx.setLineDash([8 * styles.dashScale, 4 * styles.dashScale, 2 * styles.dashScale, 4 * styles.dashScale]);
      break;
    case 'solid':
    default:
      ctx.setLineDash([]);
      break;
  }
}
