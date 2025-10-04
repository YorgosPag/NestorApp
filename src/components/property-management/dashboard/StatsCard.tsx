'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
}

export function StatsCard({ title, value, icon: Icon, color }: StatsCardProps) {
    const colorClasses = {
        blue: 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400',
        gray: 'border-gray-200 bg-gray-50/50 dark:bg-gray-950/20 text-gray-600 dark:text-gray-400',
        green: 'border-green-200 bg-green-50/50 dark:bg-green-950/20 text-green-600 dark:text-green-400',
        purple: 'border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400',
        red: 'border-red-200 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400',
        orange: 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400'
    };

    const valueColorClasses = {
        blue: 'text-blue-700 dark:text-blue-300',
        gray: 'text-gray-700 dark:text-gray-300',
        green: 'text-green-700 dark:text-green-300',
        purple: 'text-purple-700 dark:text-purple-300',
        red: 'text-red-700 dark:text-red-300',
        orange: 'text-orange-700 dark:text-orange-300'
    };

    const iconColorClasses = {
        blue: 'text-blue-500',
        gray: 'text-gray-500',
        green: 'text-green-500',
        purple: 'text-purple-500',
        red: 'text-red-500',
        orange: 'text-orange-500'
    };
    
    const colorKey = color as keyof typeof colorClasses;
    
    return (
        <Card className={colorClasses[colorKey]}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className={`text-xs font-medium ${colorClasses[colorKey]}`}>{title}</p>
                        <p className={`text-2xl font-bold ${valueColorClasses[colorKey]}`}>{value}</p>
                    </div>
                    <Icon className={`h-8 w-8 ${iconColorClasses[colorKey]}`} />
                </div>
            </CardContent>
        </Card>
    );
}
