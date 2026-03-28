'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { CommonBadge } from '@/core/badges';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

interface DetailsCardProps {
    title: string;
    icon: React.ElementType;
    data: Record<string, number>;
    labelFormatter?: (label: string) => string;
    isFloorData?: boolean;
    isThreeColumnGrid?: boolean;
}

export function DetailsCard({ title, icon: Icon, data, labelFormatter, isFloorData = false, isThreeColumnGrid = false }: DetailsCardProps) {
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const spacing = useSpacingTokens();
    
    if (isThreeColumnGrid) {
        return (
            <Card className="lg:col-span-2">
                <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${spacing.padding.sm} pb-2`}>
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <Icon className={`${iconSizes.sm} ${colors.text.muted}`} />
                </CardHeader>
                <CardContent className={`${spacing.padding.sm} pt-0`}>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        {Object.entries(data).map(([label, count]) => (
                            <div key={label}>
                                <p className="text-xl font-bold">{count}</p>
                                <p className={cn("text-xs", colors.text.muted)}>{label}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className={isFloorData ? "" : "lg:col-span-2"}>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${spacing.padding.sm} pb-2`}>
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`${iconSizes.sm} ${colors.text.muted}`} />
            </CardHeader>
            <CardContent className={`${spacing.padding.sm} pt-0`}>
                <div className={isFloorData ? "space-y-2" : "flex flex-wrap gap-2"}>
                    {Object.entries(data).slice(0, isFloorData ? 5 : undefined).map(([key, count]) => (
                        isFloorData ? (
                             <div key={key} className="flex items-center justify-between">
                                <span className="text-xs truncate flex-1">{key}</span>
                                <CommonBadge
                                  status="company"
                                  customLabel={count.toString()}
                                  variant="outline"
                                  size="sm"
                                  className="ml-2"
                                />
                            </div>
                        ) : (
                            <CommonBadge
                              key={key}
                              status="company"
                              customLabel={`${labelFormatter ? labelFormatter(key) : key} (${count})`}
                              variant="secondary"
                              size="sm"
                              className="flex items-center gap-1"
                            />
                        )
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
