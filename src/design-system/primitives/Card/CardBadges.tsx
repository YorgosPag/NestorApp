'use client';

/**
 * 🏢 ENTERPRISE CARD BADGES - Primitive Component
 *
 * Renders a card's status badges through the centralized Badge component.
 * 🔴 **Ό,τι δεν χωρά στο όριο ΔΕΝ πέφτει σιωπηλά** (ADR-777 §8.87.9γ2): γίνεται σήμα «+N», με τα κρυμμένα ονόματα
 * διαθέσιμα στον αναγνώστη οθόνης. Ως τις 2026-10-09 το `slice(0, max)` έσβηνε το τρίτο σήμα χωρίς ίχνος — το σήμα
 * κοινού της λίστας ακινήτων υπήρχε στο μοντέλο, ήταν πράσινο στο test και **δεν εμφανίστηκε ποτέ** στην οθόνη.
 * Πρακτική: MUI `limitTags` · Fluent `Overflow` · Atlassian tag group — πάντα «+N», ποτέ σιωπηλή αποκοπή.
 *
 * Owns the "how many badges may a card show" cap; the surrounding layout (a
 * wrapped row, an inline slot next to the title) stays with the card shell,
 * because that layout is what genuinely differs between grid and list.
 *
 * @fileoverview Reusable badge list for card components.
 * @enterprise Fortune 500 compliant - Single source of truth for card badges
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import React from 'react';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized Badge component (single source of truth for all badges)
import { Badge } from '@/components/ui/badge';
import { useIconSizes } from '@/hooks/useIconSizes';

import type { CardBadge } from './types';
import '@/lib/design-system';

/**
 * Props for CardBadges
 */
export interface CardBadgesProps {
  /** Badges to render, in priority order */
  badges: readonly CardBadge[];
  /** Maximum number of badges rendered; the rest collapse into one "+N" badge */
  max: number;
  /**
   * Τι γίνεται με όσα ξεπερνούν το `max`. `count` (προεπιλογή) ⇒ σήμα «+N». `drop` ⇒ παραλείπονται — **ρητή** δήλωση
   * του καλούντα ότι η θυρίδα του χωρά ΕΝΑ σήμα και τα υπόλοιπα ζουν αλλού· ποτέ προεπιλογή.
   */
  overflow?: 'count' | 'drop';
  /** Key prefix - disambiguates when a card renders two badge groups */
  keyPrefix?: string;
  /** Additional className applied to every badge */
  badgeClassName?: string;
  /**
   * **Μετρημένη γραμμή** (ADR-912 §11): πόσα από τα πρώτα `max` σήματα **χωρούν** στο πλάτος της γραμμής — η απάντηση
   * του `usePriorityOverflow`. Όσα δεν χωρούν προστίθενται στο «+N», αλλά **μένουν στη ροή αόρατα**, ώστε να μετριούνται
   * ακόμη και να επιστρέφουν όταν η γραμμή πλατύνει. Παράλειψη = γραμμή χωρίς μέτρηση (ισχύει μόνο το `max`).
   */
  fitting?: number;
}

/** Σημάδι πάνω σε κάθε σήμα της γραμμής — αυτά μετρά το `usePriorityOverflow`. */
export const CARD_BADGE_ATTR = 'data-card-badge';
/** Σημάδι πάνω στο σήμα «+N». */
export const CARD_BADGE_OVERFLOW_ATTR = 'data-card-badge-overflow';

const BADGE_MARK = { [CARD_BADGE_ATTR]: '' };
const OVERFLOW_MARK = { [CARD_BADGE_OVERFLOW_ATTR]: '' };

/**
 * 🏢 CardBadges Component
 *
 * Returns a fragment, not a container — the caller supplies the row layout.
 *
 * @example
 * ```tsx
 * <div className="flex items-center flex-wrap gap-2">
 *   <CardBadges badges={badges} max={2} />
 * </div>
 * ```
 */
export function CardBadges({
  badges,
  max,
  overflow = 'count',
  keyPrefix = '',
  badgeClassName,
  fitting,
}: CardBadgesProps) {
  // Ένα όριο, δύο λόγοι: το πλήθος (`max`) και — μόνο στη μετρημένη γραμμή — το πλάτος (`fitting`).
  const iconSizes = useIconSizes();
  const shown = Math.min(max, fitting ?? max);
  const hidden = overflow === 'count' ? badges.slice(shown) : [];
  return (
    <>
      {badges.slice(0, max).map((badge, index) => {
        // Δεν χωρά: μένει στη ροή για να μετριέται, αλλά δεν φαίνεται και δεν διαβάζεται (το όνομά του το λέει το «+N»).
        const unfitted = index >= shown;
        const Icon = badge.icon;
        return (
          <Badge
            key={`${keyPrefix}${badge.label}-${index}`}
            variant={badge.variant}
            className={cn('whitespace-nowrap', Icon && 'gap-1', badgeClassName, badge.className, unfitted && 'invisible order-last')}
            aria-hidden={unfitted || undefined}
            {...BADGE_MARK}
          >
            {Icon && <Icon aria-hidden="true" className={cn(iconSizes.xs, 'shrink-0')} />}
            {badge.label}
          </Badge>
        );
      })}
      {hidden.length > 0 && (
        <Badge variant="outline" className={cn('whitespace-nowrap', badgeClassName)} {...OVERFLOW_MARK}>
          <span aria-hidden="true">+{hidden.length}</span>
          <span className="sr-only">{hidden.map((badge) => badge.label).join(', ')}</span>
        </Badge>
      )}
    </>
  );
}

CardBadges.displayName = 'CardBadges';

export default CardBadges;
