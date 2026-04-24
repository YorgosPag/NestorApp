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

