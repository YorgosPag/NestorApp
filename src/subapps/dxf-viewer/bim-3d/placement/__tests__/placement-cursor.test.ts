/**
 * ADR-403/406 — placement-cursor SSoT ref-count tests.
 *
 * Guards the «hand instead of crosshair» bug: when two placement hooks (column +
 * MEP fixture) hand off on the same canvas, the disarming hook's release must NOT
 * clear the crosshair while the arming hook still holds it — regardless of the
 * order acquire/release fire in.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { acquirePlacementCursor, releasePlacementCursor } from '../placement-cursor';

function makeEl(): HTMLElement {
  return document.createElement('div');
}

describe('placement-cursor SSoT', () => {
  let el: HTMLElement;
  beforeEach(() => { el = makeEl(); });

  it('acquire sets the crosshair', () => {
    acquirePlacementCursor(el);
    expect(el.style.cursor).toBe('crosshair');
  });

  it('release after a single acquire clears the cursor', () => {
    acquirePlacementCursor(el);
    releasePlacementCursor(el);
    expect(el.style.cursor).toBe('');
  });

  it('tool hand-off keeps the crosshair when release fires BEFORE the new acquire', () => {
    acquirePlacementCursor(el);            // column armed
    releasePlacementCursor(el);            // column disarms…
    acquirePlacementCursor(el);            // …fixture arms (release-then-acquire order)
    expect(el.style.cursor).toBe('crosshair');
  });

  it('tool hand-off keeps the crosshair when acquire fires BEFORE the old release', () => {
    acquirePlacementCursor(el);            // column armed
    acquirePlacementCursor(el);            // fixture arms first…
    releasePlacementCursor(el);            // …column disarms after (acquire-then-release order)
    expect(el.style.cursor).toBe('crosshair');
  });

  it('clears only when the LAST holder releases', () => {
    acquirePlacementCursor(el);
    acquirePlacementCursor(el);
    releasePlacementCursor(el);
    expect(el.style.cursor).toBe('crosshair');
    releasePlacementCursor(el);
    expect(el.style.cursor).toBe('');
  });

  it('is per-canvas (independent counts)', () => {
    const a = makeEl();
    const b = makeEl();
    acquirePlacementCursor(a);
    expect(a.style.cursor).toBe('crosshair');
    expect(b.style.cursor).toBe('');
  });
});
