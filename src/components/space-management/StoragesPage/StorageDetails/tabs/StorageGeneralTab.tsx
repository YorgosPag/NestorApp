'use client';

import React from 'react';
import { formatDate, formatCurrency, formatFloorString } from '@/lib/intl-utils';
import type { Storage } from '@/types/storage/contracts';
import { Warehouse, MapPin, Calendar, User, Euro, Layers } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageGeneralTabProps {
  storage: Storage;
}

export function StorageGeneralTab({ storage }: StorageGeneralTabProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('storage');
  return (
    <div className="p-6 space-y-6">
      {/* Basic Information */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Warehouse className={iconSizes.md} />
          {t('general.basicInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.name')}</label>
            <p className="mt-1 text-sm">{storage.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.type')}</label>
            <p className="mt-1 text-sm">
              {t(`general.types.${storage.type}`, { defaultValue: t('general.unknown') })}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.status')}</label>
            <p className="mt-1 text-sm">
              {t(`general.statuses.${storage.status}`, { defaultValue: t('general.unknown') })}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.area')}</label>
            <p className="mt-1 text-sm">{storage.area} m²</p>
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
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.building')}</label>
            <p className="mt-1 text-sm">{storage.building}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.floor')}</label>
            <p className="mt-1 text-sm">{storage.floor ? formatFloorString(storage.floor) : 'N/A'}</p>
          </div>
        </div>
      </section>

      {/* Financial Information */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          {/* 🏢 ENTERPRISE: Using Euro icon for financial section */}
          <Euro className={iconSizes.md} />
          {t('general.financial')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.price')}</label>
            <p className="mt-1 text-sm">
              {storage.price ? formatCurrency(storage.price) : t('general.notSet')}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.pricePerSqm')}</label>
            <p className="mt-1 text-sm">
              {storage.price && storage.area
                ? formatCurrency(storage.price / storage.area)
                : t('general.notCalculated')
              }
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('general.fields.project')}</label>
            <p className="mt-1 text-sm">
              {storage.projectId || t('general.notAssigned')}
            </p>
          </div>
        </div>
      </section>

      {/* Description & Notes */}
      {(storage.description || storage.notes) && (
        <section>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Layers className={iconSizes.md} />
            {t('general.descriptionNotes')}
          </h3>
          <div className="space-y-4">
            {storage.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('general.fields.description')}</label>
                <p className="mt-1 text-sm">{storage.description}</p>
              </div>
            )}
            {storage.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('general.fields.notes')}</label>
                <p className="mt-1 text-sm">{storage.notes}</p>
              </div>
            )}
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
          {storage.lastUpdated && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('general.fields.lastUpdated')}</label>
              <p className="mt-1 text-sm">{formatDate(
                storage.lastUpdated instanceof Date
                  ? storage.lastUpdated.toISOString()
                  : storage.lastUpdated
              )}</p>
            </div>
          )}
          {storage.owner && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('general.fields.owner')}</label>
              <p className="mt-1 text-sm">{storage.owner}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}