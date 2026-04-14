/**
 * ROLE: GEO-CANVAS PANEL UTILITIES
 *
 * Draggable panel, overlay, and sidebar styling utilities extracted
 * from InteractiveMap.styles.ts (SRP split — Google file size standards).
 *
 * @module InteractiveMap.panel-utilities
 */

import type { CSSProperties } from 'react';
import {
  colors,
  spacing,
  typography,
  shadows,
  zIndex
} from '../../../styles/design-tokens';
import { GEO_COLORS } from '../config/color-config';
import { GEO_CANVAS_ZINDEX, GEO_CANVAS_DIMENSIONS } from '../config';

/**
 * Styling for draggable panels in the geo interface
 */
export const draggablePanelContainer = (
  position: { x: number; y: number },
  isDragging: boolean,
  width?: number
): CSSProperties => ({
  position: 'absolute',
  left: `${position.x}px`,
  top: `${position.y}px`,
  width: width ? `${width}px` : 'auto',
  minWidth: GEO_CANVAS_DIMENSIONS.DRAGGABLE_PANEL_MIN_WIDTH,
  backgroundColor: 'hsl(var(--background))',
  border: `1px solid ${colors.border.primary}`,
  borderRadius: spacing.sm,
  boxShadow: isDragging ? shadows.xl : shadows.lg,
  zIndex: zIndex.dropdown,
  cursor: isDragging ? 'grabbing' : 'auto',
  userSelect: 'none' as const,
  backdropFilter: 'blur(4px)',
  transform: isDragging ? 'scale(1.02)' : 'scale(1)',
  transition: isDragging ? 'none' : 'all 0.2s ease-in-out'
});

/**
 * Styling for draggable panel handles
 */
export const draggablePanelHandle = (isDragging: boolean): CSSProperties => ({
  padding: `${spacing.sm} ${spacing.component.gap.md}`,
  backgroundColor: isDragging ? colors.gray[100] : colors.gray[50],
  borderBottom: `1px solid ${colors.border.secondary}`,
  borderTopLeftRadius: spacing.sm,
  borderTopRightRadius: spacing.sm,
  cursor: isDragging ? 'grabbing' : 'grab',
  userSelect: 'none' as const,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  color: colors.text.primary,
  transition: isDragging ? 'none' : 'background-color 0.2s ease-in-out'
});

/**
 * Styling for floor plan overlay containers
 */
export const floorPlanOverlay = (
  width: string = '100%',
  height: string = '100%',
  opacity: number = 0.8
): CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width,
  height,
  opacity,
  pointerEvents: 'none' as const,
  zIndex: zIndex.base,
  mixBlendMode: 'multiply' as const
});

/**
 * Styling for fixed sidebar panels
 */
export const fixedSidebarPanel = (side: 'left' | 'right', width: string): CSSProperties => ({
  position: 'fixed',
  top: 0,
  bottom: 0,
  [side]: 0,
  width,
  backgroundColor: 'hsl(var(--background))',
  borderLeft: side === 'right' ? `1px solid ${colors.border.secondary}` : 'none',
  borderRight: side === 'left' ? `1px solid ${colors.border.secondary}` : 'none',
  zIndex: GEO_CANVAS_ZINDEX.PANEL_COORDINATES,
  overflowY: 'auto' as const,
  backdropFilter: 'blur(8px)'
});

/**
 * Styling for tab navigation in draggable panels
 */
export const draggablePanelTabNavigation = (): CSSProperties => ({
  display: 'flex',
  borderBottom: `1px solid ${colors.border.secondary}`,
  backgroundColor: 'hsl(var(--muted))'
});

/**
 * Styling for tab buttons in draggable panels
 */
export const draggablePanelTabButton = (isActive: boolean): CSSProperties => ({
  flex: 1,
  padding: `${spacing.sm} ${spacing.md}`,
  fontSize: typography.fontSize.sm,
  fontWeight: isActive ? 600 : 400,
  color: isActive ? colors.blue[500] : colors.gray[500],
  backgroundColor: isActive ? 'hsl(var(--background))' : GEO_COLORS.TRANSPARENT,
  border: 'none',
  borderBottom: isActive ? `2px solid ${colors.blue[500]}` : '2px solid transparent',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out'
});

/**
 * Styling for progress bars in draggable panels
 */
export const draggablePanelProgressBar = (percentage: number): CSSProperties => ({
  width: '100%',
  height: spacing.xs,
  backgroundColor: colors.border.secondary,
  borderRadius: spacing.xs,
  overflow: 'hidden',
  position: 'relative'
});

export type {
  CSSProperties
};
