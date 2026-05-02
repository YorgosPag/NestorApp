'use client';

/**
 * BOQCoverageIndicator — non-blocking banner for missing floor-level BOQ entries.
 *
 * Shows only when: (a) floor documents exist, (b) at least one floor-scoped item
 * is already in use (signals intentional floor-level work), and (c) some floors
 * still have zero floor-scoped entries — a likely oversight, not a design choice.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQCoverageIndicator
 * @see ADR-175 §4.4.3, ADR-329 §3.1
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import type { BOQItem } from '@/types/boq';

// ============================================================================
// TYPES
// ============================================================================

interface BOQCoverageIndicatorProps {
  items: BOQItem[];
  buildingId: string;
}

interface CoverageGap {
  uncoveredFloors: Array<{ id: string; name: string }>;
  total: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BOQCoverageIndicator({ items, buildingId }: BOQCoverageIndicatorProps) {
  const { t } = useTranslation(['building-tabs']);
  const { floors, loading } = useFloorsByBuilding(buildingId);
  const [dismissed, setDismissed] = useState(false);

  const gap = useMemo<CoverageGap | null>(() => {
    if (loading || floors.length === 0) return null;

    const floorScopedItems = items.filter((i) => i.scope === 'floor');
    // No floor-scoped items at all → user works at building level intentionally → no warning
    if (floorScopedItems.length === 0) return null;

    const coveredIds = new Set(
      floorScopedItems.map((i) => i.linkedFloorId).filter((id): id is string => id !== null),
    );
    const uncoveredFloors = floors.filter((f) => !coveredIds.has(f.id));
    if (uncoveredFloors.length === 0) return null;

    return { uncoveredFloors, total: floors.length };
  }, [items, floors, loading]);

  if (!gap || dismissed) return null;

  const floorNames = gap.uncoveredFloors.map((f) => f.name).join(', ');

  return (
    <aside
      role="note"
      aria-label={t('tabs.measurements.coverage.floorGapTitle')}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        'border-amber-300 bg-amber-50 text-amber-900',
        'dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200',
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{t('tabs.measurements.coverage.floorGapTitle')}</p>
        <p className="mt-0.5 text-xs opacity-80">
          {t('tabs.measurements.coverage.floorGapDescription', {
            count: gap.uncoveredFloors.length,
            total: gap.total,
            floorNames,
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t('tabs.measurements.coverage.dismiss')}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </aside>
  );
}
