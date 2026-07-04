'use client';
/**
 * ADR-345 §8.1b — SVG path constants for RibbonButtonIcon (View / Navigate /
 * Measure groups). Pure data: JSX element constants, no rendering logic.
 * Split from RibbonButtonIconPaths.tsx for SRP (N.7.1 Google file-size standard):
 * that file keeps Draw + Modify tools; this one owns Navigate · Visual Styles ·
 * Viewports · Measure Angle · Guides · Measure Distance · Measure Area.
 */
import React from 'react';
import { ICON_CLICK_COLORS } from '../../../../config/color-config';
import { dot } from './RibbonButtonIconPaths';
// ── Navigate ──────────────────────────────────────────────────────────────────
export const PAN_PATH = (
  <>
    <path d="M 9 5 L 9 13 L 6 11 Q 4 10 5 13 L 8 18 Q 9 20 12 20 L 15 20 Q 18 20 18 17 L 18 11 Q 18 9 16 9 Q 14 9 14 11 L 14 9 Q 14 7 12 7 Q 10 7 10 9 L 10 5 Q 10 3 9 3 Q 8 3 8 5 Z" fill="none" />
    <line x1="10" y1="9" x2="10" y2="13" />
    <line x1="14" y1="9" x2="14" y2="13" />
    {dot(9, 3, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const ZOOM_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
  </>
);
export const ZOOM_IN_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <line x1="7" y1="10" x2="13" y2="10" />
    <line x1="10" y1="7" x2="10" y2="13" />
    {dot(10, 10, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const ZOOM_OUT_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <line x1="7" y1="10" x2="13" y2="10" />
    {dot(10, 10, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const ZOOM_WINDOW_PATH = (
  <>
    <rect x="3" y="3" width="14" height="10" fill="none" strokeDasharray="2,2" />
    <circle cx="14" cy="14" r="4" fill="none" />
    <line x1="17" y1="17" x2="21" y2="21" />
    {dot(3, 3, ICON_CLICK_COLORS.FIRST)}
    {dot(17, 13, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const ZOOM_EXTENTS_PATH = (
  <>
    <rect x="4" y="4" width="16" height="16" fill="none" strokeDasharray="2,2" />
    <polyline points="4,9 4,4 9,4" fill="none" />
    <polyline points="15,4 20,4 20,9" fill="none" />
    <polyline points="20,15 20,20 15,20" fill="none" />
    <polyline points="9,20 4,20 4,15" fill="none" />
    <rect x="8" y="8" width="8" height="8" fill="none" />
    {dot(4, 4, ICON_CLICK_COLORS.FIRST)}
    {dot(20, 4, ICON_CLICK_COLORS.FIRST)}
    {dot(20, 20, ICON_CLICK_COLORS.FIRST)}
    {dot(4, 20, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const ZOOM_PREV_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <line x1="8" y1="10" x2="13" y2="10" />
    <polyline points="10,8 8,10 10,12" fill="none" />
    {dot(8, 10, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const ZOOM_REALTIME_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <line x1="10" y1="7.5" x2="10" y2="12.5" />
    <polyline points="8.5,9.5 10,7.5 11.5,9.5" fill="none" />
    <polyline points="8.5,10.5 10,12.5 11.5,10.5" fill="none" />
    {dot(10, 7.5, ICON_CLICK_COLORS.FIRST)}
    {dot(10, 12.5, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const ZOOM_RESET_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <circle cx="10" cy="10" r="2.5" fill="none" />
    <circle cx="10" cy="10" r="1.2" fill={ICON_CLICK_COLORS.FIRST} stroke="none" />
  </>
);
// ── Visual Styles ─────────────────────────────────────────────────────────────
export const VISUAL_STYLE_2D_PATH = (
  <>
    <rect x="4" y="6" width="16" height="12" fill="none" />
    <line x1="4" y1="6" x2="20" y2="18" />
    <line x1="20" y1="6" x2="4" y2="18" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const VISUAL_STYLE_HIDDEN_PATH = (
  <>
    <polygon points="4,18 8,6 16,6 20,18" fill="none" />
    <line x1="8" y1="6" x2="20" y2="18" strokeDasharray="2,2" />
    {dot(14, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const VISUAL_STYLE_REALISTIC_PATH = (
  <>
    <circle cx="12" cy="12" r="8" fill="none" />
    <path d="M 6 9 Q 12 5 18 9" fill="none" />
    <path d="M 6 15 Q 12 19 18 15" fill="none" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const VISUAL_STYLE_SHADED_PATH = (
  <>
    <polygon points="4,18 12,4 20,18" fill="currentColor" stroke="none" opacity="0.3" />
    <polygon points="4,18 12,4 20,18" fill="none" />
    {dot(12, 4, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const VISUAL_STYLE_CONCEPTUAL_PATH = (
  <>
    <circle cx="12" cy="12" r="7" fill="none" strokeDasharray="3,2" />
    <circle cx="12" cy="12" r="3" fill="none" />
  </>
);
// ── Viewports ─────────────────────────────────────────────────────────────────
export const VIEWPORT_SINGLE_PATH = (
  <>
    <rect x="4" y="5" width="16" height="14" fill="none" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const VIEWPORT_TWO_PATH = (
  <>
    <rect x="4" y="5" width="7" height="14" fill="none" />
    <rect x="13" y="5" width="7" height="14" fill="none" />
    {dot(7.5, 12, ICON_CLICK_COLORS.FIRST)}
    {dot(16.5, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const VIEWPORT_THREE_PATH = (
  <>
    <rect x="4" y="5" width="7" height="14" fill="none" />
    <rect x="13" y="5" width="7" height="6" fill="none" />
    <rect x="13" y="13" width="7" height="6" fill="none" />
    {dot(7.5, 12, ICON_CLICK_COLORS.FIRST)}
    {dot(16.5, 8, ICON_CLICK_COLORS.FIRST)}
    {dot(16.5, 16, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const VIEWPORT_FOUR_PATH = (
  <>
    <rect x="4" y="5" width="7" height="6" fill="none" />
    <rect x="13" y="5" width="7" height="6" fill="none" />
    <rect x="4" y="13" width="7" height="6" fill="none" />
    <rect x="13" y="13" width="7" height="6" fill="none" />
    {dot(7.5, 8, ICON_CLICK_COLORS.FIRST)}
    {dot(16.5, 8, ICON_CLICK_COLORS.FIRST)}
    {dot(7.5, 16, ICON_CLICK_COLORS.FIRST)}
    {dot(16.5, 16, ICON_CLICK_COLORS.FIRST)}
  </>
);
// ── Measure Angle ─────────────────────────────────────────────────────────────
export const MEASURE_ANGLE_PATH = (
  <>
    <line x1="5" y1="19" x2="5" y2="4" />
    <line x1="5" y1="19" x2="20" y2="4" />
    <path d="M 5 14 A 5 5 0 0 1 10 11" fill="none" />
    {dot(5, 4, ICON_CLICK_COLORS.FIRST)}
    {dot(5, 19, ICON_CLICK_COLORS.SECOND)}
    {dot(20, 4, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const MEASURE_ANGLE_LINE_ARC_PATH = (
  <>
    <line x1="5" y1="19" x2="5" y2="4" />
    <circle cx="14" cy="10" r="4" fill="none" />
    <path d="M 5 14 A 5 5 0 0 1 10 11" fill="none" />
    {dot(5, 4, ICON_CLICK_COLORS.FIRST)}
    {dot(5, 19, ICON_CLICK_COLORS.SECOND)}
    {dot(14, 10, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const MEASURE_ANGLE_TWO_ARCS_PATH = (
  <>
    <path d="M 3 12 A 5 5 0 0 1 12 3" fill="none" />
    <path d="M 12 21 A 5 5 0 0 1 21 12" fill="none" />
    <path d="M 7 12 A 3 3 0 0 1 12 7" fill="none" />
    {dot(7, 7, ICON_CLICK_COLORS.FIRST)}
    {dot(12, 12, ICON_CLICK_COLORS.SECOND)}
    {dot(17, 17, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const MEASURE_ANGLE_MEASUREGEOM_PATH = (
  <>
    <line x1="5" y1="19" x2="5" y2="4" />
    <line x1="5" y1="19" x2="20" y2="4" />
    <path d="M 5 14 A 5 5 0 0 1 10 11" fill="none" />
    <rect x="14" y="14" width="6" height="4" rx="1" fill="none" />
    <line x1="16" y1="15" x2="18" y2="15" />
    <line x1="16" y1="17" x2="18" y2="17" />
    {dot(5, 4, ICON_CLICK_COLORS.FIRST)}
    {dot(5, 19, ICON_CLICK_COLORS.SECOND)}
    {dot(20, 4, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const MEASURE_ANGLE_CONSTRAINT_PATH = (
  <>
    <line x1="5" y1="19" x2="5" y2="4" />
    <line x1="5" y1="19" x2="20" y2="4" />
    <path d="M 5 14 A 5 5 0 0 1 10 11" fill="none" />
    <rect x="16" y="8" width="3" height="2" rx="0.5" fill="none" />
    <line x1="17.5" y1="8" x2="17.5" y2="6" />
    <path d="M 17 6 A 1 1 0 0 0 18 6" fill="none" />
    {dot(5, 4, ICON_CLICK_COLORS.FIRST)}
    {dot(5, 19, ICON_CLICK_COLORS.SECOND)}
    {dot(20, 4, ICON_CLICK_COLORS.THIRD)}
  </>
);
// ── Guides ────────────────────────────────────────────────────────────────────
export const GUIDE_X_PATH = (
  <>
    <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3,2" />
    <line x1="3" y1="12" x2="21" y2="12" opacity="0.35" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const GUIDE_Z_PATH = (
  <>
    <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="3,2" />
    <line x1="12" y1="3" x2="12" y2="21" opacity="0.35" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const GUIDE_XZ_PATH = (
  <>
    <line x1="4" y1="20" x2="20" y2="4" strokeDasharray="3,2" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
    {dot(4, 20, ICON_CLICK_COLORS.SECOND)}
  </>
);
export const GUIDE_PARALLEL_PATH = (
  <>
    <line x1="3" y1="8" x2="21" y2="8" strokeDasharray="3,2" />
    <line x1="3" y1="16" x2="21" y2="16" strokeDasharray="3,2" />
    {dot(12, 8, ICON_CLICK_COLORS.FIRST)}
    {dot(12, 16, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const GUIDE_PERPENDICULAR_PATH = (
  <>
    <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="3,2" />
    <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="3,2" />
    {dot(12, 3, ICON_CLICK_COLORS.FIRST)}
    {dot(12, 12, ICON_CLICK_COLORS.SECOND)}
    {dot(21, 12, ICON_CLICK_COLORS.THIRD)}
  </>
);
// ── Measure Distance ──────────────────────────────────────────────────────────
export const MEASURE_DISTANCE_PATH = (
  <>
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="9" x2="4" y2="15" />
    <line x1="20" y1="9" x2="20" y2="15" />
    {dot(4, 12, ICON_CLICK_COLORS.FIRST)}
    {dot(20, 12, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const MEASURE_DISTANCE_CONTINUOUS_PATH = (
  <>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="9" x2="3" y2="15" />
    <line x1="12" y1="9" x2="12" y2="15" />
    <line x1="21" y1="9" x2="21" y2="15" />
    {dot(3, 12, ICON_CLICK_COLORS.FIRST)}
    {dot(12, 12, ICON_CLICK_COLORS.SECOND)}
    {dot(21, 12, ICON_CLICK_COLORS.THIRD)}
  </>
);
// ── Measure Area ──────────────────────────────────────────────────────────────
export const MEASURE_AREA_PATH = (
  <>
    <polygon points="12,3 20,8 17,19 7,19 4,8" fill="none" />
    {dot(12, 3, ICON_CLICK_COLORS.FIRST)}
    {dot(12, 12, ICON_CLICK_COLORS.SECOND)}
  </>
);
export const MEASURE_AREA_AUTO_PATH = (
  <>
    <polygon points="12,3 20,8 17,19 7,19 4,8" fill="none" />
    <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2,1" />
    {dot(12, 3, ICON_CLICK_COLORS.FIRST)}
  </>
);
