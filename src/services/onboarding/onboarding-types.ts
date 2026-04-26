/**
 * Shared onboarding types — no server-only, safe for client + server import.
 * @module services/onboarding/onboarding-types
 */

export interface OnboardingState {
  skippedAt: string | null;
  skippedBy: string | null;
  completedAt: string | null;
  completedBy: string | null;
}

export interface CompanyOnboardingRecord {
  companyId: string;
  adminEmail: string;
  skippedAt: string;
}

const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isRemindEligible(skippedAt: string, now = new Date()): boolean {
  return now.getTime() - new Date(skippedAt).getTime() >= REMIND_AFTER_MS;
}

export function isBannerEligible(state: OnboardingState | null, now = new Date()): boolean {
  if (!state?.skippedAt || state.completedAt) return false;
  return isRemindEligible(state.skippedAt, now);
}
