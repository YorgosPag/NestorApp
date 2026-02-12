/**
 * ADR-176: Toolbar Responsive Configuration
 *
 * Defines which tools appear in the mobile primary bar vs overflow menu,
 * and which are disabled on non-desktop viewports.
 *
 * @since 2026-02-12
 */

import type { ToolType } from './types';

/** Tools shown in the primary (always visible) mobile toolbar row */
export const TOOLBAR_MOBILE_PRIMARY: readonly ToolType[] = [
  'select',
  'pan',
  'zoom-in',
  'zoom-out',
  'zoom-extents',
  'layering',
] as const;

/** Tools disabled on mobile — require precision mouse interaction */
export const TOOLBAR_MOBILE_DISABLED: readonly ToolType[] = [
  'line',
  'line-perpendicular',
  'line-parallel',
  'rectangle',
  'circle',
  'circle-diameter',
  'circle-2p-diameter',
  'circle-3p',
  'circle-chord-sagitta',
  'circle-2p-radius',
  'circle-best-fit',
  'circle-ttt',
  'arc',
  'arc-3p',
  'arc-cse',
  'arc-sce',
  'polyline',
  'polygon',
  'ellipse',
  'move',
  'copy',
  'grip-edit',
  'measure-distance',
  'measure-distance-continuous',
  'measure-area',
  'measure-angle',
  'measure-angle-line-arc',
  'measure-angle-two-arcs',
  'measure-angle-measuregeom',
  'measure-angle-constraint',
  'measure-radius',
  'measure-perimeter',
] as const;

/** Check if a tool is in the mobile primary bar */
export function isMobilePrimaryTool(toolId: ToolType): boolean {
  return (TOOLBAR_MOBILE_PRIMARY as readonly string[]).includes(toolId);
}

/** Check if a tool is disabled on mobile */
export function isMobileDisabledTool(toolId: ToolType): boolean {
  return (TOOLBAR_MOBILE_DISABLED as readonly string[]).includes(toolId);
}
