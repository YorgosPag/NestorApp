'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    onClick?: () => void;
}

export function StatsCard({ title, value, icon: Icon, color, onClick }: StatsCardProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
    // Enterprise semantic color mapping
    const colorClasses = {
        blue: `${getStatusBorder('info')} ${colors.bg.infoSubtle} ${colors.text.info}`,
        gray: `${getStatusBorder('muted')} ${colors.bg.muted} ${colors.text.muted}`,
        green: `${getStatusBorder('success')} ${colors.bg.successSubtle} ${colors.text.success}`,
        purple: `${getStatusBorder('subtle')} ${colors.bg.purple} ${colors.text.purple}`,
        red: `${getStatusBorder('error')} ${colors.bg.errorSubtle} ${colors.text.danger}`,
        orange: `${getStatusBorder('warning')} ${colors.bg.warningSubtle} ${colors.text.warning}`,
        cyan: `${getStatusBorder('info')} ${colors.bg.infoSubtle} ${colors.text.info}`,
        pink: `${getStatusBorder('subtle')} ${colors.bg.purple} ${colors.text.purple}`,
        yellow: `${getStatusBorder('warning')} ${colors.bg.warningSubtle} ${colors.text.warning}`,
        indigo: `${getStatusBorder('info')} ${colors.bg.infoSubtle} ${colors.text.info}`
    };

    // Enterprise semantic value color mapping
    const valueColorClasses = {
        blue: colors.text.info,
        gray: colors.text.primary,
        green: colors.text.success,
        purple: colors.text.purple,
        red: colors.text.danger,
        orange: colors.text.warning,
        cyan: colors.text.info,
        pink: colors.text.purple,
        yellow: colors.text.warning,
        indigo: colors.text.info
    };

    // Enterprise semantic icon color mapping
    const iconColorClasses = {
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

    const colorKey = color as keyof typeof colorClasses;

    return (
        <Card
            className={`${colorClasses[colorKey]} ${onClick ? `cursor-pointer ${INTERACTIVE_PATTERNS.CARD_ENHANCED}` : ''} min-w-0 max-w-full overflow-hidden`}
            onClick={onClick}
        >
            <CardContent className={`${spacing.padding.sm} min-w-0`}>
                <div className="flex items-center justify-between min-w-0 max-w-full">
                    <div className="min-w-0 flex-1 mr-1 sm:mr-2 overflow-hidden">
                        <p className={`text-xs font-medium ${colorClasses[colorKey]} truncate leading-tight`}>{title}</p>
                        <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${valueColorClasses[colorKey]} truncate leading-tight`}>{value}</p>
                    </div>
                    <Icon className={`${iconSizes.lg} ${iconColorClasses[colorKey]} flex-shrink-0`} />
                </div>
            </CardContent>
        </Card>
    );
}

export default StatsCard;