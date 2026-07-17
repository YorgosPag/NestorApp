import { mergeSilhouetteBandsToStripGroups } from '../structural-finish-vertical-merge';
import { collectMiterWedges } from '../structural-finish-face-profile';
import type { SilhouetteBand } from '../structural-finish-silhouette';
import type { FinishFaceSegment } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const mkSeg = (a: Pt2, b: Pt2, extra: Partial<FinishFaceSegment> = {}): FinishFaceSegment => ({
  a, b, classification: 'exterior', materialId: 'mat-plaster-ext', thickness: 25,
  lengthM: Math.hypot(b.x - a.x, b.y - a.y), ...extra,
});
const mkBand = (segments: FinishFaceSegment[], zBottomMm: number, zTopMm: number): SilhouetteBand => ({
  faces: { segments, heightM: (zTopMm - zBottomMm) * 0.001, interiorAreaM2: 0, exteriorAreaM2: 0 }, zBottomMm, zTopMm,
});
const xSeg = (x0: number, x1: number): FinishFaceSegment => mkSeg({ x: x0, y: 0 }, { x: x1, y: 0 });

it('debug window wedges', () => {
  const bands: SilhouetteBand[] = [
    mkBand([xSeg(0, 300)], 0, 1000),
    mkBand([xSeg(0, 100), xSeg(200, 300)], 1000, 2200),
    mkBand([xSeg(0, 300)], 2200, 3000),
    mkBand([xSeg(0, 300)], 3000, 3150),
  ];
  const groups = mergeSilhouetteBandsToStripGroups(bands, 'mm');
  console.log('GROUPS:', groups.length);
  for (const g of groups) console.log('  dir', g.dir, 'strips', g.strips.map(s => ({aC:s.aCore,aO:s.aOuter,bC:s.bCore,bO:s.bOuter,z:[s.zBottomMm,s.zTopMm]})));
  const w = collectMiterWedges(groups);
  console.log('WEDGES:', w.length, w.map(x => ({core:x.core,mid:x.mid,tip:x.tip})));
  expect(true).toBe(true);
});
