/**
 * ADR-344 Phase 6.C — DirectDistanceEntry tests.
 */

import { describe, it, expect } from '@jest/globals';
import { DirectDistanceEntry } from '../DirectDistanceEntry';

describe('DirectDistanceEntry — buffer accept/reject', () => {
  it('starts in idle status and rejects keystrokes', () => {
    const d = new DirectDistanceEntry();
    expect(d.snapshot().status).toBe('idle');
    expect(d.pressKey('1')).toBe(false);
  });

  it('accepts digits after begin()', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    expect(d.pressKey('1')).toBe(true);
    expect(d.pressKey('2')).toBe(true);
    expect(d.snapshot().buffer).toBe('12');
    expect(d.snapshot().value).toBe(12);
  });

  it('accepts a single decimal point', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    d.pressKey('1');
    expect(d.pressKey('.')).toBe(true);
    d.pressKey('5');
    expect(d.snapshot().value).toBe(1.5);
    expect(d.pressKey('.')).toBe(false);
  });

  it('accepts a leading minus only at position 0', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    expect(d.pressKey('-')).toBe(true);
    d.pressKey('3');
    expect(d.snapshot().value).toBe(-3);
    expect(d.pressKey('-')).toBe(false);
  });

  it('rejects non-numeric keystrokes', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    expect(d.pressKey('a')).toBe(false);
    expect(d.pressKey(' ')).toBe(false);
    expect(d.snapshot().buffer).toBe('');
  });

  it('Backspace removes the last char', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    d.pressKey('1');
    d.pressKey('2');
    d.pressKey('Backspace');
    expect(d.snapshot().buffer).toBe('1');
  });
});

describe('DirectDistanceEntry — parsing edge cases', () => {
  it('returns null value for empty / lone-sign / lone-dot buffers', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    expect(d.snapshot().value).toBeNull();
    d.pressKey('-');
    expect(d.snapshot().value).toBeNull();
    d.reset();
    d.begin();
    d.pressKey('.');
    expect(d.snapshot().value).toBeNull();
  });
});

describe('DirectDistanceEntry — lifecycle', () => {
  it('commit() returns the value and moves to committed status', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    d.pressKey('7');
    expect(d.commit()).toBe(7);
    expect(d.snapshot().status).toBe('committed');
  });

  it('cancel() clears the buffer and returns to idle', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    d.pressKey('5');
    d.cancel();
    expect(d.snapshot().status).toBe('idle');
    expect(d.snapshot().buffer).toBe('');
  });

  it('begin() after commit starts a clean session', () => {
    const d = new DirectDistanceEntry();
    d.begin();
    d.pressKey('1');
    d.commit();
    d.begin();
    expect(d.snapshot().status).toBe('buffering');
    expect(d.snapshot().buffer).toBe('');
  });
});
