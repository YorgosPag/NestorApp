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
}

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
export function CardBadges({ badges, max, overflow = 'count', keyPrefix = '', badgeClassName }: CardBadgesProps) {
  const hidden = overflow === 'count' ? badges.slice(max) : [];
  return (
    <>
      {badges.slice(0, max).map((badge, index) => (
        <Badge
          key={`${keyPrefix}${badge.label}-${index}`}
          variant={badge.variant}
          className={cn('whitespace-nowrap', badgeClassName, badge.className)}
        >
          {badge.label}
        </Badge>
      ))}
      {hidden.length > 0 && (
        <Badge variant="outline" className={cn('whitespace-nowrap', badgeClassName)} data-card-badge-overflow>
          <span aria-hidden="true">+{hidden.length}</span>
          <span className="sr-only">{hidden.map((badge) => badge.label).join(', ')}</span>
        </Badge>
      )}
    </>
  );
}

CardBadges.displayName = 'CardBadges';

export default CardBadges;
