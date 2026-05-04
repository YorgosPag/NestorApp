'use client';

import { useMemo } from 'react';
import { Users2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getContactDisplayName } from '@/types/contacts';
import { cn } from '@/lib/utils';
import { EntityListColumn } from '@/core/containers';
import type { VendorCardData } from './VendorCard';

interface VendorListProps {
  vendors: VendorCardData[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  selectedVendorId: string | undefined;
  onSelectVendor: (data: VendorCardData) => void;
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-md" />
      ))}
    </div>
  );
}

export function VendorList({
  vendors,
  loading,
  search,
  onSearchChange,
  selectedVendorId,
  onSelectVendor,
}: VendorListProps) {
  const { t } = useTranslation('procurement');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => {
      const name = getContactDisplayName(v.contact).toLowerCase();
      return name.includes(q);
    });
  }, [vendors, search]);

  return (
    <EntityListColumn aria-label={t('hub.vendorMaster.title')}>
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder={t('hub.vendorMaster.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={t('hub.vendorMaster.searchPlaceholder')}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
            <Users2 className="h-8 w-8 text-muted-foreground opacity-40" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {search.trim() ? t('hub.vendorMaster.emptySearch') : t('hub.vendorMaster.noVendorsYet')}
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {filtered.map((v) => {
              const id = v.contact.id ?? '';
              const name = getContactDisplayName(v.contact);
              const isSelected = id === selectedVendorId;
              const specialties = v.metrics?.tradeSpecialties ?? [];

              return (
                <li key={id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex flex-col gap-0.5 hover:bg-accent/60 transition-colors',
                      isSelected && 'bg-accent',
                    )}
                    onClick={() => onSelectVendor(v)}
                    aria-pressed={isSelected}
                  >
                    <span className="text-sm font-medium truncate">{name}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {specialties.slice(0, 2).map((code) => (
                        <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 h-4">
                          {t(`trades.${code}`, { defaultValue: '' }) || code}
                        </Badge>
                      ))}
                      {v.metrics && v.metrics.totalOrders > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {v.metrics.totalOrders} {t('hub.vendorMaster.detail.kpis.totalOrders')}
                        </span>
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
