/**
 * ADR-363 Phase 8D — Pure param-routing maps + helpers for the column ribbon
 * bridge. Extracted from `useRibbonColumnBridge` (Google file-size SSoT, N.7.1)
 * so the hook stays under the 500-line limit. No React, no side effects — these
 * are the routing tables that map ribbon command keys onto `ColumnParams`
 * fields (flat + nested polygon/I-shape groups).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5
 */

import type {
  ColumnIShapeParams,
  ColumnParams,
  ColumnPolygonParams,
  ColumnTilt,
  ColumnUshapeParams,
} from '../../../../bim/types/column-types';
import {
  DEFAULT_I_FLANGE_THICKNESS_MM,
  DEFAULT_I_WEB_THICKNESS_MM,
  DEFAULT_POLYGON_SIDES,
  DEFAULT_U_BASE_THICKNESS_MM,
  DEFAULT_U_LEG_THICKNESS_MM,
} from '../../../../bim/types/column-types';
import { COLUMN_RIBBON_KEYS } from './column-command-keys';

export const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof ColumnParams>> = {
  [COLUMN_RIBBON_KEYS.params.width]:    'width',
  [COLUMN_RIBBON_KEYS.params.depth]:    'depth',
  [COLUMN_RIBBON_KEYS.params.height]:   'height',
  [COLUMN_RIBBON_KEYS.params.rotation]: 'rotation',
};

export const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof ColumnParams>> = {
  [COLUMN_RIBBON_KEYS.stringParams.kind]:           'kind',
  [COLUMN_RIBBON_KEYS.stringParams.anchor]:         'anchor',
  [COLUMN_RIBBON_KEYS.stringParams.material]:       'material',
  [COLUMN_RIBBON_KEYS.stringParams.catalogProfile]: 'catalogProfile',
};

/**
 * ADR-363 Phase 8D — Nested-param routing. Sides → polygon.sides;
 * flangeThickness/webThickness → ishape.{flange|web}Thickness.
 */
type NestedGroup = 'polygon' | 'ishape' | 'ushape' | 'tilt';
type NestedField =
  | keyof ColumnPolygonParams
  | keyof ColumnIShapeParams
  | keyof ColumnUshapeParams
  | keyof ColumnTilt;

export interface NestedPath {
  readonly group: NestedGroup;
  readonly field: NestedField;
  readonly defaultValue: number;
}

export const NESTED_NUMBER_KEY_TO_PATH: Readonly<Record<string, NestedPath>> = {
  [COLUMN_RIBBON_KEYS.params.sides]: {
    group: 'polygon',
    field: 'sides',
    defaultValue: DEFAULT_POLYGON_SIDES,
  },
  [COLUMN_RIBBON_KEYS.params.flangeThickness]: {
    group: 'ishape',
    field: 'flangeThickness',
    defaultValue: DEFAULT_I_FLANGE_THICKNESS_MM,
  },
  [COLUMN_RIBBON_KEYS.params.webThickness]: {
    group: 'ishape',
    field: 'webThickness',
    defaultValue: DEFAULT_I_WEB_THICKNESS_MM,
  },
  // ADR-363 Phase 2b — manual παραμετρικό Π (U-shape χωρίς polygon).
  [COLUMN_RIBBON_KEYS.params.legThickness]: {
    group: 'ushape',
    field: 'legThickness',
    defaultValue: DEFAULT_U_LEG_THICKNESS_MM,
  },
  [COLUMN_RIBBON_KEYS.params.baseThickness]: {
    group: 'ushape',
    field: 'baseThickness',
    defaultValue: DEFAULT_U_BASE_THICKNESS_MM,
  },
  // ADR-404 Φ5 — κεκλιμένη κολώνα: γωνία + φορά κλίσης (nested `tilt.{angle|direction}`).
  [COLUMN_RIBBON_KEYS.params.tiltAngle]: {
    group: 'tilt',
    field: 'angle',
    defaultValue: 0,
  },
  [COLUMN_RIBBON_KEYS.params.tiltDirection]: {
    group: 'tilt',
    field: 'direction',
    defaultValue: 0,
  },
};

export function isNestedNumberKey(commandKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(NESTED_NUMBER_KEY_TO_PATH, commandKey);
}

export function readNestedValue(params: Readonly<ColumnParams>, path: NestedPath): number {
  const group = path.group === 'polygon'
    ? params.polygon
    : path.group === 'ishape'
      ? params.ishape
      : path.group === 'ushape'
        ? params.ushape
        : params.tilt;
  const raw = group ? (group as Record<string, unknown>)[path.field] : undefined;
  return typeof raw === 'number' ? raw : path.defaultValue;
}

export function patchNestedParams(
  params: Readonly<ColumnParams>,
  path: NestedPath,
  nextValue: number,
): ColumnParams {
  if (path.group === 'polygon') {
    const nextPolygon: ColumnPolygonParams = { ...(params.polygon ?? {}), [path.field]: nextValue };
    return { ...params, polygon: nextPolygon };
  }
  if (path.group === 'ushape') {
    const nextUshape: ColumnUshapeParams = { ...(params.ushape ?? {}), [path.field]: nextValue };
    return { ...params, ushape: nextUshape };
  }
  if (path.group === 'tilt') {
    // ADR-404 — ΚΑΙ τα δύο πεδία υποχρεωτικά: default 0 στο απών ώστε το `ColumnTilt`
    // να μένει πλήρες όταν ο χρήστης ορίζει μόνο γωνία ή μόνο φορά.
    const nextTilt: ColumnTilt = { direction: 0, angle: 0, ...(params.tilt ?? {}), [path.field]: nextValue };
    return { ...params, tilt: nextTilt };
  }
  const nextIshape: ColumnIShapeParams = { ...(params.ishape ?? {}), [path.field]: nextValue };
  return { ...params, ishape: nextIshape };
}
