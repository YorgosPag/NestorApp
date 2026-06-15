/**
 * Tests for the pure modal-presence detector (ADR-040 cursor-lag Φ6).
 */

import { detectOpenModal, MODAL_Z_INDEX_THRESHOLD } from '../modal-presence-detect';

function makeOverlay(opts: { zIndex?: string; display?: string; className?: string }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = opts.className ?? 'fixed inset-0';
  if (opts.zIndex !== undefined) el.style.zIndex = opts.zIndex;
  if (opts.display !== undefined) el.style.display = opts.display;
  document.body.appendChild(el);
  return el;
}

describe('detectOpenModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false when no overlay exists', () => {
    expect(detectOpenModal(document, window)).toBe(false);
  });

  it('returns false for a fixed inset-0 overlay below the z-index threshold', () => {
    makeOverlay({ zIndex: String(MODAL_Z_INDEX_THRESHOLD - 1) });
    expect(detectOpenModal(document, window)).toBe(false);
  });

  it('returns true for an overlay at the z-index threshold', () => {
    makeOverlay({ zIndex: String(MODAL_Z_INDEX_THRESHOLD) });
    expect(detectOpenModal(document, window)).toBe(true);
  });

  it('returns true for a high z-index modal overlay (e.g. PromptDialog 10000)', () => {
    makeOverlay({ zIndex: '10000' });
    expect(detectOpenModal(document, window)).toBe(true);
  });

  it('ignores a qualifying overlay that is display:none', () => {
    makeOverlay({ zIndex: '10000', display: 'none' });
    expect(detectOpenModal(document, window)).toBe(false);
  });

  it('ignores elements that are not fixed inset-0', () => {
    const el = document.createElement('div');
    el.className = 'absolute inset-0';
    el.style.zIndex = '10000';
    document.body.appendChild(el);
    expect(detectOpenModal(document, window)).toBe(false);
  });

  it('returns true if at least one of several overlays qualifies', () => {
    makeOverlay({ zIndex: '10' });
    makeOverlay({ zIndex: '60' });
    expect(detectOpenModal(document, window)).toBe(true);
  });
});
