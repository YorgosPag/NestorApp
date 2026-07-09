/**
 * ADR-608 — tests: Tekton `<dim>` record → native `LinearDimensionEntity` (ενιαίος οργανισμός).
 */

import { tekDimToDimensionEntities } from '../tek-dim-to-dimension';
import { hexToTrueColor } from '../../../utils/dxf-true-color';
import { getDimStyleRegistry } from '../../../systems/dimensions/dim-style-registry';
import type { TekDimRecord, TekXMatrix } from '../tek-import-types';

const mat = (x20: number, x21: number): TekXMatrix => ({ x00: 1, x01: 0, x10: 0, x11: 1, x20, x21 });

/** Οριζόντια διάσταση: γραμμή (-2.21..-0.11, y=6.98), κείμενο έτοιμο "2.10", πράσινη/κίτρινο. */
const DIM: TekDimRecord = {
  color: '00FF00', dtextColor: 'FFFF80', textSizeM: 0.15875, endStyle: 8, refPoints: [],
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

  it('overrides: πράσινη γραμμή/ext + κίτρινο κείμενο (truecolor exact hex)', () => {
    const o = dims[0].overrides ?? {};
    expect(o.dimclrdTrueColor).toBe(hexToTrueColor('#00FF00'));
    expect(o.dimclreTrueColor).toBe(hexToTrueColor('#00FF00'));
    expect(o.dimclrtTrueColor).toBe(hexToTrueColor('#FFFF80'));
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
