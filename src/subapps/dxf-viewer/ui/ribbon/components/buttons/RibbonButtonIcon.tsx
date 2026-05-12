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
  <polyline points="3,18 9,10 14,14 21,5" fill="none" />
);
const POLYGON_PATH = (
  <polygon points="12,3 21,9 18,20 6,20 3,9" fill="none" />
);
const RECTANGLE_PATH = (
  <rect x="4" y="6" width="16" height="12" rx="0.5" fill="none" />
);
const ELLIPSE_PATH = (
  <ellipse cx="12" cy="12" rx="9" ry="6" fill="none" />
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
    case 'circle-radius':
      return <CircleIcon variant="radius" className={className} />;
    case 'circle-diameter':
      return <CircleIcon variant="diameter" className={className} />;
    case 'circle-2p':
      return <CircleIcon variant="2point-diameter" className={className} />;
    case 'circle-3p':
      return <CircleIcon variant="3point" className={className} />;
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
    default:
      return inlineSvg(size, <circle cx="12" cy="12" r="2" />);
  }
};
