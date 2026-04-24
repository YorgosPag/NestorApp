import type { CSSProperties } from 'react';
import {
  mapInteractionTokens,
  mapControlPointTokens,
  colors,
  spacing,
  typography,
  zIndex
} from '../../../styles/design-tokens';
import { GEO_COLORS, withOpacity } from '../config/color-config';
import { GEO_CANVAS_ZINDEX } from '../config';

// 🎯 ENTERPRISE TYPE DEFINITIONS
interface ControlPointStylesType {
  readonly interaction: (isSelected: boolean, shouldHighlight: boolean, isComplete: boolean) => CSSProperties;
}

interface AccuracyStylesType {
  readonly circle: (radius: number, color: string, opacity: number) => CSSProperties;
  readonly zone: (size: number, color: string, level: 'excellent' | 'good' | 'fair' | 'poor') => CSSProperties;
  readonly zoneIcon: () => CSSProperties;
}

interface MarkerStylesType {
  readonly pin: (sizePx: number, opacity: number) => CSSProperties;
  readonly centerDot: () => CSSProperties;
  readonly dynamicPin: (strokeColor: string, fillColor: string) => CSSProperties;
  readonly dynamicCenterDot: () => CSSProperties;
  readonly drawingPoint: (index: number) => CSSProperties;
}

interface LabelStylesType {
  readonly radiusLabel: () => CSSProperties;
  readonly previewLabel: (opacity: number) => CSSProperties;
  readonly legendItem: (color: string) => CSSProperties;
}

interface InteractiveMapStylesType {
  readonly controlPoints: ControlPointStylesType;
  readonly accuracy: AccuracyStylesType;
  readonly markers: MarkerStylesType;
  readonly labels: LabelStylesType;
  readonly layout: {
    readonly mapContainer: CSSProperties;
    readonly animationDelay: (seconds: number) => CSSProperties;
    readonly polygonVertex: (radius: number, pointColor: string, strokeColor: string) => CSSProperties;
  };
}

// 🎯 CONTROL POINT STYLING - ENTERPRISE CONTROL PATTERNS
/**
 * 🎯 CONTROL POINTS: Professional control point interaction styling
 * Replaces: canvasUtilities.geoInteractive.controlPointInteraction()
 */
const controlPointStyles: ControlPointStylesType = {
  /**
   * Control point interaction styling
   * Replaces: style={canvasUtilities.geoInteractive.controlPointInteraction(...)}
   */
  interaction: (isSelected: boolean, shouldHighlight: boolean, isComplete: boolean): CSSProperties => {
    const state = mapControlPointTokens.getControlPointStyle(isSelected, shouldHighlight, isComplete);
    return {
      zIndex: state.zIndex,
      pointerEvents: state.pointerEvents,
      cursor: state.cursor,
      borderRadius: '50%',
      border: '2px solid',
      transition: 'all 0.2s ease-in-out'
    };
  }
} as const;

// 🎯 ACCURACY VISUALIZATION - ENTERPRISE ACCURACY PATTERNS
/**
 * 🎯 ACCURACY: Professional accuracy circle and zone styling
 * Replaces: canvasUtilities.geoInteractive.accuracyCircle* functions
 */
const accuracyStyles: AccuracyStylesType = {
  /**
   * Accuracy circle with z-index
   * Replaces: canvasUtilities.geoInteractive.accuracyCircleWithZIndex()
   */
  circle: (radius: number, color: string, opacity: number): CSSProperties => ({
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    borderRadius: '50%',
    border: `2px solid ${color}`,
    backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    transform: 'translate(-50%, -50%)',
    zIndex: zIndex.sticky,
    pointerEvents: 'none' as const
  }),

  /**
   * Accuracy zone styling
   * Replaces: canvasUtilities.geoInteractive.accuracyZone()
   */
  zone: (size: number, color: string, level: 'excellent' | 'good' | 'fair' | 'poor'): CSSProperties => {
    const opacity = level === 'excellent' ? 0.3 : level === 'good' ? 0.25 : level === 'fair' ? 0.2 : 0.1;
    return {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      border: `1px solid ${color}`,
      transform: 'translate(-50%, -50%)',
      zIndex: zIndex.docked
    };
  },

  /**
   * Accuracy zone icon styling
   * Replaces: canvasUtilities.geoInteractive.accuracyZoneIcon()
   */
  zoneIcon: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    fontSize: typography.fontSize.sm,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    pointerEvents: 'none' as const
  })
} as const;

// 🎯 MARKER STYLING - ENTERPRISE MARKER PATTERNS
/**
 * 🎯 MARKERS: Professional pin and marker styling
 * Replaces: canvasUtilities.geoInteractive.pinMarker, dynamicPinMarker functions
 */
const markerStyles: MarkerStylesType = {
  /**
   * Pin marker styling
   * Replaces: canvasUtilities.geoInteractive.pinMarker()
   */
  pin: (sizePx: number, opacity: number): CSSProperties => ({
    width: `${sizePx * 2}px`,
    height: `${sizePx * 2}px`,
    borderRadius: '50%',
    backgroundColor: colors.blue[500],
    border: `2px solid ${colors.blue[300]}`,
    opacity,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: zIndex.dropdown
  }),

  /**
   * Pin center dot styling
   * Replaces: canvasUtilities.geoInteractive.pinCenterDot()
   */
  centerDot: (): CSSProperties => ({
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: '50%',
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--foreground))'
  }),

  /**
   * Dynamic pin marker styling
   * Replaces: canvasUtilities.geoInteractive.dynamicPinMarker()
   */
  dynamicPin: (strokeColor: string, fillColor: string): CSSProperties => ({
    width: spacing.md,
    height: spacing.md,
    borderRadius: '50%',
    backgroundColor: fillColor,
    border: `2px solid ${strokeColor}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: zIndex.dropdown,
    cursor: 'pointer' as const
  }),

  /**
   * Dynamic pin center dot styling
   * Replaces: canvasUtilities.geoInteractive.dynamicPinCenterDot()
   */
  dynamicCenterDot: (): CSSProperties => ({
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: '50%',
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--foreground))'
  }),

  /**
   * Drawing point styling
   * Replaces: canvasUtilities.geoInteractive.drawingPoint()
   */
  drawingPoint: (index: number): CSSProperties => ({
    width: spacing.component.gap.md,
    height: spacing.component.gap.md,
    borderRadius: '50%',
    backgroundColor: colors.blue[500],
    border: `2px solid ${colors.blue[300]}`,
    zIndex: zIndex.banner + index,
    cursor: 'pointer' as const
  })
} as const;

// 🎯 LABEL STYLING - ENTERPRISE LABEL PATTERNS
/**
 * 🎯 LABELS: Professional label and text styling
 * Replaces: canvasUtilities.geoInteractive label functions
 */
const labelStyles: LabelStylesType = {
  /**
   * Radius label styling
   * Replaces: canvasUtilities.geoInteractive.radiusLabel()
   */
  radiusLabel: (): CSSProperties => ({
    fontSize: typography.fontSize.sm,
    fontWeight: 'bold' as const,
    color: colors.text.inverse,
    backgroundColor: colors.background.overlay,
    padding: `${spacing.xs} ${spacing.component.gap.sm}`,
    borderRadius: spacing.xs,
    whiteSpace: 'nowrap' as const,
    transform: 'translate(-50%, -50%)',
    zIndex: zIndex.sticky,
    pointerEvents: 'none' as const
  }),

  /**
   * Preview radius label styling
   * Replaces: canvasUtilities.geoInteractive.previewRadiusLabel()
   */
  previewLabel: (opacity: number): CSSProperties => ({
    fontSize: typography.fontSize.sm,
    fontWeight: 'bold' as const,
    color: colors.text.inverse,
    backgroundColor: withOpacity(GEO_COLORS.BLACK, opacity * 0.7),
    padding: `${spacing.xs} ${spacing.component.gap.sm}`,
    borderRadius: spacing.xs,
    whiteSpace: 'nowrap' as const,
    transform: 'translate(-50%, -50%)',
    zIndex: zIndex.sticky,
    opacity,
    pointerEvents: 'none' as const
  }),

  /**
   * Legend item styling
   * Replaces: canvasUtilities.geoInteractive.legendItem()
   */
  legendItem: (color: string): CSSProperties => ({
    borderColor: color,
    borderWidth: spacing.xs,
    borderStyle: 'solid',
    backgroundColor: `${color}40` // Add transparency
  })
} as const;

// 🏗️ LAYOUT STYLES - ENTERPRISE MAP LAYOUT
/**
 * 🎯 LAYOUT: InteractiveMap layout and container styling
 */
const layoutStyles = {
  /**
   * Main map container styling
   * Replaces: style={mapInteractionTokens.containers.fullscreen}
   */
  mapContainer: mapInteractionTokens.containers.fullscreen,

  /**
   * Animation delay utility
   * Replaces: style={layoutUtilities.dxf.animation.delay(0.2)}
   */
  animationDelay: (seconds: number): CSSProperties => ({
    animationDelay: `${seconds}s`
  }),

  /**
   * Polygon vertex styling
   * Replaces: canvasUtilities.geoInteractive.polygonVertex()
   */
  polygonVertex: (radius: number, pointColor: string, strokeColor: string): CSSProperties => ({
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    borderRadius: '50%',
    backgroundColor: pointColor,
    border: `2px solid ${strokeColor}`,
    cursor: 'pointer' as const,
    zIndex: GEO_CANVAS_ZINDEX.POLYGON_VERTEX
  })
} as const;

// 🎯 MAIN EXPORT - ENTERPRISE INTERACTIVE MAP STYLES
/**
 * 🗺️ ENTERPRISE INTERACTIVE MAP STYLES EXPORT
 *
 * Centralized styling object που αντικαθιστά όλα τα inline styles
 * στο InteractiveMap component.
 *
 * Usage:
 * ```typescript
 * import { interactiveMapStyles } from './InteractiveMap.styles';
 *
 * <div style={interactiveMapStyles.controlPoints.interaction(isSelected, shouldHighlight, isComplete)}>
 * <div style={interactiveMapStyles.markers.pin(radius, opacity)}>
 * <div style={interactiveMapStyles.layout.mapContainer}>
 * ```
 */
export const interactiveMapStyles: InteractiveMapStylesType = {
  controlPoints: controlPointStyles,
  accuracy: accuracyStyles,
  markers: markerStyles,
  labels: labelStyles,
  layout: layoutStyles
} as const;

// 🔒 TYPE EXPORTS - ENTERPRISE TYPE SAFETY
export type {
  InteractiveMapStylesType,
  ControlPointStylesType,
  AccuracyStylesType,
  MarkerStylesType,
  LabelStylesType
};

// 🎯 PANEL UTILITIES — re-exported from InteractiveMap.panel-utilities (SRP)
export {
  draggablePanelContainer,
  draggablePanelHandle,
  floorPlanOverlay,
  fixedSidebarPanel,
  draggablePanelTabNavigation,
  draggablePanelTabButton,
  draggablePanelProgressBar
} from './InteractiveMap.panel-utilities';

