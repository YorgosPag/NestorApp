'use client';

import { ScrollText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { EntityListColumn } from '@/core/containers';
import type {
  FrameworkAgreement,
  FrameworkAgreementStatus,
} from '@/subapps/procurement/types/framework-agreement';

interface AgreementSlimListProps {
  agreements: FrameworkAgreement[];
  vendorNamesById: Map<string, string>;
  loading: boolean;
  hasFilters: boolean;
  selectedAgreementId: string | undefined;
  onSelectAgreement: (agreement: FrameworkAgreement) => void;
}

const STATUS_VARIANT: Record<FrameworkAgreementStatus, string> = {
  draft:      'bg-gray-100 text-gray-700',
  active:     'bg-green-100 text-green-700',
  expired:    'bg-orange-100 text-orange-700',
  terminated: 'bg-red-100 text-red-700',
};

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-md" />
      ))}
    </div>
  );
}

export function AgreementSlimList({
  agreements,
  vendorNamesById,
  loading,
  hasFilters,
  selectedAgreementId,
  onSelectAgreement,
}: AgreementSlimListProps) {
  const { t } = useTranslation('procurement');

  return (
    <EntityListColumn aria-label={t('hub.frameworkAgreements.title')}>
      <ScrollArea className="flex-1">
        {loading ? (
          <ListSkeleton />
        ) : agreements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground opacity-40" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? t('hub.frameworkAgreements.emptySearch')
                : t('hub.frameworkAgreements.noAgreementsYet')}
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {agreements.map((a) => {
              const isSelected = a.id === selectedAgreementId;
              const vendorName = vendorNamesById.get(a.vendorContactId) ?? null;
              const statusClass = STATUS_VARIANT[a.status];

              return (
                <li key={a.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex flex-col gap-0.5 hover:bg-accent/60 transition-colors',
                      isSelected && 'bg-accent',
                    )}
                    onClick={() => onSelectAgreement(a)}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate flex-1">{a.title}</span>
                      <span className={cn('text-xs rounded px-1.5 py-0.5 font-medium shrink-0', statusClass)}>
                        {t(`hub.frameworkAgreements.status.${a.status}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs text-muted-foreground font-mono">
                        {a.agreementNumber}
                      </code>
                      {vendorName && (
                        <span className="text-xs text-muted-foreground truncate">· {vendorName}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </EntityListColumn>
  );
}
