"use client";

/**
 * BimGeometryTab — read-only geometry grid for a selected BIM entity.
 *
 * Shows type-specific dimensions + classification fields.
 * Data from Bim3DEntitiesStore.getState() (no subscription — panel only
 * re-renders when Selection3DStore changes).
 *
 * ADR-366 B.2.Q4.
 */

import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { BeamEntity } from '../../../bim/types/beam-types';
import type { SlabEntity } from '../../../bim/types/slab-types';

interface BimGeometryTabProps {
  bimId: string;
  bimType: string;
}

interface GeometryRow {
  label: string;
  value: string;
}

function mmToM(mm: number): string {
  return `${(mm / 1000).toFixed(2)} m`;
}

function buildWallRows(e: WallEntity, t: (k: string) => string): GeometryRow[] {
  return [
    { label: t('geometry.category'), value: t(`wallCategories.${e.params.category}`) },
    { label: t('geometry.thickness'), value: `${e.params.thickness} mm` },
    { label: t('geometry.height'), value: mmToM(e.params.height) },
    { label: t('geometry.baseOffset'), value: `${e.params.baseOffset} mm` },
    { label: t('geometry.area'), value: `${e.geometry.area.toFixed(2)} m²` },
    { label: t('geometry.volume'), value: `${e.geometry.volume.toFixed(3)} m³` },
  ];
}

function buildColumnRows(e: ColumnEntity, t: (k: string) => string): GeometryRow[] {
  const dimValue = e.params.kind === 'circular'
    ? `Ø${e.params.width} mm`
    : `${e.params.width} × ${e.params.depth} mm`;
  return [
    { label: t('geometry.kind'), value: t(`columnKinds.${e.params.kind}`) },
    { label: `${t('geometry.width')} / ${t('geometry.depth')}`, value: dimValue },
    { label: t('geometry.height'), value: mmToM(e.params.height) },
    { label: t('geometry.area'), value: `${e.geometry.area.toFixed(4)} m²` },
  ];
}

function buildBeamRows(e: BeamEntity, t: (k: string) => string): GeometryRow[] {
  const topMm = e.params.topElevation + (e.params.zOffset ?? 0);
  const rows: GeometryRow[] = [
    { label: t('geometry.kind'), value: t(`beamKinds.${e.params.kind}`) },
    { label: t('geometry.width'), value: `${e.params.width} mm` },
    { label: t('geometry.depth'), value: `${e.params.depth} mm` },
    { label: t('geometry.length'), value: `${e.geometry.length.toFixed(2)} m` },
    { label: t('geometry.topElevation'), value: mmToM(e.params.topElevation) },
  ];
  if (e.params.zOffset) {
    rows.push({ label: t('geometry.zOffset'), value: `${e.params.zOffset} mm` });
  }
  rows.push({ label: t('geometry.bottomFace'), value: mmToM(topMm - e.params.depth) });
  return rows;
}

function buildSlabRows(e: SlabEntity, t: (k: string) => string): GeometryRow[] {
  const topMm = e.params.levelElevation + (e.params.heightOffsetFromLevel ?? 0);
  const rows: GeometryRow[] = [
    { label: t('geometry.kind'), value: t(`slabKinds.${e.params.kind}`) },
    { label: t('geometry.thickness'), value: `${e.params.thickness} mm` },
    { label: t('geometry.levelElevation'), value: mmToM(e.params.levelElevation) },
  ];
  if (e.params.heightOffsetFromLevel) {
    rows.push({ label: t('geometry.heightOffsetFromLevel'), value: `${e.params.heightOffsetFromLevel} mm` });
  }
  rows.push(
    { label: t('geometry.bottomFace'), value: mmToM(topMm - e.params.thickness) },
    { label: t('geometry.area'), value: `${e.geometry.area.toFixed(2)} m²` },
    { label: t('geometry.volume'), value: `${e.geometry.volume.toFixed(3)} m³` },
  );
  return rows;
}

function resolveRows(bimId: string, bimType: string, t: (k: string) => string): GeometryRow[] {
  const { walls, columns, beams, slabs } = useBim3DEntitiesStore.getState();
  switch (bimType) {
    case 'wall': {
      const e = walls.find((w) => w.id === bimId);
      return e ? buildWallRows(e, t) : [];
    }
    case 'column': {
      const e = columns.find((c) => c.id === bimId);
      return e ? buildColumnRows(e, t) : [];
    }
    case 'beam': {
      const e = beams.find((b) => b.id === bimId);
      return e ? buildBeamRows(e, t) : [];
    }
    case 'slab': {
      const e = slabs.find((s) => s.id === bimId);
      return e ? buildSlabRows(e, t) : [];
    }
    default:
      return [];
  }
}

export function BimGeometryTab({ bimId, bimType }: BimGeometryTabProps) {
  const { t } = useTranslation('bim3d');
  const rows = resolveRows(bimId, bimType, t);

  if (rows.length === 0) return null;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sm">
      {rows.map(({ label, value }) => (
        <Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono text-foreground">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
