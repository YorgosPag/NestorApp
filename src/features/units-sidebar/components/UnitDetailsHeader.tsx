// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PropertyBadge } from '@/core/badges';
import type { PropertyStatus } from '@/core/types/BadgeTypes';
import { Eye } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { cn } from '@/lib/utils';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { Property } from '@/types/property-viewer';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

// Removed hardcoded getStatusColor and getStatusLabel functions - using centralized UnitBadge instead

export function UnitDetailsHeader({ unit }: { unit: Property | null }) {
  const { t } = useTranslation('units');

  // Empty State - No unit selected
  if (!unit) {
    return (
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={UnitIcon}
          title={t('details.selectUnit')}
          subtitle={t('details.noUnitSelected')}
          variant="detailed"
          className="h-[81px] flex items-center"
        />
      </div>
    );
  }

  // Selected State - Unit is selected
  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={UnitIcon}
          title={unit.name}
          actions={[
            {
              label: t('details.showUnit'),
              onClick: () => console.log('Show unit details'),
              icon: Eye,
              className: `bg-gradient-to-r from-blue-500 to-purple-600 ${GRADIENT_HOVER_EFFECTS.BLUE_PURPLE_DEEPER}`
            }
          ]}
          variant="detailed"
        >
          {/* Centralized PropertyBadge Component - Property.status uses PropertyStatus */}
          <div className="flex gap-2 mt-2">
            <PropertyBadge status={unit.status as PropertyStatus} size="sm" />
          </div>
        </EntityDetailsHeader>
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}