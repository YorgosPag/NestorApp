import { isRemindEligible, isBannerEligible } from '../onboarding-types';
import type { OnboardingState } from '../onboarding-types';

// ─── isRemindEligible ─────────────────────────────────────────────────────────

describe('isRemindEligible', () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  it('returns true when skipped exactly 7 days ago', () => {
    const now = new Date('2026-04-26T12:00:00Z');
    const skippedAt = new Date(now.getTime() - SEVEN_DAYS_MS).toISOString();
    expect(isRemindEligible(skippedAt, now)).toBe(true);
  });

  it('returns true when skipped more than 7 days ago', () => {
    const now = new Date('2026-04-26T12:00:00Z');
    const skippedAt = new Date(now.getTime() - SEVEN_DAYS_MS - 1000).toISOString();
    expect(isRemindEligible(skippedAt, now)).toBe(true);
  });

  it('returns false when skipped less than 7 days ago', () => {
    const now = new Date('2026-04-26T12:00:00Z');
    const skippedAt = new Date(now.getTime() - SEVEN_DAYS_MS + 1000).toISOString();
    expect(isRemindEligible(skippedAt, now)).toBe(false);
  });

  it('returns false when skipped today', () => {
    const now = new Date('2026-04-26T12:00:00Z');
    const skippedAt = new Date(now.getTime() - 60_000).toISOString();
    expect(isRemindEligible(skippedAt, now)).toBe(false);
  });
});

// ─── isBannerEligible ─────────────────────────────────────────────────────────

describe('isBannerEligible', () => {
  const now = new Date('2026-04-26T12:00:00Z');
  const oldSkip = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const recentSkip = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  it('returns false for null state', () => {
    expect(isBannerEligible(null, now)).toBe(false);
  });

  it('returns false when state has no skippedAt', () => {
    const state: OnboardingState = { skippedAt: null, skippedBy: null, completedAt: null, completedBy: null };
    expect(isBannerEligible(state, now)).toBe(false);
  });

  it('returns false when completedAt is set', () => {
    const state: OnboardingState = {
      skippedAt: oldSkip,
      skippedBy: 'uid_1',
      completedAt: new Date().toISOString(),
      completedBy: 'uid_1',
    };
    expect(isBannerEligible(state, now)).toBe(false);
  });

  it('returns false when skipped recently (< 7 days)', () => {
    const state: OnboardingState = { skippedAt: recentSkip, skippedBy: 'uid_1', completedAt: null, completedBy: null };
    expect(isBannerEligible(state, now)).toBe(false);
  });

  it('returns true when skipped > 7 days ago and not completed', () => {
    const state: OnboardingState = { skippedAt: oldSkip, skippedBy: 'uid_1', completedAt: null, completedBy: null };
    expect(isBannerEligible(state, now)).toBe(true);
  });
});
