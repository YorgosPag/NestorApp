"use client";

/**
 * BimGeometryTab — geometry grid for a selected BIM entity, with inline editing.
 *
 * Numeric dimension fields are editable (ADR-402 Phase 1): an edit commits the
 * SAME view-agnostic `UpdateXxxParamsCommand` as the 2D ribbon/panels via
 * `useBimGeometryEdit`, and the 3D scene re-syncs automatically. Derived fields
 * (area / volume / length) stay read-only. When there is no editable level
 * context (`useBimGeometryEdit() === null`, e.g. ADR-371 read-only pipeline),
 * every field renders as plain text.
 *
 * Data from Bim3DEntitiesStore.getState() (no subscription — panel only
 * re-renders when Selection3DStore changes).
 *
 * ADR-366 B.2.Q4 + ADR-402.
 */

import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import { useBimGeometryEdit, type BimGeometryEditApi } from './useBimGeometryEdit';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { BeamEntity, BeamParams } from '../../../bim/types/beam-types';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';

/** Inline edit descriptor: value in display units + a commit that stores mm. */
interface EditSpec {
  raw: number;
  unit: 'mm' | 'm';
  min?: number;
  commit: (displayValue: number) => void;
}

interface GeometryRow {
  label: string;
  value: string;
  edit?: EditSpec;
}

interface BimGeometryTabProps {
  bimId: string;
  bimType: string;
}

function mmToM(mm: number): string {
  return `${(mm / 1000).toFixed(2)} m`;
}

function spec(raw: number, unit: 'mm' | 'm', commit: (v: number) => void, min?: number): EditSpec {
  return { raw, unit, min, commit };
}

function buildWallRows(e: WallEntity, t: (k: string) => string, edit: BimGeometryEditApi | null): GeometryRow[] {
  const w = edit ? (p: Partial<WallParams>) => edit.patchWall(e.id, p) : null;
  return [
    { label: t('geometry.category'), value: t(`wallCategories.${e.params.category}`) },
    { label: t('geometry.thickness'), value: `${e.params.thickness} mm`,
      edit: w ? spec(e.params.thickness, 'mm', (v) => w({ thickness: v }), 1) : undefined },
    { label: t('geometry.height'), value: mmToM(e.params.height),
      edit: w ? spec(e.params.height / 1000, 'm', (v) => w({ height: v * 1000 }), 0.01) : undefined },
    { label: t('geometry.baseOffset'), value: `${e.params.baseOffset} mm`,
      edit: w ? spec(e.params.baseOffset, 'mm', (v) => w({ baseOffset: v })) : undefined },
    { label: t('geometry.area'), value: `${e.geometry.area.toFixed(2)} m²` },
    { label: t('geometry.volume'), value: `${e.geometry.volume.toFixed(3)} m³` },
  ];
}

function buildColumnRows(e: ColumnEntity, t: (k: string) => string, edit: BimGeometryEditApi | null): GeometryRow[] {
  const c = edit ? (p: Partial<ColumnParams>) => edit.patchColumn(e.id, p) : null;
  const dimValue = e.params.kind === 'circular' ? `Ø${e.params.width} mm` : `${e.params.width} × ${e.params.depth} mm`;
  const rows: GeometryRow[] = [
    { label: t('geometry.kind'), value: t(`columnKinds.${e.params.kind}`) },
    { label: t('geometry.width'), value: `${e.params.width} mm`,
      edit: c ? spec(e.params.width, 'mm', (v) => c({ width: v }), 1) : undefined },
  ];
  if (e.params.kind !== 'circular') {
    rows.push({ label: t('geometry.depth'), value: `${e.params.depth} mm`,
      edit: c ? spec(e.params.depth, 'mm', (v) => c({ depth: v }), 1) : undefined });
  }
  rows.push(
    { label: t('geometry.height'), value: mmToM(e.params.height),
      edit: c ? spec(e.params.height / 1000, 'm', (v) => c({ height: v * 1000 }), 0.01) : undefined },
    { label: t('geometry.area'), value: `${e.geometry.area.toFixed(4)} m²` },
  );
  return rows;
}

function buildBeamRows(e: BeamEntity, t: (k: string) => string, edit: BimGeometryEditApi | null): GeometryRow[] {
  const b = edit ? (p: Partial<BeamParams>) => edit.patchBeam(e.id, p) : null;
  const topMm = e.params.topElevation + (e.params.zOffset ?? 0);
  const rows: GeometryRow[] = [
    { label: t('geometry.kind'), value: t(`beamKinds.${e.params.kind}`) },
    { label: t('geometry.width'), value: `${e.params.width} mm`,
      edit: b ? spec(e.params.width, 'mm', (v) => b({ width: v }), 1) : undefined },
    { label: t('geometry.depth'), value: `${e.params.depth} mm`,
      edit: b ? spec(e.params.depth, 'mm', (v) => b({ depth: v }), 1) : undefined },
    { label: t('geometry.length'), value: `${e.geometry.length.toFixed(2)} m` },
    { label: t('geometry.topElevation'), value: mmToM(e.params.topElevation),
      edit: b ? spec(e.params.topElevation / 1000, 'm', (v) => b({ topElevation: v * 1000 })) : undefined },
  ];
  if (e.params.zOffset) {
    rows.push({ label: t('geometry.zOffset'), value: `${e.params.zOffset} mm`,
      edit: b ? spec(e.params.zOffset, 'mm', (v) => b({ zOffset: v })) : undefined });
  }
  rows.push({ label: t('geometry.bottomFace'), value: mmToM(topMm - e.params.depth) });
  return rows;
}

function buildSlabRows(e: SlabEntity, t: (k: string) => string, edit: BimGeometryEditApi | null): GeometryRow[] {
  const s = edit ? (p: Partial<SlabParams>) => edit.patchSlab(e.id, p) : null;
  const topMm = e.params.levelElevation + (e.params.heightOffsetFromLevel ?? 0);
  const rows: GeometryRow[] = [
    { label: t('geometry.kind'), value: t(`slabKinds.${e.params.kind}`) },
    { label: t('geometry.thickness'), value: `${e.params.thickness} mm`,
      edit: s ? spec(e.params.thickness, 'mm', (v) => s({ thickness: v }), 1) : undefined },
    { label: t('geometry.levelElevation'), value: mmToM(e.params.levelElevation) },
    { label: t('geometry.heightOffsetFromLevel'), value: `${e.params.heightOffsetFromLevel ?? 0} mm`,
      edit: s ? spec(e.params.heightOffsetFromLevel ?? 0, 'mm', (v) => s({ heightOffsetFromLevel: v })) : undefined },
    { label: t('geometry.bottomFace'), value: mmToM(topMm - e.params.thickness) },
    { label: t('geometry.area'), value: `${e.geometry.area.toFixed(2)} m²` },
    { label: t('geometry.volume'), value: `${e.geometry.volume.toFixed(3)} m³` },
  ];
  return rows;
}

function resolveRows(
  bimId: string,
  bimType: string,
  t: (k: string) => string,
  edit: BimGeometryEditApi | null,
): GeometryRow[] {
  const { walls, columns, beams, slabs } = useBim3DEntitiesStore.getState();
  switch (bimType) {
    case 'wall': {
      const e = walls.find((w) => w.id === bimId);
      return e ? buildWallRows(e, t, edit) : [];
    }
    case 'column': {
      const e = columns.find((c) => c.id === bimId);
      return e ? buildColumnRows(e, t, edit) : [];
    }
    case 'beam': {
      const e = beams.find((b) => b.id === bimId);
      return e ? buildBeamRows(e, t, edit) : [];
    }
    case 'slab': {
      const e = slabs.find((sl) => sl.id === bimId);
      return e ? buildSlabRows(e, t, edit) : [];
    }
    default:
      return [];
  }
}

function EditableValue({ spec: s, label }: { spec: EditSpec; label: string }) {
  return (
    <input
      type="number"
      // key on raw so the field resets to the committed value after each edit
      key={s.raw}
      defaultValue={s.raw}
      step={s.unit === 'm' ? 0.01 : 1}
      min={s.min}
      aria-label={label}
      className="w-24 rounded border border-input bg-background px-1 text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur(); }}
      onBlur={(ev) => {
        const v = Number(ev.target.value);
        if (!Number.isFinite(v)) { ev.target.value = String(s.raw); return; }
        if (s.min !== undefined && v < s.min) { ev.target.value = String(s.raw); return; }
        if (v !== s.raw) s.commit(v);
      }}
    />
  );
}

export function BimGeometryTab({ bimId, bimType }: BimGeometryTabProps) {
  const { t } = useTranslation('bim3d');
  const edit = useBimGeometryEdit();
  const rows = resolveRows(bimId, bimType, t, edit);

  if (rows.length === 0) return null;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sm">
      {rows.map(({ label, value, edit: editSpec }) => (
        <Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          {editSpec ? (
            <dd className="flex items-center gap-1 font-mono text-foreground">
              <EditableValue spec={editSpec} label={label} />
              <span className="text-muted-foreground">{editSpec.unit}</span>
            </dd>
          ) : (
            <dd className="font-mono text-foreground">{value}</dd>
          )}
        </Fragment>
      ))}
    </dl>
  );
}
