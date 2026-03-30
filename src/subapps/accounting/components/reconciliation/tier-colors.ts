/**
 * @fileoverview Match Tier Color Mapping (Phase 2d)
 * @description Maps MatchTier to badge variants and row styling
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q11 (Color coding by tier)
 * @compliance CLAUDE.md Enterprise Standards — no inline styles
 */

import type { MatchTier } from '@/subapps/accounting/types';
import type { BadgeVariantProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeVariantProps['variant']>;

/** Badge variant per match tier */
export const TIER_BADGE_VARIANT: Record<MatchTier, BadgeVariant> = {
  auto_match: 'success',
  suggested: 'info',
  manual_review: 'warning',
  no_match: 'destructive',
};

/** Row background classes per match tier */
export const TIER_ROW_CLASSES: Record<MatchTier, string> = {
  auto_match: 'bg-emerald-50/50 dark:bg-emerald-950/20',
  suggested: 'bg-blue-50/50 dark:bg-blue-950/20',
  manual_review: 'bg-amber-50/50 dark:bg-amber-950/20',
  no_match: 'bg-red-50/50 dark:bg-red-950/20',
};

/** i18n keys per tier */
export const TIER_LABEL_KEYS: Record<MatchTier, string> = {
  auto_match: 'reconciliation.tiers.autoMatch',
  suggested: 'reconciliation.tiers.suggested',
  manual_review: 'reconciliation.tiers.manualReview',
  no_match: 'reconciliation.tiers.noMatch',
};
