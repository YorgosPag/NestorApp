'use client';

/**
 * 🅿️ ENTERPRISE PARKING GENERAL TAB COMPONENT
 *
 * Γενικές πληροφορίες θέσης στάθμευσης
 * Ακολουθεί το exact pattern από StorageGeneralTab.tsx
 */

import React from 'react';
import { formatDate, formatCurrency } from '@/lib/intl-utils';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { Car, MapPin, Calendar, Euro, Layers } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingGeneralTabProps {
  parking: ParkingSpot;
}

export function ParkingGeneralTab({ parking }: ParkingGeneralTabProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('parking');

  // Get type label using i18n
  const getTypeLabel = (type: string | undefined): string => {
    if (!type) return t('general.unknown');
    return t(`general.types.${type}`, type);
  };

  // Get status label using i18n
  const getStatusLabel = (status: string | undefined): string => {
    if (!status) return t('general.unknown');
    return t(`general.statuses.${status}`, status);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Basic Information */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Car className={iconSizes.md} />
          {t('general.basicInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.spotCode')}</label>
            <p className="mt-1 text-sm">{parking.number || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.type')}</label>
            <p className="mt-1 text-sm">{getTypeLabel(parking.type)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.status')}</label>
            <p className="mt-1 text-sm">{getStatusLabel(parking.status)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.area')}</label>
            <p className="mt-1 text-sm">{parking.area ? `${parking.area} m²` : 'N/A'}</p>
          </div>
        </div>
      </section>

      {/* Location */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <MapPin className={iconSizes.md} />
          {t('general.location')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.floor')}</label>
            <p className="mt-1 text-sm">{parking.floor || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.position')}</label>
            <p className="mt-1 text-sm">{parking.location || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.buildingId')}</label>
            <p className="mt-1 text-sm font-mono text-xs">{parking.buildingId || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.projectId')}</label>
            <p className="mt-1 text-sm font-mono text-xs">{parking.projectId || 'N/A'}</p>
          </div>
        </div>
      </section>

      {/* Financial Information */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Euro className={iconSizes.md} />
          {t('general.financial')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.price')}</label>
            <p className="mt-1 text-sm">
              {parking.price !== undefined && parking.price > 0
                ? formatCurrency(parking.price)
                : parking.price === 0
                  ? t('general.priceValues.shared')
                  : t('general.priceValues.notSet')}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.pricePerSqm')}</label>
            <p className="mt-1 text-sm">
              {parking.price && parking.area && parking.price > 0
                ? formatCurrency(parking.price / parking.area)
                : t('general.notCalculated')}
            </p>
          </div>
        </div>
      </section>

      {/* Notes */}
      {parking.notes && (
        <section>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Layers className={iconSizes.md} />
            {t('general.notes')}
          </h3>
          <div>
            <p className="text-sm bg-muted/50 p-4 rounded-lg">{parking.notes}</p>
          </div>
        </section>
      )}

      {/* Update Information */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar className={iconSizes.md} />
          {t('general.updateInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {parking.createdAt && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('general.fields.createdAt')}</label>
              <p className="mt-1 text-sm">{formatDate(
                parking.createdAt instanceof Date
                  ? parking.createdAt.toISOString()
                  : typeof parking.createdAt === 'object' && 'toDate' in parking.createdAt
                    ? (parking.createdAt as { toDate: () => Date }).toDate().toISOString()
                    : String(parking.createdAt)
              )}</p>
            </div>
          )}
          {parking.updatedAt && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('general.fields.lastUpdated')}</label>
              <p className="mt-1 text-sm">{formatDate(
                parking.updatedAt instanceof Date
                  ? parking.updatedAt.toISOString()
                  : typeof parking.updatedAt === 'object' && 'toDate' in parking.updatedAt
                    ? (parking.updatedAt as { toDate: () => Date }).toDate().toISOString()
                    : String(parking.updatedAt)
              )}</p>
            </div>
          )}
          {parking.createdBy && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('general.fields.createdBy')}</label>
              <p className="mt-1 text-sm">{parking.createdBy}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
