'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Building } from '../BuildingsPageContent';
import { getStatusColor, getStatusLabel } from '../BuildingCard/BuildingCardUtils';


interface BuildingDetailsHeaderProps {
    building: Building;
}

export function BuildingDetailsHeader({ building }: BuildingDetailsHeaderProps) {
    return (
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                    {building.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn("text-xs", getStatusColor(building.status).replace('bg-', 'bg-') + ' text-white')}>
                    {getStatusLabel(building.status)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                    {building.progress}% ολοκληρωμένο
                    </span>
                </div>
                </div>
            </div>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                <Eye className="w-4 h-4 mr-2" />
                Επίδειξη Κτιρίου
            </Button>
            </div>
      </div>
    );
}
