'use client';

/**
 * ADR-345 §8.1b — Icon renderer for ribbon buttons.
 * Resolves a string `icon` token from RibbonCommand to a React node.
 * Path constants live in RibbonButtonIconPaths.tsx (data file, SRP split).
 */

import React, { useSyncExternalStore } from 'react';
import { Undo, Redo, Trash2, PanelRight, Eye, BarChart3, Grid3X3, Crop, Scissors, Lasso, Pentagon, FileImage, Upload, FolderUp, Wand2, Download, Crosshair, FlaskConical, Activity, Sparkles, Layers, Maximize2, Bold, Italic, Underline, Strikethrough, Ruler, MoveHorizontal, MoveDiagonal2, Triangle, CircleDot, Diameter, Spline, CircleSlash, MoveUpRight, Rows3, Equal, Palette, Check, Pencil, RotateCcw, RefreshCw, Settings, Type, Construction, DoorOpen, Columns3, SquareDashed, RectangleHorizontal, TableProperties, Boxes, FileDown, Thermometer, Flame, Droplet, ArrowUpToLine, ArrowDownToLine, Unlink2, Lightbulb, Fence, Server, Armchair, Split, Info, Plug, Printer, Frame, Merge, Group, Ungroup, Syringe } from 'lucide-react';
// ADR-581 Φ6 — reactive 2-state σύριγγα icon (empty ⇄ full) driven by the brush store.
// Direct module import (ΟΧΙ barrel) → ο ribbon icon chunk δεν τραβά command classes.
import { subscribeMatchBrush, hasMatchBrushSource } from '../../../../systems/match-properties/match-brush-store';
import { LineIcon } from '../../../toolbar/icons/LineIcon';
import { CircleIcon } from '../../../toolbar/icons/CircleIcon';
import { ArcIcon } from '../../../toolbar/icons/ArcIcon';
import {
  POLYLINE_PATH, POLYGON_PATH, RECTANGLE_PATH, ELLIPSE_PATH, STAIR_PATH,
  TEXT_PLACEHOLDER_PATH, TEXT_CREATE_PATH,
  MOVE_PATH, COPY_PATH, ROTATE_PATH, MIRROR_PATH, SCALE_PATH,
  STRETCH_PATH, TRIM_PATH, EXTEND_PATH, OFFSET_PATH,
  FILLET_PATH, CHAMFER_PATH,
  ARRAY_RECT_PATH, ARRAY_PATH_PATH, ARRAY_POLAR_PATH,
  EXPLODE_PATH, SELECT_PATH, GRIP_EDIT_PATH,
} from './RibbonButtonIconPaths';
import {
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
} from './ribbon-icon-paths-view-measure';
import { STAIR_PATH_STRAIGHT, STAIR_PATH_SPIRAL, STAIR_PATH_USHAPE } from './stair-kind-icon-paths';
import { XLINE_PATH, RAY_PATH } from './xline-ray-icon-paths';
import { StructuralToolIcon } from './StructuralToolIcon';
import { WallOnEntityIcon } from './WallOnEntityIcon';
import { WallFromLinesIcon } from './WallFromLinesIcon';
import { WallRegionInsideIcon } from './WallRegionInsideIcon';
import { WallSingleIcon } from './WallSingleIcon';

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

/**
 * ADR-581 Φ6 — reactive «σύριγγα» icon. Subscribes to the low-frequency brush store
 * (αλλάζει μόνο σε pick / clear — ΟΧΙ hot-path) και εναλλάσσει άδεια (outline) ⇄
 * γεμάτη (fill) σύριγγα ώστε ο χρήστης να βλέπει ότι έχει «ρουφήξει» πηγή.
 */
const MatchSyringeIcon: React.FC<{ size: RibbonIconSize; className: string }> = ({ size, className }) => {
  const armed = useSyncExternalStore(subscribeMatchBrush, hasMatchBrushSource, hasMatchBrushSource);
  const px = sizePx[size];
  return <Syringe width={px} height={px} className={className} fill={armed ? 'currentColor' : 'none'} />;
};

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
    case 'xline': return inlineSvg(size, XLINE_PATH);
    case 'ray': return inlineSvg(size, RAY_PATH);
    case 'stair': return inlineSvg(size, STAIR_PATH);
    case 'stair-straight': return inlineSvg(size, STAIR_PATH_STRAIGHT);
    case 'stair-spiral': return inlineSvg(size, STAIR_PATH_SPIRAL);
    case 'stair-ushape': return inlineSvg(size, STAIR_PATH_USHAPE);
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
    // ADR-186 / ADR-575 — JOIN (Ένωση, inverse of Explode) + GROUP/UNGROUP (Ομαδοποίηση).
    case 'join': return <Merge width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'group': return <Group width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'ungroup': return <Ungroup width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'select': return inlineSvg(size, SELECT_PATH);
    case 'grip-edit': return inlineSvg(size, GRIP_EDIT_PATH);
    // ADR-581 Φ6 — reactive σύριγγα (empty ⇄ full) driven by the match-brush store.
    case 'match-syringe': return <MatchSyringeIcon size={size} className={className} />;
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
    case 'hatch': return <Grid3X3 width={sizePx[size]} height={sizePx[size]} className={className} />; // ADR-507 — γραμμοσκίαση
    // ADR-507 Φ3 — Μέθοδος ορίου. «Επιλογή σημείου» = γραμμοσκιασμένη περιοχή με σημείο-κλικ
    // στο κέντρο (auto-detect). «Σχεδίαση ορίου» = πολύγωνο με τελείες-κορυφές (N-click).
    // Accent χρώματα (theme-safe σε light+dark) ώστε οι δύο μέθοδοι να διαφέρουν οπτικά:
    //   #4FA3F7 (μπλε) = γραμμοσκίαση του 1ου· #FF9800 (πορτοκαλί) = κορυφές του 2ου.
    // Οι περιμετρικές γραμμές μένουν `currentColor` (theme-aware) και στα δύο.
    case 'hatch-pick-point': return inlineSvg(size, (
      <>
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <path d="M11 4 L5 10 M17 4 L5 16 M21 6 L9 20 M21 12 L15 20" strokeWidth="0.75" stroke="#4FA3F7" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      </>
    ));
    case 'hatch-draw-boundary': return inlineSvg(size, (
      <>
        <path d="M5 7 L12 3 L20 8 L17 20 L7 18 Z" />
        <circle cx="5" cy="7" r="1.5" fill="#FF9800" stroke="none" />
        <circle cx="12" cy="3" r="1.5" fill="#FF9800" stroke="none" />
        <circle cx="20" cy="8" r="1.5" fill="#FF9800" stroke="none" />
        <circle cx="17" cy="20" r="1.5" fill="#FF9800" stroke="none" />
        <circle cx="7" cy="18" r="1.5" fill="#FF9800" stroke="none" />
      </>
    ));
    case 'finish-paint': return <Palette width={sizePx[size]} height={sizePx[size]} className={className} />; // ADR-449 — «Βαφή σοβά» 2D paintbrush
    case 'display-autocrop': return <Crop width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'crop-window': return <Scissors width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'polygon-crop': return <Pentagon width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'lasso-crop': return <Lasso width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'pdf-background': return <FileImage width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'import-legacy': return <Upload width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'import-enhanced': return <FolderUp width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'import-wizard': return <Wand2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'export-dxf': return <Download width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'export-ifc': return <Boxes width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'block-library': return <Boxes width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'cursor-settings': return <Crosshair width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'run-tests': return <FlaskConical width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'toggle-perf': return <Activity width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'info': return <Info width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'ai-assistant': return <Sparkles width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'layering': return <Layers width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'fullscreen': return <Maximize2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-smart': return <Ruler width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-entity': return <Wand2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-auto': return <Frame width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-linear': return <MoveHorizontal width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-aligned': return <MoveDiagonal2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-angular2L': return <Triangle width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-angular3P': return <Triangle width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-radius': return <CircleDot width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-diameter': return <Diameter width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-arc-length': return <Spline width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-jogged-radius': return <CircleSlash width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-ordinate': return <MoveUpRight width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-baseline': return <Rows3 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-continued': return <Equal width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-apply-style': return <Check width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-edit-style': return <Pencil width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-reset-overrides': return <RotateCcw width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-reset-text-position': return <RefreshCw width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-open-panel': return <Settings width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-style-chooser': return <Palette width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'dim-text-override': return <Type width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-362 Round 36 — per-part visibility toggles («Ορατότητα» panel: show/hide each dim part).
    case 'dim-visibility': return <Eye width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-363 Phase 4.5d — BIM launcher icons (Home → Draw).
    case 'bim-wall': return <Construction width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-opening': return <DoorOpen width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-slab': return <Layers width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-slab-opening': return <SquareDashed width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-column': return <Columns3 width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-beam': return <RectangleHorizontal width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-light-fixture': return <Lightbulb width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-socket': return <Plug width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-electrical-panel': return <Server width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-mep-manifold': return <Split width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-408 Εύρος Β — heating radiator (καλοριφέρ): heating-themed thermometer glyph.
    case 'bim-mep-radiator': return <Thermometer width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-408 Εύρος Β #2 — heating boiler (λέβητας): flame glyph (distinct from radiator thermometer).
    case 'bim-mep-boiler': return <Flame width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-408 DHW — domestic hot water heater (θερμοσίφωνας): droplet glyph (water tank, distinct from boiler Flame).
    case 'bim-mep-water-heater': return <Droplet width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-railing': return <Fence width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-furniture': return <Armchair width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-417 — parametric pitched roof (gable glyph: peak slopes + eave line).
    case 'bim-roof': return inlineSvg(size, (
      <>
        <path d="M2 13 L12 4 L22 13" />
        <line x1="5" y1="13" x2="19" y2="13" />
      </>
    ));
    // ADR-408 Φ8 — duct (rectangular section) + pipe (round section) launchers.
    case 'bim-duct': return <RectangleHorizontal width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-pipe': return <Diameter width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-wall-split': return <Scissors width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-566 — Wall Merge (AutoCAD JOIN for walls).
    case 'bim-wall-merge': return <Merge width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-568 — Wall gap-bridge + auto-opening (collinear walls with a gap → one wall + door).
    case 'bim-wall-gap-opening': return <DoorOpen width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-401 Phase E.1 — Wall Attach/Detach Top/Base (manual structural attach).
    case 'bim-wall-attach-top': return <ArrowUpToLine width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-wall-attach-base': return <ArrowDownToLine width={sizePx[size]} height={sizePx[size]} className={className} />;
    case 'bim-wall-detach': return <Unlink2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-363 Phase 8 — BIM Schedule export
    case 'bim-schedule': return <TableProperties width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-453 — Print/Export (2D/3D → PDF / printer / plotter)
    case 'printer': return <Printer width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-376 Phase B.1 — Renumber Openings command
    case 'bim-opening-renumber': return <RefreshCw width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-376 Phase C.1 — Reset tag position (drag offset → 0)
    case 'bim-opening-reset-tag': return <RotateCcw width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-376 Phase C.2 — Per-project Tag Style dialog
    case 'bim-opening-tag-style': return <Palette width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-376 Phase C.3 — Opening Schedule PDF export
    case 'bim-opening-schedule-pdf': return <FileDown width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-396 Phase P6 — Thermal Envelope (ETICS) authoring command
    case 'bim-thermal-envelope': return <Thermometer width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-443 — Structural «Δομικά» tab: distinct base×method composed icons.
    // Walls (base=wall × creation method).
    // Dedicated glyph (Giorgio 2026-07-04): καφές τοίχος-ορθογώνιο (WallBar SSoT, ίδιο χρώμα/διαστάσεις
    // με τα contextual wall icons) αντί για το παλιό «δύο παράλληλες γραμμές» base+method σύμβολο.
    case 'struct-wall-single': return <WallSingleIcon className={className} />;
    // Dedicated glyph (Giorgio): κάθετος τοίχος (καφέ) ⊥ πάνω σε οριζόντια οντότητα — όχι base+method badge.
    case 'struct-wall-on-entity': return <WallOnEntityIcon className={className} />;
    // Dedicated glyph (Giorgio): 4 διακριτές γραμμές (πράσινες) → καφέ τοίχος — όχι base+method badge.
    case 'struct-wall-region-lines': return <WallFromLinesIcon className={className} />;
    // Dedicated glyph (Giorgio): πράσινη διακεκομμένη περιοχή → καφέ τοίχος — όχι base+method badge.
    case 'struct-wall-region-inside': return <WallRegionInsideIcon className={className} />;
    case 'struct-wall-region-box': return <StructuralToolIcon base="wall" method="region-box" className={className} />;
    case 'struct-wall-from-perimeter': return <StructuralToolIcon base="wall" method="from-perimeter" className={className} />;
    case 'struct-wall-from-grid': return <StructuralToolIcon base="wall" method="from-grid" className={className} />;
    // Columns & piers (base=column × creation method).
    case 'struct-col-single': return <StructuralToolIcon base="column" method="single" className={className} />;
    case 'struct-col-region-lines': return <StructuralToolIcon base="column" method="region-lines" className={className} />;
    case 'struct-col-region-inside': return <StructuralToolIcon base="column" method="region-inside" className={className} />;
    case 'struct-col-region-box': return <StructuralToolIcon base="column" method="region-box" className={className} />;
    case 'struct-col-discrete-from-perimeter': return <StructuralToolIcon base="column" method="discrete-from-perimeter" className={className} />;
    case 'struct-col-from-perimeter': return <StructuralToolIcon base="column" method="from-perimeter" className={className} />;
    case 'struct-col-from-polygon': return <StructuralToolIcon base="column" method="sketch-polygon" className={className} />;
    case 'struct-col-discrete-from-perimeter-walls': return <StructuralToolIcon base="column" method="discrete-from-perimeter-walls" className={className} />;
    case 'struct-col-from-grid': return <StructuralToolIcon base="column" method="from-grid" className={className} />;
    // Beams (base=beam × creation method).
    case 'struct-beam-single': return <StructuralToolIcon base="beam" method="single" className={className} />;
    case 'struct-beam-on-entity': return <StructuralToolIcon base="beam" method="on-entity" className={className} />;
    // ADR-569 — «Δοκάρι ανάμεσα σε μέλη» (distinct glyph από το plain beam «single»).
    case 'struct-beam-between': return <StructuralToolIcon base="beam" method="between-members" className={className} />;
    // Foundation (pad / strip × creation method; `tie` keeps tie-beam distinct).
    case 'struct-found-pad-single': return <StructuralToolIcon base="foundation-pad" method="single" className={className} />;
    case 'struct-found-strip-single': return <StructuralToolIcon base="foundation-strip" method="single" className={className} />;
    case 'struct-found-strip-tie': return <StructuralToolIcon base="foundation-strip" method="tie" className={className} />;
    case 'struct-found-strip-on-entity': return <StructuralToolIcon base="foundation-strip" method="on-entity" className={className} />;
    case 'struct-found-strip-from-grid': return <StructuralToolIcon base="foundation-strip" method="from-grid" className={className} />;
    // ADR-456 Slice 2 — «Auto οπλισμός» (code-suggested reinforcement).
    case 'struct-auto-reinforce': return <Wand2 width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-482 — «Ανάλυση» (στατικός FEM solver trigger, M/V/N αποτελέσματα).
    case 'struct-run-analysis': return <Activity width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-457 — «Λεπτομέρεια Οπλισμού» (dimensioned reinforcement detail sheet).
    case 'column-reinforcement-detail': return <Ruler width={sizePx[size]} height={sizePx[size]} className={className} />;
    // ADR-583 — annotation symbol library: North arrow (compass glyph — filled
    // arrowhead + shaft + "N", the surveyor's convention).
    case 'north-arrow': return inlineSvg(size, (
      <>
        <path d="M12 3 L15 10 L9 10 Z" fill="currentColor" stroke="none" />
        <line x1="12" y1="10" x2="12" y2="21" />
        <text x="12" y="6.5" textAnchor="middle" fontSize="5" fontWeight="700" stroke="none" fill="currentColor">N</text>
      </>
    ));
    // ADR-583 Φ1b — section mark: identifier bubble + view-direction arrow (Revit section head).
    case 'section-mark': return inlineSvg(size, (
      <>
        <circle cx="12" cy="8" r="5.5" fill="none" />
        <text x="12" y="10" textAnchor="middle" fontSize="6" fontWeight="700" stroke="none" fill="currentColor">A</text>
        <line x1="12" y1="13.5" x2="12" y2="17" />
        <path d="M12 21 L15 16 L9 16 Z" fill="currentColor" stroke="none" />
      </>
    ));
    // ADR-583 Φ1c — grid bubble: hollow circle + axis id.
    case 'grid-bubble': return inlineSvg(size, (
      <>
        <circle cx="12" cy="12" r="8" fill="none" />
        <text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="700" stroke="none" fill="currentColor">1</text>
      </>
    ));
    // ADR-583 Φ1c — elevation mark: filled down-triangle on a datum line + value.
    case 'elevation-mark': return inlineSvg(size, (
      <>
        <line x1="4" y1="15" x2="20" y2="15" />
        <path d="M12 15 L15 9 L9 9 Z" fill="currentColor" stroke="none" />
        <text x="12" y="6" textAnchor="middle" fontSize="4.5" stroke="none" fill="currentColor">0.00</text>
      </>
    ));
    // ADR-583 Φ1c — detail callout: bubble + hook leader.
    case 'detail-callout': return inlineSvg(size, (
      <>
        <circle cx="15" cy="9" r="5" fill="none" />
        <text x="15" y="11" textAnchor="middle" fontSize="5.5" fontWeight="700" stroke="none" fill="currentColor">1</text>
        <path d="M11 12 A6 6 0 1 0 6 17" fill="none" />
      </>
    ));
    // ADR-583 Φ1c — revision tag: revision number inside a delta triangle.
    case 'revision-tag': return inlineSvg(size, (
      <>
        <path d="M12 3 L20 19 L4 19 Z" fill="none" />
        <text x="12" y="18" textAnchor="middle" fontSize="7" fontWeight="700" stroke="none" fill="currentColor">1</text>
      </>
    ));
    // ADR-583 Φ2 — graphic scale-bar: classic alternating checker bar (cartographic glyph).
    case 'scale-bar': return inlineSvg(size, (
      <>
        <rect x="3" y="10" width="4.5" height="4" fill="currentColor" stroke="none" />
        <rect x="7.5" y="10" width="4.5" height="4" fill="none" />
        <rect x="12" y="10" width="4.5" height="4" fill="currentColor" stroke="none" />
        <rect x="16.5" y="10" width="4.5" height="4" fill="none" />
      </>
    ));
    // ADR-612 — opening info tag: 3-cell box glyph (outer rect + full-width mid divider +
    // bottom-half vertical divider) — mirrors the on-canvas layout (top cell full width,
    // bottom split in two).
    case 'opening-info-tag': return inlineSvg(size, (
      <>
        <rect x="4" y="5" width="16" height="14" fill="none" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="12" y1="12" x2="12" y2="19" />
      </>
    ));
    // ADR-615 — free-standing (self-hosted) opening placement: a door-leaf glyph
    // sitting on a DASHED baseline (vs the solid host-wall baseline implied by the
    // regular `bim-opening` DoorOpen icon) — visually communicates "no BIM wall".
    case 'bim-opening-freestanding': return inlineSvg(size, (
      <>
        <path d="M5 20 L5 4 L15 6 L15 20" fill="none" />
        <path d="M15 12.5 A4 4 0 0 0 11 8.5" fill="none" />
        <line x1="2" y1="20" x2="9" y2="20" strokeDasharray="2.5 2" />
        <line x1="15" y1="20" x2="22" y2="20" strokeDasharray="2.5 2" />
      </>
    ));
    default: return inlineSvg(size, <circle cx="12" cy="12" r="2" />);
  }
};
