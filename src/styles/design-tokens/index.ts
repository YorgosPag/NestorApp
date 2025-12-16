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
  designTokens as baseDesignTokens
} from '../design-tokens';

// ============================================================================
// SEMANTIC TOKENS - ALERT & STATUS LAYER
// ============================================================================

export {
  alertSeverityColors,
  statusSemanticColors,
  statusBadgeTokens,
  autoSaveStatusTokens
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
  mapZoomControlsTokens
} from './components/map-tokens';

export type {
  MapButtonVariant
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

// ============================================================================
// UNIFIED TOKEN OBJECT - SINGLE IMPORT CONVENIENCE
// ============================================================================

import {
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
  mapZoomControlsTokens
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

/**
 * 🎯 UNIFIED DESIGN TOKENS OBJECT
 *
 * Single object που περιέχει όλα τα design tokens του system.
 * Μπορεί να χρησιμοποιηθεί για programmatic access ή utility functions.
 */
export const unifiedDesignTokens = {
  // Base Design System
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
    zoomControls: mapZoomControlsTokens
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
export const colors = {
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
export type LegacyColors = typeof colors;
export type LegacyDashboardComponents = typeof dashboardComponents;
export type LegacyMapComponents = typeof mapComponents;
export type LegacyDialogComponents = typeof dialogComponents;
export type LegacyStatusIndicatorComponents = typeof statusIndicatorComponents;