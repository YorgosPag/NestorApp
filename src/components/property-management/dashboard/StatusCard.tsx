'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface StatusCardProps {
    statsByStatus: Record<string, number>;
    getStatusLabel: (status: string) => string;
}

export function StatusCard({ statsByStatus, getStatusLabel }: StatusCardProps) {
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'sold': return colors.bg.success;
            case 'available': return colors.bg.muted;
            case 'reserved': return colors.bg.warning;
            case 'owner': return colors.bg.info;
            default: return colors.bg.muted;
        }
    };
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Κατάσταση Μονάδων</CardTitle>
                <Activity className={`${iconSizes.sm} text-muted-foreground`} />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {Object.entries(statsByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`${iconSizes.xs} ${iconSizes.xs} rounded-full ${getStatusColor(status)}`} />
                                <span className="text-xs">{getStatusLabel(status)}</span>
                            </div>
                            <span className="text-xs font-medium">{count}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
