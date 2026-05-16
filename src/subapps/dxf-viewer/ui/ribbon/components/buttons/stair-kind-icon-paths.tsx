/**
 * ADR-358 Phase 7b1 — Per-kind stair SVG icon paths (G12, Q18).
 * Split from RibbonButtonIconPaths.tsx to keep that file under 500 lines.
 */

import { STAIR_PATH } from './RibbonButtonIconPaths';

// STRAIGHT: single linear flight (alias of STAIR_PATH).
export const STAIR_PATH_STRAIGHT = STAIR_PATH;

// SPIRAL: top-down view of a spiral stair — center post + 6 radial spokes.
export const STAIR_PATH_SPIRAL = (
  <>
    <circle cx="12" cy="12" r="9" fill="none" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <line x1="12" y1="12" x2="21" y2="12" />
    <line x1="12" y1="12" x2="17.5" y2="4.5" />
    <line x1="12" y1="12" x2="6.5" y2="4.5" />
    <line x1="12" y1="12" x2="3" y2="12" />
    <line x1="12" y1="12" x2="6.5" y2="19.5" />
    <line x1="12" y1="12" x2="17.5" y2="19.5" />
  </>
);

// U-SHAPE: two flights with a landing in between (plan view).
export const STAIR_PATH_USHAPE = (
  <>
    <polyline points="4,20 4,14 11,14" fill="none" />
    <line x1="4" y1="17" x2="11" y2="17" />
    <line x1="7" y1="14" x2="7" y2="20" />
    <rect x="11" y="10" width="6" height="8" fill="none" />
    <polyline points="20,4 20,10 13,10" fill="none" />
    <line x1="20" y1="7" x2="13" y2="7" />
    <line x1="17" y1="4" x2="17" y2="10" />
  </>
);
