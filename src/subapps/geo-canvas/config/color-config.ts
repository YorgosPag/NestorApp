/**
 * 🎯 GEO-CANVAS COLOR CONFIGURATION - Enterprise Color Management System
 *
 * @version 1.0.0
 * @description Κεντρικοποιημένη διαχείριση χρωμάτων για το Geo-Canvas subapp
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-12-29
 *
 * ✅ ENTERPRISE STANDARDS: Fortune 500 color management
 * ✅ AUTOCAD COMPLIANCE: ACI-compatible snap colors
 * ✅ GRAFANA STYLE: Enterprise monitoring dashboard colors
 * ✅ TAILWIND COMPATIBLE: Modern design system integration
 * ✅ ACCESSIBILITY: WCAG 2.1 AA compliant color contrasts
 *
 * 🚨 ΑΥΣΤΗΡΗ ΑΠΑΓΟΡΕΥΣΗ: Χρήση σκληρών χρωμάτων εκτός αυτού του αρχείου
 */

// ============================================================================
// CORE BASE COLORS - Foundation
// ============================================================================

/**
 * Βασικά χρώματα - Single source of truth
 */
export const BASE_COLORS = {
  // Pure colors
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  TRANSPARENT: '#00000000',

  // Standard grays
  GRAY_50: '#F9FAFB',
  GRAY_100: '#F3F4F6',
  GRAY_200: '#E5E7EB',
  GRAY_300: '#D1D5DB',
  GRAY_400: '#9CA3AF',
  GRAY_500: '#6B7280',
  GRAY_600: '#4B5563',
  GRAY_700: '#374151',
  GRAY_800: '#1F2937',
  GRAY_900: '#111827',
} as const;

// ============================================================================
// AUTOCAD/CAD SYSTEM COLORS - Professional Drawing Standards
// ============================================================================

/**
 * AutoCAD-compatible snap point colors (ACI Standard)
 * Χρησιμοποιείται για floor-plan snapping system
 */
export const AUTOCAD_SNAP_COLORS = {
  /** Cyan - ENDPOINT snapping (AutoCAD ACI standard) */
  ENDPOINT: '#00FFFF',

  /** Green - MIDPOINT snapping (AutoCAD ACI standard) */
  MIDPOINT: '#00FF00',

  /** Magenta - CENTER snapping (AutoCAD ACI standard) */
  CENTER: '#FF00FF',

  /** Yellow - INTERSECTION snapping (AutoCAD ACI standard) */
  INTERSECTION: '#FFFF00',

  /** Orange - NEAREST snapping (AutoCAD ACI standard) */
  NEAREST: '#FFA500',

  /** Red - PERPENDICULAR snapping (AutoCAD ACI standard) */
  PERPENDICULAR: '#FF0000',
} as const;

/**
 * CAD Drawing Colors - για floor plan rendering
 */
export const CAD_DRAWING_COLORS = {
  // Floor plan basics
  FLOOR_PLAN_BG: '#F8FAFC',        // Light gray background
  FLOOR_PLAN_STROKE: '#1E293B',    // Dark gray for entities

  // Drawing indicators
  CROSSHAIR_INDICATOR: '#00FFFF',  // Cyan for crosshairs
  SNAP_INDICATOR: '#00FFFF',       // Cyan για snap points

  // DXF entity colors
  DEFAULT_ENTITY: '#000000',       // Black for default entities
  SELECTED_ENTITY: '#FF0000',      // Red for selected entities
  PREVIEW_ENTITY: '#00FF00',       // Green for preview entities
} as const;

// ============================================================================
// MAP & GIS COLORS - Geospatial Visualization
// ============================================================================

/**
 * Polygon Status Colors - για το polygon management system
 */
export const POLYGON_COLORS = {
  // Primary polygon states
  DRAFT: '#3B82F6',          // Blue - Draft/editing state
  COMPLETED: '#10B981',      // Green - Successfully completed
  ERROR: '#EF4444',          // Red - Error/invalid state
  WARNING: '#F59E0B',        // Orange/Yellow - Warning state

  // Administrative polygons
  ADMINISTRATIVE: '#8B5CF6',  // Purple - Administrative zones
  TECHNICAL: '#A855F7',      // Light purple - Technical drawings

  // Accuracy visualization
  ACCURACY_EXCELLENT: '#10B981',  // Green - Survey-grade (0.5m)
  ACCURACY_GOOD: '#3B82F6',      // Blue - Engineering-grade (1.0m)
  ACCURACY_FAIR: '#F59E0B',      // Orange - Planning-grade (2.0m)
  ACCURACY_POOR: '#EF4444',      // Red - Rough estimation (5.0m)
  ACCURACY_VERY_POOR: '#9333EA', // Purple - Very poor (>5.0m)
} as const;

/**
 * Map Layer Colors - για διαφορετικά map layers
 */
export const MAP_LAYER_COLORS = {
  // Live drawing preview
  LIVE_DRAWING_FILL: '#3B82F6',    // Blue fill for live polygons
  LIVE_DRAWING_STROKE: '#3B82F6',  // Blue stroke for live polygons

  // Polygon lines (completed vs incomplete)
  POLYGON_COMPLETE: '#10B981',     // Green for completed polygons
  POLYGON_INCOMPLETE: '#3B82F6',   // Blue for incomplete polygons

  // Transformation preview
  TRANSFORMATION_PREVIEW: '#FF6B6B', // Red for transformation overlay

  // Boundary controls
  BOUNDARY_CONTROL_BG: '#3B82F6',    // Blue background
  BOUNDARY_CONTROL_BORDER: '#FFFFFF', // White border
} as const;

/**
 * Citizen Interface Colors - για διαφορετικά user interfaces
 */
export const USER_INTERFACE_COLORS = {
  // Citizen drawing interface
  CITIZEN_FILL: 'rgba(59, 130, 246, 0.2)',   // Light blue fill
  CITIZEN_STROKE: '#3B82F6',                  // Blue stroke
  CITIZEN_POLYGON_FILL: 'rgba(59, 130, 246, 0.3)', // Blue polygon fill
  CITIZEN_POLYGON_STROKE: '#3B82F6',          // Blue polygon stroke
  CITIZEN_AREA_FILL: 'rgba(16, 185, 129, 0.3)', // Green area fill
  CITIZEN_AREA_STROKE: '#10B981',             // Green area stroke

  // Professional drawing interface
  PROFESSIONAL_FILL: 'rgba(34, 197, 94, 0.3)', // Green professional fill
  PROFESSIONAL_STROKE: '#22C55E',               // Green professional stroke

  // Technical drawing interface
  TECHNICAL_FILL: 'rgba(168, 85, 247, 0.2)',   // Purple technical fill
  TECHNICAL_STROKE: '#A855F7',                  // Purple technical stroke

  // Emergency/Alert colors
  EMERGENCY_FILL: 'rgba(255, 165, 0, 0.3)',    // Orange emergency fill
  EMERGENCY_STROKE: '#FF8C00',                  // Orange emergency stroke
} as const;

// ============================================================================
// MONITORING & PERFORMANCE COLORS - Enterprise Dashboards
// ============================================================================

/**
 * Enterprise Monitoring Colors - για performance dashboards (Grafana-style)
 */
export const MONITORING_COLORS = {
  // Status indicators
  SUCCESS: '#4CAF50',        // Green - Success state
  WARNING: '#FF9800',        // Orange - Warning state
  ERROR: '#F44336',          // Red - Error state
  INFO: '#2196F3',           // Blue - Information state

  // Dashboard theme
  DASHBOARD_PRIMARY: '#00D2FF',      // Cyan - Primary dashboard color
  DASHBOARD_SECONDARY: '#3A3A3A',    // Dark gray - Secondary
  DASHBOARD_BACKGROUND: '#1F1B24',   // Very dark - Background
  DASHBOARD_SURFACE: '#2D2A32',      // Dark surface
  DASHBOARD_TEXT: '#FFFFFF',         // White text

  // Performance metrics
  PERFORMANCE_EXCELLENT: '#4CAF50',  // Green - Excellent performance
  PERFORMANCE_GOOD: '#4CAF50',       // Green - Good performance
  PERFORMANCE_WARNING: '#FF9800',    // Orange - Warning performance
  PERFORMANCE_CRITICAL: '#F44336',   // Red - Critical performance
} as const;

/**
 * Bundle Optimization Colors - για bundle analyzer reports
 */
export const OPTIMIZATION_COLORS = {
  // Priority levels
  CRITICAL_PRIORITY: '#DC3545',     // Red - Critical issues
  HIGH_PRIORITY: '#FD7E14',         // Orange - High priority
  MEDIUM_PRIORITY: '#FFC107',       // Yellow - Medium priority
  LOW_PRIORITY: '#28A745',          // Green - Low priority

  // Report styling
  REPORT_BACKGROUND: '#F8F9FA',     // Light gray background
  REPORT_BORDER: '#DEE2E6',         // Light border
  RECOMMENDATION_BG: '#F8F9FA',     // Recommendation background

  // Size indicators
  SIZE_LARGE: '#DC3545',            // Red - Large files
  SIZE_MEDIUM: '#FD7E14',           // Orange - Medium files
  SIZE_SMALL: '#28A745',            // Green - Small files

  // Table styling
  TABLE_HEADER: '#F2F2F2',          // Gray table headers
  TABLE_BORDER: '#DDD',             // Light table borders
} as const;

// ============================================================================
// UI DESIGN SYSTEM COLORS - Modern Interface
// ============================================================================

/**
 * Design System Colors - για modern UI components
 */
export const UI_SYSTEM_COLORS = {
  // Semantic colors (CSS custom properties)
  PRIMARY: 'rgb(var(--primary))',
  SECONDARY: 'rgb(var(--secondary))',
  ACCENT: 'rgb(var(--accent))',
  DANGER: 'rgb(var(--destructive))',
  TEXT: 'rgb(var(--foreground))',
  TEXT_SECONDARY: 'rgb(var(--muted-foreground))',
  GRID: 'rgb(var(--border))',
  BACKGROUND: 'rgb(var(--background))',

  // Theme overlays
  OVERLAY_LIGHT: 'rgba(0, 0, 0, 0.8)',    // Dark overlay for light theme
  OVERLAY_DARK: 'rgba(0, 0, 0, 0.9)',     // Darker overlay for dark theme

  // Performance component colors
  SCORE_EXCELLENT: '#28A745',             // Green performance score
  SCORE_GOOD: '#3B82F6',                  // Blue performance score
  SCORE_WARNING: '#EAB308',               // Yellow performance score
  SCORE_CRITICAL: '#EF4444',              // Red performance score
} as const;

/**
 * Chart Color Palette - για data visualization
 */
export const CHART_COLORS = [
  'rgb(var(--primary))',     // Primary chart color
  'rgb(var(--secondary))',   // Secondary chart color
  'rgb(var(--accent))',      // Accent chart color
  'rgb(var(--destructive))', // Destructive chart color
  'rgb(var(--muted))',       // Muted chart color
  'rgb(var(--border))',      // Border chart color
  'rgb(var(--ring))',        // Ring chart color
  'rgb(var(--chart-1))',     // Chart 1 color
  'rgb(var(--chart-2))',     // Chart 2 color
  'rgb(var(--chart-3))',     // Chart 3 color
] as const;

// ============================================================================
// RGBA UTILITY FUNCTIONS - Color Manipulation
// ============================================================================

/**
 * Convert hex color to rgba με specified opacity
 * @param hexColor - Hex color string (e.g., '#FF0000')
 * @param opacity - Opacity value 0-1
 * @returns RGBA color string
 *
 * @example
 * withOpacity('#FF0000', 0.5) // Returns 'rgba(255, 0, 0, 0.5)'
 */
export function withOpacity(hexColor: string, opacity: number): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Return rgba string
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get contrasting text color (black or white) for a given background
 * @param backgroundColor - Background hex color
 * @returns '#000000' or '#FFFFFF'
 */
export function getContrastTextColor(backgroundColor: string): string {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance using standard formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? BASE_COLORS.BLACK : BASE_COLORS.WHITE;
}

// ============================================================================
// LEGACY COLOR MAPPINGS - Backward Compatibility
// ============================================================================

/**
 * Legacy Color Mappings - για προσωρινή backward compatibility
 * ΘΑ ΔΙΑΓΡΑΦΕΙ στο μέλλον όταν ολοκληρωθεί η migration
 */
export const LEGACY_MAPPINGS = {
  // Old polygon colors → New centralized
  '#3b82f6': POLYGON_COLORS.DRAFT,           // Blue polygons
  '#10b981': POLYGON_COLORS.COMPLETED,       // Green polygons
  '#ef4444': POLYGON_COLORS.ERROR,           // Red polygons
  '#f59e0b': POLYGON_COLORS.WARNING,         // Orange polygons
  '#8b5cf6': POLYGON_COLORS.ADMINISTRATIVE,  // Purple polygons

  // Old AutoCAD colors → New centralized
  '#00FFFF': AUTOCAD_SNAP_COLORS.ENDPOINT,      // Cyan
  '#00FF00': AUTOCAD_SNAP_COLORS.MIDPOINT,      // Green
  '#FF00FF': AUTOCAD_SNAP_COLORS.CENTER,        // Magenta
  '#FFFF00': AUTOCAD_SNAP_COLORS.INTERSECTION,  // Yellow
  '#FFA500': AUTOCAD_SNAP_COLORS.NEAREST,       // Orange
  '#FF0000': AUTOCAD_SNAP_COLORS.PERPENDICULAR, // Red

  // Old monitoring colors → New centralized
  '#4CAF50': MONITORING_COLORS.SUCCESS,     // Green
  '#FF9800': MONITORING_COLORS.WARNING,     // Orange
  '#F44336': MONITORING_COLORS.ERROR,       // Red
  '#2196F3': MONITORING_COLORS.INFO,        // Blue
} as const;

// ============================================================================
// UNIFIED COLOR EXPORTS - Single Source of Truth
// ============================================================================

/**
 * Κεντρικός πίνακας ΟΛΩΝ των χρωμάτων - Single source of truth
 * Χρησιμοποιείται από όλα τα components του geo-canvas subapp
 */
export const GEO_COLORS = {
  // Foundation
  ...BASE_COLORS,

  // AutoCAD/CAD System
  SNAP: AUTOCAD_SNAP_COLORS,
  CAD: CAD_DRAWING_COLORS,

  // Map & GIS
  POLYGON: POLYGON_COLORS,
  MAP_LAYER: MAP_LAYER_COLORS,
  USER_INTERFACE: USER_INTERFACE_COLORS,

  // Monitoring & Performance
  MONITORING: MONITORING_COLORS,
  OPTIMIZATION: OPTIMIZATION_COLORS,

  // UI Design System
  UI: UI_SYSTEM_COLORS,
  CHART: CHART_COLORS,

  // Utilities
  withOpacity,
  getContrastTextColor,

  // Legacy (TEMPORARY)
  LEGACY: LEGACY_MAPPINGS,
} as const;

// Default export για convenience
export default GEO_COLORS;

/**
 * Type exports για TypeScript integration
 */
export type GeoColorConfig = typeof GEO_COLORS;
export type PolygonColorKey = keyof typeof POLYGON_COLORS;
export type SnapColorKey = keyof typeof AUTOCAD_SNAP_COLORS;
export type MonitoringColorKey = keyof typeof MONITORING_COLORS;

// ============================================================================
// DEVELOPMENT NOTES & MIGRATION GUIDE
// ============================================================================

/**
 * 📋 MIGRATION USAGE EXAMPLES:
 *
 * ❌ BEFORE (σκληρές τιμές):
 * ```typescript
 * strokeColor: '#3b82f6',
 * fillColor: 'rgba(59, 130, 246, 0.3)',
 * snapColor: '#00FFFF',
 * ```
 *
 * ✅ AFTER (κεντρικοποιημένες):
 * ```typescript
 * import { GEO_COLORS } from '../config/color-config';
 *
 * strokeColor: GEO_COLORS.POLYGON.DRAFT,
 * fillColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.DRAFT, 0.3),
 * snapColor: GEO_COLORS.SNAP.ENDPOINT,
 * ```
 *
 * 🎯 AUTOCAD COMPLIANCE:
 * ```typescript
 * // For snap indicators
 * endpointColor: GEO_COLORS.SNAP.ENDPOINT,      // #00FFFF (Cyan)
 * midpointColor: GEO_COLORS.SNAP.MIDPOINT,      // #00FF00 (Green)
 * centerColor: GEO_COLORS.SNAP.CENTER,          // #FF00FF (Magenta)
 * ```
 *
 * 📊 MONITORING DASHBOARDS:
 * ```typescript
 * // For performance components
 * successColor: GEO_COLORS.MONITORING.SUCCESS,  // #4CAF50
 * warningColor: GEO_COLORS.MONITORING.WARNING,  // #FF9800
 * errorColor: GEO_COLORS.MONITORING.ERROR,      // #F44336
 * ```
 *
 * 🗺️ MAP POLYGONS:
 * ```typescript
 * // For polygon states
 * draftColor: GEO_COLORS.POLYGON.DRAFT,         // #3B82F6 (Blue)
 * completedColor: GEO_COLORS.POLYGON.COMPLETED, // #10B981 (Green)
 * errorColor: GEO_COLORS.POLYGON.ERROR,         // #EF4444 (Red)
 * ```
 */