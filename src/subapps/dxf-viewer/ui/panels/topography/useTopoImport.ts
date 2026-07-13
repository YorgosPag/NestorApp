'use client';
/**
 * ADR-650 Milestone 2 — Import-wizard orchestration (all state, zero markup).
 *
 * The wizard component stays a pure renderer: every decision — which reader a file needs,
 * whether the mapping step applies, how many points the current mapping would yield — is
 * resolved here, on top of the pure `systems/topography` modules.
 *
 * Two roads (Q9), one destination (`TopoPointStore`):
 *
 *   CSV / TXT / XYZ / XLSX →  RawTable  →  [mapping + unit]  →  TopoPoint[]  ─┐
 *   DXF                    →  POINT / TEXT extraction        →  TopoPoint[]  ─┴→ setTopoPoints
 *
 * The DXF road carries its own coordinates and needs no column mapping, so it SKIPS the
 * mapping step — same as Civil 3D, which only shows the format dialog for point files.
 */

import * as React from 'react';
import { setTopoPoints } from '../../../systems/topography/TopoPointStore';
import { readDelimitedText } from '../../../systems/topography/topo-delimited-reader';
import { readExcelToTable } from '../../../systems/topography/topo-excel-reader';
import { extractTopoPointsFromDxf } from '../../../systems/topography/topo-dxf-points';
import { applyColumnMapping, isMappingComplete, suggestMappingFromHeaders } from '../../../systems/topography/topo-column-mapping';
import { getOrderPresetMapping } from '../../../systems/topography/topo-order-presets';
import type { ColumnMapping, ColumnRole, RawTable, TopoUnit } from '../../../systems/topography/topo-import-types';
import type { TopoPoint, TopoSurfaceId } from '../../../systems/topography/topo-types';

export type TopoImportStep = 'source' | 'mapping' | 'confirm';

/** File extension → which reader handles it. */
function readerFor(fileName: string): 'delimited' | 'excel' | 'dxf' {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (ext === '.xlsx' || ext === '.xlsm') return 'excel';
  if (ext === '.dxf') return 'dxf';
  return 'delimited';
}

export interface UseTopoImport {
  readonly step: TopoImportStep;
  readonly fileName: string | null;
  readonly table: RawTable | null;
  readonly mapping: ColumnMapping;
  readonly unit: TopoUnit;
  /** Points the CURRENT mapping/unit would import (live preview — recomputed as roles change). */
  readonly points: readonly TopoPoint[];
  /** Rows that would be dropped (unparseable X/Y/Z). */
  readonly skippedCount: number;
  readonly error: string | null;
  readonly busy: boolean;
  readonly canProceed: boolean;
  readonly loadFile: (file: File) => Promise<void>;
  readonly setRole: (columnIndex: number, role: ColumnRole) => void;
  readonly applyPreset: (presetId: string) => void;
  readonly setUnit: (unit: TopoUnit) => void;
  readonly back: () => void;
  readonly next: () => void;
  /** Commit the previewed points into the store (replaces the current set). */
  readonly commit: () => number;
  readonly reset: () => void;
}

/**
 * ADR-650 M6: the wizard imports into a NAMED surface. `existing` (the survey) is the default —
 * every M2 call-site keeps working — while the earthworks panel points the very same wizard at
 * `proposed` (the designed ground). One import road, two destinations; a second wizard for
 * "the other surface" would be the classic sibling clone.
 */
export function useTopoImport(surface: TopoSurfaceId = 'existing'): UseTopoImport {
  const [step, setStep] = React.useState<TopoImportStep>('source');
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [table, setTable] = React.useState<RawTable | null>(null);
  const [dxfPoints, setDxfPoints] = React.useState<readonly TopoPoint[] | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping>([]);
  const [unit, setUnit] = React.useState<TopoUnit>('m');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = React.useCallback(() => {
    setStep('source');
    setFileName(null);
    setTable(null);
    setDxfPoints(null);
    setMapping([]);
    setUnit('m');
    setError(null);
    setBusy(false);
  }, []);

  const loadFile = React.useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const kind = readerFor(file.name);
      setFileName(file.name);

      if (kind === 'dxf') {
        // DXF already carries world coordinates + elevations → straight to confirmation.
        setDxfPoints(extractTopoPointsFromDxf(await file.text()).points);
        setTable(null);
        setStep('confirm');
        return;
      }

      const parsed = kind === 'excel'
        ? await readExcelToTable(await file.arrayBuffer())
        : readDelimitedText(await file.text());

      setDxfPoints(null);
      setTable(parsed);
      setMapping(initialMapping(parsed));
      setStep('mapping');
    } catch {
      setError('read');
    } finally {
      setBusy(false);
    }
  }, []);

  const setRole = React.useCallback((columnIndex: number, role: ColumnRole) => {
    setMapping((prev) => assignRole(prev, columnIndex, role));
  }, []);

  const applyPreset = React.useCallback((presetId: string) => {
    const preset = getOrderPresetMapping(presetId);
    if (!preset) return;
    setMapping((prev) => padMapping(preset, prev.length));
  }, []);

  // Live preview — the surveyor sees the point count react to every dropdown change.
  const mapped = React.useMemo(() => {
    if (dxfPoints) return { points: dxfPoints, skipped: [] as readonly number[] };
    if (!table) return { points: [] as readonly TopoPoint[], skipped: [] as readonly number[] };
    return applyColumnMapping(table, mapping, unit);
  }, [dxfPoints, table, mapping, unit]);

  const canProceed = step === 'mapping'
    ? isMappingComplete(mapping) && mapped.points.length > 0
    : mapped.points.length > 0;

  const next = React.useCallback(() => setStep((s) => (s === 'mapping' ? 'confirm' : s)), []);
  const back = React.useCallback(() => {
    setStep((s) => (s === 'confirm' && !dxfPoints ? 'mapping' : 'source'));
  }, [dxfPoints]);

  const commit = React.useCallback(() => {
    setTopoPoints(mapped.points, surface);
    return mapped.points.length;
  }, [mapped, surface]);

  return {
    step, fileName, table, mapping, unit,
    points: mapped.points,
    skippedCount: mapped.skipped.length,
    error, busy, canProceed,
    loadFile, setRole, applyPreset, setUnit, back, next, commit, reset,
  };
}

// ─── Pure mapping helpers ──────────────────────────────────────────────────────

/** Header labels give a first guess; a header-less file starts fully unmapped. */
function initialMapping(table: RawTable): ColumnMapping {
  const width = Math.max(table.headers.length, ...table.rows.map((r) => r.length), 0);
  if (table.headers.length > 0) return padMapping(suggestMappingFromHeaders(table.headers), width);
  return Array.from({ length: width }, () => 'ignore' as ColumnRole);
}

/** Stretch/truncate a mapping to the table's column count. */
function padMapping(mapping: ColumnMapping, width: number): ColumnMapping {
  return Array.from({ length: width }, (_, i) => mapping[i] ?? ('ignore' as ColumnRole));
}

/**
 * Assign a role, releasing whichever column held it before. A role is single-occupancy
 * (X cannot be two columns), so picking it elsewhere must vacate the old one — otherwise
 * `isMappingComplete` would reject a mapping the surveyor believes they just fixed.
 */
function assignRole(mapping: ColumnMapping, columnIndex: number, role: ColumnRole): ColumnMapping {
  return mapping.map((current, i) => {
    if (i === columnIndex) return role;
    return role !== 'ignore' && current === role ? 'ignore' : current;
  });
}
