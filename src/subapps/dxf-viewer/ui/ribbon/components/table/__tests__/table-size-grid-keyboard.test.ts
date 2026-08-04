/**
 * ADR-739 §39 — ο χάρτης πλήκτρων του πλέγματος.
 *
 * Το πιο σημαντικό test εδώ είναι το «άσχετο πλήκτρο → `null`»: εκεί κρέμεται το ότι το `Tab`
 * βγάζει από το πλέγμα αντί να εγκλωβίζεται.
 */

import {
  MIN_FOCUSABLE_ROW_INDEX,
  isGridCommitKey,
  nextGridFocus,
} from '../table-size-grid-keyboard';
import { TABLE_SIZE_GRID_COLUMNS, TABLE_SIZE_GRID_ROWS } from '../table-size-menu-model';

const DIMS = { columns: TABLE_SIZE_GRID_COLUMNS, rows: TABLE_SIZE_GRID_ROWS };
const key = (k: string, mod: { ctrlKey?: boolean; metaKey?: boolean } = {}) => ({
  key: k,
  ctrlKey: mod.ctrlKey ?? false,
  metaKey: mod.metaKey ?? false,
});

describe('nextGridFocus — κίνηση', () => {
  it('τα βέλη μετακινούν μία κυψελίδα', () => {
    const start = { col: 3, row: 3 };
    expect(nextGridFocus(start, key('ArrowRight'), DIMS)).toEqual({ col: 4, row: 3 });
    expect(nextGridFocus(start, key('ArrowLeft'), DIMS)).toEqual({ col: 2, row: 3 });
    expect(nextGridFocus(start, key('ArrowDown'), DIMS)).toEqual({ col: 3, row: 4 });
    expect(nextGridFocus(start, key('ArrowUp'), DIMS)).toEqual({ col: 3, row: 2 });
  });

  it('ΔΕΝ αναδιπλώνει σε κανένα από τα τέσσερα άκρα', () => {
    const dims = DIMS;
    expect(nextGridFocus({ col: dims.columns - 1, row: 3 }, key('ArrowRight'), dims))
      .toEqual({ col: dims.columns - 1, row: 3 });
    expect(nextGridFocus({ col: 0, row: 3 }, key('ArrowLeft'), dims))
      .toEqual({ col: 0, row: 3 });
    expect(nextGridFocus({ col: 3, row: dims.rows - 1 }, key('ArrowDown'), dims))
      .toEqual({ col: 3, row: dims.rows - 1 });
  });

  it('το πάνω βέλος σταματά στην πρώτη ΕΣΤΙΑΣΙΜΗ σειρά, όχι στη σειρά 0', () => {
    const at = { col: 3, row: MIN_FOCUSABLE_ROW_INDEX };
    expect(nextGridFocus(at, key('ArrowUp'), DIMS)).toEqual(at);
  });
});

describe('nextGridFocus — άλματα', () => {
  it('Home/End κινούνται μέσα στη γραμμή', () => {
    expect(nextGridFocus({ col: 5, row: 4 }, key('Home'), DIMS)).toEqual({ col: 0, row: 4 });
    expect(nextGridFocus({ col: 5, row: 4 }, key('End'), DIMS))
      .toEqual({ col: TABLE_SIZE_GRID_COLUMNS - 1, row: 4 });
  });

  it('Ctrl+Home / Ctrl+End πάνε στις δύο γωνίες', () => {
    expect(nextGridFocus({ col: 5, row: 4 }, key('Home', { ctrlKey: true }), DIMS))
      .toEqual({ col: 0, row: MIN_FOCUSABLE_ROW_INDEX });
    expect(nextGridFocus({ col: 5, row: 4 }, key('End', { ctrlKey: true }), DIMS))
      .toEqual({ col: TABLE_SIZE_GRID_COLUMNS - 1, row: TABLE_SIZE_GRID_ROWS - 1 });
  });

  it('το Meta λειτουργεί όπως το Ctrl (macOS)', () => {
    expect(nextGridFocus({ col: 5, row: 4 }, key('End', { metaKey: true }), DIMS))
      .toEqual({ col: TABLE_SIZE_GRID_COLUMNS - 1, row: TABLE_SIZE_GRID_ROWS - 1 });
  });
});

describe('nextGridFocus — τι ΔΕΝ διεκδικεί', () => {
  it('το Tab επιστρέφει null ώστε ο caller να ΜΗΝ κάνει preventDefault', () => {
    expect(nextGridFocus({ col: 0, row: 1 }, key('Tab'), DIMS)).toBeNull();
  });

  it('γράμματα και Escape δεν αφορούν την πλοήγηση', () => {
    expect(nextGridFocus({ col: 0, row: 1 }, key('a'), DIMS)).toBeNull();
    expect(nextGridFocus({ col: 0, row: 1 }, key('Escape'), DIMS)).toBeNull();
    expect(nextGridFocus({ col: 0, row: 1 }, key('Enter'), DIMS)).toBeNull();
  });
});

describe('isGridCommitKey', () => {
  it('Enter και Space δεσμεύουν', () => {
    expect(isGridCommitKey('Enter')).toBe(true);
    expect(isGridCommitKey(' ')).toBe(true);
  });

  it('τα υπόλοιπα όχι', () => {
    expect(isGridCommitKey('Escape')).toBe(false);
    expect(isGridCommitKey('ArrowDown')).toBe(false);
    expect(isGridCommitKey('Tab')).toBe(false);
  });
});
