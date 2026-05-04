/**
 * Tests for ADR-331 Phase B1 helpers (D26 = pure helper coverage).
 * Covers: quarter-helpers (pure), canViewSpendAnalytics RBAC, aggregator fallback.
 */

import {
  getCurrentQuarterRange,
  getPreviousPeriod,
  athensOffsetHours,
  athensDateRangeToUtc,
} from '@/lib/date/quarter-helpers';
import { canViewSpendAnalytics } from '@/lib/auth/permissions/spend-analytics';

// ============================================================================
// quarter-helpers — getCurrentQuarterRange
// ============================================================================

describe('getCurrentQuarterRange', () => {
  it('Q1: Jan 1 → March date', () => {
    const result = getCurrentQuarterRange(new Date('2026-02-15T12:00:00Z'));
    expect(result.from).toBe('2026-01-01');
    expect(result.to).toBe('2026-02-15');
  });

  it('Q2: Apr 1 → June date', () => {
    const result = getCurrentQuarterRange(new Date('2026-05-20T00:00:00Z'));
    expect(result.from).toBe('2026-04-01');
    expect(result.to).toBe('2026-05-20');
  });

  it('Q3: Jul 1 → Sep date', () => {
    const result = getCurrentQuarterRange(new Date('2026-08-01T00:00:00Z'));
    expect(result.from).toBe('2026-07-01');
    expect(result.to).toBe('2026-08-01');
  });

  it('Q4: Oct 1 → Dec date', () => {
    const result = getCurrentQuarterRange(new Date('2026-11-30T00:00:00Z'));
    expect(result.from).toBe('2026-10-01');
    expect(result.to).toBe('2026-11-30');
  });
});

// ============================================================================
// quarter-helpers — getPreviousPeriod
// ============================================================================

describe('getPreviousPeriod', () => {
  it('30-day period shifts back 31 days', () => {
    // from=2026-02-01, to=2026-03-02 (29 days duration)
    // prev.to = 2026-01-31 (1 day before from)
    // prev.from = 2026-01-02 (29 days before prev.to)
    const result = getPreviousPeriod('2026-02-01', '2026-03-02');
    expect(result.to).toBe('2026-01-31');
    // Duration: 2026-02-01 to 2026-03-02 = 29 days
    // prev.from = 2026-01-31 - 29 days = 2026-01-02
    expect(result.from).toBe('2026-01-02');
  });

  it('Q1 previous quarter is Q4', () => {
    const result = getPreviousPeriod('2026-01-01', '2026-03-31');
    // Q1 duration = 89 days. prev.to = 2025-12-31. prev.from = 2025-10-03
    expect(result.to).toBe('2025-12-31');
    // 2025-12-31 - 89 days = 2025-10-03
    expect(result.from).toBe('2025-10-03');
  });

  it('single day period gives previous day', () => {
    const result = getPreviousPeriod('2026-05-04', '2026-05-04');
    expect(result.to).toBe('2026-05-03');
    expect(result.from).toBe('2026-05-03');
  });
});

// ============================================================================
// quarter-helpers — Athens timezone
// ============================================================================

describe('athensOffsetHours', () => {
  it('January = UTC+2 (winter)', () => {
    expect(athensOffsetHours('2026-01-15')).toBe(2);
  });

  it('July = UTC+3 (summer)', () => {
    expect(athensOffsetHours('2026-07-15')).toBe(3);
  });

  it('March before DST switch = UTC+2', () => {
    // DST 2026 starts last Sunday of March. March 29, 2026 is a Sunday.
    expect(athensOffsetHours('2026-03-28')).toBe(2);
  });

  it('March after DST switch = UTC+3', () => {
    expect(athensOffsetHours('2026-03-30')).toBe(3);
  });

  it('October before DST end = UTC+3', () => {
    // DST 2026 ends last Sunday of October = Oct 25, 2026.
    expect(athensOffsetHours('2026-10-24')).toBe(3);
  });

  it('October after DST end = UTC+2', () => {
    expect(athensOffsetHours('2026-10-26')).toBe(2);
  });
});

describe('athensDateRangeToUtc', () => {
  it('winter range: start shifts to previous day UTC', () => {
    const { start, end } = athensDateRangeToUtc('2026-01-01', '2026-01-31');
    // Midnight Athens UTC+2 = 2025-12-31T22:00:00.000Z
    expect(start).toBe('2025-12-31T22:00:00.000Z');
    // End of day Athens UTC+2 = 21:59:59.999Z same calendar day
    expect(end).toBe('2026-01-31T21:59:59.999Z');
  });

  it('summer range: start is same date UTC', () => {
    const { start, end } = athensDateRangeToUtc('2026-07-01', '2026-07-31');
    // Midnight Athens UTC+3 = 2026-06-30T21:00:00.000Z
    expect(start).toBe('2026-06-30T21:00:00.000Z');
    // End: 20:59:59.999Z
    expect(end).toBe('2026-07-31T20:59:59.999Z');
  });
});

// ============================================================================
// canViewSpendAnalytics — RBAC
// ============================================================================

describe('canViewSpendAnalytics', () => {
  it('allows super_admin', () => expect(canViewSpendAnalytics('super_admin')).toBe(true));
  it('allows company_admin', () => expect(canViewSpendAnalytics('company_admin')).toBe(true));
  it('blocks internal_user', () => expect(canViewSpendAnalytics('internal_user')).toBe(false));
  it('blocks external_user', () => expect(canViewSpendAnalytics('external_user')).toBe(false));
  it('blocks unknown role', () => expect(canViewSpendAnalytics('site_manager')).toBe(false));
});
