/**
 * Preview-ghost routing coverage (ADR-587 Φ7 — TIER-2 seam D, Μηχανισμός 2: coverage + ρητό pin).
 *
 * Το preview-ghost dispatch ΔΕΝ είναι ένα type-keyed `Record` αλλά **ordered if-gates**
 * (`if (xGripKind && entity.type === x)`) με double-guard (kind + type), `movesEntity`
 * fall-throughs (group / opening alt-move / BIM-whole-entity / classic) και per-branch
 * bespoke geometry recompute — ADR-040 perf-critical. Μετατροπή σε Record θα έχανε
 * ordering / double-guard / fall-throughs → **coverage-only** (mirror του `bounds-twins`
 * Φ5 Μηχ.2): κανένα source mutation, μόνο binding του «ποιος type έχει ρητό parametric
 * ghost branch» με το descriptor domain (`RENDERABLE_ENTITY_TYPES`) + ρητά pins των
 * ασυμμετριών.
 *
 * Δύο αρχεία-πηγές (READ-ONLY):
 *  - `apply-entity-preview.ts` — 14 renderable branches: wall / slab / slab-opening /
 *    roof / floor-finish / hatch / text|mtext / line(rotation) / arc(rotation) /
 *    polyline(rotation) / annotation-symbol(rotation) / stair / opening(alt-move) —
 *    + το editor-only `group` (rotation + move) + generic `movesEntity` BIM-whole-entity
 *    + classic fallback.
 *  - `apply-parametric-box-preview.ts` — 8 box branches: column / foundation / beam /
 *    mep-fixture / electrical-panel / mep-manifold / mep-segment / furniture.
 *
 *  1. Golden — renderable types με ρητό parametric ghost branch (partition A).
 *  2. Off-path — renderable types ΧΩΡΙΣ ρητό branch → πέφτουν σε generic movesEntity /
 *     classic (partition B). `handled ∪ off-path === RENDERABLE_ENTITY_TYPES` = ο
 *     completeness anchor: νέος renderable τύπος → σπάει ΤΟ partition → συνειδητή απόφαση
 *     (πρόσθεσε branch ή επιβεβαίωσε classic fall-through).
 *  3. Editor-only extra — ο ΜΟΝΟΣ non-renderable supported type είναι το `group` (container).
 *  4. Behavioral skeleton pins — cheap early-returns (undefined / wrong-id / zero-delta)
 *     + το box-sibling gating (gripKind-driven, null όταν δεν στοχεύει box type).
 *
 * Καρφωμένες ασυμμετρίες (ΜΗΝ τις «διορθώσεις» σιωπηλά):
 *  (α) box-preview types (column/foundation/beam/mep-fixture/electrical-panel/mep-manifold/
 *      mep-segment/furniture) ζουν στο sibling `apply-parametric-box-preview` — ΟΧΙ στο κύριο
 *      αρχείο· το `applyParametricBoxPreview` επιστρέφει `null` για non-box types (π.χ. wall).
 *  (β) circle / point / ellipse (+ spline/rectangle/rect/dimension/angle-measurement/xline/ray)
 *      = ΚΑΝΕΝΑ ρητό branch → classic path.
 *  (γ) `mtext` γίνεται ρητά δεκτό ΜΑΖΙ με `text` (ίδιο guard) — ο RAW scene discriminator
 *      μένει `'mtext'` στο ghost pipeline.
 *  (δ) `group` / `opening` = δρομολογούνται ΜΟΝΟ μέσω `movesEntity` (group + `group-rotation`)·
 *      δεν έχουν params-geometry-recompute branch σαν τα BIM parametric.
 *  (ε) `lwpolyline` = ΚΑΝΕΝΑ δικό του branch (off-path), αλλά `normalizePreviewEntity` το
 *      χαρτογραφεί σε `'polyline'` ΠΡΙΝ το dispatch (ξεχωριστό normalization step, όχι branch).
 */

// Firebase auth mock — τα type barrels (bim/text projections) αγγίζουν auth στο import path.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import {
  applyEntityPreview,
  normalizePreviewEntity,
} from '../apply-entity-preview';
import { applyParametricBoxPreview } from '../apply-parametric-box-preview';
import type { EntityPreviewTransform } from '../entity-preview-types';
import { RENDERABLE_ENTITY_TYPES } from '../../contract/renderable-entity-type';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();
const renderableSet = new Set<string>(RENDERABLE_ENTITY_TYPES);

// ─── Partition A — renderable types με ρητό parametric ghost branch ───────────────────
/** `apply-entity-preview.ts` renderable branches (16). */
const PREVIEW_GHOST_MAIN_TYPES = [
  'wall', 'slab', 'slab-opening', 'roof', 'floor-finish', 'hatch',
  'text', 'mtext', 'line', 'arc', 'polyline', 'annotation-symbol', 'scale-bar',
  'opening-info-tag', 'stair', 'opening',
] as const;
/** `apply-parametric-box-preview.ts` branches (8) — box-like BIM (asymmetry α). */
const PREVIEW_GHOST_BOX_TYPES = [
  'column', 'foundation', 'beam', 'mep-fixture', 'electrical-panel',
  'mep-manifold', 'mep-segment', 'furniture',
] as const;
/** Editor-only container — NON-renderable, rotation + move (asymmetry δ). */
const PREVIEW_GHOST_EDITOR_ONLY_TYPES = ['group'] as const;

/** ΟΛΟΙ οι types με ρητό parametric ghost branch (και τα δύο αρχεία + group). */
const PREVIEW_GHOST_SUPPORTED_TYPES = [
  ...PREVIEW_GHOST_MAIN_TYPES,
  ...PREVIEW_GHOST_BOX_TYPES,
  ...PREVIEW_GHOST_EDITOR_ONLY_TYPES,
] as const;
const supportedSet = new Set<string>(PREVIEW_GHOST_SUPPORTED_TYPES);

// ─── Partition B — renderable types ΧΩΡΙΣ ρητό branch → generic movesEntity / classic ──
const PREVIEW_GHOST_OFF_PATH_TYPES = [
  // DXF (11) — asymmetry β (circle/point/ellipse …) + ε (lwpolyline normalized, όχι branch)
  'circle', 'ellipse', 'spline', 'rectangle', 'rect', 'point',
  'dimension', 'angle-measurement', 'xline', 'ray', 'lwpolyline',
  // BIM (9) — μη-box, μη-footprint parametric → BIM-whole-entity move / classic
  'railing', 'wall-covering', 'thermal-space', 'space-separator',
  'mep-radiator', 'mep-boiler', 'mep-water-heater', 'mep-fitting', 'mep-underfloor',
] as const;

const mk = (type: string, extra: Record<string, unknown> = {}): DxfEntityUnion =>
  ({ id: `${type}_x`, layerId: 'L', type, ...extra }) as unknown as DxfEntityUnion;
const mkPreview = (
  entityId: string,
  over: Partial<EntityPreviewTransform> = {},
): EntityPreviewTransform =>
  ({ entityId, gripIndex: 0, delta: { x: 1, y: 1 }, movesEntity: false, ...over });

describe('Preview-ghost routing coverage — ghost dispatch ↔ descriptor domain (ADR-587 Φ7, coverage+pin)', () => {
  it('completeness: golden ∪ off-path = RENDERABLE_ENTITY_TYPES (exhaustive + disjoint)', () => {
    const renderableSupported = PREVIEW_GHOST_SUPPORTED_TYPES.filter((t) => renderableSet.has(t));
    const partition = [...renderableSupported, ...PREVIEW_GHOST_OFF_PATH_TYPES];
    expect(new Set(partition).size).toBe(partition.length); // disjoint
    expect(asSorted(partition)).toEqual(asSorted([...RENDERABLE_ENTITY_TYPES])); // exhaustive
  });

  it('golden: renderable types με ρητό parametric ghost branch = καρφωμένο set (main + box)', () => {
    const withBranch = RENDERABLE_ENTITY_TYPES.filter((t) => supportedSet.has(t));
    expect(asSorted(withBranch)).toEqual(
      asSorted([...PREVIEW_GHOST_MAIN_TYPES, ...PREVIEW_GHOST_BOX_TYPES]),
    );
  });

  it('off-path: renderable types χωρίς branch = classic / generic movesEntity set', () => {
    const withoutBranch = RENDERABLE_ENTITY_TYPES.filter((t) => !supportedSet.has(t));
    expect(asSorted(withoutBranch)).toEqual(asSorted([...PREVIEW_GHOST_OFF_PATH_TYPES]));
  });

  it('editor-only extra: ο ΜΟΝΟΣ non-renderable supported type είναι το "group" (container)', () => {
    const nonRenderable = PREVIEW_GHOST_SUPPORTED_TYPES.filter((t) => !renderableSet.has(t));
    expect(nonRenderable).toEqual(['group']);
  });

  // ── asymmetry (α) — box types ζουν στο sibling `apply-parametric-box-preview` ──────
  it('asymmetry α: applyParametricBoxPreview επιστρέφει null για non-box supported type (wall)', () => {
    // wall handled στο ΚΥΡΙΟ αρχείο· η box-sibling δεν το αναγνωρίζει → null (fall-through).
    expect(applyParametricBoxPreview(mk('wall'), mkPreview('wall_x'))).toBeNull();
  });

  it('asymmetry α: applyParametricBoxPreview είναι gripKind-gated → null χωρίς box gripKind', () => {
    // Ακόμη & για box type (column), χωρίς tagged gripKind κανένα branch δεν πυροδοτεί → null.
    expect(applyParametricBoxPreview(mk('column'), mkPreview('column_x'))).toBeNull();
  });

  // ── asymmetry (ε) — lwpolyline δεν έχει branch· χαρτογραφείται σε polyline ρητά ──────
  it('asymmetry ε: normalizePreviewEntity χαρτογραφεί lwpolyline → polyline (όχι δικό branch)', () => {
    expect(normalizePreviewEntity(mk('lwpolyline')).type).toBe('polyline');
    // polyline (και κάθε άλλος type) μένει ανέγγιχτος — normalization ΜΟΝΟ για lwpolyline.
    const poly = mk('polyline');
    expect(normalizePreviewEntity(poly)).toBe(poly);
    const circle = mk('circle');
    expect(normalizePreviewEntity(circle)).toBe(circle);
  });

  // ── Behavioral skeleton pins (cheap early-returns — πριν από κάθε geometry recompute) ──
  it('behavioral: undefined preview → επιστρέφει το ΙΔΙΟ entity (no-op)', () => {
    const e = mk('wall');
    expect(applyEntityPreview(e, undefined)).toBe(e);
  });

  it('behavioral: preview για άλλο entityId → επιστρέφει το ΙΔΙΟ entity (no-op)', () => {
    const e = mk('wall');
    expect(applyEntityPreview(e, mkPreview('some_other_id'))).toBe(e);
  });

  it('behavioral: zero-delta preview → επιστρέφει το ΙΔΙΟ entity (no-op, πριν το dispatch)', () => {
    const e = mk('wall');
    expect(applyEntityPreview(e, mkPreview('wall_x', { delta: { x: 0, y: 0 } }))).toBe(e);
  });
});
