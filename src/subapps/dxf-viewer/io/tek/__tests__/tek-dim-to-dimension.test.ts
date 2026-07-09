/**
 * ADR-608 — tests: Tekton `<dim>` record → native `LinearDimensionEntity` (ενιαίος οργανισμός).
 */

import { tekDimToDimensionEntities } from '../tek-dim-to-dimension';
import { hexToTrueColor } from '../../../utils/dxf-true-color';
import { getDimStyleRegistry } from '../../../systems/dimensions/dim-style-registry';
import { getArrowheadBlock } from '../../../systems/dimensions/dim-arrowhead-blocks';
import type { TekDimRecord, TekXMatrix } from '../tek-import-types';

const mat = (x20: number, x21: number): TekXMatrix => ({ x00: 1, x01: 0, x10: 0, x11: 1, x20, x21 });

/** Οριζόντια διάσταση Τέκτονα: πράσινη γραμμή, κίτρινο κείμενο, μπορντώ βέλη, μπλε οδηγοί, «Βέλος 2». */
const DIM: TekDimRecord = {
  color: '00FF00', dtextColor: 'FFFF80', endsColor: 'A40050', drvColor: '809CFC',
  textSizeM: 0.15875, endStyle: 8, arrowLenM: 0.3, refPoints: [],
  segs: [{
    end0: { x: -2.21, y: 6.98 }, end1: { x: -0.11, y: 6.98 },
    gap0: { x: -1.32, y: 6.98 }, gap1: { x: -1.0, y: 6.98 },
    text: '2.10', textMatrix: mat(-1.32, 6.39),
  }],
};

describe('tekDimToDimensionEntities (ADR-608)', () => {
  const dims = tekDimToDimensionEntities(DIM, 'mm');

  it('παράγει ΕΝΑ native linear DimensionEntity ανά πατιά (ενιαίος οργανισμός, όχι primitives)', () => {
    expect(dims).toHaveLength(1);
    expect(dims[0].type).toBe('dimension');
    expect(dims[0].dimensionType).toBe('linear');
  });

  it('userText = το ΕΤΟΙΜΟ string του Τέκτονα (preserve-and-replay, όχι re-measured)', () => {
    expect(dims[0].userText).toBe('2.10');
  });

  it('defPoints = [ext1, ext2, dimLineRef] από end0/end1 (Y-flip mm)· rotation 0 (οριζόντια)', () => {
    // 'mm': μέτρα → scene ×1000, Y-flip. end0(-2.21,6.98)→(-2210,-6980)· end1(-0.11,6.98)→(-110,-6980).
    expect(dims[0].defPoints).toHaveLength(3);
    expect(dims[0].defPoints[0]).toEqual({ x: -2210, y: -6980 });
    expect(dims[0].defPoints[1]).toEqual({ x: -110, y: -6980 });
    expect(dims[0].defPoints[2]).toEqual({ x: -2210, y: -6980 });
    expect(dims[0].rotation).toBe(0);
  });

  it('overrides: 4 ξεχωριστά Τέκτων-χρώματα — γραμμή πράσινη / witness μπλε / κείμενο κίτρινο / βέλη μπορντώ', () => {
    const o = dims[0].overrides ?? {};
    expect(o.dimclrdTrueColor).toBe(hexToTrueColor('#00FF00')); // γραμμή διάστασης (πράσινη)
    expect(o.dimclreTrueColor).toBe(hexToTrueColor('#809CFC')); // οδηγοί/witness (μπλε drv_color)
    expect(o.dimclrtTrueColor).toBe(hexToTrueColor('#FFFF80')); // κείμενο (κίτρινο)
    expect(o.arrowTrueColor).toBe(hexToTrueColor('#A40050'));   // βέλη/άκρα (μπορντώ ends_color)
  });

  it('dimblk = Tekton «Βέλος 2» (custom block tektonArrow2, base 0.050/μήκος 0.120 → half-width 0.208)', () => {
    const name = dims[0].overrides?.dimblk;
    expect(name).toBe('tektonArrow2');
    const geom = getArrowheadBlock(name ?? '').geometry; // όχι silent fallback σε closedFilled
    const tri = geom[0];
    expect(tri.kind).toBe('triangle');
    if (tri.kind === 'triangle') {
      expect(tri.v2[1]).toBeCloseTo(0.025 / 0.12, 5); // half-width βάσης
      expect(tri.v2[0]).toBe(1); // MIRRORED: βάση στο +X (σώμα μέσα στο μήκος, μύτη έξω)
      expect(tri.solid).toBe(false); // OUTLINE-only (περίγραμμα, όχι συμπαγές μπορντώ)
    }
    // 2 επιπλέον γραμμές (Giorgio 2026-07-09), σε αναλογία (1 unit = μήκος 0.120m):
    expect(geom).toHaveLength(3);
    const tick = geom[1]; // κάθετη παύλα στη μύτη 0.16m (centered)
    const leader = geom[2]; // οριζόντια 0.30m από μύτη → κέντρο (+X)
    expect(tick.kind).toBe('line');
    expect(leader.kind).toBe('line');
    if (tick.kind === 'line' && leader.kind === 'line') {
      expect(tick.from[0]).toBe(0);
      expect(tick.to[1]).toBeCloseTo(0.16 / 0.12 / 2, 6);
      expect(leader.from).toEqual([0, 0]);
      expect(leader.to[0]).toBeCloseTo(0.3 / 0.12, 6);
      expect(leader.to[1]).toBe(0);
    }
    // Η κεντρική γραμμή διάστασης κάνει inset κατά το μήκος του leader (= LEADER_LEN).
    expect(getArrowheadBlock(name ?? '').dimLineInset).toBeCloseTo(0.3 / 0.12, 6);
  });

  it('dimasz = ρητή βαθμονόμηση: μήκος βέλους 0.120m → length_mm/(100 dimscale) = 1.2mm', () => {
    // Giorgio step-by-step: μήκος (μέσο βάσης→κορυφή) = 0.120m· block length = 1 unit· 1:100.
    expect(dims[0].overrides?.dimasz).toBeCloseTo((0.12 * 1000) / 100, 5);
  });

  it('dimscale = annotation scale (100 × MAG 3 = 300) → κείμενο+βέλος διαβάζονται (σαν Τέκτονας)', () => {
    // Giorgio: οι διαστάσεις σε πραγματικό μέγεθος = μικροσκοπικές· uniform annotation magnification.
    expect(dims[0].overrides?.dimscale).toBe(300);
  });

  it('dimtad = centered → κείμενο ομοαξωνικό με τη γραμμή διάστασης (όχι έκκεντρο/above)', () => {
    expect(dims[0].overrides?.dimtad).toBe('centered');
  });

  it('χρώματα κενά → fallback στη γραμμή· άγνωστο end_style → κληρονομεί dimblk (χωρίς override)', () => {
    const bare = tekDimToDimensionEntities(
      { ...DIM, endsColor: '', drvColor: '', endStyle: 0 }, 'mm',
    );
    const o = bare[0].overrides ?? {};
    expect(o.arrowTrueColor).toBe(hexToTrueColor('#00FF00')); // βέλη → line color
    expect(o.dimclreTrueColor).toBe(hexToTrueColor('#00FF00')); // witness → line color
    expect(o.dimblk).toBeUndefined();
  });

  it('styleId = το ενεργό dim style του registry', () => {
    expect(dims[0].styleId).toBe(getDimStyleRegistry().getActiveStyleId());
  });

  it('κείμενο χωρίς <s> → measured token "<>" (fallback)', () => {
    const noText = tekDimToDimensionEntities(
      { ...DIM, segs: [{ ...DIM.segs[0], text: '' }] }, 'mm',
    );
    expect(noText[0].userText).toBe('<>');
  });
});
