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
            badges={[
                {
                    type: 'status',
                    value: getStatusLabel(building.status),
                    size: 'sm'
                },
                {
                    type: 'progress',
                    value: `${building.progress}% ολοκληρωμένο`,
                    variant: 'secondary',
                    size: 'sm'
                }
            ]}
            actions={[
                {
                    label: 'Προβολή Κτιρίου',
                    onClick: () => console.log('Show building details'),
                    icon: Eye,
                    className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                }
            ]}
            variant="detailed"
        />
    );
}