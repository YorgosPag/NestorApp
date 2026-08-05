/**
 * ADR-040 / ADR-537 — DXF overlay idempotency guard. Pure key logic: only the entities
 * the underlay DRAWS (line/circle/arc/polyline/text) + layersById + units affect the key;
 * BIM-wrapper churn (beam/column) and invisible entities must NOT invalidate it.
 */

import type { DxfScene, DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../../types/entities';
import {
  toDxfOverlaySyncKey,
  isSameDxfOverlaySync,
  isSameMultiKey,
} from '../dxf-overlay-sync-guard';

const ent = (id: string, type: string, visible = true): DxfEntityUnion =>
  ({ id, type, visible }) as unknown as DxfEntityUnion;

const scene = (entities: DxfEntityUnion[], extra: Partial<DxfScene> = {}): DxfScene =>
  ({ entities, layers: [], layersById: undefined, bounds: null, units: 'mm', ...extra }) as DxfScene;

/** Η κλίμακα σχεδίασης του δείγματος — ρητή, ώστε τα tests της Φ.Θ να μπορούν να τη μεταβάλουν. */
const SCALE = 100;

/** Το κλειδί, με σταθερή κλίμακα εκτός αν το test ενδιαφέρεται ρητά γι' αυτήν (ADR-739 Φ.Θ). */
const keyOf = (s: DxfScene | null, drawingScale: number = SCALE) =>
  toDxfOverlaySyncKey(s, drawingScale);

describe('toDxfOverlaySyncKey', () => {
  it('null scene → empty key', () => {
    const k = keyOf(null);
    expect(k.drawn).toEqual([]);
    expect(k.units).toBeUndefined();
  });

  it('keeps only drawn entity types, in order', () => {
    const line = ent('l', 'line');
    const beam = ent('b', 'beam');
    const text = ent('t', 'text');
    const k = keyOf(scene([line, beam, text]));
    expect(k.drawn).toEqual([line, text]); // beam excluded
  });

  it('excludes invisible entities (mirrors buildColorGroup)', () => {
    const visible = ent('a', 'line', true);
    const hidden = ent('h', 'line', false);
    const k = keyOf(scene([visible, hidden]));
    expect(k.drawn).toEqual([visible]);
  });

  // ── ADR-739 Φ.Θ — ο πίνακας ζωγραφίζεται, άρα ΠΡΕΠΕΙ να μετρά στο κλειδί ──────────────
  it('ADR-739 Φ.Θ — ο πίνακας συμμετέχει στα σχεδιαζόμενα', () => {
    const table = ent('tbl', 'table');
    expect(keyOf(scene([table])).drawn).toEqual([table]);
  });

  it('ADR-739 Φ.Θ — η κλίμακα μπαίνει στο κλειδί ΜΟΝΟ με πίνακα στη σκηνή', () => {
    // Χωρίς πίνακα το πεδίο μένει `undefined` ⇒ σχέδια χωρίς πίνακες δεν ξαναχτίζονται ποτέ
    // λόγω κλίμακας — η ρητή προϋπόθεση για να μην είναι αυτή η φάση οπισθοδρόμηση απόδοσης.
    expect(keyOf(scene([ent('l', 'line')])).tableScale).toBeUndefined();
    expect(keyOf(scene([ent('tbl', 'table')])).tableScale).toBe(SCALE);
  });

  it('ADR-739 Φ.Θ — αόρατος πίνακας δεν φέρνει την κλίμακα στο κλειδί', () => {
    expect(keyOf(scene([ent('tbl', 'table', false)])).tableScale).toBeUndefined();
  });
});

describe('isSameDxfOverlaySync', () => {
  it('null previous → never equal', () => {
    expect(isSameDxfOverlaySync(null, keyOf(scene([])))).toBe(false);
  });

  it('two empty scenes → equal', () => {
    expect(isSameDxfOverlaySync(keyOf(null), keyOf(null))).toBe(true);
  });

  it('same drawn entity references → equal', () => {
    const line = ent('l', 'line');
    expect(isSameDxfOverlaySync(
      keyOf(scene([line])),
      keyOf(scene([line])),
    )).toBe(true);
  });

  it('BIM-wrapper churn does NOT invalidate (beam ref changed, lines unchanged)', () => {
    const line = ent('l', 'line');
    const before = keyOf(scene([line, ent('b', 'beam')]));
    const after = keyOf(scene([line, ent('b', 'beam')])); // fresh beam ref
    expect(isSameDxfOverlaySync(before, after)).toBe(true);
  });

  it('changed drawn entity reference → not equal', () => {
    expect(isSameDxfOverlaySync(
      keyOf(scene([ent('l', 'line')])),
      keyOf(scene([ent('l', 'line')])), // different line ref
    )).toBe(false);
  });

  it('different drawn count → not equal', () => {
    const line = ent('l', 'line');
    expect(isSameDxfOverlaySync(
      keyOf(scene([line])),
      keyOf(scene([line, ent('t', 'text')])),
    )).toBe(false);
  });

  it('reorder → not equal', () => {
    const a = ent('a', 'line');
    const b = ent('b', 'line');
    expect(isSameDxfOverlaySync(
      keyOf(scene([a, b])),
      keyOf(scene([b, a])),
    )).toBe(false);
  });

  it('layersById reference change → not equal (ByLayer colour may differ)', () => {
    const line = ent('l', 'line');
    const layers = {} as Record<string, SceneLayer>;
    expect(isSameDxfOverlaySync(
      keyOf(scene([line], { layersById: layers })),
      keyOf(scene([line], { layersById: { ...layers } })),
    )).toBe(false);
  });

  it('units change → not equal', () => {
    const line = ent('l', 'line');
    expect(isSameDxfOverlaySync(
      keyOf(scene([line], { units: 'mm' })),
      keyOf(scene([line], { units: 'm' })),
    )).toBe(false);
  });

  /**
   * 🔴 ADR-739 Φ.Θ — **η αστοχία που αυτή η φάση έκλεισε πριν προλάβει να συμβεί.**
   *
   * Ο πίνακας είναι annotative: 1:100 → 1:50 τον διπλασιάζει, **χωρίς να αλλάξει ούτε μία
   * αναφορά οντότητας**. Χωρίς το `tableScale` το κλειδί θα έμενε ίσο ⇒ ο converter θα
   * παρέκαμπτε το χτίσιμο ⇒ ο πίνακας θα κρατούσε το **παλιό** μέγεθος επ' αόριστον, ενώ ο
   * 2Δ καμβάς δίπλα του θα είχε ήδη αλλάξει. Καμία πύλη δεν πιάνει τέτοια απόκλιση.
   */
  it('ADR-739 Φ.Θ — αλλαγή κλίμακας ΜΕ πίνακα → ξαναχτίζει', () => {
    const table = ent('tbl', 'table');
    expect(isSameDxfOverlaySync(
      keyOf(scene([table]), 100),
      keyOf(scene([table]), 50),
    )).toBe(false);
  });

  it('ADR-739 Φ.Θ — αλλαγή κλίμακας ΧΩΡΙΣ πίνακα → ΔΕΝ ξαναχτίζει (μηδέν οπισθοδρόμηση)', () => {
    const line = ent('l', 'line');
    expect(isSameDxfOverlaySync(
      keyOf(scene([line]), 100),
      keyOf(scene([line]), 50),
    )).toBe(true);
  });

  it('ADR-739 Φ.Θ — επεξεργασία κελιού (νέα αναφορά πίνακα) → ξαναχτίζει', () => {
    expect(isSameDxfOverlaySync(
      keyOf(scene([ent('tbl', 'table')])),
      keyOf(scene([ent('tbl', 'table')])), // νέα αναφορά = αλλαγμένο μοντέλο
    )).toBe(false);
  });
});

describe('isSameMultiKey', () => {
  const floor = (entities: DxfEntityUnion[], elev: number) =>
    ({ key: keyOf(scene(entities)), elev });

  it('null previous → not equal', () => {
    expect(isSameMultiKey(null, [floor([ent('l', 'line')], 0)])).toBe(false);
  });

  it('same stack → equal', () => {
    const line = ent('l', 'line');
    expect(isSameMultiKey(
      [floor([line], 0), floor([line], 3000)],
      [floor([line], 0), floor([line], 3000)],
    )).toBe(true);
  });

  it('different elevation → not equal', () => {
    const line = ent('l', 'line');
    expect(isSameMultiKey([floor([line], 0)], [floor([line], 100)])).toBe(false);
  });

  it('different floor count → not equal', () => {
    const line = ent('l', 'line');
    expect(isSameMultiKey([floor([line], 0)], [floor([line], 0), floor([line], 3000)])).toBe(false);
  });

  it('changed floor content → not equal', () => {
    expect(isSameMultiKey(
      [floor([ent('l', 'line')], 0)],
      [floor([ent('l', 'line')], 0)], // fresh line ref
    )).toBe(false);
  });
});
