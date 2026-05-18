import { MultiCharKeySequence } from '../MultiCharKeySequence';
import type { ChordDefinition, FallbackDefinition } from '../MultiCharKeySequence';

// BIM chord table matching useDxfToolbarShortcuts constants
const CHORDS: ChordDefinition[] = [
  { firstKey: 'S', secondKey: 'T', action: 'tool:stair' },
  { firstKey: 'S', secondKey: 'L', action: 'tool:slab' },
  { firstKey: 'O', secondKey: 'P', action: 'tool:opening' },
  { firstKey: 'C', secondKey: 'L', action: 'tool:column' },
  { firstKey: 'B', secondKey: 'M', action: 'tool:beam' },
];

const FALLBACKS: FallbackDefinition[] = [
  { firstKey: 'S', action: 'tool:select' },
  { firstKey: 'O', action: 'tool:layering' },
  { firstKey: 'C', action: 'tool:circle' },
];

jest.useFakeTimers();

const make = (onTimeout = jest.fn()) =>
  new MultiCharKeySequence(CHORDS, FALLBACKS, 350, onTimeout);

// ── Basic chord completion ────────────────────────────────────────────────────

describe('chord completion', () => {
  test('S+T resolves to stair', () => {
    const seq = make();
    expect(seq.feed('S')).toEqual({ kind: 'chord-started' });
    expect(seq.feed('T')).toEqual({ kind: 'chord-completed', action: 'tool:stair' });
  });

  test('S+L resolves to slab', () => {
    const seq = make();
    seq.feed('S');
    expect(seq.feed('L')).toEqual({ kind: 'chord-completed', action: 'tool:slab' });
  });

  test('O+P resolves to opening', () => {
    const seq = make();
    seq.feed('O');
    expect(seq.feed('P')).toEqual({ kind: 'chord-completed', action: 'tool:opening' });
  });

  test('C+L resolves to column', () => {
    const seq = make();
    seq.feed('C');
    expect(seq.feed('L')).toEqual({ kind: 'chord-completed', action: 'tool:column' });
  });

  test('B+M resolves to beam', () => {
    const seq = make();
    seq.feed('B');
    expect(seq.feed('M')).toEqual({ kind: 'chord-completed', action: 'tool:beam' });
  });
});

// ── Timeout / fallback ────────────────────────────────────────────────────────

describe('timeout fallback', () => {
  test('S alone after 350ms fires select', () => {
    const onTimeout = jest.fn();
    const seq = make(onTimeout);
    seq.feed('S');
    jest.advanceTimersByTime(350);
    expect(onTimeout).toHaveBeenCalledWith('tool:select');
  });

  test('O alone after 350ms fires layering', () => {
    const onTimeout = jest.fn();
    const seq = make(onTimeout);
    seq.feed('O');
    jest.advanceTimersByTime(350);
    expect(onTimeout).toHaveBeenCalledWith('tool:layering');
  });

  test('C alone after 350ms fires circle', () => {
    const onTimeout = jest.fn();
    const seq = make(onTimeout);
    seq.feed('C');
    jest.advanceTimersByTime(350);
    expect(onTimeout).toHaveBeenCalledWith('tool:circle');
  });

  test('B alone after 350ms fires null (no fallback defined)', () => {
    const onTimeout = jest.fn();
    const seq = make(onTimeout);
    seq.feed('B');
    jest.advanceTimersByTime(350);
    expect(onTimeout).toHaveBeenCalledWith(null);
  });

  test('timeout does NOT fire after chord completed', () => {
    const onTimeout = jest.fn();
    const seq = make(onTimeout);
    seq.feed('S');
    seq.feed('T'); // completes chord
    jest.advanceTimersByTime(350);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

// ── Wrong second key (fallback-fired) ────────────────────────────────────────

describe('fallback-fired on wrong second key', () => {
  test('S + wrong key returns fallback-fired with select', () => {
    const seq = make();
    seq.feed('S');
    expect(seq.feed('X')).toEqual({ kind: 'fallback-fired', fallbackAction: 'tool:select' });
  });

  test('O + wrong key returns fallback-fired with layering', () => {
    const seq = make();
    seq.feed('O');
    expect(seq.feed('Q')).toEqual({ kind: 'fallback-fired', fallbackAction: 'tool:layering' });
  });

  test('B + wrong key returns fallback-fired with null (no fallback)', () => {
    const seq = make();
    seq.feed('B');
    expect(seq.feed('X')).toEqual({ kind: 'fallback-fired', fallbackAction: null });
  });

  test('onTimeout NOT called on fallback-fired (timer was cleared)', () => {
    const onTimeout = jest.fn();
    const seq = make(onTimeout);
    seq.feed('S');
    seq.feed('X'); // wrong second key
    jest.advanceTimersByTime(500);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

// ── Non-leader keys ───────────────────────────────────────────────────────────

describe('miss for non-leader keys', () => {
  test('L is not a leader → miss', () => {
    const seq = make();
    expect(seq.feed('L')).toEqual({ kind: 'miss' });
  });

  test('W is not a leader → miss', () => {
    const seq = make();
    expect(seq.feed('W')).toEqual({ kind: 'miss' });
  });

  test('G is not a leader → miss', () => {
    const seq = make();
    expect(seq.feed('G')).toEqual({ kind: 'miss' });
  });
});

// ── hasPending ────────────────────────────────────────────────────────────────

describe('hasPending', () => {
  test('false when idle', () => {
    const seq = make();
    expect(seq.hasPending()).toBe(false);
  });

  test('true after leader key', () => {
    const seq = make();
    seq.feed('S');
    expect(seq.hasPending()).toBe(true);
  });

  test('false after chord completed', () => {
    const seq = make();
    seq.feed('S');
    seq.feed('T');
    expect(seq.hasPending()).toBe(false);
  });

  test('false after timeout', () => {
    const seq = make();
    seq.feed('S');
    jest.advanceTimersByTime(350);
    expect(seq.hasPending()).toBe(false);
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('destroy', () => {
  test('clears pending timer and nulls state', () => {
    const onTimeout = jest.fn();
    const seq = make(onTimeout);
    seq.feed('S');
    seq.destroy();
    jest.advanceTimersByTime(500);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(seq.hasPending()).toBe(false);
  });

  test('safe to call destroy when idle', () => {
    const seq = make();
    expect(() => seq.destroy()).not.toThrow();
  });
});

// ── Prefix collision ─────────────────────────────────────────────────────────

describe('prefix collision (S has two second keys)', () => {
  test('S+T and S+L both resolve correctly', () => {
    const seq1 = make();
    seq1.feed('S');
    expect(seq1.feed('T')).toEqual({ kind: 'chord-completed', action: 'tool:stair' });

    const seq2 = make();
    seq2.feed('S');
    expect(seq2.feed('L')).toEqual({ kind: 'chord-completed', action: 'tool:slab' });
  });

  test('S + other key falls back to select (not stair or slab)', () => {
    const seq = make();
    seq.feed('S');
    const result = seq.feed('X');
    expect(result).toEqual({ kind: 'fallback-fired', fallbackAction: 'tool:select' });
  });
});
