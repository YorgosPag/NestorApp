'use client';
import {
  MousePointer, Hand, ZoomIn, ZoomOut, Square, Pen,
  Move, Copy, Trash2, Ruler, Undo, Redo, Focus, Maximize2,
  Grid, Crop, Download, Crosshair,
  Maximize, Calculator, Map, Edit, Hexagon, FlaskConical,
  Activity, // 🏢 ENTERPRISE: Performance Monitor icon
  FileUp, // 🏢 ENTERPRISE: PDF Background icon
  Sparkles, // 🤖 ADR-185: AI Drawing Assistant icon
  BarChart3, // ADR-189: Guide Analysis Panel icon
  RotateCw, // 🏢 ADR-188: Entity Rotation System icon
  ArrowDownUp, // ADR-189: Guide vertical icon
  ArrowLeftRight, // ADR-189: Guide horizontal icon
  Slash, // ADR-189 §3.3: Diagonal guide icon
  CopyPlus, // ADR-189: Parallel guide icon
  CornerDownRight, // ADR-189 §3.4: Perpendicular guide icon
  ScissorsLineDashed, // ADR-189 §3.7: Segment points icon
  Plus, // ADR-189 §3.15: Add point icon
  Minus, // ADR-189 §3.16: Delete point icon
  Eye, EyeOff, // ADR-189: Guide visibility toggle
  CircleDot, // ADR-189 §3.9/§3.10: Arc guide points icon
  Waypoints, // ADR-189 §3.12: Arc-Line intersection icon
  CircleDashed, // ADR-189 §3.11: Circle-Circle intersection icon
  LocateFixed, // Midpoint on line
  Target, // Circle center
  Radar, // ADR-189 B31: Polar array icon
  Scaling, // ADR-189 B32: Scale grid icon
  Compass, // ADR-189 B16: Guide at angle icon
  FlipHorizontal2, // ADR-189 B19: Mirror guides icon
  FileDown, // ADR-189 B8: Guide from entity icon
  BoxSelect, // ADR-189 B14: Guide multi-select icon
  CopyCheck, // ADR-189 B17: Copy/offset pattern icon
  Grid3x3, // ADR-189 B23: Structural preset grid icon
  Layers, // ADR-189 B37: Guide from selection icon
} from "lucide-react";

// 🏢 ENTERPRISE: Import centralized DXF tool labels - ZERO HARDCODED VALUES
import {
  DXF_SELECTION_TOOL_LABELS,
  DXF_DRAWING_TOOL_LABELS,
  DXF_EDITING_TOOL_LABELS,
  DXF_MEASUREMENT_TOOL_LABELS,
  DXF_ZOOM_TOOL_LABELS,
  DXF_UTILITY_TOOL_LABELS,
} from '../../../../constants/property-statuses-enterprise';
import {
  CircleRadiusIcon,
  CircleDiameterIcon,
  Circle2PDiameterIcon,
  Circle3PIcon,
  CircleChordSagittaIcon,
  Circle2PRadiusIcon,
  CircleBestFitIcon,
  CircleTTTIcon // 🏢 ENTERPRISE (2026-01-31): Circle Tangent to 3 Lines
} from './icons/CircleIcon';
// 🏢 ENTERPRISE (2026-01-31): Arc drawing tool icons - ADR-059
import {
  Arc3PIcon,
  ArcCSEIcon,
  ArcSCEIcon
} from './icons/ArcIcon';
// 🏢 ENTERPRISE (2026-01-31): Line drawing tool icons - ADR-060
import {
  LineNormalIcon,
  LinePerpendicularIcon,
  LineParallelIcon
} from './icons/LineIcon';
import { AngleIcon } from './icons/AngleIcon';
import { AngleLineArcIcon } from './icons/AngleLineArcIcon';
import { AngleTwoArcsIcon } from './icons/AngleTwoArcsIcon';
import { AngleMeasureGeomIcon } from './icons/AngleMeasureGeomIcon';
import { AngleConstraintIcon } from './icons/AngleConstraintIcon';
import type { ToolType, ActionDefinition, ToolDefinition } from './types';
import * as React from 'react';
// 🎨 ENTERPRISE: Centralized DXF toolbar colors - Single source of truth
import {
  DXF_TOOL_GROUP_COLORS,
  DXF_ACTION_COLORS,
  getDxfToolColor
} from '../../config/toolbar-colors';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import {
  getShortcutDisplayLabel
} from '../../config/keyboard-shortcuts';
// 🏢 ENTERPRISE: Centralized icon sizes - Zero hardcoded values (ADR-002)
import { componentSizes } from '../../../../styles/design-tokens';

// 🏢 ENTERPRISE: Default icon size from centralized design tokens
const DEFAULT_ICON_SIZE = componentSizes.icon.numeric.sm; // 16px

// ✅ ENTERPRISE FIX: Type adapters για custom icons με SVGProps compatibility
const AngleIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = DEFAULT_ICON_SIZE,
  height = DEFAULT_ICON_SIZE,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleIcon
    size={Number(width) || DEFAULT_ICON_SIZE}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

const AngleLineArcIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = DEFAULT_ICON_SIZE,
  height = DEFAULT_ICON_SIZE,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleLineArcIcon
    size={Number(width) || DEFAULT_ICON_SIZE}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

const AngleTwoArcsIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = DEFAULT_ICON_SIZE,
  height = DEFAULT_ICON_SIZE,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleTwoArcsIcon
    size={Number(width) || DEFAULT_ICON_SIZE}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

const AngleMeasureGeomIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = DEFAULT_ICON_SIZE,
  height = DEFAULT_ICON_SIZE,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleMeasureGeomIcon
    size={Number(width) || DEFAULT_ICON_SIZE}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

const AngleConstraintIconAdapter: React.ComponentType<React.SVGProps<SVGSVGElement>> = ({
  width = DEFAULT_ICON_SIZE,
  height = DEFAULT_ICON_SIZE,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <AngleConstraintIcon
    size={Number(width) || DEFAULT_ICON_SIZE}
    color={color as string}
    strokeWidth={typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : Number(strokeWidth) || 1.5}
  />
);

// 🏢 ENTERPRISE: Tool group i18n keys for dynamic translation
export const DXF_TOOL_GROUP_KEYS = {
  SELECTION: 'toolGroups.selection',
  DRAWING: 'toolGroups.drawing',
  TOOLS: 'toolGroups.tools',
  MEASUREMENTS: 'toolGroups.measurements',
  ZOOM: 'toolGroups.zoom',
  // ADR-189: Construction guide tools
  GUIDES: 'toolGroups.guides',
} as const;

export const toolGroups: { name: string; tools: ToolDefinition[] }[] = [
  {
    name: DXF_TOOL_GROUP_KEYS.SELECTION,
    tools: [
      // ✅ CENTRALIZED: Using DXF_SELECTION_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      // 🎨 ENTERPRISE: Auto-assigned from DXF_TOOL_GROUP_COLORS.SELECTION
      // ⌨️ ENTERPRISE: Hotkeys from centralized keyboard-shortcuts.ts
      { id: 'select' as ToolType, icon: MousePointer, label: DXF_SELECTION_TOOL_LABELS.SELECT, hotkey: getShortcutDisplayLabel('select'), colorClass: DXF_TOOL_GROUP_COLORS.SELECTION },
      { id: 'pan' as ToolType, icon: Hand, label: DXF_SELECTION_TOOL_LABELS.PAN, hotkey: getShortcutDisplayLabel('pan'), colorClass: DXF_TOOL_GROUP_COLORS.SELECTION },
    ]
  },
  {
    name: DXF_TOOL_GROUP_KEYS.DRAWING,
    tools: [
      // ✅ CENTRALIZED: Using DXF_DRAWING_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      // 🎨 ENTERPRISE: Auto-assigned from DXF_TOOL_GROUP_COLORS.DRAWING
      // ⌨️ ENTERPRISE: Hotkeys from centralized keyboard-shortcuts.ts
      // 🏢 ENTERPRISE (2026-01-31): Line tool with dropdown - ADR-060
      {
        id: 'line' as ToolType,
        icon: LineNormalIcon,
        label: DXF_DRAWING_TOOL_LABELS.LINE,
        hotkey: getShortcutDisplayLabel('line'),
        colorClass: DXF_TOOL_GROUP_COLORS.DRAWING,
        dropdownOptions: [
          { id: 'line' as ToolType, icon: LineNormalIcon, label: DXF_DRAWING_TOOL_LABELS.LINE },
          { id: 'line-perpendicular' as ToolType, icon: LinePerpendicularIcon, label: DXF_DRAWING_TOOL_LABELS.LINE_PERPENDICULAR },
          { id: 'line-parallel' as ToolType, icon: LineParallelIcon, label: DXF_DRAWING_TOOL_LABELS.LINE_PARALLEL }
        ]
      },
      { id: 'rectangle' as ToolType, icon: Square, label: DXF_DRAWING_TOOL_LABELS.RECTANGLE, hotkey: getShortcutDisplayLabel('rectangle'), colorClass: DXF_TOOL_GROUP_COLORS.DRAWING },
      {
        id: 'circle' as ToolType,
        icon: CircleRadiusIcon,
        label: DXF_DRAWING_TOOL_LABELS.CIRCLE_RADIUS,
        hotkey: getShortcutDisplayLabel('circle'),
        colorClass: DXF_TOOL_GROUP_COLORS.DRAWING,
        dropdownOptions: [
          // ✅ CENTRALIZED: Circle tool variations - ZERO HARDCODED VALUES
          { id: 'circle' as ToolType, icon: CircleRadiusIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_RADIUS },
          { id: 'circle-diameter' as ToolType, icon: CircleDiameterIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_DIAMETER },
          { id: 'circle-2p-diameter' as ToolType, icon: Circle2PDiameterIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_2P_DIAMETER },
          { id: 'circle-3p' as ToolType, icon: Circle3PIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_3P },
          { id: 'circle-chord-sagitta' as ToolType, icon: CircleChordSagittaIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_CHORD_SAGITTA },
          { id: 'circle-2p-radius' as ToolType, icon: Circle2PRadiusIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_2P_RADIUS },
          { id: 'circle-best-fit' as ToolType, icon: CircleBestFitIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_BEST_FIT },
          // 🏢 ENTERPRISE (2026-01-31): Circle Tangent to 3 Lines (AutoCAD TTT)
          { id: 'circle-ttt' as ToolType, icon: CircleTTTIcon, label: DXF_DRAWING_TOOL_LABELS.CIRCLE_TTT }
        ]
      },
      // 🏢 ENTERPRISE (2026-01-31): Arc drawing tool with dropdown - ADR-059
      {
        id: 'arc' as ToolType,
        icon: Arc3PIcon,
        label: DXF_DRAWING_TOOL_LABELS.ARC,
        hotkey: getShortcutDisplayLabel('arc'),
        colorClass: DXF_TOOL_GROUP_COLORS.DRAWING,
        dropdownOptions: [
          { id: 'arc-3p' as ToolType, icon: Arc3PIcon, label: DXF_DRAWING_TOOL_LABELS.ARC_3P },
          { id: 'arc-cse' as ToolType, icon: ArcCSEIcon, label: DXF_DRAWING_TOOL_LABELS.ARC_CENTER_START_END },
          { id: 'arc-sce' as ToolType, icon: ArcSCEIcon, label: DXF_DRAWING_TOOL_LABELS.ARC_START_CENTER_END }
        ]
      },
      { id: 'polyline' as ToolType, icon: Pen, label: DXF_DRAWING_TOOL_LABELS.POLYLINE, hotkey: getShortcutDisplayLabel('polyline'), colorClass: DXF_TOOL_GROUP_COLORS.DRAWING },
      { id: 'polygon' as ToolType, icon: Hexagon, label: DXF_DRAWING_TOOL_LABELS.POLYGON, hotkey: getShortcutDisplayLabel('polygon'), colorClass: DXF_TOOL_GROUP_COLORS.DRAWING },
      { id: 'layering' as ToolType, icon: Map, label: DXF_DRAWING_TOOL_LABELS.LAYERING, hotkey: getShortcutDisplayLabel('layering'), colorClass: DXF_TOOL_GROUP_COLORS.DRAWING }
    ]
  },
  {
    name: DXF_TOOL_GROUP_KEYS.TOOLS,
    tools: [
      // ✅ CENTRALIZED: Using DXF_EDITING_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      // 🎨 ENTERPRISE: Auto-assigned from DXF_TOOL_GROUP_COLORS.TOOLS
      // ⌨️ ENTERPRISE: Hotkeys from centralized keyboard-shortcuts.ts
      { id: 'grip-edit' as ToolType, icon: Edit, label: DXF_EDITING_TOOL_LABELS.GRIP_EDIT, hotkey: getShortcutDisplayLabel('gripEdit'), colorClass: DXF_TOOL_GROUP_COLORS.TOOLS },
      { id: 'move' as ToolType, icon: Move, label: DXF_EDITING_TOOL_LABELS.MOVE, hotkey: getShortcutDisplayLabel('move'), colorClass: DXF_TOOL_GROUP_COLORS.TOOLS },
      { id: 'rotate' as ToolType, icon: RotateCw, label: DXF_EDITING_TOOL_LABELS.ROTATE, hotkey: getShortcutDisplayLabel('rotate'), colorClass: DXF_TOOL_GROUP_COLORS.TOOLS },
      { id: 'copy' as ToolType, icon: Copy, label: DXF_EDITING_TOOL_LABELS.COPY, hotkey: getShortcutDisplayLabel('copy'), colorClass: DXF_TOOL_GROUP_COLORS.TOOLS },
      // 🎨 ENTERPRISE: Delete uses getDxfToolColor with override (RED for danger)
      { id: 'delete' as ToolType, icon: Trash2, label: DXF_EDITING_TOOL_LABELS.DELETE, hotkey: getShortcutDisplayLabel('delete'), colorClass: getDxfToolColor('TOOLS', 'delete') },
    ]
  },
  // ADR-189: Construction Guide Tools
  {
    name: DXF_TOOL_GROUP_KEYS.GUIDES,
    tools: [
      {
        id: 'guide-x' as ToolType,
        icon: ArrowDownUp,
        label: DXF_DRAWING_TOOL_LABELS.GUIDE_X,
        hotkey: 'G→X',
        colorClass: DXF_TOOL_GROUP_COLORS.GUIDES,
        dropdownOptions: [
          // 🏢 ADR-189 §37: Grouped guide menu (AutoCAD/Revit pattern)
          // ── Δημιουργία ──
          { id: 'guide-x' as ToolType, icon: ArrowDownUp, label: DXF_DRAWING_TOOL_LABELS.GUIDE_X, hotkey: 'G→X', group: 'guideMenuGroups.create' },
          { id: 'guide-z' as ToolType, icon: ArrowLeftRight, label: DXF_DRAWING_TOOL_LABELS.GUIDE_Z, hotkey: 'G→Z', group: 'guideMenuGroups.create' },
          { id: 'guide-xz' as ToolType, icon: Slash, label: DXF_DRAWING_TOOL_LABELS.GUIDE_XZ, hotkey: 'G→K', group: 'guideMenuGroups.create' },
          { id: 'guide-parallel' as ToolType, icon: CopyPlus, label: DXF_DRAWING_TOOL_LABELS.GUIDE_PARALLEL, hotkey: 'G→P', group: 'guideMenuGroups.create' },
          { id: 'guide-perpendicular' as ToolType, icon: CornerDownRight, label: DXF_DRAWING_TOOL_LABELS.GUIDE_PERPENDICULAR, hotkey: 'G→N', group: 'guideMenuGroups.create' },
          // ── Σημεία Κατασκευής ──
          { id: 'guide-segments' as ToolType, icon: ScissorsLineDashed, label: DXF_DRAWING_TOOL_LABELS.GUIDE_SEGMENTS, hotkey: 'G→S', group: 'guideMenuGroups.points' },
          { id: 'guide-distance' as ToolType, icon: Ruler, label: DXF_DRAWING_TOOL_LABELS.GUIDE_DISTANCE, hotkey: 'G→A', group: 'guideMenuGroups.points' },
          { id: 'guide-add-point' as ToolType, icon: Plus, label: DXF_DRAWING_TOOL_LABELS.GUIDE_ADD_POINT, hotkey: 'G→Q', group: 'guideMenuGroups.points' },
          { id: 'guide-delete-point' as ToolType, icon: Minus, label: DXF_DRAWING_TOOL_LABELS.GUIDE_DELETE_POINT, hotkey: 'G→W', group: 'guideMenuGroups.points' },
          { id: 'guide-arc-segments' as ToolType, icon: CircleDot, label: DXF_DRAWING_TOOL_LABELS.GUIDE_ARC_SEGMENTS, hotkey: 'G→T', group: 'guideMenuGroups.points' },
          { id: 'guide-arc-distance' as ToolType, icon: CircleDot, label: DXF_DRAWING_TOOL_LABELS.GUIDE_ARC_DISTANCE, hotkey: 'G→U', group: 'guideMenuGroups.points' },
          { id: 'guide-arc-line-intersect' as ToolType, icon: Waypoints, label: DXF_DRAWING_TOOL_LABELS.GUIDE_ARC_LINE_INTERSECT, hotkey: 'G→I', group: 'guideMenuGroups.points' },
          { id: 'guide-circle-intersect' as ToolType, icon: CircleDashed, label: DXF_DRAWING_TOOL_LABELS.GUIDE_CIRCLE_INTERSECT, hotkey: 'G→O', group: 'guideMenuGroups.points' },
          // ── Κέντρα & Μέσα ──
          { id: 'guide-rect-center' as ToolType, icon: Crosshair, label: DXF_DRAWING_TOOL_LABELS.GUIDE_RECT_CENTER, hotkey: 'G→R', group: 'guideMenuGroups.centers' },
          { id: 'guide-line-midpoint' as ToolType, icon: LocateFixed, label: DXF_DRAWING_TOOL_LABELS.GUIDE_LINE_MIDPOINT, hotkey: 'G→E', group: 'guideMenuGroups.centers' },
          { id: 'guide-circle-center' as ToolType, icon: Target, label: DXF_DRAWING_TOOL_LABELS.GUIDE_CIRCLE_CENTER, hotkey: 'G→C', group: 'guideMenuGroups.centers' },
          // ── Διαχείριση ──
          { id: 'guide-move' as ToolType, icon: Move, label: DXF_DRAWING_TOOL_LABELS.GUIDE_MOVE, hotkey: 'G→M', group: 'guideMenuGroups.manage' },
          { id: 'guide-delete' as ToolType, icon: Trash2, label: DXF_DRAWING_TOOL_LABELS.GUIDE_DELETE, hotkey: 'G→D', group: 'guideMenuGroups.manage' },
          { id: 'guide-select' as ToolType, icon: BoxSelect, label: DXF_DRAWING_TOOL_LABELS.GUIDE_SELECT, hotkey: 'G→6', group: 'guideMenuGroups.manage' },
          // ── Μετασχηματισμοί ──
          { id: 'guide-rotate' as ToolType, icon: RotateCw, label: DXF_DRAWING_TOOL_LABELS.GUIDE_ROTATE, hotkey: 'G→H', group: 'guideMenuGroups.transforms' },
          { id: 'guide-rotate-all' as ToolType, icon: RotateCw, label: DXF_DRAWING_TOOL_LABELS.GUIDE_ROTATE_ALL, hotkey: 'G→J', group: 'guideMenuGroups.transforms' },
          { id: 'guide-rotate-group' as ToolType, icon: RotateCw, label: DXF_DRAWING_TOOL_LABELS.GUIDE_ROTATE_GROUP, hotkey: 'G→F', group: 'guideMenuGroups.transforms' },
          { id: 'guide-equalize' as ToolType, icon: ArrowDownUp, label: DXF_DRAWING_TOOL_LABELS.GUIDE_EQUALIZE, hotkey: 'G→Y', group: 'guideMenuGroups.transforms' },
          { id: 'guide-mirror' as ToolType, icon: FlipHorizontal2, label: DXF_DRAWING_TOOL_LABELS.GUIDE_MIRROR, hotkey: 'G→5', group: 'guideMenuGroups.transforms' },
          { id: 'guide-scale' as ToolType, icon: Scaling, label: DXF_DRAWING_TOOL_LABELS.GUIDE_SCALE, hotkey: 'G→3', group: 'guideMenuGroups.transforms' },
          { id: 'guide-angle' as ToolType, icon: Compass, label: DXF_DRAWING_TOOL_LABELS.GUIDE_ANGLE, hotkey: 'G→4', group: 'guideMenuGroups.transforms' },
          { id: 'guide-copy-pattern' as ToolType, icon: CopyCheck, label: DXF_DRAWING_TOOL_LABELS.GUIDE_COPY_PATTERN, hotkey: 'G→7', group: 'guideMenuGroups.transforms' },
          // ── Πλέγμα & Στοιχεία ──
          { id: 'guide-grid' as ToolType, icon: Grid, label: DXF_DRAWING_TOOL_LABELS.GUIDE_GRID, hotkey: 'G→B', group: 'guideMenuGroups.grid' },
          { id: 'guide-preset-grid' as ToolType, icon: Grid3x3, label: DXF_DRAWING_TOOL_LABELS.GUIDE_PRESET_GRID, hotkey: 'G→1', group: 'guideMenuGroups.grid' },
          { id: 'guide-polar-array' as ToolType, icon: Radar, label: DXF_DRAWING_TOOL_LABELS.GUIDE_POLAR_ARRAY, hotkey: 'G→2', group: 'guideMenuGroups.grid' },
          { id: 'guide-from-entity' as ToolType, icon: FileDown, label: DXF_DRAWING_TOOL_LABELS.GUIDE_FROM_ENTITY, hotkey: 'G→8', group: 'guideMenuGroups.grid' },
          { id: 'guide-offset-entity' as ToolType, icon: Ruler, label: DXF_DRAWING_TOOL_LABELS.GUIDE_OFFSET_ENTITY, hotkey: 'G→9', group: 'guideMenuGroups.grid' },
          { id: 'guide-from-selection' as ToolType, icon: Layers, label: DXF_DRAWING_TOOL_LABELS.GUIDE_FROM_SELECTION, hotkey: 'G→0', group: 'guideMenuGroups.grid' },
        ],
      },
    ],
  },
  {
    name: DXF_TOOL_GROUP_KEYS.MEASUREMENTS,
    tools: [
      // ✅ CENTRALIZED: Using DXF_MEASUREMENT_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      // 🎨 ENTERPRISE: Auto-assigned from DXF_TOOL_GROUP_COLORS.MEASUREMENTS
      // ⌨️ ENTERPRISE: Hotkeys from centralized keyboard-shortcuts.ts
      {
        id: 'measure-distance' as ToolType,
        icon: Ruler,
        label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_DISTANCE,
        hotkey: getShortcutDisplayLabel('measureDistance'),
        colorClass: DXF_TOOL_GROUP_COLORS.MEASUREMENTS,
        dropdownOptions: [
          // 🏢 ENTERPRISE (2026-01-27): Distance measurement variations - ZERO HARDCODED VALUES
          { id: 'measure-distance' as ToolType, icon: Ruler, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_DISTANCE_2P },
          { id: 'measure-distance-continuous' as ToolType, icon: Ruler, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_DISTANCE_CONTINUOUS }
        ]
      },
      { id: 'measure-area' as ToolType, icon: Calculator, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_AREA, hotkey: getShortcutDisplayLabel('measureArea'), colorClass: DXF_TOOL_GROUP_COLORS.MEASUREMENTS },
      {
        id: 'measure-angle' as ToolType,
        icon: AngleIconAdapter,
        label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE,
        hotkey: getShortcutDisplayLabel('measureAngle'),
        colorClass: DXF_TOOL_GROUP_COLORS.MEASUREMENTS,
        dropdownOptions: [
          // ✅ CENTRALIZED: Angle measurement variations - ZERO HARDCODED VALUES
          { id: 'measure-angle' as ToolType, icon: AngleIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_BASIC },
          { id: 'measure-angle-line-arc' as ToolType, icon: AngleLineArcIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_LINE_ARC },
          { id: 'measure-angle-two-arcs' as ToolType, icon: AngleTwoArcsIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_TWO_ARCS },
          { id: 'measure-angle-measuregeom' as ToolType, icon: AngleMeasureGeomIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_MEASUREGEOM },
          { id: 'measure-angle-constraint' as ToolType, icon: AngleConstraintIconAdapter, label: DXF_MEASUREMENT_TOOL_LABELS.MEASURE_ANGLE_CONSTRAINT }
        ]
      },
    ]
  },
  {
    name: DXF_TOOL_GROUP_KEYS.ZOOM,
    tools: [
      // ✅ CENTRALIZED: Using DXF_ZOOM_TOOL_LABELS from central system - ZERO HARDCODED VALUES
      // 🎨 ENTERPRISE: Auto-assigned from DXF_TOOL_GROUP_COLORS.ZOOM
      // ⌨️ ENTERPRISE: Hotkeys from centralized keyboard-shortcuts.ts
      { id: 'zoom-in' as ToolType, icon: ZoomIn, label: DXF_ZOOM_TOOL_LABELS.ZOOM_IN, hotkey: getShortcutDisplayLabel('zoomIn'), colorClass: DXF_TOOL_GROUP_COLORS.ZOOM },
      { id: 'zoom-out' as ToolType, icon: ZoomOut, label: DXF_ZOOM_TOOL_LABELS.ZOOM_OUT, hotkey: getShortcutDisplayLabel('zoomOut'), colorClass: DXF_TOOL_GROUP_COLORS.ZOOM },
      { id: 'zoom-window' as ToolType, icon: Maximize2, label: DXF_ZOOM_TOOL_LABELS.ZOOM_WINDOW, hotkey: getShortcutDisplayLabel('zoomWindow'), colorClass: DXF_TOOL_GROUP_COLORS.ZOOM },
      { id: 'zoom-extents' as ToolType, icon: Maximize, label: DXF_ZOOM_TOOL_LABELS.ZOOM_EXTENTS, hotkey: getShortcutDisplayLabel('zoomExtents'), colorClass: DXF_TOOL_GROUP_COLORS.ZOOM },
    ]
  }
];

export const createActionButtons = (props: {
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showGrid: boolean;
  autoCrop: boolean;
  showCursorSettings?: boolean;
  guidesVisible?: boolean;
  onAction: (action: string, data?: number | string | boolean) => void;
}): ActionDefinition[] => [
  // ⌨️ ENTERPRISE: All hotkeys from centralized keyboard-shortcuts.ts
  {
    id: 'undo',
    icon: Undo,
    // ✅ CENTRALIZED: Using DXF_UTILITY_TOOL_LABELS from central system - ZERO HARDCODED VALUES
    label: DXF_UTILITY_TOOL_LABELS.UNDO,
    hotkey: getShortcutDisplayLabel('undo'),
    disabled: !props.canUndo,
    // 🎨 ENTERPRISE: Auto-assigned from DXF_ACTION_COLORS
    colorClass: DXF_ACTION_COLORS.undo,
    onClick: () => props.onAction('undo')
  },
  {
    id: 'redo',
    icon: Redo,
    label: DXF_UTILITY_TOOL_LABELS.REDO,
    hotkey: getShortcutDisplayLabel('redo'),
    disabled: !props.canRedo,
    colorClass: DXF_ACTION_COLORS.redo,
    onClick: () => props.onAction('redo')
  },
  {
    id: 'cursor-settings',
    icon: Crosshair,
    label: DXF_UTILITY_TOOL_LABELS.CURSOR_SETTINGS,
    hotkey: getShortcutDisplayLabel('toggleCursorSettings'),
    active: props.showCursorSettings,
    colorClass: DXF_ACTION_COLORS.cursorSettings,
    onClick: () => props.onAction('toggle-cursor-settings')
  },
  {
    id: 'grid',
    icon: Grid,
    // 🏢 ENTERPRISE: i18n key - translated in ActionButton component
    label: props.showGrid ? 'actionButtons.hideGrid' : 'actionButtons.showGrid',
    hotkey: getShortcutDisplayLabel('grid'),
    active: props.showGrid,
    colorClass: DXF_ACTION_COLORS.grid,
    onClick: () => props.onAction('grid')
  },
  // ADR-189: Toggle construction guide visibility
  {
    id: 'toggle-guides',
    icon: props.guidesVisible ? EyeOff : Eye,
    label: props.guidesVisible ? 'actionButtons.hideGuides' : 'actionButtons.showGuides',
    hotkey: 'G→V',
    active: props.guidesVisible,
    colorClass: DXF_ACTION_COLORS.grid,
    onClick: () => props.onAction('toggle-guides')
  },
  // ADR-189: Guide Analysis Panel (10 services → 4 tabs)
  {
    id: 'toggle-guide-analysis',
    icon: BarChart3,
    label: DXF_UTILITY_TOOL_LABELS.GUIDE_ANALYSIS,
    hotkey: '',
    colorClass: DXF_ACTION_COLORS.grid,
    onClick: () => props.onAction('toggle-guide-analysis-panel')
  },
  {
    id: 'autocrop',
    icon: Crop,
    // 🏢 ENTERPRISE: i18n key - translated in ActionButton component
    label: props.autoCrop ? 'actionButtons.autoCropOn' : 'actionButtons.autoCropOff',
    hotkey: getShortcutDisplayLabel('autocrop'),
    active: props.autoCrop,
    colorClass: DXF_ACTION_COLORS.autocrop,
    onClick: () => props.onAction('autocrop')
  },
  {
    id: 'fit',
    icon: Focus,
    label: DXF_UTILITY_TOOL_LABELS.FIT_TO_VIEW,
    hotkey: getShortcutDisplayLabel('fit'),
    active: false, // 🔥 Add active state - στιγμιαίο action, όχι toggle
    disabled: false, // 🔥 Ensure it's not disabled
    colorClass: DXF_ACTION_COLORS.fit,
    onClick: () => props.onAction('fit-to-view')
  },
  {
    id: 'export',
    icon: Download,
    label: DXF_UTILITY_TOOL_LABELS.EXPORT,
    hotkey: getShortcutDisplayLabel('export'),
    colorClass: DXF_ACTION_COLORS.export,
    onClick: () => props.onAction('export')
  },
  {
    id: 'tests',
    icon: FlaskConical,
    label: DXF_UTILITY_TOOL_LABELS.RUN_TESTS,
    hotkey: getShortcutDisplayLabel('runTests'),
    colorClass: DXF_ACTION_COLORS.tests,
    onClick: () => props.onAction('run-tests')
  },
  // 🏢 ENTERPRISE: Performance Monitor Toggle (Bentley/Autodesk pattern)
  {
    id: 'toggle-perf',
    icon: Activity,
    label: DXF_UTILITY_TOOL_LABELS.TOGGLE_PERF,
    hotkey: getShortcutDisplayLabel('togglePerf'),
    colorClass: DXF_ACTION_COLORS.togglePerf,
    onClick: () => props.onAction('toggle-perf')
  },
  // 🏢 ENTERPRISE: PDF Background Controls (Independent pan/zoom/rotation)
  // Note: Ctrl+Shift+B is reserved by browser (bookmarks bar)
  {
    id: 'toggle-pdf-background',
    icon: FileUp,
    label: DXF_UTILITY_TOOL_LABELS.PDF_BACKGROUND,
    hotkey: getShortcutDisplayLabel('togglePdfBackground'),
    colorClass: DXF_ACTION_COLORS.pdfBackground,
    onClick: () => props.onAction('toggle-pdf-background')
  },
  // 🤖 ADR-185: AI Drawing Assistant Toggle
  {
    id: 'toggle-ai-assistant',
    icon: Sparkles,
    label: DXF_UTILITY_TOOL_LABELS.AI_ASSISTANT,
    hotkey: '',
    colorClass: DXF_ACTION_COLORS.aiAssistant,
    onClick: () => props.onAction('toggle-ai-assistant')
  }
];
