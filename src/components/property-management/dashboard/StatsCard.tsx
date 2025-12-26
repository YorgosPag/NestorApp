'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

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
    const colorClasses = {
        blue: `${getStatusBorder('info')} bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400`,
        gray: `${getStatusBorder('muted')} bg-gray-50/50 dark:bg-gray-950/20 text-gray-600 dark:text-gray-400`,
        green: `${getStatusBorder('success')} bg-green-50/50 dark:bg-green-950/20 text-green-600 dark:text-green-400`,
        purple: `${getStatusBorder('subtle')} bg-purple-50/50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400`,
        red: `${getStatusBorder('error')} bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400`,
        orange: `${getStatusBorder('warning')} bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400`,
        cyan: `${getStatusBorder('info')} bg-cyan-50/50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400`,
        pink: `${getStatusBorder('subtle')} bg-pink-50/50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400`,
        yellow: `${getStatusBorder('warning')} bg-yellow-50/50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400`,
        indigo: `${getStatusBorder('info')} bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400`
    };

    const valueColorClasses = {
        blue: 'text-blue-700 dark:text-blue-300',
        gray: 'text-gray-700 dark:text-gray-300',
        green: 'text-green-700 dark:text-green-300',
        purple: 'text-purple-700 dark:text-purple-300',
        red: 'text-red-700 dark:text-red-300',
        orange: 'text-orange-700 dark:text-orange-300',
        cyan: 'text-cyan-700 dark:text-cyan-300',
        pink: 'text-pink-700 dark:text-pink-300',
        yellow: 'text-yellow-700 dark:text-yellow-300',
        indigo: 'text-indigo-700 dark:text-indigo-300'
    };

    const iconColorClasses = {
        blue: 'text-blue-500',
        gray: 'text-gray-500',
        green: 'text-green-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
        orange: 'text-orange-500',
        cyan: 'text-cyan-500',
        pink: 'text-pink-500',
        yellow: 'text-yellow-500',
        indigo: 'text-indigo-500'
    };

    const colorKey = color as keyof typeof colorClasses;

    return (
        <Card
            className={`${colorClasses[colorKey]} ${onClick ? `cursor-pointer ${INTERACTIVE_PATTERNS.CARD_ENHANCED}` : ''} min-w-0 max-w-full overflow-hidden`}
            onClick={onClick}
        >
            <CardContent className="p-2 sm:p-4 min-w-0">
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