/**
 * ADR-366 Phase 8.0 — ARIA Live Region unit tests.
 *
 * Coverage:
 *   - ariaLiveBus: announce fires listeners, idempotency, severity routing,
 *     unsubscribe, empty-message guard
 *   - ARIA_PRESETS: shape validation for all 4 preset factory functions
 */

import { ariaLiveBus } from '../accessibility/aria-live-bus';
import { ARIA_PRESETS } from '../accessibility/aria-attribute-presets';

beforeEach(() => {
  ariaLiveBus._resetForTests();
});

// ── ariaLiveBus ───────────────────────────────────────────────────────────────

describe('ariaLiveBus', () => {
  it('fires registered listener on announce', () => {
    const spy = jest.fn();
    const unsub = ariaLiveBus.subscribe(spy);
    ariaLiveBus.announce('Hello');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Hello', 'polite');
    unsub();
  });

  it('defaults severity to polite', () => {
    const spy = jest.fn();
    ariaLiveBus.subscribe(spy);
    ariaLiveBus.announce('test');
    expect(spy).toHaveBeenCalledWith('test', 'polite');
  });

  it('routes assertive severity correctly', () => {
    const spy = jest.fn();
    ariaLiveBus.subscribe(spy);
    ariaLiveBus.announce('Error!', 'assertive');
    expect(spy).toHaveBeenCalledWith('Error!', 'assertive');
  });

  it('idempotency: same message within 200ms fires once', () => {
    const spy = jest.fn();
    ariaLiveBus.subscribe(spy);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      ariaLiveBus.announce('Repeated');
      ariaLiveBus.announce('Repeated');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('same message after 200ms window fires again', () => {
    const spy = jest.fn();
    ariaLiveBus.subscribe(spy);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    ariaLiveBus.announce('Msg');
    nowSpy.mockReturnValue(1201); // 201ms later → outside window
    ariaLiveBus.announce('Msg');
    expect(spy).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('different message always fires even at same time', () => {
    const spy = jest.fn();
    ariaLiveBus.subscribe(spy);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      ariaLiveBus.announce('A');
      ariaLiveBus.announce('B');
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('unsubscribe stops listener from receiving', () => {
    const spy = jest.fn();
    const unsub = ariaLiveBus.subscribe(spy);
    unsub();
    ariaLiveBus.announce('After unsub');
    expect(spy).not.toHaveBeenCalled();
  });

  it('empty message is silently ignored', () => {
    const spy = jest.fn();
    ariaLiveBus.subscribe(spy);
    ariaLiveBus.announce('');
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple listeners all receive announce', () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    ariaLiveBus.subscribe(spy1);
    ariaLiveBus.subscribe(spy2);
    ariaLiveBus.announce('Broadcast');
    expect(spy1).toHaveBeenCalledWith('Broadcast', 'polite');
    expect(spy2).toHaveBeenCalledWith('Broadcast', 'polite');
  });
});

// ── ARIA_PRESETS ──────────────────────────────────────────────────────────────

describe('ARIA_PRESETS', () => {
  it('TOGGLE_BUTTON(true) returns role=button, aria-pressed=true', () => {
    const attrs = ARIA_PRESETS.TOGGLE_BUTTON(true);
    expect(attrs.role).toBe('button');
    expect(attrs['aria-pressed']).toBe(true);
  });

  it('TOGGLE_BUTTON(false) sets aria-pressed=false', () => {
    const attrs = ARIA_PRESETS.TOGGLE_BUTTON(false);
    expect(attrs.role).toBe('button');
    expect(attrs['aria-pressed']).toBe(false);
  });

  it('SECTION_PANEL returns role=region with correct labelledby', () => {
    const attrs = ARIA_PRESETS.SECTION_PANEL('my-heading-id');
    expect(attrs.role).toBe('region');
    expect(attrs['aria-labelledby']).toBe('my-heading-id');
  });

  it('VIEWCUBE_FACE active=true sets aria-current=true', () => {
    const attrs = ARIA_PRESETS.VIEWCUBE_FACE('Top', true);
    expect(attrs.role).toBe('button');
    expect(attrs['aria-label']).toBe('Top');
    expect(attrs['aria-current']).toBe(true);
  });

  it('VIEWCUBE_FACE active=false sets aria-current=undefined', () => {
    const attrs = ARIA_PRESETS.VIEWCUBE_FACE('Front', false);
    expect(attrs['aria-current']).toBeUndefined();
  });

  it('RIBBON_TOOL includes aria-pressed when provided', () => {
    const on = ARIA_PRESETS.RIBBON_TOOL('Section', true);
    expect(on['aria-label']).toBe('Section');
    expect(on['aria-pressed']).toBe(true);
  });

  it('RIBBON_TOOL aria-pressed undefined when not provided', () => {
    const attrs = ARIA_PRESETS.RIBBON_TOOL('Pan');
    expect(attrs['aria-label']).toBe('Pan');
    expect(attrs['aria-pressed']).toBeUndefined();
  });
});
