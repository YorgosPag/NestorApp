/**
 * ADR-441 3-mode — tests για την ανίχνευση ασυνεπούς έδρασης «από κάναβο».
 * Χτίζει πραγματικά entities μέσω των builders → ελέγχει τα signs end-to-end.
 * @see ../grid-justification-consistency.ts
 */

import { detectGridJustificationConflicts } from '../grid-justification-consistency';
import { buildColumnGridFromGuides } from '../../columns/column-from-grid';
import { buildWallGridFromGuides } from '../../walls/wall-from-grid';
import { buildBeamGridFromGuides } from '../../beams/beam-from-grid';
import { type AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
import type { Entity } from '../../../types/entities';

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({
    id, axis, offset, visible: true, label: null, style: null,
    locked: false, createdAt: '', parentId: null, groupId: null,
  } as Guide);

function reader(guides: readonly Guide[]): AxisGuideReader {
  return { getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis) };
}

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];
const R = () => reader([...X3, ...Y3]);

const cols = (mode: 'center' | 'inner' | 'outer'): Entity[] =>
  [...buildColumnGridFromGuides(R(), {}, '0', 'mm', undefined, mode).columns];
const walls = (mode: 'center' | 'inner' | 'outer'): Entity[] =>
  [...buildWallGridFromGuides(R(), {}, '0', 'mm', [], mode).walls];
const beams = (mode: 'center' | 'inner' | 'outer'): Entity[] =>
  [...buildBeamGridFromGuides(R(), {}, '0', 'mm', [], mode).beams];

describe('detectGridJustificationConflicts', () => {
  it('κολόνες inner + τοίχοι outer → ΑΣΥΝΕΠΕΙΑ (το σενάριο του χρήστη)', () => {
    const conflicts = detectGridJustificationConflicts([...cols('inner'), ...walls('outer')]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect([...conflicts[0].kinds].sort()).toEqual(['column', 'wall']);
  });

  it('κολόνες inner + τοίχοι inner → ΚΑΜΙΑ ασυνέπεια (ίδια φορά)', () => {
    expect(detectGridJustificationConflicts([...cols('inner'), ...walls('inner')])).toHaveLength(0);
  });

  it('κολόνες inner 40 + δοκάρια center 25 → ΑΣΥΝΕΠΕΙΑ (partial bearing — το παράπονο του χρήστη)', () => {
    // Το δοκάρι center προεξέχει 12.5cm έξω από την κολόνα inner → δεν περιέχεται.
    const conflicts = detectGridJustificationConflicts([...cols('inner'), ...beams('center')]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect([...conflicts[0].kinds].sort()).toEqual(['beam', 'column']);
  });

  it('κολόνες inner + δοκάρια inner → ΚΑΜΙΑ ασυνέπεια (πλήρης στήριξη, flush)', () => {
    expect(detectGridJustificationConflicts([...cols('inner'), ...beams('inner')])).toHaveLength(0);
  });

  it('μόνο ένα είδος (τοίχοι outer) → ΚΑΜΙΑ ασυνέπεια', () => {
    expect(detectGridJustificationConflicts(walls('outer'))).toHaveLength(0);
  });

  it('όλα center → ΚΑΜΙΑ ασυνέπεια', () => {
    const all = [...cols('center'), ...walls('center'), ...beams('center')];
    expect(detectGridJustificationConflicts(all)).toHaveLength(0);
  });

  it('δοκάρια inner + τοίχοι outer → ΑΣΥΝΕΠΕΙΑ (γραμμικό vs γραμμικό)', () => {
    const conflicts = detectGridJustificationConflicts([...beams('inner'), ...walls('outer')]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect([...conflicts[0].kinds].sort()).toEqual(['beam', 'wall']);
  });

  it('κενή σκηνή → ΚΑΜΙΑ ασυνέπεια', () => {
    expect(detectGridJustificationConflicts([])).toHaveLength(0);
  });
});
