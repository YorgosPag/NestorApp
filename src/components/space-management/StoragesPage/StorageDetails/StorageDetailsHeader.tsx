'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Warehouse, Eye, Edit, Archive, Share, FileText } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { UnitBadge, CommonBadge } from '@/core/badges/UnifiedBadgeSystem';
import { cn } from '@/lib/utils';
import type { Storage } from '@/types/storage/contracts';
import type { UnitStatus } from '@/core/types/BadgeTypes';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageDetailsHeaderProps {
  storage: Storage;
}

export function StorageDetailsHeader({ storage }: StorageDetailsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('storage');

  // Helper function for type labels using i18n
  const getTypeLabel = (type: Storage['type']) => {
    return t(`general.types.${type}`, t('general.unknown'));
  };

  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={Warehouse}
          title={storage.name}
          actions={[
            {
              label: t('header.viewStorage'),
              onClick: () => console.log('Show storage details'),
              icon: Eye,
              className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON
            },
            {
              label: t('header.edit'),
              onClick: () => console.log('Edit storage'),
              icon: Edit,
              variant: 'outline'
            },
            {
              label: t('header.print'),
              onClick: () => console.log('Print storage details'),
              icon: FileText,
              variant: 'outline'
            }
          ]}
          variant="detailed"
        >
          {/* Centralized Storage Badges */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {/* Status Badge using UnitBadge (similar statuses) */}
            <UnitBadge
              status={storage.status as UnitStatus}
              size="sm"
            />

            {/* Type Badge using CommonBadge */}
            <CommonBadge
              status={storage.type}
              size="sm"
              variant="secondary"
            >
              {getTypeLabel(storage.type)}
            </CommonBadge>

            {/* Area Badge using CommonBadge */}
            <CommonBadge
              status="area"
              size="sm"
              variant="outline"
            >
              {storage.area} m²
            </CommonBadge>

            {/* Price Badge using CommonBadge */}
            {storage.price && (
              <CommonBadge
                status="price"
                size="sm"
                variant="success"
              >
                €{storage.price.toLocaleString()}
              </CommonBadge>
            )}
          </div>

          {/* Additional Info */}
          <div className="mt-2 text-sm text-muted-foreground">
            <span>{storage.building} • {storage.floor}</span>
            {storage.owner && (
              <span> • {t('header.ownerLabel')} {storage.owner}</span>
            )}
          </div>
        </EntityDetailsHeader>
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}