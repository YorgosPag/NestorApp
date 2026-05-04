'use client';

import { ScrollText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FrameworkAgreementCard } from './FrameworkAgreementCard';
import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

interface FrameworkAgreementListProps {
  agreements: FrameworkAgreement[];
  vendorNamesById: Map<string, string>;
  loading: boolean;
  hasFilters: boolean;
  onEdit: (agreement: FrameworkAgreement) => void;
  onDelete: (agreement: FrameworkAgreement) => void;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-lg" />
      ))}
    </div>
  );
}

export function FrameworkAgreementList({
  agreements,
  vendorNamesById,
  loading,
  hasFilters,
  onEdit,
  onDelete,
}: FrameworkAgreementListProps) {
  const { t } = useTranslation('procurement');

  if (loading) {
    return <GridSkeleton />;
  }

  if (agreements.length === 0) {
    if (hasFilters) {
      return (
        <p className="py-10 text-center text-muted-foreground">
          {t('hub.frameworkAgreements.emptySearch')}
        </p>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ScrollText className="h-12 w-12 text-muted-foreground opacity-40" aria-hidden />
        <p className="text-muted-foreground">
          {t('hub.frameworkAgreements.noAgreementsYet')}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {t('hub.frameworkAgreements.addAgreementHint')}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label={t('hub.frameworkAgreements.title')}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {agreements.map((a) => (
        <FrameworkAgreementCard
          key={a.id}
          agreement={a}
          vendorName={vendorNamesById.get(a.vendorContactId) ?? null}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}
