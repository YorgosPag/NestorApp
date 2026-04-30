'use client';

// ADR-330: Quote History side drawer / bottom sheet
// Displays per-quote audit trail using the canonical useEntityAudit hook + AuditTimelineEntry renderer.

import { useMemo } from 'react';
import { ChevronDown, Clock, History, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useEntityAudit } from '@/hooks/useEntityAudit';
import { AuditTimelineEntry } from '@/components/shared/audit/audit-timeline-entry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useMobile';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { EntityAuditEntry } from '@/types/audit-trail';

// ============================================================================
// DATE GROUPING
// ============================================================================

type DayGroup = { dateKey: string; dateLabel: string; entries: EntityAuditEntry[] };

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function groupByDate(entries: EntityAuditEntry[]): DayGroup[] {
  if (entries.length === 0) return [];

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(yesterday);

  const map = new Map<string, EntityAuditEntry[]>();
  for (const entry of entries) {
    const key = entry.timestamp ? toDateKey(new Date(entry.timestamp)) : todayKey;
    const group = map.get(key);
    if (group) group.push(entry);
    else map.set(key, [entry]);
  }

  return Array.from(map.entries()).map(([dateKey, dayEntries]) => {
    let dateLabel: string;
    if (dateKey === todayKey) dateLabel = 'Σήμερα';
    else if (dateKey === yesterdayKey) dateLabel = 'Χθες';
    else {
      const [y, m, d] = dateKey.split('-');
      dateLabel = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('el-GR', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    }
    return { dateKey, dateLabel, entries: dayEntries };
  });
}

// ============================================================================
// PROPS
// ============================================================================

export interface QuoteHistoryDrawerProps {
  quoteId: string;
  open: boolean;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QuoteHistoryDrawer({ quoteId, open, onClose }: QuoteHistoryDrawerProps) {
  const { t } = useTranslation(['quotes', 'common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();
  const isMobile = useIsMobile();

  const { entries, isLoading, error, hasMore, loadMore } = useEntityAudit({
    entityType: ENTITY_TYPES.QUOTE,
    entityId: open ? quoteId : undefined,
  });

  const grouped = useMemo(() => groupByDate(entries), [entries]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 p-0',
          isMobile ? 'h-[80dvh]' : 'w-[420px] sm:w-[480px]',
        )}
      >
        <SheetHeader className="flex-none border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" />
              {t('rfqs.history.title')}
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('rfqs.history.closeAria')}>
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {isLoading && entries.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          {!isLoading && entries.length === 0 && !error && (
            <div className={cn('flex flex-col items-center justify-center py-12', colors.text.muted)}>
              <Clock className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">{t('rfqs.history.empty')}</p>
              <p className="text-xs opacity-60">{t('rfqs.history.emptyDesc')}</p>
            </div>
          )}

          {grouped.map(({ dateKey, dateLabel, entries: dayEntries }) => (
            <section key={dateKey}>
              <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 py-1 backdrop-blur-sm">
                <div className="h-px flex-1 bg-border" />
                <span className={cn('text-[11px] font-medium', colors.text.muted)}>{dateLabel}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <ol className="relative ml-3 space-y-0 border-l-2 border-muted">
                {dayEntries.map((entry) => (
                  <AuditTimelineEntry key={entry.id} entry={entry} showEntityLink={false} />
                ))}
              </ol>
            </section>
          ))}

          {hasMore && (
            <footer className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={isLoading}
                className={cn('inline-flex items-center gap-1.5 text-xs', colors.text.muted)}
              >
                {isLoading
                  ? <Spinner size="small" color="inherit" />
                  : <ChevronDown className="h-3 w-3" />
                }
                {t('audit.loadMore')}
              </Button>
            </footer>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
