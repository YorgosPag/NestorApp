/**
 * ⚓ ADR-929 §6.21.2 — **η βάση ανήκει στο βέλος**: διάσταση με **κλειστά άγεμιστα** βέλη (ISO 129-1 / AutoCAD «Closed
 * blank»: δύο βραχίονες **και η βάση** ως πινελιές) και βοηθητική **κεντραρισμένη** στη γραμμή, που δεν φτάνει στο
 * αντικείμενο — οι αναλογίες του ΤΕΣΤ2 (βέλος 57 × ±12 μονάδες ⇒ μισό πλάτος 0,63 mm σε μήκος 3 mm · βοηθητική ±2 mm ·
 * κομμάτι γραμμής 7,5 mm από την κορυφή, μετά το κενό του αριθμού).
 *
 * 🔑 **Η ανάλυση μετρά.** Στα 0,12 px/mm το βέλος είναι 36 px και η βάση του **δεν** περνούσε ποτέ για επέκταση (ο
 * βραχίονας γεμίζει τον έλεγχο του ελεύθερου άκρου) ⇒ το τεστ ήταν πράσινο **και χωρίς** τη διόρθωση (μετάλλαξη επέζησε).
 * Στα 0,06 px/mm (βέλος 18 px· ΤΕΣΤ2: 13,7 px) αναπαράγεται **ακριβώς** το σφάλμα του ΤΕΣΤ2: 18 + 219 + 18 px αντί για 255.
 *
 * 🔴 Μετρημένο στο ΤΕΣΤ2 πριν από τη διόρθωση: η βάση (λεπτή κάθετη πινελιά που τέμνει τη γραμμή 14 px μέσα από την κορυφή)
 * κρινόταν `extension-line` και γινόταν **άγκυρα** ⇒ η 4.12 κοβόταν σε 0.12 + 3.88 + 0.12.
 * ⛔ Η βοηθητική εδώ είναι **συμμετρική** γύρω από τη γραμμή, όπως και η βάση: κανένας κανόνας συμμετρίας δεν τις ξεχωρίζει.
 */

import { describe, expect, it } from '@jest/globals';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { alignPlan } from '../alignment/align-plan';
import { extensionAnchorMap, segmentRoleMap, textLinkMap } from '../classify/segment-roles';
import { fusePlan } from '../fusion/plan-fusion';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../segments/plan-segments';
import type { SyntheticDimension } from '../testing/synthetic-dimensions';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';

const PX_PER_MM = 0.06;
const OUT = 125;
/** Το μήκος της κατακόρυφης διάστασης σε mm κάτοψης: από βοηθητική σε βοηθητική. */
const DIMENSION_MM = 4000 + 2 * OUT;

/**
 * Δύο διαστάσεις, όπως μετρήθηκε. ⚠️ Σε αυτή την ανάλυση η οριζόντια 6.25 **δεν** αναγνωρίζεται (ούτε πριν ούτε μετά τη
 * διόρθωση), και με τη μία μόνο κατακόρυφη η βοηθητική της πάνω κορυφής μένει `unknown` (άλλη εικόνα, άλλη ευθυγράμμιση) —
 * χωριστά όρια του συνθετικού, όχι της βάσης. Οι έλεγχοι γι' αυτό ρωτούν μόνο ό,τι ανήκει στην κατακόρυφη.
 */
const STYLE = {
  terminator: 'arrow', arrowStyle: 'closed-blank', arrowHalfWidthMm: (3 * 12) / 57, text: 'interrupt', stubMm: 7.5,
  extensionAroundLineMm: 2, offsetMm: -875,
} as const;
const SPEC: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: PX_PER_MM, marginMm: 400, wallStyle: 'outlined', strokePx: 1, rotationDeg: 0, degradation: null,
  dimensions: [
    { ...STYLE, from: { x: -OUT, y: -OUT }, to: { x: 6000 + OUT, y: -OUT }, label: '6.25' },
    { ...STYLE, from: { x: 6000 + OUT, y: -OUT }, to: { x: 6000 + OUT, y: 4000 + OUT }, label: '4.25' },
  ] satisfies SyntheticDimension[],
};

function recognise() {
  const plan = renderSyntheticPlan(SPEC);
  const alignment = alignPlan(plan.image);
  const metresPerPixel = mmToSceneUnits('m') / SPEC.pxPerMm;
  const minFillPx = minFillPxFor(alignment, { metresPerPixelX: metresPerPixel, metresPerPixelY: metresPerPixel, source: 'gallery-scale' });
  const extraction = extractPlanSegments(alignment, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
  const verdicts = extraction.classification.verdicts;
  const fusion = fusePlan({
    kind: 'scan', alignment, segments: extraction.segments, reading: null, knownScale: null, sourceDpi: null,
    segmentRoles: segmentRoleMap(verdicts), extensionAnchors: extensionAnchorMap(verdicts), textLinks: textLinkMap(verdicts),
    roomAreaProbe: () => null,
  });
  return { verdicts, spans: fusion.dimensionSpans };
}

describe('ADR-929 §6.21.2 — η βάση του κλειστού βέλους δεν είναι γραμμή επέκτασης', () => {
  const r = recognise();
  const arrowed = r.verdicts.filter((v) => v.role === 'dimension-line' && v.terminators.includes('arrow'));

  it('και τα δύο βέλη αναγνωρίζονται (αλλιώς το τεστ δεν ελέγχει τίποτα)', () => {
    expect(arrowed).toHaveLength(2);
  });

  it('ΜΙΑ άγκυρα ανά βέλος — η βοηθητική στην κορυφή, όχι η βάση', () => {
    for (const v of arrowed) expect(v.extensionAnchors ?? []).toHaveLength(1);
  });

  it('ΕΝΑ άνοιγμα, από κορυφή σε κορυφή: 4250 mm ⇒ 255 px (όχι 18 + 219 + 18)', () => {
    const expected = DIMENSION_MM * PX_PER_MM;
    expect(r.spans.filter((s) => Math.abs(s.gapPx - expected) <= 2)).toHaveLength(1);
    // Κανένα κομμάτι «από βοηθητική ως βάση» και κανένα κολοβό άνοιγμα ανάμεσα στις βάσεις.
    expect(r.spans.filter((s) => s.gapPx < expected - 2)).toEqual([]);
  });
});
