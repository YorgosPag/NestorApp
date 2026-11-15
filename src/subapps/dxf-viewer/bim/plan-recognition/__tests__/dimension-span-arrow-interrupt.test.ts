/**
 * ⚓ ADR-929 §6.21 — **διάσταση με βέλη και κομμένη γραμμή, από άκρη σε άκρη** (το στυλ του «ΔΟΚΙΜΗ Κτήριο Β · 2ος»):
 * `|◄—   2.05   —►|` — δύο κοντά κομμάτια δίπλα στα κλειστά βέλη, ο αριθμός στη μέση ενός μεγάλου κενού.
 *
 * 🔴 Μετρημένο πριν από τη διόρθωση: τα κομμάτια κρίνονταν σωστά `dimension-line`, με την επέκτασή τους ως άγκυρα, αλλά
 * καλύπτουν 144 από τα 750 px του ανοίγματος (19% < `spanCoverageMin` 50%) ⇒ **κανένα** άνοιγμα, καμία διάσταση στο
 * «Κράτησε τα αναγνωρισμένα» / «Δημιουργία τοίχων». Το κενό ΕΙΝΑΙ ο αριθμός — ο ταξινομητής το ήξερε ήδη (`links`).
 * Ανάλυση 0,12 px/mm + βέλος 1 : 3: το όριο ανάλυσης του §6.19 (`segment-roles.test.ts`).
 */

import { describe, expect, it } from '@jest/globals';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { alignPlan } from '../alignment/align-plan';
import { extensionAnchorMap, segmentRoleMap, textLinkMap } from '../classify/segment-roles';
import { fusePlan } from '../fusion/plan-fusion';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../segments/plan-segments';
import type { SyntheticDimension } from '../testing/synthetic-dimensions';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';

const PX_PER_MM = 0.12;
const OUT = 125;

const STYLE = { terminator: 'arrow', text: 'interrupt', stubMm: 6, arrowHalfWidthMm: 0.5, offsetMm: -875 } as const;
const SPEC: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: PX_PER_MM, marginMm: 400, wallStyle: 'outlined', strokePx: 2, rotationDeg: 0, degradation: null,
  dimensions: [
    { ...STYLE, from: { x: -OUT, y: -OUT }, to: { x: 6000 + OUT, y: -OUT }, label: '6.25' },
    { ...STYLE, from: { x: 6000 + OUT, y: -OUT }, to: { x: 6000 + OUT, y: 4000 + OUT }, label: '4.25' },
  ] satisfies SyntheticDimension[],
};

/** Μία αναγνώριση (ακριβή: ~30 s), δύο συντήξεις — με και χωρίς τους δεσμούς κειμένου. */
function recognise() {
  const plan = renderSyntheticPlan(SPEC);
  const alignment = alignPlan(plan.image);
  const metresPerPixel = mmToSceneUnits('m') / SPEC.pxPerMm;
  const minFillPx = minFillPxFor(alignment, { metresPerPixelX: metresPerPixel, metresPerPixelY: metresPerPixel, source: 'gallery-scale' });
  const extraction = extractPlanSegments(alignment, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
  const verdicts = extraction.classification.verdicts;
  const fuse = (withTextLinks: boolean) => fusePlan({
    kind: 'scan', alignment, segments: extraction.segments, reading: null, knownScale: null, sourceDpi: null,
    segmentRoles: segmentRoleMap(verdicts), extensionAnchors: extensionAnchorMap(verdicts),
    textLinks: withTextLinks ? textLinkMap(verdicts) : undefined, roomAreaProbe: () => null,
  });
  return { verdicts, withLinks: fuse(true), withoutLinks: fuse(false) };
}

describe('ADR-929 §6.21 — διάσταση με βέλη και κομμένη γραμμή', () => {
  const r = recognise();

  it('ο ταξινομητής ενώνει τα δύο κομμάτια κάθε διάστασης μέσω του αριθμού (και προς τις δύο μεριές)', () => {
    const linked = r.verdicts.filter((v) => (v.textLinkedWith ?? []).length > 0);
    expect(linked.length).toBeGreaterThanOrEqual(4);
    for (const v of linked) {
      expect(v.role).toBe('dimension-line');
      for (const partner of v.textLinkedWith ?? []) {
        expect(r.verdicts.find((w) => w.segmentId === partner)?.textLinkedWith).toContain(v.segmentId);
      }
    }
  });

  it('ΤΟ ΣΦΑΛΜΑ (έλεγχος): χωρίς τους δεσμούς, το κενό του αριθμού μετρά «λείπει μελάνι» ⇒ κανένα άνοιγμα', () => {
    expect(r.withoutLinks.dimensionSpans).toEqual([]);
  });

  it('με τους δεσμούς ⇒ ένα άνοιγμα ανά διάσταση, παρειά σε παρειά, σε λόγο 6250 : 4250', () => {
    const full = r.withLinks.dimensionSpans.filter((s) => s.ends.every((e) => e.lineId !== null));
    expect(r.withLinks.dimensionSpans).toHaveLength(2);
    expect(full).toHaveLength(2);
    const [long, short] = [...full].sort((p, q) => q.gapPx - p.gapPx);
    expect(long.gapPx / short.gapPx).toBeCloseTo(6250 / 4250, 1);
  });
});
