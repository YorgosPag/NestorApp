/**
 * ADR-539 Φ4a — classifyFaceClipboardKey (pure keydown → clipboard action mapping).
 * Layout-independent (event.code), Shift → entity-level, Alt → never.
 */

import {
  classifyFaceClipboardKey,
  type FaceClipboardKey,
} from '../polygon-clipboard-key';

function key(over: Partial<FaceClipboardKey>): FaceClipboardKey {
  return { code: 'KeyC', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over };
}

describe('classifyFaceClipboardKey', () => {
  it('Ctrl+C → copy-face', () => {
    expect(classifyFaceClipboardKey(key({ code: 'KeyC', ctrlKey: true }))).toBe('copy-face');
  });

  it('Ctrl+V → paste-face', () => {
    expect(classifyFaceClipboardKey(key({ code: 'KeyV', ctrlKey: true }))).toBe('paste-face');
  });

  it('Cmd+C (metaKey) → copy-face (macOS parity)', () => {
    expect(classifyFaceClipboardKey(key({ code: 'KeyC', metaKey: true }))).toBe('copy-face');
  });

  it('Ctrl+Shift+C → copy-entity', () => {
    expect(classifyFaceClipboardKey(key({ code: 'KeyC', ctrlKey: true, shiftKey: true }))).toBe('copy-entity');
  });

  it('Ctrl+Shift+V → paste-entity', () => {
    expect(classifyFaceClipboardKey(key({ code: 'KeyV', ctrlKey: true, shiftKey: true }))).toBe('paste-entity');
  });

  it('no modifier → null (plain C/V left to the browser / other tools)', () => {
    expect(classifyFaceClipboardKey(key({ code: 'KeyC' }))).toBeNull();
    expect(classifyFaceClipboardKey(key({ code: 'KeyV' }))).toBeNull();
  });

  it('Alt held → null (avoids collision with alt-combos)', () => {
    expect(classifyFaceClipboardKey(key({ code: 'KeyC', ctrlKey: true, altKey: true }))).toBeNull();
  });

  it('other keys → null', () => {
    expect(classifyFaceClipboardKey(key({ code: 'KeyX', ctrlKey: true }))).toBeNull();
    expect(classifyFaceClipboardKey(key({ code: 'KeyZ', ctrlKey: true }))).toBeNull();
  });

  it('uses event.code (layout-independent) — Greek keyboard still maps KeyC', () => {
    // On a Greek layout the produced char is 'ψ', but event.code stays 'KeyC'.
    expect(classifyFaceClipboardKey(key({ code: 'KeyC', ctrlKey: true }))).toBe('copy-face');
  });
});
