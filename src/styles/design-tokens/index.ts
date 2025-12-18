/**
 * 🏢 UNIFIED DESIGN TOKENS - ENTERPRISE CONSOLIDATION
 *
 * @description Κεντρικοποιημένο design system που ενοποιεί όλα τα tokens
 * από διάφορα modules σε έναν single source of truth
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-16
 * @version 2.0.0 - Enterprise Consolidation με Modular Architecture
 */

// ============================================================================
// CORE TOKENS - BASE DESIGN SYSTEM
// ============================================================================

// Re-export existing base tokens from the main design-tokens file
export {
  borderRadius,
  shadows,
  animation,
  zIndex,
  gridPatterns,
  componentSizes,
  breakpoints,
  interactiveStates,
  designTokens as baseDesignTokens
} from '../design-tokens';

// Additional re-exports for backward compatibility
export {
  animation as animations
} from '../design-tokens';

// ============================================================================
// SEMANTIC TOKENS - ALERT & STATUS LAYER
// ============================================================================

export {
  alertSeverityColors,
  statusSemanticColors,
  statusBadgeTokens,
  autoSaveStatusTokens,
  getStatusBadgeVariant
} from './semantic/alert-tokens';

export type {
  AlertSeverity,
  StatusSemantic,
  StatusBadgeVariant,
  AutoSaveStatus
} from './semantic/alert-tokens';

// ============================================================================
// COMPONENT TOKENS - SPECIALIZED COMPONENTS
// ============================================================================

// Dashboard Components
export {
  dashboardLayoutTokens,
  metricsCardTokens,
  alertsListTokens,
  eventsListTokens,
  alertConfigTokens,
  loadingStateTokens
} from './components/dashboard-tokens';

export type {
  MetricsTrendVariant
} from './components/dashboard-tokens';

// Map Components
export {
  mapContainerTokens,
  mapHeaderTokens,
  mapControlSectionTokens,
  mapButtonTokens,
  mapSidebarTokens,
  polygonListTokens,
  mapDrawingToolsTokens,
  mapCoordinateTokens,
  mapZoomControlsTokens,
  mapControlPointTokens,
  mapInteractionTokens,
  mapOverlayTokens,
  getMapButtonStyle
} from './components/map-tokens';

export type {
  MapButtonVariant,
  ControlPointState,
  MapCursorState
} from './components/map-tokens';

// Dialog Components
export {
  modalTokens,
  formTokens,
  formErrorStateTokens,
  formLoadingStateTokens,
  formEmptyStateTokens,
  infoCardTokens,
  dialogButtonTokens,
  stepWizardTokens
} from './components/dialog-tokens';

export type {
  DialogButtonVariant,
  StepState
} from './components/dialog-tokens';

// Portal Components
export {
  portalComponents,
  photoPreviewComponents,
  getPortalZIndex,
  getDropdownStyles,
  getPhotoContainerStyles,
  getPortalAnimations
} from './components/portal-tokens';

export type {
  PortalZIndexLevel,
  DropdownVariant,
  PhotoContainerState,
  PortalPlacement
} from './components/portal-tokens';

// Floating System Components - Enterprise Unified System
export {
  FLOATING_LAYERS,
  FLOATING_POSITIONING,
  FLOATING_DIMENSIONS,
  FLOATING_BEHAVIORS,
  FloatingStyleUtils,
  FLOATING_SYSTEM_TOKENS,
  // Specific component tokens
  PerformanceDashboardTokens,
  ModalTokens,
  // Legacy compatibility exports
  PERFORMANCE_DASHBOARD_Z_INDEX,
  MODAL_Z_INDEX,
  OVERLAY_Z_INDEX
} from './components/floating-system-tokens';

export type {
  FloatingLayer,
  FloatingPosition,
  FloatingDimension,
  FloatingBehavior,
  FloatingConfig
} from './components/floating-system-tokens';

// ============================================================================
// NEW ENTERPRISE MODULES - PERFORMANCE & CHART COMPONENTS
// ============================================================================

// Performance Components
export {
  performanceComponents,
  virtualizationUtilities,
  // Legacy compatibility
  designTokenPerformanceComponents,
  designTokenVirtualizationUtilities,
  type PerformanceComponents,
  type VirtualizationUtilities,
  type VirtualizedTableComponents,
  type MetricsComponents,
  type PerformanceStates
} from './components/performance-tokens';

// Chart Components
export {
  chartComponents,
  chartUtilities,
  // Legacy compatibility
  designTokenChartComponents,
  designTokenChartUtilities,
  type ChartComponents,
  type ChartUtilities,
  type ChartLegendComponents,
  type ChartTooltipComponents,
  type ChartContainerComponents,
  type ChartColors,
  type ChartStatusColor
} from './components/chart-tokens';

// Base Tokens (imported from dedicated modules)
export {
  colors,
  semanticColors,
  getColor,
  getSemanticColor,
  // Legacy compatibility
  designTokenColors,
  designTokenSemanticColors,
  type ColorPalette,
  type SemanticColorPalette,
  type ColorValue,
  type ColorPath
} from './base/colors';

export {
  typography,
  typographyPresets,
  getTypography,
  getTypographyStyles,
  // Legacy compatibility
  designTokenTypography,
  designTokenTypographyPresets,
  type TypographyScale,
  type TypographyPresets,
  type FontSize,
  type FontWeight,
  type LineHeight,
  type LetterSpacing
} from './base/typography';

export {
  spacing,
  spacingPresets,
  responsiveSpacing,
  getSpacing,
  getComponentSpacing,
  getSpacingStyles,
  // Legacy compatibility
  designTokenSpacing,
  designTokenSpacingPresets,
  type SpacingScale,
  type SpacingPresets,
  type SpacingSize,
  type ComponentSpacingSize
} from './base/spacing';

// Layout Utilities
export {
  layoutUtilities,
  responsiveLayoutUtilities,
  layoutPresets,
  // Legacy compatibility
  designTokenLayoutUtilities,
  designTokenResponsiveLayoutUtilities,
  designTokenLayoutPresets,
  type LayoutUtilities,
  type ResponsiveLayoutUtilities,
  type LayoutPresets,
  type FlexDirection,
  type JustifyContent,
  type AlignItems
} from './utilities/layout-utilities';

// Canvas Utilities (NEW: Massive 1,850 lines extracted!)
export {
  canvasUtilities,
  canvasHelpers,
  // Legacy compatibility
  designTokenCanvasUtilities,
  designTokenCanvasHelpers,
  type CanvasUtilities,
  type CanvasHelpers,
  type CanvasPosition,
  type CanvasBounds
} from './utilities/canvas-utilities';

// ============================================================================
// UNIFIED TOKEN OBJECT - SINGLE IMPORT CONVENIENCE
// ============================================================================

import {
  borderRadius,
  shadows,
  animation,
  zIndex,
  gridPatterns,
  componentSizes,
  breakpoints,
  interactiveStates
} from '../design-tokens';
import {
  alertSeverityColors,
  statusSemanticColors,
  statusBadgeTokens,
  autoSaveStatusTokens
} from './semantic/alert-tokens';
import {
  dashboardLayoutTokens,
  metricsCardTokens,
  alertsListTokens,
  eventsListTokens,
  alertConfigTokens,
  loadingStateTokens
} from './components/dashboard-tokens';
import {
  mapContainerTokens,
  mapHeaderTokens,
  mapControlSectionTokens,
  mapButtonTokens,
  mapSidebarTokens,
  polygonListTokens,
  mapDrawingToolsTokens,
  mapCoordinateTokens,
  mapZoomControlsTokens,
  mapControlPointTokens,
  mapInteractionTokens,
  mapOverlayTokens
} from './components/map-tokens';
import {
  modalTokens,
  formTokens,
  formErrorStateTokens,
  formLoadingStateTokens,
  formEmptyStateTokens,
  infoCardTokens,
  dialogButtonTokens,
  stepWizardTokens
} from './components/dialog-tokens';
import {
  portalComponents,
  photoPreviewComponents
} from './components/portal-tokens';
import {
  performanceComponents,
  virtualizationUtilities
} from './components/performance-tokens';
import {
  chartComponents,
  chartUtilities
} from './components/chart-tokens';
import { colors } from './base/colors';
import { typography } from './base/typography';
import { spacing } from './base/spacing';
import {
  layoutUtilities,
  responsiveLayoutUtilities,
  layoutPresets
} from './utilities/layout-utilities';

/**
 * 🎯 UNIFIED DESIGN TOKENS OBJECT
 *
 * Single object που περιέχει όλα τα design tokens του system.
 * Μπορεί να χρησιμοποιηθεί για programmatic access ή utility functions.
 */
export const unifiedDesignTokens = {
  // Base Design System (NEW: From dedicated modules)
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
  semanticColors,
  zIndex,
  gridPatterns,
  componentSizes,
  breakpoints,
  interactiveStates,

  // Layout System (NEW: Extracted utilities)
  layout: {
    utilities: layoutUtilities,
    responsive: responsiveLayoutUtilities,
    presets: layoutPresets
  },

  // Canvas System (NEW: Massive extraction - 1,850 lines!)
  canvas: {
    utilities: canvasUtilities,
    helpers: canvasHelpers
  },

  // Performance System (NEW: Enterprise performance components)
  performance: {
    components: performanceComponents,
    virtualization: virtualizationUtilities
  },

  // Chart System (NEW: Consolidated chart components)
  charts: {
    components: chartComponents,
    utilities: chartUtilities
  },

  // Extended Semantic Layer
  alert: {
    severity: alertSeverityColors,
    status: statusSemanticColors,
    badges: statusBadgeTokens,
    autoSave: autoSaveStatusTokens
  },

  // Component Tokens
  dashboard: {
    layout: dashboardLayoutTokens,
    metricsCard: metricsCardTokens,
    alertsList: alertsListTokens,
    eventsList: eventsListTokens,
    alertConfig: alertConfigTokens,
    loading: loadingStateTokens
  },

  map: {
    container: mapContainerTokens,
    header: mapHeaderTokens,
    controls: mapControlSectionTokens,
    buttons: mapButtonTokens,
    sidebar: mapSidebarTokens,
    polygonList: polygonListTokens,
    drawingTools: mapDrawingToolsTokens,
    coordinates: mapCoordinateTokens,
    zoomControls: mapZoomControlsTokens,
    controlPoints: mapControlPointTokens,
    interaction: mapInteractionTokens,
    overlays: mapOverlayTokens
  },

  dialog: {
    modal: modalTokens,
    form: formTokens,
    formError: formErrorStateTokens,
    formLoading: formLoadingStateTokens,
    formEmpty: formEmptyStateTokens,
    infoCard: infoCardTokens,
    buttons: dialogButtonTokens,
    stepWizard: stepWizardTokens
  },

  portal: {
    components: portalComponents,
    photoPreview: photoPreviewComponents
  }
} as const;

// ============================================================================
// BACKWARD COMPATIBILITY LAYER
// ============================================================================

/**
 * 🔄 BACKWARD COMPATIBILITY EXPORTS
 *
 * Αυτά τα exports διατηρούν compatibility με existing code που χρησιμοποιεί
 * τα παλιά geo-canvas design tokens.
 */

// Legacy colors export - maps to new semantic structure
export const legacyColors = {
  // Primary brand colors (από base tokens)
  primary: semanticColors.propertyStatus,

  // Severity colors (νέα structure)
  severity: alertSeverityColors,

  // Semantic colors (enhanced)
  semantic: statusSemanticColors,

  // Existing semantic mapping
  status: semanticColors.status,
  propertyStatus: semanticColors.propertyStatus,
  buildingStatus: semanticColors.buildingStatus
} as const;

// Legacy dashboard components - mapped to new tokens
export const dashboardComponents = {
  metricsCard: metricsCardTokens,
  alertsList: alertsListTokens,
  eventsList: eventsListTokens,
  alertConfig: alertConfigTokens,
  loadingState: loadingStateTokens,
  dashboardLayout: dashboardLayoutTokens
} as const;

// Configuration components (συμβατότητα με alert engine)
export const configurationComponents = {
  ...dashboardComponents,
  // Ειδικά sections για configuration interface
  configurationCard: {
    base: {
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      padding: '1rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    selected: {
      backgroundColor: '#eff6ff',
      borderColor: '#3b82f6',
    },
    statusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '9999px',
      display: 'inline-block',
      marginRight: '0.5rem',
    }
  },
  layout: {
    container: { padding: '2rem' },
    header: { marginBottom: '2rem' },
    title: { fontSize: '1.5rem', fontWeight: '700' },
    subtitle: { fontSize: '1rem', color: '#6b7280' },
    contentGrid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' },
    sidebar: { padding: '1.5rem' }
  },
  buttons: {
    primary: modalTokens,
    secondary: modalTokens,
    small: modalTokens
  }
};

// Legacy map components - mapped to new tokens
export const mapComponents = {
  container: mapContainerTokens,
  header: mapHeaderTokens,
  controlSection: mapControlSectionTokens,
  mapContainer: mapContainerTokens,
  sidebar: mapSidebarTokens,
  polygonList: polygonListTokens
} as const;

// Legacy dialog components - mapped to new tokens
export const dialogComponents = {
  modal: modalTokens,
  form: formTokens,
  infoCard: infoCardTokens,
  buttons: dialogButtonTokens,
  steps: stepWizardTokens
} as const;

// Legacy status indicator components - mapped to new tokens
export const statusIndicatorComponents = autoSaveStatusTokens;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get alert severity colors by severity level
 */
export const getAlertSeverityColors = (severity: keyof typeof alertSeverityColors) => {
  return alertSeverityColors[severity];
};

/**
 * Get status semantic colors by status type
 */
export const getStatusSemanticColors = (status: keyof typeof statusSemanticColors) => {
  return statusSemanticColors[status];
};

/**
 * Get map button variant styles
 */
export const getMapButtonVariant = (variant: keyof typeof mapButtonTokens.variants) => {
  return {
    ...mapButtonTokens.base,
    ...mapButtonTokens.variants[variant]
  };
};

/**
 * Get dialog button variant styles
 */
export const getDialogButtonVariant = (variant: keyof typeof dialogButtonTokens.variants) => {
  return {
    ...dialogButtonTokens.base,
    ...dialogButtonTokens.variants[variant]
  };
};

// ============================================================================
// TYPE SAFETY EXPORTS
// ============================================================================

export type UnifiedDesignTokens = typeof unifiedDesignTokens;
export type LegacyColors = typeof legacyColors;
export type LegacyDashboardComponents = typeof dashboardComponents;
export type LegacyMapComponents = typeof mapComponents;
export type LegacyDialogComponents = typeof dialogComponents;
export type LegacyStatusIndicatorComponents = typeof statusIndicatorComponents;