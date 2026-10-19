'use client';

/**
 * 🏢 ENTERPRISE CARD HEADER - Primitive Component
 *
 * A card's identity region: the icon/title/subtitle block, followed by the
 * status badges. Single Source of Truth for the header's clipping and for the
 * rule that a card shows at most two badges — one when they ride inline with
 * the title.
 *
 * @fileoverview Reusable header region for card components.
 * @enterprise Fortune 500 compliant - Uses centralized spacing tokens
 * @see CardTitleBlock, CardBadges for the composed primitives
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import React from 'react';
import { cn } from '@/lib/utils';

// 🏢 CENTRALIZED HOOKS
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { usePriorityOverflow, type PriorityOverflowSpec } from '@/hooks/media/usePriorityOverflow';

import { CardTitleBlock } from './CardTitleBlock';
import { CardBadges, CARD_BADGE_ATTR, CARD_BADGE_OVERFLOW_ATTR } from './CardBadges';
import type { CardBadge, CardIdentityProps } from './types';
import '@/lib/design-system';

/**
 * Maximum badges on a card's own row. Τρία: φυσική κατάσταση · εμπορική κατάσταση · κοινό (ADR-777 §8.87.8) — με δύο
 * το σήμα κοινού της κάρτας ακινήτου δεν αποδιδόταν ποτέ (§8.87.9γ2). Ό,τι περισσεύει γίνεται «+N» (`CardBadges`).
 */
const MAX_BADGES_STACKED = 3;
/** Maximum badges when they share the title's row */
const MAX_BADGES_INLINE = 1;

/**
 * Πώς φέρεται η γραμμή σημάτων όταν τα σήματα ξεπερνούν το πλάτος της κάρτας.
 * - `wrap`: αναδιπλώνονται σε επόμενες γραμμές — το πλακίδιο έχει το ύψος.
 * - `fit`: μία γραμμή, σταθερό ύψος· ό,τι δεν χωρά **ολόκληρο** περνά στο «+N» (μετρημένο, ADR-912 §11). Ως τις
 *   2026-10-11 η γραμμή δήλωνε σκέτο `overflow-hidden` και το τελευταίο σήμα φαινόταν **μισό** στα 390px.
 */
export type CardBadgeRowMode = 'wrap' | 'fit';

const CARD_BADGE_OVERFLOW: PriorityOverflowSpec = {
  itemAttr: CARD_BADGE_ATTR,
  moreAttr: CARD_BADGE_OVERFLOW_ATTR,
  // Πλάτος του «+N» πριν ζωγραφιστεί (`px-2.5` + δύο χαρακτήρες `text-xs` + περίγραμμα).
  moreFallbackPx: 36,
  // Η γραμμή δεν καταρρέει ποτέ σε σκέτο «+N»: το πρώτο σήμα είναι η κατάσταση της εγγραφής.
  minVisible: 1,
};

interface CardBadgeRowProps {
  readonly badges: readonly CardBadge[];
  readonly className: string;
}

/** Η μετρημένη γραμμή: τα σήματα που χωρούν ολόκληρα, και «+N» για τα υπόλοιπα. */
function FittedBadgeRow({ badges, className }: CardBadgeRowProps) {
  const { containerRef, visibleCount } = usePriorityOverflow<HTMLDivElement>(
    Math.min(badges.length, MAX_BADGES_STACKED),
    CARD_BADGE_OVERFLOW,
    // Πάνω από το όριο πλήθους το «+N» υπάρχει ούτως ή άλλως ⇒ ο χώρος του κρατιέται από την αρχή.
    badges.length > MAX_BADGES_STACKED,
  );
  return (
    <div ref={containerRef} className={cn(className, 'overflow-hidden')}>
      <CardBadges badges={badges} max={MAX_BADGES_STACKED} fitting={visibleCount} badgeClassName="shrink-0" />
    </div>
  );
}

function WrappedBadgeRow({ badges, className }: CardBadgeRowProps) {
  return (
    <div className={cn(className, 'flex-wrap')}>
      <CardBadges badges={badges} max={MAX_BADGES_STACKED} />
    </div>
  );
}

const BADGE_ROWS: Record<CardBadgeRowMode, (props: CardBadgeRowProps) => React.ReactElement> = {
  wrap: WrappedBadgeRow,
  fit: FittedBadgeRow,
};

/**
 * Props for CardHeaderBlock
 */
export interface CardHeaderBlockProps extends CardIdentityProps {
  /** Status badges, in priority order */
  badges?: readonly CardBadge[];
  /**
   * Render the leading badge on the title's row instead of a row of its own.
   * Inline mode shows one badge; the stacked row shows two.
   */
  inlineBadges?: boolean;
  /** How the stacked badge row handles badges that exceed the card's width. */
  badgeRow: CardBadgeRowMode;
}

/**
 * 🏢 CardHeaderBlock Component
 *
 * @example
 * ```tsx
 * <CardHeaderBlock
 *   entityType="parking"
 *   title="P-001"
 *   subtitle="Τυπική Θέση"
 *   badges={badges}
 *   badgeRow="wrap"
 * />
 * ```
 */
export function CardHeaderBlock({
  entityType,
  customIcon,
  customIconColor,
  avatar,
  title,
  subtitle,
  compact = false,
  hideIcon = false,
  badges = [],
  inlineBadges = false,
  badgeRow,
}: CardHeaderBlockProps) {
  const spacing = useSpacingTokens();

  const hasBadges = badges.length > 0;
  const showInlineBadges = inlineBadges && hasBadges;
  const showStackedBadges = !inlineBadges && hasBadges;
  const BadgeRow = BADGE_ROWS[badgeRow];

  return (
    <header className={cn('overflow-hidden', spacing.margin.bottom.sm)}>
      {/* Row 1: Icon + Title (+ inline badges if enabled) */}
      <CardTitleBlock
        entityType={entityType}
        customIcon={customIcon}
        customIconColor={customIconColor}
        avatar={avatar}
        title={title}
        subtitle={subtitle}
        compact={compact}
        hideIcon={hideIcon}
        inlineSlot={
          showInlineBadges ? (
            <CardBadges
              badges={badges}
              max={MAX_BADGES_INLINE}
              // ⚠️ Η θυρίδα δίπλα στον τίτλο χωρά ΕΝΑ σήμα· «+N» εκεί αλλάζει ~12 κάρτες λίστας και δεν έχει μετρηθεί
              //    σε browser (ADR-777 §8.87.9γ2, ανοιχτό). Δηλωμένο ρητά, όχι σιωπηλό.
              overflow="drop"
              keyPrefix="inline-"
              badgeClassName="flex-shrink-0"
            />
          ) : undefined
        }
      />

      {/* Row 2: Badges (separate row when NOT inline) */}
      {showStackedBadges && (
        <BadgeRow badges={badges} className={cn('flex items-center', spacing.gap.sm, spacing.margin.top.sm)} />
      )}
    </header>
  );
}

CardHeaderBlock.displayName = 'CardHeaderBlock';

export default CardHeaderBlock;
