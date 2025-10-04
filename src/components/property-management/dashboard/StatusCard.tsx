'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface StatusCardProps {
    statsByStatus: Record<string, number>;
    getStatusLabel: (status: string) => string;
}

export function StatusCard({ statsByStatus, getStatusLabel }: StatusCardProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'sold': return 'bg-green-500';
            case 'available': return 'bg-gray-500';
            case 'reserved': return 'bg-yellow-500';
            case 'owner': return 'bg-blue-500';
            default: return 'bg-gray-400';
        }
    };
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Κατάσταση Μονάδων</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {Object.entries(statsByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
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
