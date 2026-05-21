// ============================================================================
// ♿ SELECTION CURSOR ICON — Unit tests (ADR-366 Phase 4.7 / §A.7.Q3)
// ============================================================================

import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { SelectionCursorIcon } from '../SelectionCursorIcon';

afterEach(cleanup);

function fireKey(type: 'keydown' | 'keyup', opts: KeyboardEventInit) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...opts }));
  });
}

function getIcon(container: HTMLElement): HTMLDivElement {
  return container.firstChild as HTMLDivElement;
}

// ── Visibility ────────────────────────────────────────────────────────────────

describe('SelectionCursorIcon — visibility', () => {
  it('starts hidden when no modifier keys held', () => {
    const { container } = render(<SelectionCursorIcon />);
    expect(getIcon(container).className).toContain('hidden');
  });

  it('shows when Ctrl held', () => {
    const { container } = render(<SelectionCursorIcon />);
    fireKey('keydown', { ctrlKey: true });
    expect(getIcon(container).className).not.toContain('hidden');
  });

  it('shows when Shift held', () => {
    const { container } = render(<SelectionCursorIcon />);
    fireKey('keydown', { shiftKey: true });
    expect(getIcon(container).className).not.toContain('hidden');
  });

  it('shows when Ctrl+Shift held', () => {
    const { container } = render(<SelectionCursorIcon />);
    fireKey('keydown', { ctrlKey: true, shiftKey: true });
    expect(getIcon(container).className).not.toContain('hidden');
  });

  it('hides again when modifier released', () => {
    const { container } = render(<SelectionCursorIcon />);
    fireKey('keydown', { ctrlKey: true });
    fireKey('keyup', { ctrlKey: false });
    expect(getIcon(container).className).toContain('hidden');
  });
});

// ── Icon content per mode ─────────────────────────────────────────────────────

describe('SelectionCursorIcon — icon content', () => {
  it('renders two lines (cross) for add mode (Ctrl)', () => {
    const { container } = render(<SelectionCursorIcon />);
    fireKey('keydown', { ctrlKey: true });
    const lines = getIcon(container).querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  it('renders one line for remove mode (Shift)', () => {
    const { container } = render(<SelectionCursorIcon />);
    fireKey('keydown', { shiftKey: true });
    const lines = getIcon(container).querySelectorAll('line');
    expect(lines.length).toBe(1);
  });

  it('renders ± text for toggle mode (Ctrl+Shift)', () => {
    const { container } = render(<SelectionCursorIcon />);
    fireKey('keydown', { ctrlKey: true, shiftKey: true });
    const text = getIcon(container).querySelector('text');
    expect(text?.textContent).toBe('±');
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('SelectionCursorIcon — accessibility', () => {
  it('outer element is aria-hidden (decorative)', () => {
    const { container } = render(<SelectionCursorIcon />);
    expect(getIcon(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('SVG element is aria-hidden', () => {
    const { container } = render(<SelectionCursorIcon />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
