/**
 * @module useLineCompletionStyle
 * @description ADR-056: Centralized Entity Completion Styles
 *
 * ENTERPRISE PATTERN: Mirrors applyLinePreviewStyle() for completion phase
 * - Reads from completionStyleStore (single source of truth)
 * - No React context required (can be called from anywhere)
 * - Centralized LineType conversion utility
 *
 * ARCHITECTURE:
 * ```
 * completionStyleStore (SSOT)
 *        ↓
 * getCompletionStyles() / applyCompletionStyles()
 *        ↓
 * All Entities (drawing + measurement)
 * ```
 *
 * @example
 * ```typescript
 * import { applyCompletionStyles } from './useLineCompletionStyle';
 *
 * // Apply completion styles to any entity (reads from store automatically)
 * applyCompletionStyles(newEntity);
 * ```
 *
 * @author Anthropic Claude Code
 * @since 2026-01-30
 * @see ADR-056 in docs/centralized-systems/reference/adr-index.md
 */

import { completionStyleStore, type CompletionStyle } from '../stores/CompletionStyleStore';
import type { LineType } from '../settings-core/types';

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
 * Get completion styles from completionStyleStore
 *
 * ENTERPRISE PATTERN: Single source of truth for completion styles
 * Mirrors getLinePreviewStyle() but for completion phase
 *
 * @returns EntityCompletionStyles object with all styling properties
 */
export function getCompletionStyles(): EntityCompletionStyles {
  const storeStyle = completionStyleStore.get();

  return {
    color: storeStyle.color,
    lineweight: storeStyle.lineWidth,
    opacity: storeStyle.opacity,
    lineType: convertLineTypeToEntityFormat(storeStyle.lineType),
    dashScale: storeStyle.dashScale,
    lineCap: storeStyle.lineCap,
    lineJoin: storeStyle.lineJoin,
    dashOffset: storeStyle.dashOffset,
    breakAtCenter: storeStyle.breakAtCenter,
  };
}

/**
 * Apply completion styles to an entity
 *
 * ENTERPRISE PATTERN: AutoCAD "Current Properties" style application
 * - Reads from completionStyleStore (single source of truth)
 * - Applies ALL properties consistently to any entity type
 * - Type-safe with proper generic constraint
 * - No parameters required (reads from store automatically)
 *
 * @param entity - The entity to apply styles to (modified in place for performance)
 * @returns The same entity reference with styles applied
 *
 * @example
 * ```typescript
 * // For drawing entities (line, circle, rectangle, polyline)
 * const newEntity = createEntityFromTool(tool, points);
 * applyCompletionStyles(newEntity);
 *
 * // For measurement entities (measure-distance, measure-angle)
 * const measurementEntity = createMeasurementEntity(points);
 * applyCompletionStyles(measurementEntity);
 * ```
 */
export function applyCompletionStyles<T extends Record<string, unknown>>(entity: T): T {
  const styles = getCompletionStyles();

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
 * Reads from completionStyleStore automatically
 *
 * @param ctx - The canvas 2D rendering context
 *
 * @example
 * ```typescript
 * applyCompletionStylesToContext(ctx);
 * ctx.strokeRect(x, y, width, height);
 * ```
 */
export function applyCompletionStylesToContext(ctx: CanvasRenderingContext2D): void {
  const styles = getCompletionStyles();

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
