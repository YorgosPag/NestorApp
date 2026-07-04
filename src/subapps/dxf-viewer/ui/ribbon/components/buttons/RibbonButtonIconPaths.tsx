'use client';
/**
 * ADR-345 §8.1b — SVG path constants for RibbonButtonIcon (Draw + Modify tools).
 * Pure data: JSX element constants, no rendering logic.
 * Split from RibbonButtonIcon.tsx for SRP (N.7.1 Google file-size standard).
 * The View / Navigate / Measure groups live in `ribbon-icon-paths-view-measure.tsx`
 * (further SRP split); the shared `dot()` primitive is exported from HERE.
 */
import React from 'react';
import { ICON_CLICK_COLORS } from '../../../../config/color-config';
export function dot(cx: number, cy: number, color: string): React.ReactElement {
  return <circle cx={cx} cy={cy} r="2.5" fill={color} stroke="none" />;
}
// ── Draw tools ──────────────────────────────────────────────────────────────
export const POLYLINE_PATH = (
  <>
    <polyline points="3,18 9,10 14,14 21,5" fill="none" />
    {dot(3, 18, ICON_CLICK_COLORS.FIRST)}
    {dot(9, 10, ICON_CLICK_COLORS.SECOND)}
    {dot(14, 14, ICON_CLICK_COLORS.SECOND)}
    {dot(21, 5, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const POLYGON_PATH = (
  <>
    <polygon points="12,3 21,9 18,20 6,20 3,9" fill="none" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
    {dot(12, 3, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const RECTANGLE_PATH = (
  <>
    <rect x="4" y="6" width="16" height="12" rx="0.5" fill="none" />
    {dot(4, 6, ICON_CLICK_COLORS.FIRST)}
    {dot(20, 18, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const ELLIPSE_PATH = (
  <>
    <ellipse cx="12" cy="12" rx="9" ry="6" fill="none" />
    {dot(12, 12, ICON_CLICK_COLORS.FIRST)}
    {dot(21, 12, ICON_CLICK_COLORS.THIRD)}
  </>
);
// ADR-358 Phase 0: Stair placeholder icon — 4-step ascending profile.
export const STAIR_PATH = (
  <>
    <polyline points="4,20 4,16 8,16 8,12 12,12 12,8 16,8 16,4 20,4" fill="none" />
  </>
);

export const TEXT_PLACEHOLDER_PATH = (
  <>
    <polyline points="4 6 4 3 20 3 20 6" />
    <line x1="12" y1="3" x2="12" y2="11" />
    <line x1="4" y1="14" x2="20" y2="14" />
    <line x1="4" y1="17" x2="16" y2="17" />
    <line x1="4" y1="20" x2="12" y2="20" />
  </>
);
export const TEXT_CREATE_PATH = (
  <>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="9" y1="20" x2="15" y2="20" />
  </>
);
// ── Modify tools ─────────────────────────────────────────────────────────────
export const MOVE_PATH = (
  <>
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="9,7 12,4 15,7" fill="none" />
    <polyline points="9,17 12,20 15,17" fill="none" />
    <polyline points="7,9 4,12 7,15" fill="none" />
    <polyline points="17,9 20,12 17,15" fill="none" />
  </>
);
export const COPY_PATH = (
  <>
    <rect x="4" y="4" width="13" height="13" rx="1" fill="none" />
    <rect x="8" y="8" width="13" height="13" rx="1" fill="none" />
  </>
);
export const ROTATE_PATH = (
  <>
    <path d="M 5 12 A 7 7 0 1 1 12 19" fill="none" />
    <polyline points="2,9 5,12 8,9" fill="none" />
  </>
);
export const MIRROR_PATH = (
  <>
    <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2,2" />
    <polygon points="3,7 9,12 3,17" fill="none" />
    <polygon points="21,7 15,12 21,17" fill="none" />
  </>
);
export const SCALE_PATH = (
  <>
    <rect x="4" y="4" width="9" height="9" rx="0.5" fill="none" />
    <rect x="11" y="11" width="9" height="9" rx="0.5" strokeDasharray="2,2" fill="none" />
    <polyline points="14,7 20,7 20,13" fill="none" />
  </>
);
export const STRETCH_PATH = (
  <>
    <rect x="6" y="9" width="12" height="6" fill="none" strokeDasharray="2,2" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <polyline points="5,9 2,12 5,15" fill="none" />
    <polyline points="19,9 22,12 19,15" fill="none" />
  </>
);
// ── Modify tools (ADR-510 Φ4g) ────────────────────────────────────────────────
// Σταθερά «σώματα» γραμμών = currentColor (λευκά στο dark theme)· τα ΣΗΜΕΙΑ/ΤΜΗΜΑΤΑ
// όπου γίνεται η τροποποίηση = ICON_CLICK_COLORS.THIRD (κόκκινο accent) ώστε να
// ξεχωρίζουν· τα φαντάσματα της αρχικής (αφαιρούμενης) γωνίας = REFERENCE (γκρι).
// SSoT χρώματα: config/color-config → ICON_CLICK_COLORS (ίδια με τα draw-tool dots).
export const TRIM_PATH = (
  <>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="8" y1="6" x2="14" y2="18" />
    {/* το σημείο κοπής (τομή cutter × αντικειμένου) — εκεί «γίνεται» το ψαλίδισμα */}
    {dot(11, 12, ICON_CLICK_COLORS.THIRD)}
  </>
);
export const EXTEND_PATH = (
  <>
    <line x1="3" y1="12" x2="14" y2="12" strokeDasharray="2,2" />
    <line x1="14" y1="12" x2="21" y2="12" />
    {/* το βέλος = ο νέος στόχος όπου επεκτείνεται η γραμμή (σημείο αλλαγής) */}
    <polyline points="18,9 21,12 18,15" fill="none" stroke={ICON_CLICK_COLORS.THIRD} />
    <line x1="6" y1="5" x2="6" y2="19" />
  </>
);
export const OFFSET_PATH = (
  <>
    {/* ADR-510 Φ4g — μεγαλύτερη απόσταση (gap 12) ώστε το βελάκι να είναι ξεκάθαρο */}
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" strokeDasharray="2,2" />
    {/* double-arrow απόστασης = η μετατόπιση (σημείο/κατεύθυνση αλλαγής) */}
    <line x1="6" y1="8" x2="6" y2="16" stroke={ICON_CLICK_COLORS.THIRD} />
    <polyline points="4,10 6,8 8,10" fill="none" stroke={ICON_CLICK_COLORS.THIRD} />
    <polyline points="4,14 6,16 8,14" fill="none" stroke={ICON_CLICK_COLORS.THIRD} />
  </>
);
export const FILLET_PATH = (
  <>
    <line x1="4" y1="4" x2="4" y2="12" />
    {/* το στρογγυλεμένο τόξο = το αποτέλεσμα της συναρμογής (σημείο αλλαγής) */}
    <path d="M 4 12 Q 4 20 12 20" fill="none" stroke={ICON_CLICK_COLORS.THIRD} />
    <line x1="12" y1="20" x2="20" y2="20" />
    <line x1="4" y1="12" x2="4" y2="20" strokeDasharray="1,2" stroke={ICON_CLICK_COLORS.REFERENCE} />
    <line x1="4" y1="20" x2="12" y2="20" strokeDasharray="1,2" stroke={ICON_CLICK_COLORS.REFERENCE} />
  </>
);
export const CHAMFER_PATH = (
  <>
    <line x1="4" y1="4" x2="4" y2="14" />
    {/* η λοξή ακμή = το αποτέλεσμα της λοξοτομής (σημείο αλλαγής) */}
    <line x1="4" y1="14" x2="14" y2="20" stroke={ICON_CLICK_COLORS.THIRD} />
    <line x1="14" y1="20" x2="20" y2="20" />
    <line x1="4" y1="14" x2="4" y2="20" strokeDasharray="1,2" stroke={ICON_CLICK_COLORS.REFERENCE} />
    <line x1="4" y1="20" x2="14" y2="20" strokeDasharray="1,2" stroke={ICON_CLICK_COLORS.REFERENCE} />
  </>
);
export const ARRAY_RECT_PATH = (
  <>
    <rect x="3" y="3" width="5" height="5" fill="none" />
    <rect x="10" y="3" width="5" height="5" fill="none" />
    <rect x="17" y="3" width="5" height="5" fill="none" />
    <rect x="3" y="10" width="5" height="5" fill="none" />
    <rect x="10" y="10" width="5" height="5" fill="none" />
    <rect x="17" y="10" width="5" height="5" fill="none" />
    <rect x="3" y="17" width="5" height="5" fill="none" />
    <rect x="10" y="17" width="5" height="5" fill="none" />
    <rect x="17" y="17" width="5" height="5" fill="none" />
  </>
);
export const ARRAY_PATH_PATH = (
  <>
    <path d="M 3 18 Q 8 4 16 12 T 21 6" fill="none" />
    <circle cx="3" cy="18" r="1.5" />
    <circle cx="9" cy="9" r="1.5" />
    <circle cx="14" cy="13" r="1.5" />
    <circle cx="20" cy="7" r="1.5" />
  </>
);
export const ARRAY_POLAR_PATH = (
  <>
    <circle cx="12" cy="12" r="8" fill="none" strokeDasharray="2,2" />
    <circle cx="12" cy="4" r="1.5" />
    <circle cx="18" cy="8" r="1.5" />
    <circle cx="18" cy="16" r="1.5" />
    <circle cx="12" cy="20" r="1.5" />
    <circle cx="6" cy="16" r="1.5" />
    <circle cx="6" cy="8" r="1.5" />
  </>
);
export const EXPLODE_PATH = (
  <>
    <line x1="12" y1="3" x2="12" y2="9" />
    <line x1="12" y1="15" x2="12" y2="21" />
    <line x1="3" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="21" y2="12" />
    <line x1="5" y1="5" x2="9" y2="9" />
    <line x1="15" y1="15" x2="19" y2="19" />
    <line x1="5" y1="19" x2="9" y2="15" />
    <line x1="15" y1="9" x2="19" y2="5" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  </>
);
export const SELECT_PATH = (
  <>
    <path d="M 5 3 L 5 18 L 9 14 L 12 20 L 14 19 L 11 13 L 16 12 Z" fill="none" />
    {dot(5, 3, ICON_CLICK_COLORS.FIRST)}
  </>
);
export const GRIP_EDIT_PATH = (
  <>
    <rect x="5" y="8" width="14" height="9" rx="0.5" fill="none" />
    <rect x="3" y="6" width="4" height="4" fill="none" />
    <rect x="17" y="6" width="4" height="4" fill="none" />
    <rect x="3" y="15" width="4" height="4" fill="none" />
    {dot(19, 17, ICON_CLICK_COLORS.SECOND)}
  </>
);
