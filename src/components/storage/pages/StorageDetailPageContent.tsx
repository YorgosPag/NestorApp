'use client';

/**
 * Storage Unit Detail Page Content
 *
 * @module components/storage/pages/StorageDetailPageContent
 * @enterprise ADR-294 Batch 7 — extracted from app/storage/[id]/page.tsx
 */

import React, { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UnitBadge } from '@/core/badges';
import type { UnitStatus } from '@/core/types/BadgeTypes';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getStorageUnitById } from '@/services/storage.service';
import type { StorageUnit } from '@/types/storage';
import {
  Package,
  Car,
  Euro,
  Ruler,
  Building,
  MapPin,
  CheckCircle,
  Link as LinkIcon,
  ArrowLeft,
  User
} from 'lucide-react';
import { getParkingStatusLabel, getParkingStatusColor } from '@/components/projects/utils/parking-utils';
import type { ParkingSpotStatus } from '@/types/parking';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import '@/lib/design-system';

const logger = createModuleLogger('StorageDetailPage');
const storageDetailCache = createStaleCache<StorageUnit>('storage-detail');

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) {
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    if (!value) return null;
    return (
        <div className="flex items-center gap-3">
            <Icon className={cn(iconSizes.sm, colors.text.muted)} />
            <span className="text-sm font-medium w-32">{label}:</span>
            <span className="text-sm text-foreground">{value}</span>
        </div>
    );
}


export function StorageDetailPageContent() {
  const params = useParams<{ id: string }>();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('storage');
  const [unit, setUnit] = useState<StorageUnit | null>(
    params.id ? (storageDetailCache.get(params.id) ?? null) : null
  );
  const [loading, setLoading] = useState(
    params.id ? !storageDetailCache.hasLoaded(params.id) : true
  );

  useEffect(() => {
    if (params.id) {
      getStorageUnitById(params.id)
        .then(data => {
          if (data) {
            storageDetailCache.set(data, params.id);
            setUnit(data);
          }
        })
        .catch((error: unknown) => logger.error('Failed to fetch storage unit', { error }))
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return (
        <div className="p-8">
            <Card>
                <CardHeader><Skeleton className={`${iconSizes.xl} w-1/2`} /></CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className={`${iconSizes.lg} w-full`} />
                    <Skeleton className={`${iconSizes.lg} w-2/3`} />
                    <Skeleton className={`${iconSizes.lg} w-3/4`} />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!unit) {
    notFound();
  }

  const isStorage = unit.type === 'storage';
  const MainIcon = isStorage ? Package : Car;
  const mappedStatus = (unit.status === 'maintenance' ? 'reserved' : unit.status) as ParkingSpotStatus;
  const statusColor = getParkingStatusColor(mappedStatus);
  const _statusLabel = getParkingStatusLabel(mappedStatus);

  return (
    <div className="p-4 md:p-8">
       <div className="mb-4">
            <Button asChild variant="outline" size="sm">
                <Link href="/projects">
                    <ArrowLeft className={`${iconSizes.sm} mr-2`} />
                    {t('page.backToProjects')}
                </Link>
            </Button>
       </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-muted">
                    <MainIcon className={`${iconSizes.lg} text-primary`} />
                </div>
                <div>
                    <CardTitle className="text-2xl">{unit.code}</CardTitle>
                    <CardDescription>{unit.type === 'storage' ? t('common.storage') : t('common.parking')}</CardDescription>
                </div>
            </div>
             <UnitBadge
               status={(unit.status === 'sold' ? 'available' : unit.status) as UnitStatus}
               size="sm"
               className={cn("text-base", statusColor)}
             />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-3">
                     <InfoRow icon={Ruler} label={t('card.sections.area')} value={`${unit.area} m²`} />
                     <InfoRow icon={Euro} label={t('general.fields.price')} value={`${unit.price.toLocaleString('el-GR')} €`} />
                     <InfoRow icon={MapPin} label={t('general.fields.floor')} value={unit.level} />
                     <InfoRow icon={Building} label={t('general.fields.project')} value={unit.projectId} />
                 </div>
                 <div className="space-y-3">
                     <InfoRow icon={User} label={t('general.fields.owner')} value={unit.owner || t('general.status.available')} />
                     {unit.propertyCode && <InfoRow icon={LinkIcon} label={t('page.linkedTo')} value={unit.propertyCode} />}
                     <InfoRow icon={CheckCircle} label={t('page.registeredBy')} value={unit.constructedBy} />
                 </div>
            </div>
            {unit.notes && (
                <div>
                    <h4 className="font-semibold text-sm mb-2">{t('general.fields.notes')}</h4>
                    <p className={cn("text-sm p-3 bg-muted/50 rounded-md border", colors.text.muted)}>{unit.notes}</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
