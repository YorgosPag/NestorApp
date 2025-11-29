'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { BuildingBadge } from '@/core/badges';
import { Building2, Eye } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { cn } from '@/lib/utils';
import type { Building } from '../BuildingsPageContent';
import { getStatusColor, getStatusLabel } from '../BuildingCard/BuildingCardUtils';


interface BuildingDetailsHeaderProps {
    building: Building;
}

export function BuildingDetailsHeader({ building }: BuildingDetailsHeaderProps) {
    return (
        <EntityDetailsHeader
            icon={Building2}
            title={building.name}
            actions={[
                {
                    label: 'Προβολή Κτιρίου',
                    onClick: () => console.log('Show building details'),
                    icon: Eye,
                    className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                }
            ]}
            variant="detailed"
        >
            {/* Centralized BuildingBadge Components */}
            <div className="flex gap-2 mt-2">
                <BuildingBadge status={building.status} size="sm" />
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                    {building.progress}% ολοκληρωμένο
                </span>
            </div>
        </EntityDetailsHeader>
    );
}