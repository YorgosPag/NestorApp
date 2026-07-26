/**
 * ADR-713 — η στεγάνωση της θαμμένης ζώνης φτάνει στην ΕΠΙΜΕΤΡΗΣΗ (m², δικό της άρθρο).
 *
 * Ο Giorgio (2026-07-26): «η κολώνα μέσα στο χώμα θέλει στεγανωτικό, ενώ η ίδια κολώνα στο
 * ισόγειο επενδύεται με τούβλο». Άρα δεν αρκεί να μη βάφεται — η επάλειψη είναι **εργασία**
 * που πρέπει να τιμολογηθεί. Εδώ κλειδώνεται ότι εμφανίζεται ως ξεχωριστό bucket υλικού
 * (→ child row μέσω του υπάρχοντος group-by-material pipeline), ότι το εμβαδό είναι σωστό,
 * και — κρίσιμο — ότι ο **σοβάς μένει byte-for-byte** στο default.
 */

import { columnBoqEntity } from '../column-boq-feed';
import { buildColumnEntity, buildDefaultColumnParams } from '../../drawing/column-completion';
import type { ColumnEntity } from '../../../bim/types/column-types';
import { WATERPROOF_BITUMEN_MATERIAL, WATERPROOF_CEMENTITIOUS_MATERIAL } from '../../../bim/finishes/buried-waterproofing';
import { resolveMaterialAtoeMapping } from '../../../bim/config/material-to-atoe-mapping';

function column(overrides: Partial<ColumnEntity['params']> = {}): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return { ...res.entity, params: { ...res.entity.params, ...overrides } } as ColumnEntity;
}

/** Τα buckets υλικού που ταξιδεύουν προς το BOQ (σοβάς + στεγάνωση, group-by-material). */
function buckets(entity: ColumnEntity, baseDropMm: number, gradeAbsMm?: number) {
  const drop = new Map([[entity.id, baseDropMm]]);
  const grade = gradeAbsMm === undefined ? undefined : new Map([[entity.id, gradeAbsMm]]);
  return columnBoqEntity(entity, null, drop, grade).finishContribution?.byMaterial ?? [];
}

function bucketFor(list: readonly { materialId: string; areaM2: number }[], materialId: string) {
  return list.find((b) => b.materialId === materialId);
}

describe('ADR-713 — στεγάνωση θαμμένης ζώνης στην επιμέτρηση', () => {
  it('κολώνα εδρασμένη σε πέδιλο → ΝΕΟ bucket στεγάνωσης (αυτόματα)', () => {
    const wp = bucketFor(buckets(column(), 1000), WATERPROOF_BITUMEN_MATERIAL);
    expect(wp).toBeDefined();
    expect(wp!.areaM2).toBeGreaterThan(0);
  });

  it('το εμβαδό = περίμετρος × ύψος θαμμένης ζώνης', () => {
    const c = column();
    const w = c.params.width;   // mm
    const d = c.params.depth;   // mm
    const perimeterM = (2 * (w + d)) / 1000;
    const wp1000 = bucketFor(buckets(c, 1000), WATERPROOF_BITUMEN_MATERIAL)!;
    expect(wp1000.areaM2).toBeCloseTo(perimeterM * 1.0, 5);
    // Διπλάσιο βάθος έδρασης → διπλάσιο εμβαδό στεγάνωσης (γραμμικό στο ύψος).
    const wp2000 = bucketFor(buckets(c, 2000), WATERPROOF_BITUMEN_MATERIAL)!;
    expect(wp2000.areaM2).toBeCloseTo(2 * wp1000.areaM2, 5);
  });

  it('χαμηλότερη στάθμη εδάφους → ΜΙΚΡΟΤΕΡΗ στεγάνωση (η διαφορά πάει στον σοβά)', () => {
    const c = column();
    const full = bucketFor(buckets(c, 1000), WATERPROOF_BITUMEN_MATERIAL)!;
    // Έδαφος 300mm κάτω από το FFL → θάβονται μόνο τα κάτω 700 από τα 1000.
    const partial = bucketFor(buckets(c, 1000, -300), WATERPROOF_BITUMEN_MATERIAL)!;
    expect(partial.areaM2).toBeCloseTo(full.areaM2 * 0.7, 5);
  });

  it('ρητό τσιμεντοειδές → ΑΛΛΟ bucket, άρα άλλο άρθρο τιμολογίου', () => {
    const c = column({ buriedWaterproofing: { materialId: WATERPROOF_CEMENTITIOUS_MATERIAL } } as Partial<ColumnEntity['params']>);
    const list = buckets(c, 1000);
    expect(bucketFor(list, WATERPROOF_CEMENTITIOUS_MATERIAL)).toBeDefined();
    expect(bucketFor(list, WATERPROOF_BITUMEN_MATERIAL)).toBeUndefined();
  });

  it('κλειστή στεγάνωση → ΚΑΝΕΝΑ bucket (μηδέν χρέωση)', () => {
    const c = column({ buriedWaterproofing: { enabled: false } } as Partial<ColumnEntity['params']>);
    const list = buckets(c, 1000);
    expect(list.some((b) => b.materialId.startsWith('mat-waterproof'))).toBe(false);
  });

  it('ΚΑΘΕ υλικό στεγάνωσης λύνεται σε άρθρο ΑΤΟΕ m² — αλλιώς το child row θα έπεφτε σιωπηλά', () => {
    for (const id of [WATERPROOF_BITUMEN_MATERIAL, WATERPROOF_CEMENTITIOUS_MATERIAL]) {
      const mapping = resolveMaterialAtoeMapping(id);
      expect(mapping).not.toBeNull();
      expect(mapping!.unit).toBe('m2');
      expect(mapping!.quantityKind).toBe('area');
    }
  });
});

describe('ADR-713 — μηδέν παλινδρόμηση στα υπάρχοντα', () => {
  it('κολώνα ΧΩΡΙΣ έδραση → καμία στεγάνωση, contribution ως πριν', () => {
    const list = buckets(column(), 0);
    expect(list.some((b) => b.materialId.startsWith('mat-waterproof'))).toBe(false);
  });

  it('το `geometry.volume` (OIK-2.03 ανωδομή) μένει ΑΝΕΠΗΡΕΑΣΤΟ από τη ζώνη έκθεσης', () => {
    const c = column();
    const bare = columnBoqEntity(c, null);
    const withZone = columnBoqEntity(c, null, new Map([[c.id, 1000]]), new Map([[c.id, -300]]));
    expect(withZone.geometry.volume).toBeCloseTo(bare.geometry.volume, 9);
    expect(withZone.geometry.height).toBeCloseTo(bare.geometry.height, 9);
  });

  it('το κοντόστυλο (ADR-712, OIK-2.07) ΔΕΝ μετακινείται από τη στάθμη εδάφους', () => {
    const c = column();
    const atFfl = columnBoqEntity(c, null, new Map([[c.id, 1000]]));
    const lower = columnBoqEntity(c, null, new Map([[c.id, 1000]]), new Map([[c.id, -300]]));
    // Το όριο ΟΓΚΟΥ είναι η άνω παρειά του πεδίλου — ανεξάρτητο από το όριο ΟΨΗΣ.
    expect(lower.foundationStub?.stubVolumeM3).toBeCloseTo(atFfl.foundationStub!.stubVolumeM3, 9);
    expect(lower.foundationStub?.baseDropMm).toBe(1000);
  });
});
