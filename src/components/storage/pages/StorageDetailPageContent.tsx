'use client';

/**
 * Storage Unit Detail Page Content
 *
 * @module components/storage/pages/StorageDetailPageContent
 * @enterprise ADR-294 Batch 7 — extracted from app/storage/[id]/page.tsx
 */

import React, { useState, useEffect } from 'react';
import { Link } from '@/lib/workspace/navigation';
import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { resolveStorageById } from '@/hooks/entity-deep-link-sources';
import type { Storage } from '@/types/storage/contracts';
import {
  Package,
  Car,
  Euro,
  Ruler,
  Building,
  MapPin,
  ArrowLeft,
  User
} from 'lucide-react';
import { SpaceStatusBadges } from '@/components/shared/unit-status/SpaceStatusBadges';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import '@/lib/design-system';

const logger = createModuleLogger('StorageDetailPage');
const storageDetailCache = createStaleCache<Storage>('storage-detail');

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
  const [unit, setUnit] = useState<Storage | null>(
    params.id ? (storageDetailCache.get(params.id) ?? null) : null
  );
  const [loading, setLoading] = useState(
    params.id ? !storageDetailCache.hasLoaded(params.id) : true
  );

  useEffect(() => {
    if (params.id) {
      // 🔒 ADR-777 §8.60.20 — ΜΟΝΟ από τη διαδρομή με φύλακα εταιρείας (`requireStorageInTenant`).
      // Ως τις 2026-09-19 εδώ καλούνταν server action (`'use server'`) με Admin SDK και σκέτο
      // `doc(id).get()`: οποιοσδήποτε client διάβαζε αποθήκη ΞΕΝΗΣ εταιρείας με μια ταυτότητα.
      // Ξένη ή ανύπαρκτη ⇒ `null` ⇒ `notFound()` — ίδια απάντηση, ώστε να μην απαριθμούνται ταυτότητες.
      resolveStorageById(params.id)
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
             {/* ADR-777 §8.60.20 — διάθεση + λειτουργική εξαίρεση από το ΕΝΑ SSoT. Ως τις 2026-09-18
                 εδώ ένα `sold` γινόταν ρητά «available» και ένα `maintenance` «reserved». */}
             <SpaceStatusBadges space={unit} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-3">
                     <InfoRow icon={Ruler} label={t('card.sections.area')} value={`${unit.area} m²`} />
                     <InfoRow icon={Euro} label={t('general.fields.price')} value={unit.price != null ? `${unit.price.toLocaleString('el-GR')} €` : null} />
                     <InfoRow icon={MapPin} label={t('general.fields.floor')} value={unit.floor} />
                     <InfoRow icon={Building} label={t('general.fields.project')} value={unit.projectId} />
                 </div>
                 <div className="space-y-3">
                     <InfoRow icon={User} label={t('general.fields.owner')} value={unit.owner || t('general.status.available')} />
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
