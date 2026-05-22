// ============================================================================
// ♿ ARIA ENTITY DESCRIPTION GENERATOR — Screen reader descriptions (ADR-366 Phase 8.1)
// ============================================================================
//
// Pure utility producing localized ARIA descriptions for focused BIM entities.
// Injected TFn must resolve keys from the `bim-3d-aria` namespace.
//
// Design: each entity type function is independently exported (testable in
// isolation). The unified `generateAriaDescription` dispatches by bimType.
// All geometry fields are optional — generator degrades gracefully to
// "TypeLabel EntityName" when no geometry data is available.
// ============================================================================

import type { TFn } from './status-bar-text-generator';

export interface AriaEntityData {
  readonly bimType: string | null | undefined;
  readonly entityName: string | null | undefined;
  readonly length?: number | null;
  readonly height?: number | null;
  readonly width?: number | null;
  readonly thickness?: number | null;
  readonly area?: number | null;
  readonly material?: string | null;
  readonly levelName?: string | null;
  /** Stair: number of steps. */
  readonly stepsCount?: number | null;
  /** Dimension annotation: numeric value. */
  readonly dimensionValue?: number | null;
  /** Dimension annotation: unit string (e.g. 'm', 'mm'). */
  readonly dimensionUnit?: string | null;
  /** Comment marker: first N chars of comment text. */
  readonly commentText?: string | null;
}

function fmt(n: number): string {
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, '');
}

function materialFrag(data: AriaEntityData, t: TFn): string {
  return data.material ? t('entity.material', { material: data.material }) : '';
}

function levelFrag(data: AriaEntityData, t: TFn): string {
  return data.levelName ? t('entity.level', { level: data.levelName }) : '';
}

function assembleDescription(
  typeLabel: string,
  geom: string,
  mat: string,
  lvl: string,
  entityName: string | null | undefined,
  t: TFn,
): string {
  if (geom || mat || lvl) return `${typeLabel}${geom}${mat}${lvl}`;
  if (entityName) return t('entity.withName', { type: typeLabel, name: entityName });
  return typeLabel;
}

// ---------------------------------------------------------------------------
// Per-type generators (public API — mirror pattern of status-bar-text-generator)
// ---------------------------------------------------------------------------

export function generateWallDescription(data: AriaEntityData, t: TFn): string {
  const geom = (data.length != null && data.height != null)
    ? t('entity.wallGeometry', { length: fmt(data.length), height: fmt(data.height) })
    : '';
  return assembleDescription(t('entity.wall'), geom, materialFrag(data, t), levelFrag(data, t), data.entityName, t);
}

export function generateColumnDescription(data: AriaEntityData, t: TFn): string {
  const geom = (data.width != null && data.height != null)
    ? t('entity.columnGeometry', { width: fmt(data.width), height: fmt(data.height) })
    : '';
  return assembleDescription(t('entity.column'), geom, materialFrag(data, t), levelFrag(data, t), data.entityName, t);
}

export function generateBeamDescription(data: AriaEntityData, t: TFn): string {
  const geom = (data.length != null && data.height != null)
    ? t('entity.beamGeometry', { length: fmt(data.length), height: fmt(data.height) })
    : '';
  return assembleDescription(t('entity.beam'), geom, materialFrag(data, t), levelFrag(data, t), data.entityName, t);
}

export function generateSlabDescription(data: AriaEntityData, t: TFn): string {
  const geom = (data.area != null && data.thickness != null)
    ? t('entity.slabGeometry', { area: fmt(data.area), thickness: fmt(data.thickness) })
    : '';
  return assembleDescription(t('entity.slab'), geom, materialFrag(data, t), levelFrag(data, t), data.entityName, t);
}

export function generateOpeningDescription(data: AriaEntityData, t: TFn): string {
  const geom = (data.width != null && data.height != null)
    ? t('entity.openingGeometry', { width: fmt(data.width), height: fmt(data.height) })
    : '';
  return assembleDescription(t('entity.opening'), geom, '', levelFrag(data, t), data.entityName, t);
}

export function generateSlabOpeningDescription(data: AriaEntityData, t: TFn): string {
  const geom = (data.width != null && data.height != null)
    ? t('entity.slabOpeningGeometry', { width: fmt(data.width), height: fmt(data.height) })
    : '';
  return assembleDescription(t('entity.slabOpening'), geom, '', levelFrag(data, t), data.entityName, t);
}

export function generateStairDescription(data: AriaEntityData, t: TFn): string {
  const geom = (data.stepsCount != null && data.height != null)
    ? t('entity.stairGeometry', { steps: data.stepsCount, height: fmt(data.height) })
    : '';
  return assembleDescription(t('entity.stair'), geom, '', levelFrag(data, t), data.entityName, t);
}

export function generateDimensionDescription(data: AriaEntityData, t: TFn): string {
  const geom = (data.dimensionValue != null)
    ? t('entity.dimensionGeometry', {
        value: fmt(data.dimensionValue),
        unit: data.dimensionUnit ?? 'm',
      })
    : '';
  return assembleDescription(t('entity.dimension'), geom, '', levelFrag(data, t), data.entityName, t);
}

export function generateCommentMarkerDescription(data: AriaEntityData, t: TFn): string {
  if (data.commentText) {
    return t('entity.commentMarkerWithText', { text: data.commentText });
  }
  return t('entity.commentMarker');
}

export function generateAreaPlanDescription(data: AriaEntityData, t: TFn): string {
  return assembleDescription(t('entity.areaPlan'), '', '', levelFrag(data, t), data.entityName, t);
}

// ---------------------------------------------------------------------------
// Unified dispatcher — used by AriaLiveRegion
// ---------------------------------------------------------------------------

export function generateAriaDescription(data: AriaEntityData, t: TFn): string {
  if (!data.bimType && !data.entityName) return t('entity.noData');

  const type = (data.bimType ?? '').toLowerCase();

  switch (type) {
    case 'wall':
      return generateWallDescription(data, t);
    case 'column':
      return generateColumnDescription(data, t);
    case 'beam':
      return generateBeamDescription(data, t);
    case 'slab':
      return generateSlabDescription(data, t);
    case 'opening':
      return generateOpeningDescription(data, t);
    case 'slab-opening':
      return generateSlabOpeningDescription(data, t);
    case 'stair':
      return generateStairDescription(data, t);
    case 'dimension':
      return generateDimensionDescription(data, t);
    case 'comment-marker':
      return generateCommentMarkerDescription(data, t);
    case 'area-plan':
      return generateAreaPlanDescription(data, t);
    default: {
      if (data.entityName) return t('entity.withName', { type: t('entity.unknown'), name: data.entityName });
      return t('entity.unknown');
    }
  }
}
