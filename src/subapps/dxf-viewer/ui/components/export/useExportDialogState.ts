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
  DxfImageFillMode,
  TekSymbolMode,
  TekHatchMode,
  ExportLengthUnit,
} from '../../../export/types';
import { isMesh3dFormat } from '../../../export/types';
import { scopeIncludesBim } from '../../../export/core/export-entity-scope';

/**
 * ADR-668 — default μονάδα OBJ = **εκατοστά**. Ο three κόσμος είναι μέτρα (ADR-462) και το OBJ
 * δεν αποθηκεύει μονάδα· το C4D διαβάζει OBJ ως εκατοστά → με μέτρα το μοντέλο άνοιγε 100×
 * μικρό και ο χρήστης έπρεπε να βάζει Scale 100 στο χέρι.
 */
const DEFAULT_MESH3D_UNIT: ExportLengthUnit = 'centimeters';

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
  dxfImageFillMode: DxfImageFillMode;
  setDxfImageFillMode: (m: DxfImageFillMode) => void;
  tekSymbolMode: TekSymbolMode;
  setTekSymbolMode: (m: TekSymbolMode) => void;
  tekHatchMode: TekHatchMode;
  setTekHatchMode: (m: TekHatchMode) => void;
  /** ADR-668 — μονάδα του εξαγόμενου OBJ (το glTF είναι spec-locked σε μέτρα). */
  mesh3dUnit: ExportLengthUnit;
  setMesh3dUnit: (u: ExportLengthUnit) => void;
  /** True when current format requires BIM content (IFC/TEK/3Δ) but scope excludes it. */
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
  // ADR-643 Φ5b — image-fill hatch export mode. Default 'solid' (Ελαφρύ: μέσο χρώμα, πάντα
  // ανοίγει, single-file). Switch to 'image' για πιστό tiled IMAGE + raster bundled σε zip.
  const [dxfImageFillMode, setDxfImageFillMode] = React.useState<DxfImageFillMode>('solid');
  // Default 'native' — annotation symbols → ΕΝΑ built-in Tekton object (ενιαίο πακέτο).
  // Switch to 'geometry' to keep our exact glyph geometry (grouped with tags).
  const [tekSymbolMode, setTekSymbolMode] = React.useState<TekSymbolMode>('native');
  // ADR-648 Στάδιο Ε — default 'native': μοτίβο της βιβλιοθήκης του Τέκτονα → ελαφρύ αρχείο +
  // επεξεργάσιμο hatch, αλλά ΚΑΤΑ ΠΡΟΣΕΓΓΙΣΗ. 'exploded' → οι ακριβείς γραμμές (πλήρης ταύτιση
  // με το AutoCAD) με τίμημα το μέγεθος (μετρημένο: πραγματικό σχέδιο 107 MB).
  const [tekHatchMode, setTekHatchMode] = React.useState<TekHatchMode>('native');
  const [mesh3dUnit, setMesh3dUnit] = React.useState<ExportLengthUnit>(DEFAULT_MESH3D_UNIT);

  // IFC/TEK/3Δ carry only BIM elements → a `dxf-only` scope produces an empty model.
  // ADR-668 — the 3Δ formats join this rule because 2D primitives (line/arc/text) have no
  // solid body: an OBJ of them would be a valid, empty file.
  const scopeConflictsWithFormat =
    (format === 'ifc' || format === 'tek' || isMesh3dFormat(format)) && !scopeIncludesBim(entityScope);

  const buildRequest = React.useCallback(
    (): ExportRequest => ({
      format,
      entityScope,
      floorScope,
      dxfVersion: format === 'dxf' ? dxfVersion : undefined,
      dxfUnit: format === 'dxf' ? dxfUnit : undefined,
      dxfLineMode: format === 'dxf' ? dxfLineMode : undefined,
      dxfImageFillMode: format === 'dxf' ? dxfImageFillMode : undefined,
      tekSymbolMode: format === 'tek' ? tekSymbolMode : undefined,
      tekHatchMode: format === 'tek' ? tekHatchMode : undefined,
      // ADR-668/678 — OBJ & COLLADA carry an explicit unit; glTF is spec-locked to metres, so
      // sending a unit there would imply a choice the exporter is bound to ignore.
      mesh3dUnit: format === 'obj' || format === 'dae' ? mesh3dUnit : undefined,
    }),
    [
      format, entityScope, floorScope, dxfVersion, dxfUnit, dxfLineMode, dxfImageFillMode,
      tekSymbolMode, tekHatchMode, mesh3dUnit,
    ],
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
    dxfImageFillMode,
    setDxfImageFillMode,
    tekSymbolMode,
    setTekSymbolMode,
    tekHatchMode,
    setTekHatchMode,
    mesh3dUnit,
    setMesh3dUnit,
    scopeConflictsWithFormat,
    buildRequest,
  };
}
