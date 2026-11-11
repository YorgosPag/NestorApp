'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { ACTIONABLE_CARD_CLASS, PRESSED_CARD_CLASS, actionableCardProps } from './actionable-card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';
import type { StatBreakdownRow } from '@/types/stat-breakdown';
import { StatBreakdown } from '@/components/shared/stat-breakdown/StatBreakdown';

import { STAT_TONE_TEXT, type StatTone } from '@/design-system/stat-tone';

/** Ο ΚΛΕΙΣΤΟΣ κατάλογος χρωμάτων — ο ΕΝΑΣ, στο `design-system/stat-tone` (ADR-770 §18). */
export type StatsCardColor = StatTone;

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: StatsCardColor;
    onClick?: () => void;
    loading?: boolean;
    description?: string;
    /**
     * Υποσύνολα — τιμή ανά ρόλο (ADR-777 §8.60.14.13) · εμβαδόν ανά είδος (§8.101). Όταν έχει γραμμές,
     * **αντικαθιστά** το `value`: μεγέθη άλλης μονάδας/άλλου είδους δεν γίνονται ένας αριθμός. Τα παράγουν **μόνο**
     * το `priceTotalsView` και το `areaTotalsView`.
     */
    breakdown?: readonly StatBreakdownRow[];
    /**
     * Η κάρτα είναι **εναλλαγή φίλτρου** και αυτή είναι η κατάστασή της (ADR-840 §7.8). `undefined` ⇒ δεν είναι
     * εναλλαγή. Λέγεται με `aria-pressed` **και** με παχύτερο περίγραμμα τονισμού — ποτέ μόνο με χρώμα (ADR-771).
     */
    pressed?: boolean;
}

export function StatsCard({ title, value, icon: Icon, color, onClick, loading, description, breakdown, pressed }: StatsCardProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
    // ΕΝΑΣ χάρτης τόνου (`STAT_TONE_TEXT`): ετικέτα + εικονίδιο τον παίρνουν αυτούσιο· ο αριθμός διαφέρει ΜΟΝΟ
    // στην ουδέτερη κάρτα (μελάνι κειμένου αντί muted).
    const colorKey = color;
    const toneClass = STAT_TONE_TEXT[colorKey];
    const valueToneClass = colorKey === 'gray' ? colors.text.primary : toneClass;

    return (
        <Card
            className={`${quick.card} ${colors.bg.card} ${toneClass} ${onClick ? `${ACTIONABLE_CARD_CLASS} ${INTERACTIVE_PATTERNS.CARD_ENHANCED}` : ''} ${pressed ? PRESSED_CARD_CLASS : ''} min-w-0 max-w-full overflow-hidden`}
            {...actionableCardProps(onClick, pressed)}
        >
            <CardContent className={`${spacing.padding.sm} min-w-0`}>
                <div className="flex items-center justify-between min-w-0 max-w-full">
                    <div className="min-w-0 flex-1 mr-1 sm:mr-2 overflow-hidden min-h-[3.75rem]">
                        {loading ? (
                            <>
                                <Skeleton className="h-4 w-20 mb-1" />
                                <Skeleton className="h-7 w-14" />
                                <Skeleton className="h-3 w-24 mt-1" />
                            </>
                        ) : (
                            <>
                                <p className={`text-xs font-medium ${toneClass} truncate leading-tight`}>{title}</p>
                                {breakdown && breakdown.length > 0 ? (
                                    <StatBreakdown rows={breakdown} valueClassName={valueToneClass} />
                                ) : (
                                    <p className={`${typeof value === 'string' ? 'text-sm sm:text-base' : 'text-lg sm:text-xl lg:text-2xl'} font-bold ${valueToneClass} truncate leading-tight`}>{value}</p>
                                )}
                                {description && (
                                    <p className={`text-xs ${colors.text.muted} truncate leading-tight mt-0.5`}>{description}</p>
                                )}
                            </>
                        )}
                    </div>
                    <Icon className={`${iconSizes.lg} ${toneClass} flex-shrink-0`} />
                </div>
            </CardContent>
        </Card>
    );
}

export default StatsCard;