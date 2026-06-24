/**
 * ADR-521 — «Τύποι» column-type dropdown: action helpers (build / guard / parse).
 *
 * Pure round-trip + guard tests for the `column.drawKind:<kind>` action vocabulary
 * that wires the ribbon dropdown selection to `setKind` + column-tool activation.
 */

import {
  COLUMN_DRAW_KINDS,
  columnDrawKindAction,
  isColumnDrawKindAction,
  parseColumnDrawKind,
} from '../column-command-keys';
import type { ColumnKind } from '../../../../../bim/types/column-types';

describe('ADR-521 — column draw-kind actions', () => {
  it('1. exposes the 8 drawable kinds (no composite)', () => {
    expect(COLUMN_DRAW_KINDS).toHaveLength(8);
    expect(COLUMN_DRAW_KINDS).toEqual([
      'rectangular', 'circular', 'L-shape', 'T-shape', 'polygon', 'shear-wall', 'I-shape', 'U-shape',
    ]);
    expect(COLUMN_DRAW_KINDS).not.toContain('composite' as ColumnKind);
  });

  it('2. build → guard → parse round-trips for every drawable kind', () => {
    for (const kind of COLUMN_DRAW_KINDS) {
      const action = columnDrawKindAction(kind);
      expect(action).toBe(`column.drawKind:${kind}`);
      expect(isColumnDrawKindAction(action)).toBe(true);
      expect(parseColumnDrawKind(action)).toBe(kind);
    }
  });

  it('3. isColumnDrawKindAction rejects foreign actions', () => {
    expect(isColumnDrawKindAction('column.actions.close')).toBe(false);
    expect(isColumnDrawKindAction('column.params.kind')).toBe(false);
    expect(isColumnDrawKindAction('wall.actions.fromGrid')).toBe(false);
    expect(isColumnDrawKindAction('')).toBe(false);
  });

  it('4. parseColumnDrawKind → null for non-draw-kind or unknown kind', () => {
    expect(parseColumnDrawKind('column.actions.close')).toBeNull();
    expect(parseColumnDrawKind('column.drawKind:composite')).toBeNull(); // not drawable
    expect(parseColumnDrawKind('column.drawKind:bogus')).toBeNull();
    expect(parseColumnDrawKind('column.drawKind:')).toBeNull();
  });
});
