'use client';

/**
 * 🅿️ ENTERPRISE PARKING DETAILS HEADER COMPONENT
 *
 * Header για τις λεπτομέρειες θέσης στάθμευσης
 * Ακολουθεί το exact pattern από StorageDetailsHeader.tsx
 */

import React from 'react';
import { Car, Eye, Edit, FileText } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { UnitBadge, CommonBadge } from '@/core/badges/UnifiedBadgeSystem';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { PARKING_TYPE_LABELS } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';

interface ParkingDetailsHeaderProps {
  parking: ParkingSpot;
}

function getTypeLabel(type: string): string {
  return PARKING_TYPE_LABELS[type as keyof typeof PARKING_TYPE_LABELS] || type || 'Άγνωστο';
}

export function ParkingDetailsHeader({ parking }: ParkingDetailsHeaderProps) {
  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={Car}
          title={parking.number || 'Θέση Στάθμευσης'}
          actions={[
            {
              label: 'Προβολή Θέσης',
              onClick: () => console.log('Show parking details'),
              icon: Eye,
              className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON
            },
            {
              label: 'Επεξεργασία',
              onClick: () => console.log('Edit parking'),
              icon: Edit,
              variant: 'outline'
            },
            {
              label: 'Εκτύπωση',
              onClick: () => console.log('Print parking details'),
              icon: FileText,
              variant: 'outline'
            }
          ]}
          variant="detailed"
        >
          {/* Centralized Parking Badges */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {/* Status Badge using UnitBadge (similar statuses) */}
            <UnitBadge
              status={parking.status as 'available' | 'occupied' | 'reserved' | 'sold' | 'maintenance'}
              size="sm"
            />

            {/* Type Badge using CommonBadge */}
            <CommonBadge
              status={parking.type || 'standard'}
              size="sm"
              variant="secondary"
            >
              {getTypeLabel(parking.type || 'standard')}
            </CommonBadge>

            {/* Area Badge using CommonBadge */}
            {parking.area && (
              <CommonBadge
                status="area"
                size="sm"
                variant="outline"
              >
                {parking.area} m²
              </CommonBadge>
            )}

            {/* Price Badge using CommonBadge */}
            {parking.price !== undefined && parking.price > 0 && (
              <CommonBadge
                status="price"
                size="sm"
                variant="success"
              >
                €{parking.price.toLocaleString('el-GR')}
              </CommonBadge>
            )}
          </div>

          {/* Additional Info */}
          <div className="mt-2 text-sm text-muted-foreground">
            <span>{parking.floor || 'N/A'}</span>
            {parking.location && (
              <span> • {parking.location}</span>
            )}
          </div>
        </EntityDetailsHeader>
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}
