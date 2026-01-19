'use client';

import React from 'react';
import Link from 'next/link';
import { Package, Car } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { StorageUnitStub, ParkingSpotStub } from '@/types/property-viewer';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PropertyAttachmentsProps {
  storage: StorageUnitStub[];
  parking: ParkingSpotStub[];
}

export function PropertyAttachments({ storage, parking }: PropertyAttachmentsProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <div className="space-y-3">
      {storage.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <Package className={iconSizes.xs} />
            {t('attachments.linkedStorages')}
          </h4>
          <div className="pl-4">
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
        <div className="space-y-1">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <Car className={iconSizes.xs} />
            {t('attachments.linkedParking')}
          </h4>
          <div className="pl-4">
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
