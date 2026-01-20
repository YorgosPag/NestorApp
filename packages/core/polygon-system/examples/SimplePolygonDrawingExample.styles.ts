/**
 * SIMPLE POLYGON DRAWING EXAMPLE STYLES
 * Universal Polygon System - Enterprise Styling Module
 *
 * Centralized styling companion module for SimplePolygonDrawingExample.tsx
 * 🏢 ENTERPRISE: Self-contained styles with no external dependencies
 *
 * @module core/polygon-system/examples/SimplePolygonDrawingExample.styles
 */

import React from 'react';

// ============================================================================
// LOCAL DESIGN TOKENS (Self-contained for portability)
// ============================================================================

const colors = {
  blue: { 500: '#3b82f6', 600: '#2563eb' },
  green: { 500: '#22c55e', 600: '#16a34a' },
  red: { 500: '#ef4444', 600: '#dc2626' },
  gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 500: '#6b7280', 600: '#4b5563', 800: '#1f2937' },
  background: { primary: '#ffffff', secondary: '#f9fafb' },
  border: { secondary: '#e5e7eb' }
};

const spacing = { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 6: '1.5rem' };

// ============================================================================
// COMPONENT STYLES
// ============================================================================

const polygonDrawingComponents = {
  buttons: {
    base: { padding: spacing[2], borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s ease', border: 'none' },
    primary: { backgroundColor: colors.blue[500], color: 'white' },
    success: { backgroundColor: colors.green[500], color: 'white' },
    danger: { backgroundColor: colors.red[500], color: 'white' },
    secondary: { backgroundColor: colors.gray[200], color: colors.gray[800] },
    disabled: { backgroundColor: colors.gray[300], color: colors.gray[500], cursor: 'not-allowed' },
    marginRight: { marginRight: spacing[2] }
  },
  canvas: {
    element: { border: `1px solid ${colors.gray[300]}`, borderRadius: '0.5rem' },
    container: { display: 'flex', flexDirection: 'column' as const, gap: spacing[4] },
    drawing: { cursor: 'crosshair' },
    default: { cursor: 'default' }
  },
  statistics: {
    container: { display: 'flex', gap: spacing[4] },
    item: { display: 'flex', flexDirection: 'column' as const },
    card: { padding: spacing[4], backgroundColor: colors.gray[50], borderRadius: '0.5rem' },
    cardActive: { backgroundColor: colors.blue[500], color: 'white' },
    title: { fontSize: '1rem', fontWeight: 600 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing[2] },
    label: { fontSize: '0.75rem', color: colors.gray[500] },
    value: { fontSize: '1.25rem', fontWeight: 700 }
  },
  controls: {
    container: { display: 'flex', gap: spacing[2], flexWrap: 'wrap' as const },
    section: { display: 'flex', flexDirection: 'column' as const, gap: spacing[2] },
    group: { display: 'flex', gap: spacing[2], alignItems: 'center' },
    label: { fontSize: '0.875rem', color: colors.gray[600] },
    select: { padding: spacing[2], borderRadius: '0.5rem', border: `1px solid ${colors.gray[300]}` }
  },
  polygonList: {
    container: { display: 'flex', flexDirection: 'column' as const, gap: spacing[2] },
    item: { padding: spacing[2], backgroundColor: colors.gray[100], borderRadius: '0.25rem' },
    title: { fontSize: '1rem', fontWeight: 600, marginBottom: spacing[2] },
    scrollArea: { maxHeight: '200px', overflow: 'auto' },
    info: { display: 'flex', justifyContent: 'space-between' },
    primaryText: { fontWeight: 500 },
    secondaryText: { fontSize: '0.75rem', color: colors.gray[500] },
    deleteButton: { padding: spacing[1], color: colors.red[500], cursor: 'pointer' }
  },
  debug: {
    container: { padding: spacing[4], backgroundColor: colors.gray[100], borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' },
    summary: { cursor: 'pointer', padding: spacing[2] },
    content: { marginTop: spacing[2], whiteSpace: 'pre-wrap' as const }
  },
  instructions: {
    container: { padding: spacing[4], backgroundColor: colors.gray[50], borderRadius: '0.5rem' },
    title: { fontSize: '1rem', fontWeight: 600, marginBottom: spacing[2] },
    list: { listStyle: 'disc', paddingLeft: spacing[4] },
    listItem: { marginBottom: spacing[1] }
  },
  layout: {
    main: { display: 'flex', flexDirection: 'column' as const, gap: spacing[4] },
    row: { display: 'flex', gap: spacing[4] },
    container: { maxWidth: '1200px', margin: '0 auto', padding: spacing[4] },
    title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: spacing[4] }
  }
};

// ============================================================================
// DYNAMIC STYLE UTILITIES
// ============================================================================

export const getButtonStyles = (
  variant: 'primary' | 'success' | 'danger' | 'secondary' | 'disabled',
  marginRight = false
) => {
  const baseStyles = {
    ...polygonDrawingComponents.buttons.base,
    ...polygonDrawingComponents.buttons[variant === 'disabled' ? 'disabled' : variant]
  };
  return marginRight ? { ...baseStyles, ...polygonDrawingComponents.buttons.marginRight } : baseStyles;
};

export const getCanvasStyles = (isDrawing: boolean) => ({
  ...polygonDrawingComponents.canvas.element,
  cursor: isDrawing ? polygonDrawingComponents.canvas.drawing.cursor : polygonDrawingComponents.canvas.default.cursor
});

export const getStatisticsCardStyles = (isActive: boolean) => ({
  ...polygonDrawingComponents.statistics.card,
  ...(isActive ? polygonDrawingComponents.statistics.cardActive : {})
});

// ============================================================================
// HOVER HANDLERS
// ============================================================================

export const getButtonHoverHandlers = (variant: 'primary' | 'success' | 'danger' | 'secondary') => {
  const variantColors = {
    primary: colors.blue[600],
    success: colors.green[600],
    danger: colors.red[600],
    secondary: colors.gray[300]
  };
  const variantStyles = polygonDrawingComponents.buttons[variant];
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.backgroundColor = variantColors[variant];
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.backgroundColor = variantStyles.backgroundColor;
    },
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.blue[500]}`;
    },
    onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = 'none';
    }
  };
};

export const getSelectFocusHandlers = () => ({
  onFocus: (e: React.FocusEvent<HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = colors.blue[500];
    e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.blue[500]}33`;
  },
  onBlur: (e: React.FocusEvent<HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = colors.border.secondary;
    e.currentTarget.style.boxShadow = 'none';
  }
});

export const getPolygonItemHoverHandlers = () => ({
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.backgroundColor = colors.gray[200];
  },
  onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.backgroundColor = colors.background.primary;
  }
});

export const getDebugSummaryHoverHandlers = () => ({
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.backgroundColor = colors.gray[200];
  },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.backgroundColor = colors.background.secondary;
  }
});

// ============================================================================
// EXPORTED STYLES
// ============================================================================

export const polygonDrawingStyles = {
  container: polygonDrawingComponents.layout.container,
  title: polygonDrawingComponents.layout.title,
  controls: {
    section: polygonDrawingComponents.controls.section,
    group: polygonDrawingComponents.controls.group,
    label: polygonDrawingComponents.controls.label,
    select: polygonDrawingComponents.controls.select
  },
  buttons: {
    primary: polygonDrawingComponents.buttons.primary,
    success: polygonDrawingComponents.buttons.success,
    danger: polygonDrawingComponents.buttons.danger,
    secondary: polygonDrawingComponents.buttons.secondary,
    disabled: polygonDrawingComponents.buttons.disabled
  },
  instructions: {
    container: polygonDrawingComponents.instructions.container,
    title: polygonDrawingComponents.instructions.title,
    list: polygonDrawingComponents.instructions.list,
    listItem: polygonDrawingComponents.instructions.listItem
  },
  canvas: {
    container: polygonDrawingComponents.canvas.container,
    element: polygonDrawingComponents.canvas.element
  },
  statistics: {
    container: polygonDrawingComponents.statistics.container,
    title: polygonDrawingComponents.statistics.title,
    grid: polygonDrawingComponents.statistics.grid,
    card: polygonDrawingComponents.statistics.card,
    label: polygonDrawingComponents.statistics.label,
    value: polygonDrawingComponents.statistics.value
  },
  polygonList: {
    container: polygonDrawingComponents.polygonList.container,
    title: polygonDrawingComponents.polygonList.title,
    scrollArea: polygonDrawingComponents.polygonList.scrollArea,
    item: polygonDrawingComponents.polygonList.item,
    info: polygonDrawingComponents.polygonList.info,
    primaryText: polygonDrawingComponents.polygonList.primaryText,
    secondaryText: polygonDrawingComponents.polygonList.secondaryText,
    deleteButton: polygonDrawingComponents.polygonList.deleteButton
  },
  debug: {
    container: polygonDrawingComponents.debug.container,
    summary: polygonDrawingComponents.debug.summary,
    content: polygonDrawingComponents.debug.content
  }
} as const;

// ============================================================================
// BUTTON UTILITIES
// ============================================================================

export const getButtonVariantFromMode = (isDrawing: boolean): 'primary' | 'success' | 'danger' => {
  return isDrawing ? 'success' : 'primary';
};

export const getButtonPropsForAction = (
  action: 'start' | 'finish' | 'cancel' | 'export' | 'clear' | 'delete',
  isDisabled = false
) => {
  const variants: Record<string, 'primary' | 'success' | 'danger' | 'secondary'> = {
    start: 'primary',
    finish: 'success',
    cancel: 'danger',
    export: 'secondary',
    clear: 'danger',
    delete: 'danger'
  };
  const variant = isDisabled ? 'disabled' : variants[action];
  return {
    style: getButtonStyles(variant, action === 'finish'),
    ...(variant !== 'disabled' ? getButtonHoverHandlers(variants[action]) : {}),
    disabled: isDisabled
  };
};
