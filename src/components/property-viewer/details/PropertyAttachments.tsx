'use client';

import React from 'react';
import Link from 'next/link';
import { Package, Car } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { StorageUnitStub, ParkingSpotStub } from '@/types/property-viewer';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

interface PropertyAttachmentsProps {
  storage: StorageUnitStub[];
  parking: ParkingSpotStub[];
}

export function PropertyAttachments({ storage, parking }: PropertyAttachmentsProps) {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <div className={spacing.spaceBetween.sm}>
      {storage.length > 0 && (
        <div className={spacing.spaceBetween.sm}>
          <h4 className={`text-xs font-medium flex items-center ${spacing.gap.sm}`}>
            <Package className={iconSizes.xs} />
            {t('attachments.linkedStorages')}
          </h4>
          <div className={spacing.padding.left.sm}>
            {storage.map(item => (
              <Link key={item.id} href={`/storage/${item.id}`} className="block">
                <p className={`text-xs text-muted-foreground cursor-pointer ${HOVER_TEXT_EFFECTS.PRIMARY_WITH_UNDERLINE}`}>
                  {item.code} - {item.floor} ({item.area} {t('attachments.sqm')})
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
      {parking.length > 0 && (
        <div className={spacing.spaceBetween.sm}>
          <h4 className={`text-xs font-medium flex items-center ${spacing.gap.sm}`}>
            <Car className={iconSizes.xs} />
            {t('attachments.linkedParking')}
          </h4>
          <div className={spacing.padding.left.sm}>
            {parking.map(item => (
              <Link key={item.id} href={`/storage/${item.id}`} className="block">
                <p className={`text-xs text-muted-foreground cursor-pointer ${HOVER_TEXT_EFFECTS.PRIMARY_WITH_UNDERLINE}`}>
                  {item.code} - {item.level} ({item.type})
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
