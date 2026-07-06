'use client';

/**
 * entity-property-schema — ADR-357 Phase 10 SSoT
 *
 * Pure metadata registry: maps entity type → property descriptor groups.
 * Used by: QuickPropertiesMiniPanel (Phase 9), PropertiesPalette (Phase 10).
 * No React state, no side effects.
 */

import {
  formatDisplayValue,
  fromDisplay,
  type DisplayUnit,
} from '../../config/units';
import type { DxfLine } from '../../canvas-v2/dxf-canvas/dxf-types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const COMMON_LINETYPES = [
  'ByLayer', 'Continuous', 'DASHED', 'DASHED2', 'DASHEDX2',
  'HIDDEN', 'HIDDEN2', 'HIDDENX2', 'CENTER', 'CENTER2', 'CENTERX2',
  'DOT', 'DOT2', 'DOTX2', 'DASHDOT', 'DASHDOT2', 'DASHDOTX2',
  'BORDER', 'DIVIDE', 'PHANTOM',
] as const;

export type LinetypeName = (typeof COMMON_LINETYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EditorType = 'text' | 'number' | 'select' | 'color' | 'readonly';

export interface PropertyDescriptor {
  readonly key: string;
  /** i18n key in dxf-viewer-shell namespace */
  readonly labelKey: string;
  readonly editorType: EditorType;
  readonly options?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** 'display' = value converted via displayUnit; 'deg' = plain degrees */
  readonly unit?: 'display' | 'deg';
}

export interface PropertyGroup {
  readonly groupKey: string;
  readonly properties: readonly PropertyDescriptor[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE schema
// ─────────────────────────────────────────────────────────────────────────────

const LINE_SCHEMA: PropertyGroup[] = [
  {
    groupKey: 'propertiesPalette.groups.geometry',
    properties: [
      { key: 'startX',  labelKey: 'propertiesPalette.props.startX',  editorType: 'number', step: 0.001, unit: 'display' },
      { key: 'startY',  labelKey: 'propertiesPalette.props.startY',  editorType: 'number', step: 0.001, unit: 'display' },
      { key: 'endX',    labelKey: 'propertiesPalette.props.endX',    editorType: 'readonly', unit: 'display' },
      { key: 'endY',    labelKey: 'propertiesPalette.props.endY',    editorType: 'readonly', unit: 'display' },
      { key: 'length',  labelKey: 'propertiesPalette.props.length',  editorType: 'number', min: 0.001, step: 0.001, unit: 'display' },
      { key: 'angle',   labelKey: 'propertiesPalette.props.angle',   editorType: 'number', min: 0, max: 360, step: 0.0001, unit: 'deg' },
    ],
  },
  {
    groupKey: 'propertiesPalette.groups.style',
    properties: [
      { key: 'layerId',      labelKey: 'propertiesPalette.props.layer',    editorType: 'select' },
      { key: 'color',        labelKey: 'propertiesPalette.props.color',    editorType: 'color' },
      { key: 'linetypeName', labelKey: 'propertiesPalette.props.linetype', editorType: 'select', options: COMMON_LINETYPES },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION schema (ADR-362 §7) — curated AutoCAD Ctrl+1, εκφράσιμο με τους 5
// editorType. Read/apply logic (needs the dim domain) lives in
// `dimension-property-model.ts`; this stays pure data (no dim-domain imports).
// ─────────────────────────────────────────────────────────────────────────────

/** DIMTAD curated subset (text vertical placement). */
const DIM_TAD_OPTIONS = ['above', 'centered', 'below'] as const;
/** DIMLUNIT linear unit formats (AutoCAD codes 1-6). */
const DIM_LUNIT_OPTIONS = [
  'scientific', 'decimal', 'engineering', 'architectural', 'fractional', 'windowsDesktop',
] as const;

const DIMENSION_SCHEMA: PropertyGroup[] = [
  {
    groupKey: 'propertiesPalette.groups.general',
    properties: [
      { key: 'layerId',  labelKey: 'propertiesPalette.props.layer',         editorType: 'select' },
      { key: 'dimclrd',  labelKey: 'propertiesPalette.props.dimLineColor',   editorType: 'color' },
      { key: 'dimlwd',   labelKey: 'propertiesPalette.props.lineweight',     editorType: 'select' },
      { key: 'dimltype', labelKey: 'propertiesPalette.props.linetype',       editorType: 'select', options: COMMON_LINETYPES },
    ],
  },
  {
    groupKey: 'propertiesPalette.groups.text',
    properties: [
      { key: 'dimclrt',      labelKey: 'propertiesPalette.props.dimTextColor', editorType: 'color' },
      { key: 'dimtxt',       labelKey: 'propertiesPalette.props.textHeight',   editorType: 'number', min: 0, step: 0.1 },
      { key: 'dimtad',       labelKey: 'propertiesPalette.props.textPosition', editorType: 'select', options: DIM_TAD_OPTIONS },
      { key: 'textRotation', labelKey: 'propertiesPalette.props.textRotation', editorType: 'number', unit: 'deg', step: 1 },
      { key: 'userText',     labelKey: 'propertiesPalette.props.textOverride', editorType: 'text' },
    ],
  },
  {
    groupKey: 'propertiesPalette.groups.arrows',
    properties: [
      { key: 'dimblk', labelKey: 'propertiesPalette.props.arrowStyle', editorType: 'select' },
      { key: 'dimasz', labelKey: 'propertiesPalette.props.arrowSize',  editorType: 'number', min: 0, step: 0.1 },
    ],
  },
  {
    groupKey: 'propertiesPalette.groups.fitUnits',
    properties: [
      { key: 'dimscale', labelKey: 'propertiesPalette.props.dimScale',    editorType: 'number', min: 0, step: 0.1 },
      { key: 'dimlunit', labelKey: 'propertiesPalette.props.lengthUnits', editorType: 'select', options: DIM_LUNIT_OPTIONS },
      { key: 'dimdec',   labelKey: 'propertiesPalette.props.decimals',    editorType: 'number', min: 0, step: 1 },
    ],
  },
  {
    groupKey: 'propertiesPalette.groups.geometry',
    properties: [
      { key: 'dimType',      labelKey: 'propertiesPalette.props.dimType',      editorType: 'readonly' },
      { key: 'measurement',  labelKey: 'propertiesPalette.props.measurement',  editorType: 'readonly' },
      { key: 'point1',       labelKey: 'propertiesPalette.props.point1',       editorType: 'readonly' },
      { key: 'point2',       labelKey: 'propertiesPalette.props.point2',       editorType: 'readonly' },
      { key: 'styleName',    labelKey: 'propertiesPalette.props.styleName',    editorType: 'readonly' },
      { key: 'associations', labelKey: 'propertiesPalette.props.associations', editorType: 'readonly' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA_REGISTRY: Record<string, PropertyGroup[]> = {
  line: LINE_SCHEMA,
  dimension: DIMENSION_SCHEMA,
};

export function getEntityGroups(entityType: string): PropertyGroup[] | null {
  return SCHEMA_REGISTRY[entityType] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (shared by MiniPanel + PropertiesPalette)
// ─────────────────────────────────────────────────────────────────────────────

export interface LineFormState {
  startX: string;
  startY: string;
  lengthDisplay: string;
  angleDeg: string;
  layerId: string;
  color: string;
  linetype: string;
}

export function buildLineFormState(entity: DxfLine, displayUnit: DisplayUnit): LineFormState {
  const dx = entity.end.x - entity.start.x;
  const dy = entity.end.y - entity.start.y;
  const lengthMm = Math.hypot(dx, dy);
  let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  return {
    startX: formatDisplayValue(entity.start.x, displayUnit),
    startY: formatDisplayValue(entity.start.y, displayUnit),
    lengthDisplay: formatDisplayValue(lengthMm, displayUnit),
    angleDeg: angle.toFixed(4),
    layerId: entity.layerId ?? '',
    color: entity.colorMode === 'Concrete' ? (entity.color ?? '') : '',
    linetype: entity.linetypeName ?? 'ByLayer',
  };
}

/**
 * Compute the endX/endY read-only derived values for display.
 * Returns null values if end cannot be derived from the form state.
 */
export function deriveEndPoint(
  form: LineFormState,
  entity: DxfLine,
  displayUnit: DisplayUnit,
): { endX: string; endY: string } {
  const startXMm = fromDisplay(parseFloat(form.startX), displayUnit);
  const startYMm = fromDisplay(parseFloat(form.startY), displayUnit);
  const lengthMm = fromDisplay(parseFloat(form.lengthDisplay), displayUnit);
  const angleDeg = parseFloat(form.angleDeg);

  const startX = isNaN(startXMm) ? entity.start.x : startXMm;
  const startY = isNaN(startYMm) ? entity.start.y : startYMm;

  if (isNaN(lengthMm) || isNaN(angleDeg)) {
    return {
      endX: formatDisplayValue(entity.end.x, displayUnit),
      endY: formatDisplayValue(entity.end.y, displayUnit),
    };
  }

  const rad = angleDeg * (Math.PI / 180);
  const endXMm = startX + lengthMm * Math.cos(rad);
  const endYMm = startY - lengthMm * Math.sin(rad);

  return {
    endX: formatDisplayValue(endXMm, displayUnit),
    endY: formatDisplayValue(endYMm, displayUnit),
  };
}
