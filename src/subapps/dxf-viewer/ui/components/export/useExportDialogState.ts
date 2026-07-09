'use client';

/**
 * ADR-505 — Export dialog · form state hook.
 *
 * Owns the «Εξαγωγή» dialog's session fields (format, content scope, floor
 * scope, DXF version/unit) and derives an `ExportRequest`. React state only —
 * no I/O.
 *
 * @module subapps/dxf-viewer/ui/components/export/useExportDialogState
 */

import * as React from 'react';
import type { DxfVersion, DxfUnit } from '../../../types/dxf-export.types';
import { DEFAULT_DXF_VERSION } from '../../../types/dxf-export.types';

// Default export unit = metres. Greek structural CAD (Tekton/FESPA) works in
// metres (its drawing-area limit is ~4000 m); exporting raw mm coordinates lands
// the geometry thousands of "metres" away. The user can still pick mm/cm.
const DEFAULT_EXPORT_UNIT: DxfUnit = 'meters';
import type {
  ExportFormat,
  ExportEntityScope,
  ExportFloorScope,
  ExportRequest,
  DxfLineMode,
  TekSymbolMode,
} from '../../../export/types';
import { scopeIncludesBim } from '../../../export/core/export-entity-scope';

export interface ExportDialogState {
  format: ExportFormat;
  setFormat: (f: ExportFormat) => void;
  entityScope: ExportEntityScope;
  setEntityScope: (s: ExportEntityScope) => void;
  floorScope: ExportFloorScope;
  setFloorScope: (s: ExportFloorScope) => void;
  dxfVersion: DxfVersion;
  setDxfVersion: (v: DxfVersion) => void;
  dxfUnit: DxfUnit;
  setDxfUnit: (u: DxfUnit) => void;
  dxfLineMode: DxfLineMode;
  setDxfLineMode: (m: DxfLineMode) => void;
  tekSymbolMode: TekSymbolMode;
  setTekSymbolMode: (m: TekSymbolMode) => void;
  /** True when current format requires BIM content (IFC) but scope excludes it. */
  readonly scopeConflictsWithFormat: boolean;
  buildRequest: () => ExportRequest;
}

export function useExportDialogState(): ExportDialogState {
  const [format, setFormat] = React.useState<ExportFormat>('dxf');
  const [entityScope, setEntityScope] = React.useState<ExportEntityScope>('both');
  const [floorScope, setFloorScope] = React.useState<ExportFloorScope>('active');
  const [dxfVersion, setDxfVersion] = React.useState<DxfVersion>(DEFAULT_DXF_VERSION);
  const [dxfUnit, setDxfUnit] = React.useState<DxfUnit>(DEFAULT_EXPORT_UNIT);
  // Default 'polyline' (AutoCAD/standard — proper objects). Switch to 'lines'
  // for Τέκτονας/FESPA, whose basic parser reads only LINE/TEXT/CIRCLE.
  const [dxfLineMode, setDxfLineMode] = React.useState<DxfLineMode>('polyline');
  // Default 'native' — annotation symbols → ΕΝΑ built-in Tekton object (ενιαίο πακέτο).
  // Switch to 'geometry' to keep our exact glyph geometry (grouped with tags).
  const [tekSymbolMode, setTekSymbolMode] = React.useState<TekSymbolMode>('native');

  // IFC/TEK carry only BIM elements → a `dxf-only` scope produces an empty model.
  const scopeConflictsWithFormat =
    (format === 'ifc' || format === 'tek') && !scopeIncludesBim(entityScope);

  const buildRequest = React.useCallback(
    (): ExportRequest => ({
      format,
      entityScope,
      floorScope,
      dxfVersion: format === 'dxf' ? dxfVersion : undefined,
      dxfUnit: format === 'dxf' ? dxfUnit : undefined,
      dxfLineMode: format === 'dxf' ? dxfLineMode : undefined,
      tekSymbolMode: format === 'tek' ? tekSymbolMode : undefined,
    }),
    [format, entityScope, floorScope, dxfVersion, dxfUnit, dxfLineMode, tekSymbolMode],
  );

  return {
    format,
    setFormat,
    entityScope,
    setEntityScope,
    floorScope,
    setFloorScope,
    dxfVersion,
    setDxfVersion,
    dxfUnit,
    setDxfUnit,
    dxfLineMode,
    setDxfLineMode,
    tekSymbolMode,
    setTekSymbolMode,
    scopeConflictsWithFormat,
    buildRequest,
  };
}
