'use client';

/**
 * ADR-662 Φάση 1b — Live pressed-state topo toggles for the «Τοπογραφικό» ribbon.
 *
 * Replaces the Φάση-1 stateless action-buttons (grid / north / cloud toggle)
 * with big-player (Revit/ArchiCAD) live ON/OFF widgets, plus the mode toggles
 * (contour style, north mode, cut/fill reference). Each is a ~6-line config over
 * the shared {@link RibbonToggleWidget} SSoT (ADR-599) — the config's
 * `useToggleState` subscribes the matching persisted topo store and returns
 * `{value, toggle}`. ZERO new business logic: same stores/setters the left
 * `TopographyPanel` sections already drive (dual access until Φάση 4).
 *
 * ADR-040: topo stores are LOW-freq (change on click), so `useSyncExternalStore`
 * here is safe — identical to `PlanLinesToggle`. Not a canvas hot-path.
 */

import React from 'react';
import {
  Grid3x3,
  Compass,
  Boxes,
  EyeOff,
  Spline,
  Waypoints,
  Navigation,
  Mountain,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';
import {
  getGridDisplayOptions,
  setTopoGridVisible,
  subscribeTopoGrid,
} from '../../../systems/topography/topo-grid-store';
import {
  getNorthArrowOptions,
  setNorthArrowVisible,
  setNorthArrowMode,
  subscribeNorthArrow,
} from '../../../systems/topography/north-arrow-store';
import {
  getPointCloud3DState,
  setPointCloud3DVisible,
  subscribePointCloud3D,
} from '../../../systems/topography/pointcloud-3d-store';
import {
  getCutFillState,
  setCutFillMode,
  subscribeCutFill,
} from '../../../systems/topography/cut-fill-store';
import { useContourDisplay } from '../../../systems/topography/useContourDisplay';

/** i18n key group + on/off/tooltip suffixes for one toggle. */
interface ToggleKeys {
  readonly label: string;
  readonly on: string;
  readonly off: string;
  readonly tipOn: string;
  readonly tipOff: string;
}

const K = 'ribbon.commands.topo';
function keys(group: string): ToggleKeys {
  return {
    label: `${K}.${group}.label`,
    on: `${K}.${group}.on`,
    off: `${K}.${group}.off`,
    tipOn: `${K}.${group}.tooltipOn`,
    tipOff: `${K}.${group}.tooltipOff`,
  };
}

/** Assemble a {@link RibbonToggleConfig} — collapses the repeated 8-field literal. */
function toggleConfig(
  useToggleState: RibbonToggleConfig['useToggleState'],
  activeIcon: LucideIcon,
  inactiveIcon: LucideIcon,
  k: ToggleKeys,
): RibbonToggleConfig {
  return {
    useToggleState,
    labelKey: k.label,
    activeIcon,
    inactiveIcon,
    activeLabelKey: k.on,
    inactiveLabelKey: k.off,
    activeTooltipKey: k.tipOn,
    inactiveTooltipKey: k.tipOff,
  };
}

// ── Visibility toggles (value = visible) ────────────────────────────────────
const GRID_VISIBLE = toggleConfig(
  () => {
    const opts = React.useSyncExternalStore(subscribeTopoGrid, getGridDisplayOptions, getGridDisplayOptions);
    return { value: opts.visible, toggle: () => setTopoGridVisible(!opts.visible) };
  },
  Grid3x3, EyeOff, keys('gridVisible'),
);

const NORTH_VISIBLE = toggleConfig(
  () => {
    const opts = React.useSyncExternalStore(subscribeNorthArrow, getNorthArrowOptions, getNorthArrowOptions);
    return { value: opts.visible, toggle: () => setNorthArrowVisible(!opts.visible) };
  },
  Compass, EyeOff, keys('northVisible'),
);

const CLOUD_VISIBLE = toggleConfig(
  () => {
    const st = React.useSyncExternalStore(subscribePointCloud3D, getPointCloud3DState, getPointCloud3DState);
    // Read fresh in the callback to dodge a stale-closure toggle (mirror TopoCloud3DSection).
    return { value: st.visible, toggle: () => setPointCloud3DVisible(!getPointCloud3DState().visible) };
  },
  Boxes, EyeOff, keys('cloudVisible'),
);

// ── Mode toggles (value = the "on" mode) ────────────────────────────────────
const CONTOUR_STYLE = toggleConfig(
  () => {
    const { style, setStyle } = useContourDisplay();
    return { value: style === 'smooth', toggle: () => setStyle(style === 'smooth' ? 'exact' : 'smooth') };
  },
  Spline, Waypoints, keys('contourStyle'),
);

const NORTH_MODE = toggleConfig(
  () => {
    const opts = React.useSyncExternalStore(subscribeNorthArrow, getNorthArrowOptions, getNorthArrowOptions);
    return { value: opts.mode === 'grid', toggle: () => setNorthArrowMode(opts.mode === 'grid' ? 'true' : 'grid') };
  },
  Grid3x3, Navigation, keys('northMode'),
);

const CUTFILL_MODE = toggleConfig(
  () => {
    const st = React.useSyncExternalStore(subscribeCutFill, getCutFillState, getCutFillState);
    return { value: st.mode === 'surface', toggle: () => setCutFillMode(st.mode === 'surface' ? 'datum' : 'surface') };
  },
  Mountain, Layers, keys('cutFillMode'),
);

export const TopoGridVisibleToggle: React.FC = () => <RibbonToggleWidget config={GRID_VISIBLE} />;
export const NorthArrowVisibleToggle: React.FC = () => <RibbonToggleWidget config={NORTH_VISIBLE} />;
export const PointCloud3DVisibleToggle: React.FC = () => <RibbonToggleWidget config={CLOUD_VISIBLE} />;
export const ContourStyleToggle: React.FC = () => <RibbonToggleWidget config={CONTOUR_STYLE} />;
export const NorthModeToggle: React.FC = () => <RibbonToggleWidget config={NORTH_MODE} />;
export const CutFillModeToggle: React.FC = () => <RibbonToggleWidget config={CUTFILL_MODE} />;
