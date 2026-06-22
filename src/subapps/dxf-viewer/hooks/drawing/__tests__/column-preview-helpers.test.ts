/**
 * ADR-398 §3.10 — column WYSIWYG preview helper tests (sync-in-preview).
 *
 * Verifies that `generateColumnPreview` builds the SAME entity the commit path builds
 * (preview === commit): it computes the face-snap **synchronously** from the pre-collected
 * `sceneSnapTargetsStore` targets + the snapped cursor (`ImmediateSnap`), adopts the auto face
 * anchor / §3.9 wall-axis center, and renders the 🔴 overlap status schematic for beam
 * short-ends. Pure — μηδέν canvas, μηδέν async scheduler.
 */

import { generateColumnPreview } from '../column-preview-helpers';
import { columnToolBridgeStore } from '../../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { setImmediateSnap, clearImmediateSnap } from '../../../systems/cursor/ImmediateSnapStore';
import { sceneSnapTargetsStore, type SceneSnapTargets } from '../../../bim/framing/scene-snap-targets';
import type { LinearMemberSnapTarget } from '../../../bim/framing/linear-member-face-snap';
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

/** Οριζόντιο δοκάρι: x −1000..1000, y −150..150 (endsAxis x). */
const horizontalBeam: LinearMemberSnapTarget = {
  id: 'beam-h',
  axis: [{ x: -1000, y: 0 }, { x: 1000, y: 0 }],
  outline: [{ x: -1000, y: -150 }, { x: 1000, y: -150 }, { x: 1000, y: 150 }, { x: -1000, y: 150 }],
};

/** Οριζόντιος τοίχος: άξονας y=0 (x −1000..1000), πάχος 200 (y ±100). halfThickness=100, όριο=50. */
const horizontalWall: LinearMemberSnapTarget = {
  id: 'wall-h',
  axis: [{ x: -1000, y: 0 }, { x: 1000, y: 0 }],
  outline: [{ x: -1000, y: 100 }, { x: 1000, y: 100 }, { x: 1000, y: -100 }, { x: -1000, y: -100 }],
};

/** Τετράγωνη πλάκα: x 0..2000, y 0..2000 (μία ακμή ανά πλευρά). */
const slabSquare: LinearMemberSnapTarget[] = [
  { id: 's#0', axis: [{ x: 0, y: 0 }, { x: 2000, y: 0 }], outline: [{ x: 0, y: 2 }, { x: 2000, y: 2 }, { x: 2000, y: -2 }, { x: 0, y: -2 }] },
  { id: 's#1', axis: [{ x: 2000, y: 0 }, { x: 2000, y: 2000 }], outline: [{ x: 1998, y: 0 }, { x: 2002, y: 0 }, { x: 2002, y: 2000 }, { x: 1998, y: 2000 }] },
];

function setTargets(t: Partial<SceneSnapTargets>): void {
  sceneSnapTargetsStore.set({
    footprints: t.footprints ?? [],
    beamTargets: t.beamTargets ?? [],
    wallTargets: t.wallTargets ?? [],
    slabTargets: t.slabTargets ?? [],
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

describe('generateColumnPreview (ADR-398 §3.10 sync-in-preview)', () => {
  afterEach(() => {
    columnToolBridgeStore.set(null);
    clearImmediateSnap();
    sceneSnapTargetsStore.reset();
  });

  it('returns null when the column tool is inactive (no bridge handle)', () => {
    columnToolBridgeStore.set(null);
    expect(generateColumnPreview({ x: 0, y: 0 })).toBeNull();
  });

  it('returns null when the bridge handle is present but isActive=false', () => {
    activateColumnBridge({ isActive: false });
    expect(generateColumnPreview({ x: 0, y: 0 })).toBeNull();
  });

  it('free placement (no targets) → full WYSIWYG ColumnEntity at the raw cursor + ribbon anchor', () => {
    activateColumnBridge({ anchor: 'center' });
    clearImmediateSnap(); // no snap armed → raw cursor
    sceneSnapTargetsStore.reset(); // no targets → no face-snap
    const ghost = generateColumnPreview({ x: 100, y: 200 }) as PreviewColumn;
    expect(ghost).not.toBeNull();
    expect(ghost.type).toBe('column');
    expect(ghost.id).toBe('preview_column_ghost');
    expect(ghost.preview).toBe(true);
    expect(ghost.wysiwygPreview).toBe(true);
    expect(ghost.ghostStatusColor ?? null).toBeNull();
    expect(ghost.params.anchor).toBe('center');
    expect(ghost.params.position.x).toBeCloseTo(100);
    expect(ghost.params.position.y).toBeCloseTo(200);
  });

  it('uses the snapped point from ImmediateSnap (preview === commit click point)', () => {
    activateColumnBridge();
    sceneSnapTargetsStore.reset();
    setImmediateSnap({ found: true, point: { x: 555, y: 666 }, mode: 'endpoint' });
    const ghost = generateColumnPreview({ x: 0, y: 0 }) as PreviewColumn;
    expect(ghost.params.position.x).toBeCloseTo(555);
    expect(ghost.params.position.y).toBeCloseTo(666);
  });

  it('beam face-snap → adopts the auto-selected face anchor (flush παρειά, preview computes it)', () => {
    activateColumnBridge({ anchor: 'center' });
    setTargets({ beamTargets: [horizontalBeam] });
    // effective cursor = N face, hi-zone (x=1000) → anchor 'se', flush στην πάνω παρειά (y=150).
    setImmediateSnap({ found: true, point: { x: 1000, y: 250 }, mode: 'endpoint' });
    const ghost = generateColumnPreview({ x: 1000, y: 250 }) as PreviewColumn;
    expect(ghost.params.anchor).toBe('se');
    expect(ghost.params.position.y).toBeCloseTo(150);
  });

  it('wall-axis center (§3.9) → centered anchor (κέντρο κολώνας ≡ άξονας τοίχου)', () => {
    activateColumnBridge({ anchor: 'nw' });
    setTargets({ wallTargets: [horizontalWall] });
    setImmediateSnap({ found: true, point: { x: 0, y: 0 }, mode: 'endpoint' }); // πάνω στον άξονα
    const ghost = generateColumnPreview({ x: 0, y: 0 }) as PreviewColumn;
    expect(ghost.params.anchor).toBe('center');
    expect(ghost.params.position.x).toBeCloseTo(0);
    expect(ghost.params.position.y).toBeCloseTo(0);
  });

  it('slab edge → snaps to the edge (sync recompute — η ρίζα του handoff)', () => {
    activateColumnBridge({ anchor: 'center' });
    setTargets({ slabTargets: slabSquare });
    // λίγο πάνω από την κάτω ακμή (y=0) στο x=1000 → κουμπώνει στην ακμή.
    setImmediateSnap({ found: true, point: { x: 1000, y: 120 }, mode: 'endpoint' });
    const ghost = generateColumnPreview({ x: 1000, y: 120 }) as PreviewColumn;
    expect(ghost).not.toBeNull();
    // band ±eps (=2) → εδράζεται εντός ~eps της ακμής (flush, ίδιο μοντέλο με τοίχο/δοκάρι).
    expect(Math.abs(ghost.params.position.y)).toBeLessThanOrEqual(2.001);
    expect(ghost.params.position.x).toBeCloseTo(1000);
  });

  it('overlap status (beam short-end) → red ghostStatusColor (collision warning schematic)', () => {
    activateColumnBridge();
    setTargets({ beamTargets: [horizontalBeam] });
    setImmediateSnap({ found: true, point: { x: 1100, y: 0 }, mode: 'endpoint' }); // E short-end → overlap
    const ghost = generateColumnPreview({ x: 1100, y: 0 }) as PreviewColumn;
    expect(ghost.ghostStatusColor).not.toBeNull();
    expect(ghost.ghostStatusColor!.stroke).toBe('#d23b3b');
  });

  it('respects ribbon kind + width overrides (WYSIWYG dims == committed dims)', () => {
    activateColumnBridge({ kind: 'rectangular', overrides: { width: 800, depth: 600 } });
    sceneSnapTargetsStore.reset();
    const ghost = generateColumnPreview({ x: 0, y: 0 }) as PreviewColumn;
    expect(ghost.params.kind).toBe('rectangular');
    expect(ghost.params.width).toBe(800);
  });
});
