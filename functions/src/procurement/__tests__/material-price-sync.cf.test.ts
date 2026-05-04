/**
 * Unit tests for the pure helpers of the Material Price Sync CF.
 *
 * The trigger itself is exercised end-to-end via the `test:functions-integration`
 * suite (Firestore emulator). This file locks the math + transition rules so the
 * trigger contract cannot drift silently when the helpers are refactored.
 *
 * @module functions/procurement/__tests__/material-price-sync.cf
 * @enterprise ADR-330 Phase 4.5 (Cloud Function variant)
 */

import {
  shouldTriggerSync,
  computeNewAvgPrice,
} from '../material-price-sync-pure';

describe('shouldTriggerSync', () => {
  it('triggers on ordered → delivered', () => {
    expect(shouldTriggerSync('ordered', 'delivered')).toBe(true);
  });

  it('triggers on partially_delivered → delivered', () => {
    expect(shouldTriggerSync('partially_delivered', 'delivered')).toBe(true);
  });

  it('does NOT retrigger when status stays delivered', () => {
    expect(shouldTriggerSync('delivered', 'delivered')).toBe(false);
  });

  it('does NOT trigger on transitions that do not end in delivered', () => {
    expect(shouldTriggerSync('ordered', 'partially_delivered')).toBe(false);
    expect(shouldTriggerSync('draft', 'approved')).toBe(false);
    expect(shouldTriggerSync('approved', 'ordered')).toBe(false);
  });

  it('does NOT trigger on delivered → closed (PO lifecycle continuation)', () => {
    expect(shouldTriggerSync('delivered', 'closed')).toBe(false);
  });

  it('handles missing/undefined statuses defensively', () => {
    expect(shouldTriggerSync(null, 'delivered')).toBe(true);
    expect(shouldTriggerSync(undefined, 'delivered')).toBe(true);
    expect(shouldTriggerSync('ordered', null)).toBe(false);
    expect(shouldTriggerSync('ordered', undefined)).toBe(false);
  });
});

describe('computeNewAvgPrice', () => {
  it('seeds the average with the unit price on first purchase (avg=null)', () => {
    expect(computeNewAvgPrice(null, 100)).toBe(100);
    expect(computeNewAvgPrice(null, 12.5)).toBe(12.5);
  });

  it('blends 50/50 with the previous average on subsequent purchases', () => {
    expect(computeNewAvgPrice(100, 200)).toBe(150);
    expect(computeNewAvgPrice(50, 50)).toBe(50);
    expect(computeNewAvgPrice(10, 30)).toBe(20);
  });

  it('rounds to 2 decimals (cents)', () => {
    expect(computeNewAvgPrice(10.555, 10.557)).toBe(10.56);
    expect(computeNewAvgPrice(0.1, 0.2)).toBe(0.15);
  });

  it('returns 0 when both seeds are 0', () => {
    expect(computeNewAvgPrice(null, 0)).toBe(0);
    expect(computeNewAvgPrice(0, 0)).toBe(0);
  });

  it('handles fractional unit prices on first purchase', () => {
    expect(computeNewAvgPrice(null, 0.333)).toBe(0.333);
  });
});
