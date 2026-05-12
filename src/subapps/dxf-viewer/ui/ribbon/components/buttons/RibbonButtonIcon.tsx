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
    default:
      return inlineSvg(size, <circle cx="12" cy="12" r="2" />);
  }
};
