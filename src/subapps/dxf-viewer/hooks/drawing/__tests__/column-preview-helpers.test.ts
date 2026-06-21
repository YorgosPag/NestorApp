/**
 * ADR-398 §3.8 — column WYSIWYG preview helper tests.
 *
 * Verifies that `generateColumnPreview` builds the SAME entity the commit path
 * builds (preview === commit): snapped position via ImmediateSnap, anchor
 * precedence via the face-snap / ghost-status SSoT, ribbon kind/dims via the
 * column-tool bridge, and the 🔴 overlap status schematic. Pure — μηδέν canvas.
 */

import { generateColumnPreview } from '../column-preview-helpers';
import { columnToolBridgeStore } from '../../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { setImmediateSnap, clearImmediateSnap } from '../../../systems/cursor/ImmediateSnapStore';
import {
  setColumnGhostStatus,
  setColumnFaceAnchor,
  clearColumnGhostStatus,
} from '../../../systems/cursor/ColumnPlacementGhostStatusStore';
import type { ColumnAnchor, ColumnKind } from '../../../bim/types/column-types';
import type { ColumnParamOverrides } from '../column-completion';

interface BridgeOpts {
  readonly kind?: ColumnKind;
  readonly anchor?: ColumnAnchor;
  readonly overrides?: ColumnParamOverrides;
  readonly isActive?: boolean;
}

function activateColumnBridge(opts: BridgeOpts = {}): void {
  columnToolBridgeStore.set({
    isActive: opts.isActive ?? true,
    kind: opts.kind ?? 'rectangular',
    anchor: opts.anchor ?? 'center',
    overrides: opts.overrides ?? {},
    setKind: () => undefined,
    setAnchor: () => undefined,
    setParamOverrides: () => undefined,
    getSceneUnits: () => 'mm',
  });
}

interface PreviewColumn {
  readonly type: string;
  readonly id: string;
  readonly preview?: boolean;
  readonly wysiwygPreview?: boolean;
  readonly ghostStatusColor?: { readonly stroke: string; readonly fill: string } | null;
  readonly params: {
    readonly anchor: ColumnAnchor;
    readonly kind: ColumnKind;
    readonly width: number;
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
  };
}

describe('generateColumnPreview (ADR-398 §3.8 WYSIWYG)', () => {
  afterEach(() => {
    columnToolBridgeStore.set(null);
    clearImmediateSnap();
    clearColumnGhostStatus();
  });

  it('returns null when the column tool is inactive (no bridge handle)', () => {
    columnToolBridgeStore.set(null);
    expect(generateColumnPreview({ x: 0, y: 0 })).toBeNull();
  });

  it('returns null when the bridge handle is present but isActive=false', () => {
    activateColumnBridge({ isActive: false });
    expect(generateColumnPreview({ x: 0, y: 0 })).toBeNull();
  });

  it('free placement → full WYSIWYG ColumnEntity at the raw cursor + ribbon anchor', () => {
    activateColumnBridge({ anchor: 'center' });
    clearImmediateSnap(); // no snap armed → raw cursor
    setColumnGhostStatus('neutral');
    setColumnFaceAnchor(null);
    const ghost = generateColumnPreview({ x: 100, y: 200 }) as PreviewColumn;
    expect(ghost).not.toBeNull();
    expect(ghost.type).toBe('column');
    expect(ghost.id).toBe('preview_column_ghost');
    expect(ghost.preview).toBe(true);
    expect(ghost.wysiwygPreview).toBe(true);
    // valid placement → real renderer (no red status schematic).
    expect(ghost.ghostStatusColor ?? null).toBeNull();
    expect(ghost.params.anchor).toBe('center');
    expect(ghost.params.position.x).toBeCloseTo(100);
    expect(ghost.params.position.y).toBeCloseTo(200);
  });

  it('uses the snapped point from ImmediateSnap (preview === commit click point)', () => {
    activateColumnBridge();
    setImmediateSnap({ found: true, point: { x: 555, y: 666 }, mode: 'endpoint' });
    const ghost = generateColumnPreview({ x: 0, y: 0 }) as PreviewColumn;
    expect(ghost.params.position.x).toBeCloseTo(555);
    expect(ghost.params.position.y).toBeCloseTo(666);
  });

  it('face-snap → adopts the auto-selected face anchor (flush παρειά)', () => {
    activateColumnBridge({ anchor: 'center' });
    setColumnFaceAnchor('se');
    setColumnGhostStatus('beam');
    const ghost = generateColumnPreview({ x: 0, y: 0 }) as PreviewColumn;
    expect(ghost.params.anchor).toBe('se');
  });

  it('beam status without a face anchor → centered anchor (κέντρο ≡ άξονας δοκαριού)', () => {
    activateColumnBridge({ anchor: 'nw' });
    setColumnFaceAnchor(null);
    setColumnGhostStatus('beam');
    const ghost = generateColumnPreview({ x: 0, y: 0 }) as PreviewColumn;
    expect(ghost.params.anchor).toBe('center');
  });

  it('overlap status → red ghostStatusColor (collision warning schematic)', () => {
    activateColumnBridge();
    setColumnGhostStatus('overlap');
    const ghost = generateColumnPreview({ x: 0, y: 0 }) as PreviewColumn;
    expect(ghost.ghostStatusColor).not.toBeNull();
    expect(ghost.ghostStatusColor!.stroke).toBe('#d23b3b');
  });

  it('respects ribbon kind + width overrides (WYSIWYG dims == committed dims)', () => {
    activateColumnBridge({ kind: 'rectangular', overrides: { width: 800, depth: 600 } });
    const ghost = generateColumnPreview({ x: 0, y: 0 }) as PreviewColumn;
    expect(ghost.params.kind).toBe('rectangular');
    expect(ghost.params.width).toBe(800);
  });
});
