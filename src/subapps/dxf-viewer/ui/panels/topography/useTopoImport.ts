'use client';
/**
 * ADR-650 Milestone 2 (+ M8α) — Import-wizard orchestration (all state, zero markup).
 *
 * The wizard component stays a pure renderer: every decision — which reader a file needs,
 * whether the mapping step applies, how many points the current mapping would yield — is
 * resolved here, on top of the pure `systems/topography` modules.
 *
 * Four roads (Q9), one destination (`TopoPointStore`):
 *
 *   CSV / TXT / XLSX        →  RawTable  →  [mapping + unit]  →  TopoPoint[]  ─┐
 *   DXF                     →  POINT / TEXT extraction        →  TopoPoint[]  ─┤
 *   LAS / LAZ / XYZ / PTS   →  bare-earth filter (CSF)         →  TopoPoint[]  ─┴→ setTopoPoints
 *                              (see `cloud` step, M8α)
 *
 * The DXF road carries its own coordinates and needs no column mapping, same as Civil 3D, which
 * only shows the format dialog for point files. The point-cloud road ALSO skips mapping — a
 * bulk cloud carries raw XYZ (+ optional ASPRS classification), never a described column order —
 * but unlike DXF it needs an extra step: `'cloud'`, where the engineer reviews the bare-earth
 * filter (source classification or CSF) and the decimated preview BEFORE it reaches `confirm`.
 */

import * as React from 'react';
import { setTopoPoints } from '../../../systems/topography/TopoPointStore';
import { readDelimitedText } from '../../../systems/topography/topo-delimited-reader';
import { readExcelToTable } from '../../../systems/topography/topo-excel-reader';
import { extractTopoPointsFromDxf } from '../../../systems/topography/topo-dxf-points';
import { applyColumnMapping, isMappingComplete, suggestMappingFromHeaders } from '../../../systems/topography/topo-column-mapping';
import { getOrderPresetMapping } from '../../../systems/topography/topo-order-presets';
import { isPointCloudFile, importPointCloud } from '../../../io/pointcloud-import';
import { CSF_DEFAULTS, VOXEL_DEFAULTS, READ_DEFAULTS } from '../../../systems/topography/pointcloud/pointcloud-defaults';
import type { ColumnMapping, ColumnRole, RawTable, TopoUnit } from '../../../systems/topography/topo-import-types';
import type { TopoPoint, TopoSurfaceId } from '../../../systems/topography/topo-types';
import type {
  CsfOptions,
  PointCloudImportProgress,
  PointCloudPipelineResult,
  VoxelDecimateOptions,
} from '../../../systems/topography/pointcloud/pointcloud-types';

export type TopoImportStep = 'source' | 'mapping' | 'cloud' | 'confirm';

/** i18n key used when a cloud filter rejects with something other than an `Error`. */
const CLOUD_ERROR_FALLBACK_KEY = 'topography.pointcloud.error.unknown';

/** File extension → which reader handles it. */
function readerFor(fileName: string): 'delimited' | 'excel' | 'dxf' | 'pointcloud' {
  if (isPointCloudFile(fileName)) return 'pointcloud';
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
  /** Points the CURRENT mapping/unit (or cloud filter result) would import — live preview. */
  readonly points: readonly TopoPoint[];
  /** Rows that would be dropped (unparseable X/Y/Z). Always 0 on the cloud road. */
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

  // ─── Point-cloud road (ADR-650 M8α) ─────────────────────────────────────────
  readonly csf: CsfOptions;
  readonly decimate: VoxelDecimateOptions;
  readonly forceCsf: boolean;
  readonly cloudResult: PointCloudPipelineResult | null;
  readonly cloudProgress: PointCloudImportProgress | null;
  readonly cloudError: string | null;
  readonly updateCsf: (patch: Partial<CsfOptions>) => void;
  readonly updateDecimate: (patch: Partial<VoxelDecimateOptions>) => void;
  readonly setForceCsf: (value: boolean) => void;
  /** Run the bare-earth filter over the loaded file with the current csf/decimate/unit options. */
  readonly runCloudFilter: () => Promise<void>;
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

  const [cloudFile, setCloudFile] = React.useState<File | null>(null);
  const [csf, setCsf] = React.useState<CsfOptions>(CSF_DEFAULTS);
  const [decimate, setDecimate] = React.useState<VoxelDecimateOptions>(VOXEL_DEFAULTS);
  const [forceCsf, setForceCsf] = React.useState(false);
  const [cloudResult, setCloudResult] = React.useState<PointCloudPipelineResult | null>(null);
  const [cloudProgress, setCloudProgress] = React.useState<PointCloudImportProgress | null>(null);
  const [cloudError, setCloudError] = React.useState<string | null>(null);

  const reset = React.useCallback(() => {
    setStep('source');
    setFileName(null);
    setTable(null);
    setDxfPoints(null);
    setMapping([]);
    setUnit('m');
    setError(null);
    setBusy(false);
    setCloudFile(null);
    setCsf(CSF_DEFAULTS);
    setDecimate(VOXEL_DEFAULTS);
    setForceCsf(false);
    setCloudResult(null);
    setCloudProgress(null);
    setCloudError(null);
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

      if (kind === 'pointcloud') {
        // Bulk buffer, own coordinates, no described column order → the `cloud` step, not mapping.
        setDxfPoints(null);
        setTable(null);
        setCloudFile(file);
        setCloudResult(null);
        setCloudProgress(null);
        setCloudError(null);
        setStep('cloud');
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

  const updateCsf = React.useCallback((patch: Partial<CsfOptions>) => {
    setCsf((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateDecimate = React.useCallback((patch: Partial<VoxelDecimateOptions>) => {
    setDecimate((prev) => ({ ...prev, ...patch }));
  }, []);

  const runCloudFilter = React.useCallback(async () => {
    if (!cloudFile) return;
    setBusy(true);
    setCloudError(null);
    setCloudProgress(null);
    try {
      const result = await importPointCloud(
        cloudFile,
        { read: { unit, maxPointsInMemory: READ_DEFAULTS.maxPointsInMemory }, csf, decimate, forceCsf },
        setCloudProgress,
      );
      setCloudResult(result);
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : CLOUD_ERROR_FALLBACK_KEY);
    } finally {
      setBusy(false);
    }
  }, [cloudFile, unit, csf, decimate, forceCsf]);

  // Live preview — the surveyor sees the point count react to every dropdown change.
  const mapped = React.useMemo(() => {
    if (cloudResult) return { points: cloudResult.points, skipped: [] as readonly number[] };
    if (dxfPoints) return { points: dxfPoints, skipped: [] as readonly number[] };
    if (!table) return { points: [] as readonly TopoPoint[], skipped: [] as readonly number[] };
    return applyColumnMapping(table, mapping, unit);
  }, [cloudResult, dxfPoints, table, mapping, unit]);

  const canProceed = step === 'mapping'
    ? isMappingComplete(mapping) && mapped.points.length > 0
    : step === 'cloud'
      ? cloudResult !== null && cloudResult.points.length > 0
      : mapped.points.length > 0;

  const next = React.useCallback(() => setStep((s) => (s === 'mapping' || s === 'cloud' ? 'confirm' : s)), []);
  const back = React.useCallback(() => {
    setStep((s) => {
      if (s !== 'confirm') return 'source';
      if (dxfPoints) return 'source';
      if (cloudResult) return 'cloud';
      return 'mapping';
    });
  }, [dxfPoints, cloudResult]);

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
    csf, decimate, forceCsf, cloudResult, cloudProgress, cloudError,
    updateCsf, updateDecimate, setForceCsf, runCloudFilter,
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
