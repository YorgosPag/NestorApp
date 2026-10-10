'use client';

/**
 * FloorStairsList — οι σκάλες του ανοιχτού ορόφου (ADR-358 Phase 9C-3).
 * Εξήχθη από το `FloorsTabContent.tsx` (ADR-912 §5 — μέγεθος αρχείου, N.7.1). Μία διαφορά: έφυγε το
 * κλαδί «κενή λίστα» (`stairsEmpty`), που ήταν απρόσιτο — η κενή λίστα επιστρέφει `null` δύο γραμμές πιο πάνω.
 *
 * @module components/building-management/tabs/floors/FloorStairsList
 */

import { Footprints } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairDoc } from '@/subapps/dxf-viewer/bim/types/stair-types';

interface FloorStairsListProps {
  stairs: StairDoc[];
  loading: boolean;
}

export function FloorStairsList({ stairs, loading }: FloorStairsListProps) {
  const { t } = useTranslation(['building-tabs']);

  // Hide entirely when no data to show
  if (!loading && stairs.length === 0) return null;

  if (loading) {
    return (
      <section className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner size="small" />
      </section>
    );
  }

  return (
    <section className="mt-2 pt-2 border-t border-border/30">
      <header className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
        <Footprints className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('tabs.floors.stairs')}
      </header>
      <ul className="flex flex-col gap-0.5 pl-1">
        {stairs.map((stair) => {
          const isLinked = stair.params.multiStoryConfig?.linkedToFloor === true;
          const isCustom = stair.params.multiStoryConfig !== undefined && !isLinked;
          return (
            <li key={stair.id} className="flex items-center gap-2 text-xs py-0.5 px-1 rounded hover:bg-muted/20">
              <Footprints className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{t(`tabs.floors.stairKind.${stair.kind}`)}</span>
              {isLinked && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--bg-info)/0.15)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--text-info))]">
                  🔗 {t('tabs.floors.stairLinked')}
                </span>
              )}
              {isCustom && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--bg-warning)/0.15)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--text-warning))]">
                  ⚠️ {t('tabs.floors.stairCustom')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
