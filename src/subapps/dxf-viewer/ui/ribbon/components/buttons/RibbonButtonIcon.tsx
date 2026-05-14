'use client';

/**
 * ADR-345 §8.1b — Icon renderer for ribbon buttons.
 * Resolves a string `icon` token from RibbonCommand to a React node.
 * Path constants live in RibbonButtonIconPaths.tsx (data file, SRP split).
 */

import React from 'react';
import { Undo, Redo, Trash2, PanelRight, Eye, BarChart3, Grid3X3, Crop, Scissors, Lasso, FileImage, Upload, FolderUp, Wand2, Download, Crosshair, FlaskConical, Activity, Sparkles, Layers, Maximize2, Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import { LineIcon } from '../../../toolbar/icons/LineIcon';
import { CircleIcon } from '../../../toolbar/icons/CircleIcon';
import { ArcIcon } from '../../../toolbar/icons/ArcIcon';
import {
  POLYLINE_PATH, POLYGON_PATH, RECTANGLE_PATH, ELLIPSE_PATH,
  TEXT_PLACEHOLDER_PATH, TEXT_CREATE_PATH,
  MOVE_PATH, COPY_PATH, ROTATE_PATH, MIRROR_PATH, SCALE_PATH,
  STRETCH_PATH, TRIM_PATH, EXTEND_PATH, OFFSET_PATH,
  FILLET_PATH, CHAMFER_PATH,
  ARRAY_RECT_PATH, ARRAY_PATH_PATH, ARRAY_POLAR_PATH,
  EXPLODE_PATH, SELECT_PATH, GRIP_EDIT_PATH,
  PAN_PATH, ZOOM_PATH, ZOOM_IN_PATH, ZOOM_OUT_PATH,
  ZOOM_WINDOW_PATH, ZOOM_EXTENTS_PATH, ZOOM_PREV_PATH,
  ZOOM_REALTIME_PATH, ZOOM_RESET_PATH,
  VISUAL_STYLE_2D_PATH, VISUAL_STYLE_HIDDEN_PATH,
  VISUAL_STYLE_REALISTIC_PATH, VISUAL_STYLE_SHADED_PATH,
  VISUAL_STYLE_CONCEPTUAL_PATH,
  VIEWPORT_SINGLE_PATH, VIEWPORT_TWO_PATH,
  VIEWPORT_THREE_PATH, VIEWPORT_FOUR_PATH,
  MEASURE_ANGLE_PATH, MEASURE_ANGLE_LINE_ARC_PATH,
  MEASURE_ANGLE_TWO_ARCS_PATH, MEASURE_ANGLE_MEASUREGEOM_PATH,
  MEASURE_ANGLE_CONSTRAINT_PATH,
  GUIDE_X_PATH, GUIDE_Z_PATH, GUIDE_XZ_PATH,
  GUIDE_PARALLEL_PATH, GUIDE_PERPENDICULAR_PATH,
  MEASURE_DISTANCE_PATH, MEASURE_DISTANCE_CONTINUOUS_PATH,
  MEASURE_AREA_PATH, MEASURE_AREA_AUTO_PATH,
} from './RibbonButtonIconPaths';

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

export const RibbonButtonIcon: React.FC<RibbonButtonIconProps> = ({ icon, size }) => {
  const className = size === 'large' ? 'dxf-ribbon-btn-icon-large' : 'dxf-ribbon-btn-icon-small';
  switch (icon) {
    case 'line': return <LineIcon variant="normal" className={className} />;
    case 'line-perpendicular': return <LineIcon variant="perpendicular" className={className} />;
    case 'line-parallel': return <LineIcon variant="parallel" className={className} />;
    case 'circle-radius': return <CircleIcon variant="radius" className={className} />;
    case 'circle-diameter': return <CircleIcon variant="diameter" className={className} />;
    case 'circle-2p': return <CircleIcon variant="2point-diameter" className={className} />;
    case 'circle-3p': return <CircleIcon variant="3point" className={className} />;
    case 'circle-chord-sagitta': return <CircleIcon variant="chord-sagitta" className={className} />;
    case 'circle-2p-radius': return <CircleIcon variant="2point-radius" className={className} />;
    case 'circle-best-fit': return <CircleIcon variant="best-fit" className={className} />;
    case 'circle-ttt': return <CircleIcon variant="ttt" className={className} />;
    case 'arc-3p': return <ArcIcon variant="3point" className={className} />;
    case 'arc-cse': return <ArcIcon variant="center-start-end" className={className} />;
    case 'arc-sce': return <ArcIcon variant="start-center-end" className={className} />;
    case 'polyline': return inlineSvg(size, POLYLINE_PATH);
    case 'polygon': return inlineSvg(size, POLYGON_PATH);
    case 'rectangle': return inlineSvg(size, RECTANGLE_PATH);
    case 'ellipse': return inlineSvg(size, ELLIPSE_PATH);
    case 'text-placeholder': return inlineSvg(size, TEXT_PLACEHOLDER_PATH);
    case 'text-create': return inlineSvg(size, TEXT_CREATE_PATH);
    case 'text-bold': return <Bold width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'text-italic': return <Italic width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'text-underline': return <Underline width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'text-strikethrough': return <Strikethrough width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'text-overline': return inlineSvg(size, (
      <>
        <line x1="4" y1="4" x2="20" y2="4" />
        <text x="12" y="18" textAnchor="middle" fontSize="13" fontWeight="600" stroke="none" fill="currentColor">O</text>
      </>
    ));
    case 'move': return inlineSvg(size, MOVE_PATH);
    case 'copy': return inlineSvg(size, COPY_PATH);
    case 'rotate': return inlineSvg(size, ROTATE_PATH);
    case 'mirror': return inlineSvg(size, MIRROR_PATH);
    case 'scale': return inlineSvg(size, SCALE_PATH);
    case 'stretch': return inlineSvg(size, STRETCH_PATH);
    case 'trim': return inlineSvg(size, TRIM_PATH);
    case 'extend': return inlineSvg(size, EXTEND_PATH);
    case 'offset': return inlineSvg(size, OFFSET_PATH);
    case 'fillet': return inlineSvg(size, FILLET_PATH);
    case 'chamfer': return inlineSvg(size, CHAMFER_PATH);
    case 'array-rect': return inlineSvg(size, ARRAY_RECT_PATH);
    case 'array-path': return inlineSvg(size, ARRAY_PATH_PATH);
    case 'array-polar': return inlineSvg(size, ARRAY_POLAR_PATH);
    case 'explode': return inlineSvg(size, EXPLODE_PATH);
    case 'select': return inlineSvg(size, SELECT_PATH);
    case 'grip-edit': return inlineSvg(size, GRIP_EDIT_PATH);
    case 'pan': return inlineSvg(size, PAN_PATH);
    case 'zoom': return inlineSvg(size, ZOOM_PATH);
    case 'zoom-in': return inlineSvg(size, ZOOM_IN_PATH);
    case 'zoom-out': return inlineSvg(size, ZOOM_OUT_PATH);
    case 'zoom-window': return inlineSvg(size, ZOOM_WINDOW_PATH);
    case 'zoom-extents': return inlineSvg(size, ZOOM_EXTENTS_PATH);
    case 'zoom-previous': return inlineSvg(size, ZOOM_PREV_PATH);
    case 'zoom-realtime': return inlineSvg(size, ZOOM_REALTIME_PATH);
    case 'zoom-reset': return inlineSvg(size, ZOOM_RESET_PATH);
    case 'visual-2d': return inlineSvg(size, VISUAL_STYLE_2D_PATH);
    case 'visual-hidden': return inlineSvg(size, VISUAL_STYLE_HIDDEN_PATH);
    case 'visual-realistic': return inlineSvg(size, VISUAL_STYLE_REALISTIC_PATH);
    case 'visual-shaded': return inlineSvg(size, VISUAL_STYLE_SHADED_PATH);
    case 'visual-conceptual': return inlineSvg(size, VISUAL_STYLE_CONCEPTUAL_PATH);
    case 'viewport-single': return inlineSvg(size, VIEWPORT_SINGLE_PATH);
    case 'viewport-two': return inlineSvg(size, VIEWPORT_TWO_PATH);
    case 'viewport-three': return inlineSvg(size, VIEWPORT_THREE_PATH);
    case 'viewport-four': return inlineSvg(size, VIEWPORT_FOUR_PATH);
    case 'measure-angle': return inlineSvg(size, MEASURE_ANGLE_PATH);
    case 'measure-angle-line-arc': return inlineSvg(size, MEASURE_ANGLE_LINE_ARC_PATH);
    case 'measure-angle-two-arcs': return inlineSvg(size, MEASURE_ANGLE_TWO_ARCS_PATH);
    case 'measure-angle-measuregeom': return inlineSvg(size, MEASURE_ANGLE_MEASUREGEOM_PATH);
    case 'measure-angle-constraint': return inlineSvg(size, MEASURE_ANGLE_CONSTRAINT_PATH);
    case 'guide-x': return inlineSvg(size, GUIDE_X_PATH);
    case 'guide-z': return inlineSvg(size, GUIDE_Z_PATH);
    case 'guide-xz': return inlineSvg(size, GUIDE_XZ_PATH);
    case 'guide-parallel': return inlineSvg(size, GUIDE_PARALLEL_PATH);
    case 'guide-perpendicular': return inlineSvg(size, GUIDE_PERPENDICULAR_PATH);
    case 'measure-distance': return inlineSvg(size, MEASURE_DISTANCE_PATH);
    case 'measure-distance-continuous': return inlineSvg(size, MEASURE_DISTANCE_CONTINUOUS_PATH);
    case 'measure-area': return inlineSvg(size, MEASURE_AREA_PATH);
    case 'measure-area-auto': return inlineSvg(size, MEASURE_AREA_AUTO_PATH);
    case 'undo': return <Undo width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'redo': return <Redo width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'delete': return <Trash2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'guide-panel': return <PanelRight width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'guide-visibility': return <Eye width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'guide-analysis': return <BarChart3 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'display-grid': return <Grid3X3 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'display-autocrop': return <Crop width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'crop-window': return <Scissors width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'lasso-crop': return <Lasso width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'pdf-background': return <FileImage width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'import-legacy': return <Upload width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'import-enhanced': return <FolderUp width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'import-wizard': return <Wand2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'export-dxf': return <Download width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'cursor-settings': return <Crosshair width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'run-tests': return <FlaskConical width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'toggle-perf': return <Activity width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'ai-assistant': return <Sparkles width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'layering': return <Layers width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'fullscreen': return <Maximize2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    default: return inlineSvg(size, <circle cx="12" cy="12" r="2" />);
  }
};
