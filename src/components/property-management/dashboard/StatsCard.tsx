'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';
import type { PriceTotalsRow } from '@/lib/listings/listing-price-label';
import { PriceTotalsBreakdown } from '@/components/shared/price-totals/PriceTotalsBreakdown';

/**
 * Ο ΚΛΕΙΣΤΟΣ κατάλογος χρωμάτων — ADR-770 §18. Ήταν `color: string` + `as keyof`, και
 * το `"teal"` (ανύπαρκτο κλειδί) προσγειώθηκε σε ΔΥΟ οθόνες ιστορικού βάφοντας την κλάση
 * `undefined`. Με union ο μεταγλωττιστής το αρνείται.
 *
 * 🔑 `gray` = ΟΥΔΕΤΕΡΗ κάρτα (ετικέτα/εικονίδιο muted, αριθμός foreground). Είναι η
 * προεπιλογή των μεγάλων (GitHub · Linear · Stripe): το χρώμα σε στατιστικό ΣΗΜΑΙΝΕΙ
 * κατάσταση, ποτέ ποικιλία.
 */
export type StatsCardColor =
  | 'blue' | 'gray' | 'green' | 'purple' | 'red' | 'orange'
  | 'cyan' | 'pink' | 'yellow' | 'indigo';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: StatsCardColor;
    onClick?: () => void;
    loading?: boolean;
    description?: string;
    /**
     * Υποσύνολα τιμής ανά ρόλο (ADR-777 §8.60.14.13). Όταν έχει γραμμές, **αντικαθιστά** το
     * `value`: ποσά άλλης μονάδας δεν γίνονται ένας αριθμός. Το παράγει **μόνο** το `priceTotalsView`.
     */
    priceBreakdown?: readonly PriceTotalsRow[];
}

export function StatsCard({ title, value, icon: Icon, color, onClick, loading, description, priceBreakdown }: StatsCardProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
    // Enterprise semantic color mapping (ONLY text colors - NO borders, NO backgrounds).
    // ΕΝΑΣ χάρτης τόνου: ετικέτα + εικονίδιο τον παίρνουν αυτούσιο· ο αριθμός διαφέρει ΜΟΝΟ
    // στην ουδέτερη κάρτα (μελάνι κειμένου αντί muted) — τρεις δίδυμοι χάρτες έκρυβαν αυτή τη μία διαφορά.
    const toneClasses: Record<StatsCardColor, string> = {
        blue: colors.text.info,
        gray: colors.text.muted,
        green: colors.text.success,
        purple: colors.text.purple,
        red: colors.text.danger,
        orange: colors.text.warning,
        cyan: colors.text.info,
        pink: colors.text.purple,
        yellow: colors.text.warning,
        indigo: colors.text.info
    };

    const colorKey = color;
    const toneClass = toneClasses[colorKey];
    const valueToneClass = colorKey === 'gray' ? colors.text.primary : toneClass;

    return (
        <Card
            className={`${quick.card} ${colors.bg.card} ${toneClass} ${onClick ? `cursor-pointer ${INTERACTIVE_PATTERNS.CARD_ENHANCED}` : ''} min-w-0 max-w-full overflow-hidden`}
            onClick={onClick}
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
                                {priceBreakdown && priceBreakdown.length > 0 ? (
                                    <PriceTotalsBreakdown rows={priceBreakdown} valueClassName={valueToneClass} />
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