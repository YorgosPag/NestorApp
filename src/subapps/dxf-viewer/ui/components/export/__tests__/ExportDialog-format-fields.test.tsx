/**
 * ExportDialog — per-format field visibility (ADR-608 Φ-grouping v2).
 *
 * Guards the conditional render of the format-specific rows:
 *   - `dxf`  → DXF version / unit / line-mode fields visible, tek symbol hidden.
 *   - `tek`  → «Σύμβολα» (native vs geometry) field visible, DXF rows hidden.
 *
 * The Radix Dialog/Select primitives are stubbed to passthroughs so the test
 * isolates `ExportDialog`'s branching from third-party portal/pointer behaviour.
 * Mocks are declared before any other import so the swc-jest hoister keeps them
 * ahead of the source-file resolution chain.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: () => {}, warn: () => {}, info: () => {}, debug: () => {} }),
}));

// Stub the design-system dialog/select/button so no border/color/icon hooks or
// Radix portals run — we only care about which <Field> rows mount. `require`
// react inside the factory because jest hoists this above the top-level import.
jest.mock('@/components/ui/dialog', () => {
  const R = require('react');
  const Pass = ({ children }: { children?: unknown }) => R.createElement('div', null, children);
  return {
    Dialog: Pass,
    DialogContent: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
  };
});

jest.mock('@/components/ui/select', () => {
  const R = require('react');
  const Pass = ({ children }: { children?: unknown }) => R.createElement('div', null, children);
  return {
    Select: Pass,
    SelectContent: Pass,
    SelectItem: Pass,
    SelectTrigger: Pass,
    SelectValue: Pass,
  };
});

jest.mock('@/components/ui/button', () => {
  const R = require('react');
  return { Button: ({ children }: { children?: unknown }) => R.createElement('button', { type: 'button' }, children) };
});

// Controllable state hook — each test drives `format`.
jest.mock('../useExportDialogState', () => ({
  useExportDialogState: () => (globalThis as { __mockExportState?: unknown }).__mockExportState,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import type { ExportDialogState } from '../useExportDialogState';
import { ExportDialog } from '../ExportDialog';

/**
 * Complete `ExportDialogState`. Typed WITHOUT `as unknown as` on purpose: the cast used to
 * hide missing fields (`dxfImageFillMode`/`tekHatchMode` had silently drifted out), so a new
 * per-format row could ship with its state field unset and this suite would still pass.
 * Now a missing field is a compile error — which is the whole point of the fixture.
 */
function makeState(format: ExportDialogState['format']): ExportDialogState {
  return {
    format,
    setFormat: () => {},
    entityScope: 'both',
    setEntityScope: () => {},
    floorScope: 'active',
    setFloorScope: () => {},
    dxfVersion: 'AC1027',
    setDxfVersion: () => {},
    dxfUnit: 'meters',
    setDxfUnit: () => {},
    dxfLineMode: 'polyline',
    setDxfLineMode: () => {},
    dxfImageFillMode: 'solid',
    setDxfImageFillMode: () => {},
    tekSymbolMode: 'native',
    setTekSymbolMode: () => {},
    tekHatchMode: 'native',
    setTekHatchMode: () => {},
    // ADR-668 — 3Δ mesh export unit (OBJ only).
    mesh3dUnit: 'centimeters',
    setMesh3dUnit: () => {},
    scopeConflictsWithFormat: false,
    buildRequest: () => ({ format, entityScope: 'both', floorScope: 'active' }),
  };
}

function renderDialog(format: ExportDialogState['format']) {
  (globalThis as { __mockExportState?: unknown }).__mockExportState = makeState(format);
  return render(<ExportDialog open onOpenChange={() => {}} onSubmit={async () => {}} />);
}

describe('ExportDialog — per-format fields', () => {
  it('shows the «Σύμβολα» (tekSymbolMode) field when format = tek', () => {
    renderDialog('tek');
    expect(screen.getByText('export.tekSymbolMode')).toBeInTheDocument();
    expect(screen.queryByText('export.dxfLineMode')).not.toBeInTheDocument();
  });

  it('shows the DXF rows (and hides tekSymbolMode) when format = dxf', () => {
    renderDialog('dxf');
    expect(screen.getByText('export.dxfLineMode')).toBeInTheDocument();
    expect(screen.getByText('export.dxfVersion')).toBeInTheDocument();
    expect(screen.queryByText('export.tekSymbolMode')).not.toBeInTheDocument();
  });

  it('hides both DXF and tek rows when format = ifc', () => {
    renderDialog('ifc');
    expect(screen.queryByText('export.dxfLineMode')).not.toBeInTheDocument();
    expect(screen.queryByText('export.tekSymbolMode')).not.toBeInTheDocument();
  });

  // ADR-668 — the unit field is the user's answer to «γιατί βγαίνει 100× μικρό στο C4D».
  it('shows the «Μονάδες» field + hint when format = obj', () => {
    renderDialog('obj');
    expect(screen.getByText('export.mesh3dUnit')).toBeInTheDocument();
    expect(screen.getByText('export.mesh3dUnitHint')).toBeInTheDocument();
    expect(screen.queryByText('export.dxfUnit')).not.toBeInTheDocument();
    expect(screen.queryByText('export.tekSymbolMode')).not.toBeInTheDocument();
  });

  // glTF is spec-locked to metres → offering a unit would promise a choice the exporter
  // is bound to ignore. It gets a note instead of a field.
  it('hides the unit field and explains why when format = gltf', () => {
    renderDialog('gltf');
    expect(screen.queryByText('export.mesh3dUnit')).not.toBeInTheDocument();
    expect(screen.getByText('export.mesh3dGltfUnitNote')).toBeInTheDocument();
  });
});
