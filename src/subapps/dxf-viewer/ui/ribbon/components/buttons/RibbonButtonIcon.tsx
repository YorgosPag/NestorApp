'use client';

/**
 * ADR-345 §8.1b — Icon renderer for ribbon buttons.
 * Resolves a string `icon` token from RibbonCommand to a React node.
 * Reuses existing CAD icons in `toolbar/icons/`; falls back to inline
 * SVG primitives for tools that don't have a dedicated icon yet.
 */

import React from 'react';
import { LineIcon } from '../../../toolbar/icons/LineIcon';
import { CircleIcon } from '../../../toolbar/icons/CircleIcon';
import { ArcIcon } from '../../../toolbar/icons/ArcIcon';
import { ICON_CLICK_COLORS } from '../../../../config/color-config';

export type RibbonIconSize = 'large' | 'small';

interface RibbonButtonIconProps {
  icon?: string;
  size: RibbonIconSize;
}

const sizePx: Record<RibbonIconSize, number> = { large: 28, small: 16 };

function inlineSvg(
  size: RibbonIconSize,
  children: React.ReactNode,
): React.ReactElement {
  const px = sizePx[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const POLYLINE_PATH = (
  <>
    <polyline points="3,18 9,10 14,14 21,5" fill="none" />
    <circle cx="3" cy="18" r="2.5" fill={ICON_CLICK_COLORS.FIRST} stroke="none" />
    <circle cx="9" cy="10" r="2.5" fill={ICON_CLICK_COLORS.SECOND} stroke="none" />
    <circle cx="14" cy="14" r="2.5" fill={ICON_CLICK_COLORS.SECOND} stroke="none" />
    <circle cx="21" cy="5" r="2.5" fill={ICON_CLICK_COLORS.THIRD} stroke="none" />
  </>
);
const POLYGON_PATH = (
  <polygon points="12,3 21,9 18,20 6,20 3,9" fill="none" />
);
const RECTANGLE_PATH = (
  <>
    <rect x="4" y="6" width="16" height="12" rx="0.5" fill="none" />
    <circle cx="4" cy="6" r="2.5" fill={ICON_CLICK_COLORS.FIRST} stroke="none" />
    <circle cx="20" cy="18" r="2.5" fill={ICON_CLICK_COLORS.THIRD} stroke="none" />
  </>
);
const ELLIPSE_PATH = (
  <>
    <ellipse cx="12" cy="12" rx="9" ry="6" fill="none" />
    <circle cx="12" cy="12" r="2.5" fill={ICON_CLICK_COLORS.FIRST} stroke="none" />
    <circle cx="21" cy="12" r="2.5" fill={ICON_CLICK_COLORS.THIRD} stroke="none" />
  </>
);

const MOVE_PATH = (
  <>
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="9,7 12,4 15,7" fill="none" />
    <polyline points="9,17 12,20 15,17" fill="none" />
    <polyline points="7,9 4,12 7,15" fill="none" />
    <polyline points="17,9 20,12 17,15" fill="none" />
  </>
);
const COPY_PATH = (
  <>
    <rect x="4" y="4" width="13" height="13" rx="1" fill="none" />
    <rect x="8" y="8" width="13" height="13" rx="1" fill="none" />
  </>
);
const ROTATE_PATH = (
  <>
    <path d="M 5 12 A 7 7 0 1 1 12 19" fill="none" />
    <polyline points="2,9 5,12 8,9" fill="none" />
  </>
);
const MIRROR_PATH = (
  <>
    <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2,2" />
    <polygon points="3,7 9,12 3,17" fill="none" />
    <polygon points="21,7 15,12 21,17" fill="none" />
  </>
);
const SCALE_PATH = (
  <>
    <rect x="4" y="4" width="9" height="9" rx="0.5" fill="none" />
    <rect x="11" y="11" width="9" height="9" rx="0.5" strokeDasharray="2,2" fill="none" />
    <polyline points="14,7 20,7 20,13" fill="none" />
  </>
);
const STRETCH_PATH = (
  <>
    <rect x="6" y="9" width="12" height="6" fill="none" strokeDasharray="2,2" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <polyline points="5,9 2,12 5,15" fill="none" />
    <polyline points="19,9 22,12 19,15" fill="none" />
  </>
);
const TRIM_PATH = (
  <>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="8" y1="6" x2="14" y2="18" />
    <line x1="6" y1="14" x2="10" y2="10" />
    <line x1="6" y1="10" x2="10" y2="14" />
  </>
);
const EXTEND_PATH = (
  <>
    <line x1="3" y1="12" x2="14" y2="12" strokeDasharray="2,2" />
    <line x1="14" y1="12" x2="21" y2="12" />
    <polyline points="18,9 21,12 18,15" fill="none" />
    <line x1="6" y1="5" x2="6" y2="19" />
  </>
);
const OFFSET_PATH = (
  <>
    <line x1="3" y1="8" x2="21" y2="8" />
    <line x1="3" y1="16" x2="21" y2="16" strokeDasharray="2,2" />
    <line x1="6" y1="9" x2="6" y2="15" />
    <polyline points="4,11 6,9 8,11" fill="none" />
    <polyline points="4,13 6,15 8,13" fill="none" />
  </>
);
const FILLET_PATH = (
  <>
    <path d="M 4 4 L 4 12 Q 4 20 12 20 L 20 20" fill="none" />
    <line x1="4" y1="4" x2="4" y2="8" strokeDasharray="1,2" />
    <line x1="20" y1="20" x2="20" y2="16" strokeDasharray="1,2" />
  </>
);
const CHAMFER_PATH = (
  <>
    <polyline points="4,4 4,14 14,20 20,20" fill="none" />
    <line x1="4" y1="4" x2="4" y2="8" strokeDasharray="1,2" />
    <line x1="20" y1="20" x2="20" y2="16" strokeDasharray="1,2" />
  </>
);
const ARRAY_RECT_PATH = (
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
const ARRAY_PATH_PATH = (
  <>
    <path d="M 3 18 Q 8 4 16 12 T 21 6" fill="none" />
    <circle cx="3" cy="18" r="1.5" />
    <circle cx="9" cy="9" r="1.5" />
    <circle cx="14" cy="13" r="1.5" />
    <circle cx="20" cy="7" r="1.5" />
  </>
);
const ARRAY_POLAR_PATH = (
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
const PAN_PATH = (
  <>
    <path d="M 9 5 L 9 13 L 6 11 Q 4 10 5 13 L 8 18 Q 9 20 12 20 L 15 20 Q 18 20 18 17 L 18 11 Q 18 9 16 9 Q 14 9 14 11 L 14 9 Q 14 7 12 7 Q 10 7 10 9 L 10 5 Q 10 3 9 3 Q 8 3 8 5 Z" fill="none" />
  </>
);
const ZOOM_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
  </>
);
const ZOOM_IN_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <line x1="7" y1="10" x2="13" y2="10" />
    <line x1="10" y1="7" x2="10" y2="13" />
  </>
);
const ZOOM_OUT_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <line x1="7" y1="10" x2="13" y2="10" />
  </>
);
const ZOOM_WINDOW_PATH = (
  <>
    <rect x="3" y="3" width="14" height="10" fill="none" strokeDasharray="2,2" />
    <circle cx="14" cy="14" r="4" fill="none" />
    <line x1="17" y1="17" x2="21" y2="21" />
  </>
);
const ZOOM_EXTENTS_PATH = (
  <>
    <rect x="4" y="4" width="16" height="16" fill="none" strokeDasharray="2,2" />
    <polyline points="4,8 4,4 8,4" fill="none" />
    <polyline points="16,4 20,4 20,8" fill="none" />
    <polyline points="20,16 20,20 16,20" fill="none" />
    <polyline points="8,20 4,20 4,16" fill="none" />
    <rect x="9" y="9" width="6" height="6" fill="none" />
  </>
);
const ZOOM_PREV_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <polyline points="11,7 8,10 11,13" fill="none" />
  </>
);
const ZOOM_REALTIME_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <polyline points="8,8 8,12 12,12" fill="none" />
    <polyline points="12,8 8,12" fill="none" />
  </>
);
const ZOOM_RESET_PATH = (
  <>
    <circle cx="10" cy="10" r="6" fill="none" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
  </>
);
const VISUAL_STYLE_2D_PATH = (
  <>
    <rect x="4" y="6" width="16" height="12" fill="none" />
    <line x1="4" y1="6" x2="20" y2="18" />
    <line x1="20" y1="6" x2="4" y2="18" />
  </>
);
const VISUAL_STYLE_HIDDEN_PATH = (
  <>
    <polygon points="4,18 8,6 16,6 20,18" fill="none" />
    <line x1="8" y1="6" x2="20" y2="18" strokeDasharray="2,2" />
  </>
);
const VISUAL_STYLE_REALISTIC_PATH = (
  <>
    <circle cx="12" cy="12" r="8" fill="none" />
    <path d="M 6 9 Q 12 5 18 9" fill="none" />
    <path d="M 6 15 Q 12 19 18 15" fill="none" />
  </>
);
const VISUAL_STYLE_SHADED_PATH = (
  <>
    <polygon points="4,18 12,4 20,18" fill="currentColor" stroke="none" opacity="0.3" />
    <polygon points="4,18 12,4 20,18" fill="none" />
  </>
);
const VISUAL_STYLE_CONCEPTUAL_PATH = (
  <>
    <circle cx="12" cy="12" r="7" fill="none" strokeDasharray="3,2" />
    <circle cx="12" cy="12" r="3" fill="none" />
  </>
);
const VIEWPORT_SINGLE_PATH = (
  <rect x="4" y="5" width="16" height="14" fill="none" />
);
const VIEWPORT_TWO_PATH = (
  <>
    <rect x="4" y="5" width="7" height="14" fill="none" />
    <rect x="13" y="5" width="7" height="14" fill="none" />
  </>
);
const VIEWPORT_THREE_PATH = (
  <>
    <rect x="4" y="5" width="7" height="14" fill="none" />
    <rect x="13" y="5" width="7" height="6" fill="none" />
    <rect x="13" y="13" width="7" height="6" fill="none" />
  </>
);
const VIEWPORT_FOUR_PATH = (
  <>
    <rect x="4" y="5" width="7" height="6" fill="none" />
    <rect x="13" y="5" width="7" height="6" fill="none" />
    <rect x="4" y="13" width="7" height="6" fill="none" />
    <rect x="13" y="13" width="7" height="6" fill="none" />
  </>
);
const TEXT_PLACEHOLDER_PATH = (
  <>
    <polyline points="4 6 4 3 20 3 20 6" />
    <line x1="12" y1="3" x2="12" y2="11" />
    <line x1="4" y1="14" x2="20" y2="14" />
    <line x1="4" y1="17" x2="16" y2="17" />
    <line x1="4" y1="20" x2="12" y2="20" />
  </>
);
const TEXT_CREATE_PATH = (
  <>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="9" y1="20" x2="15" y2="20" />
  </>
);
const EXPLODE_PATH = (
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

export const RibbonButtonIcon: React.FC<RibbonButtonIconProps> = ({
  icon,
  size,
}) => {
  const className = size === 'large' ? 'dxf-ribbon-btn-icon-large' : 'dxf-ribbon-btn-icon-small';

  switch (icon) {
    case 'line':
      return <LineIcon variant="normal" className={className} />;
    case 'line-perpendicular':
      return <LineIcon variant="perpendicular" className={className} />;
    case 'line-parallel':
      return <LineIcon variant="parallel" className={className} />;
    case 'circle-radius':
      return <CircleIcon variant="radius" className={className} />;
    case 'circle-diameter':
      return <CircleIcon variant="diameter" className={className} />;
    case 'circle-2p':
      return <CircleIcon variant="2point-diameter" className={className} />;
    case 'circle-3p':
      return <CircleIcon variant="3point" className={className} />;
    case 'circle-chord-sagitta':
      return <CircleIcon variant="chord-sagitta" className={className} />;
    case 'circle-2p-radius':
      return <CircleIcon variant="2point-radius" className={className} />;
    case 'circle-best-fit':
      return <CircleIcon variant="best-fit" className={className} />;
    case 'circle-ttt':
      return <CircleIcon variant="ttt" className={className} />;
    case 'arc-3p':
      return <ArcIcon variant="3point" className={className} />;
    case 'arc-cse':
      return <ArcIcon variant="center-start-end" className={className} />;
    case 'arc-sce':
      return <ArcIcon variant="start-center-end" className={className} />;
    case 'polyline':
      return inlineSvg(size, POLYLINE_PATH);
    case 'polygon':
      return inlineSvg(size, POLYGON_PATH);
    case 'rectangle':
      return inlineSvg(size, RECTANGLE_PATH);
    case 'ellipse':
      return inlineSvg(size, ELLIPSE_PATH);
    case 'move':
      return inlineSvg(size, MOVE_PATH);
    case 'copy':
      return inlineSvg(size, COPY_PATH);
    case 'rotate':
      return inlineSvg(size, ROTATE_PATH);
    case 'mirror':
      return inlineSvg(size, MIRROR_PATH);
    case 'scale':
      return inlineSvg(size, SCALE_PATH);
    case 'stretch':
      return inlineSvg(size, STRETCH_PATH);
    case 'trim':
      return inlineSvg(size, TRIM_PATH);
    case 'extend':
      return inlineSvg(size, EXTEND_PATH);
    case 'offset':
      return inlineSvg(size, OFFSET_PATH);
    case 'fillet':
      return inlineSvg(size, FILLET_PATH);
    case 'chamfer':
      return inlineSvg(size, CHAMFER_PATH);
    case 'array-rect':
      return inlineSvg(size, ARRAY_RECT_PATH);
    case 'array-path':
      return inlineSvg(size, ARRAY_PATH_PATH);
    case 'array-polar':
      return inlineSvg(size, ARRAY_POLAR_PATH);
    case 'explode':
      return inlineSvg(size, EXPLODE_PATH);
    case 'pan':
      return inlineSvg(size, PAN_PATH);
    case 'zoom':
      return inlineSvg(size, ZOOM_PATH);
    case 'zoom-in':
      return inlineSvg(size, ZOOM_IN_PATH);
    case 'zoom-out':
      return inlineSvg(size, ZOOM_OUT_PATH);
    case 'zoom-window':
      return inlineSvg(size, ZOOM_WINDOW_PATH);
    case 'zoom-extents':
      return inlineSvg(size, ZOOM_EXTENTS_PATH);
    case 'zoom-previous':
      return inlineSvg(size, ZOOM_PREV_PATH);
    case 'zoom-realtime':
      return inlineSvg(size, ZOOM_REALTIME_PATH);
    case 'zoom-reset':
      return inlineSvg(size, ZOOM_RESET_PATH);
    case 'visual-2d':
      return inlineSvg(size, VISUAL_STYLE_2D_PATH);
    case 'visual-hidden':
      return inlineSvg(size, VISUAL_STYLE_HIDDEN_PATH);
    case 'visual-realistic':
      return inlineSvg(size, VISUAL_STYLE_REALISTIC_PATH);
    case 'visual-shaded':
      return inlineSvg(size, VISUAL_STYLE_SHADED_PATH);
    case 'visual-conceptual':
      return inlineSvg(size, VISUAL_STYLE_CONCEPTUAL_PATH);
    case 'viewport-single':
      return inlineSvg(size, VIEWPORT_SINGLE_PATH);
    case 'viewport-two':
      return inlineSvg(size, VIEWPORT_TWO_PATH);
    case 'viewport-three':
      return inlineSvg(size, VIEWPORT_THREE_PATH);
    case 'viewport-four':
      return inlineSvg(size, VIEWPORT_FOUR_PATH);
    case 'text-placeholder':
      return inlineSvg(size, TEXT_PLACEHOLDER_PATH);
    case 'text-create':
      return inlineSvg(size, TEXT_CREATE_PATH);
    default:
      return inlineSvg(size, <circle cx="12" cy="12" r="2" />);
  }
};
