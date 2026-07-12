/**
 * Regression — `matchesShortcutDef` must never crash the keydown handler.
 *
 * A synthetic / IME-composition / dead-key `keydown` can arrive with `event.key`
 * undefined; a malformed shortcut def may lack `key`. Calling `.toUpperCase()` on
 * either `undefined` used to throw INSIDE the global keydown listener, killing every
 * shortcut for the rest of the session (observed as
 * `Cannot read properties of undefined (reading 'toUpperCase')`). The guard makes an
 * unmatchable event fall through to `false` instead of throwing.
 */

import { matchesShortcutDef, DXF_TOOL_SHORTCUTS } from '../keyboard-shortcuts';
import type { ShortcutDefinition } from '../keyboard-shortcuts';

/** A bare event carrying only the fields `matchesShortcutDef` reads (all modifiers off). */
function fakeEvent(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    key: '', code: '',
    ...partial,
  } as KeyboardEvent;
}

// `select` = key 'S', modifier 'none' — a plain single-letter shortcut.
const selectDef: ShortcutDefinition = DXF_TOOL_SHORTCUTS.select;

describe('matchesShortcutDef — undefined-key guard', () => {
  it('returns false (no throw) when event.key is undefined', () => {
    expect(() => matchesShortcutDef(fakeEvent({ key: undefined }), selectDef)).not.toThrow();
    expect(matchesShortcutDef(fakeEvent({ key: undefined }), selectDef)).toBe(false);
  });

  it('returns false (no throw) when the shortcut def has no key', () => {
    const malformed = { ...selectDef, key: undefined as unknown as string };
    expect(() => matchesShortcutDef(fakeEvent({ key: 'S' }), malformed)).not.toThrow();
    expect(matchesShortcutDef(fakeEvent({ key: 'S' }), malformed)).toBe(false);
  });

  it('still matches a normal keypress (guard does not regress the happy path)', () => {
    expect(matchesShortcutDef(fakeEvent({ key: 's' }), selectDef)).toBe(true);
    expect(matchesShortcutDef(fakeEvent({ key: 'S' }), selectDef)).toBe(true);
  });

  it('still rejects a non-matching key', () => {
    expect(matchesShortcutDef(fakeEvent({ key: 'A' }), selectDef)).toBe(false);
  });
});
