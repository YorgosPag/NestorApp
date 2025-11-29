'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';

interface DetailsCardProps {
    title: string;
    icon: React.ElementType;
    data: Record<string, number>;
    labelFormatter?: (label: string) => string;
    isFloorData?: boolean;
    isThreeColumnGrid?: boolean;
}

export function DetailsCard({ title, icon: Icon, data, labelFormatter, isFloorData = false, isThreeColumnGrid = false }: DetailsCardProps) {
    
    if (isThreeColumnGrid) {
        return (
            <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        {Object.entries(data).map(([label, count]) => (
                            <div key={label}>
                                <p className="text-xl font-bold">{count}</p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className={isFloorData ? "" : "lg:col-span-2"}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
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
