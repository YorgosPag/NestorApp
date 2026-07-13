'use client';

/**
 * @module ui/panels/furniture-plan/FurniturePlanPanel
 * @description ADR-654 — palette «Έπιπλα Κάτοψης» (raster entourage cut-outs, top view).
 *
 * Grid από κάρτες + chips κατηγορίας — μικρότερο ζεύγος του `BlockLibraryPanel` (ADR-652):
 * εδώ δεν υπάρχει session/cloud merge ούτε save/promote/delete/edit, μόνο ένας σταθερός
 * curated κατάλογος (`listFurniturePlanDefs`). Κλικ σε κάρτα → resolve FULL url, set στο
 * `furniture-plan-selection-store`, ενεργοποίηση του tool 'furniture-plan' στον καλούντα.
 *
 * Container only: ο κύκλος ζωής (thumbnails + select) ζει στο `useFurniturePlanPalette`,
 * η κάρτα στο `FurniturePlanCard`.
 *
 * @see ./hooks/useFurniturePlanPalette.ts — thumbnails + resolve-then-select
 * @see ../shared/library-filter.ts — LIBRARY_FILTER_ALL (κοινό «όλα» sentinel)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Armchair } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { useTranslation } from '@/i18n';
import { useSelectedFurniturePlan } from '../../../bim/furniture-plan/furniture-plan-selection-store';
import type {
  FurniturePlanCategory,
  FurniturePlanDef,
} from '../../../data/furniture-plan-catalog';
import { LIBRARY_FILTER_ALL } from '../shared/library-filter';
import { FurniturePlanCard } from './FurniturePlanCard';
import { useFurniturePlanPalette } from './hooks/useFurniturePlanPalette';

const PANEL_DIMENSIONS = { width: 300, height: 560 } as const;
const SSR_FALLBACK_POSITION = { x: 140, y: 140 };

type CategoryFilter = FurniturePlanCategory | typeof LIBRARY_FILTER_ALL;

interface FurniturePlanPanelProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  /** Επιλογή έγινε (selection store ήδη ενημερωμένο) → ενεργοποίηση tool στον καλούντα. */
  readonly onSelect: () => void;
}

/** Ένα chip κατηγορίας — ίδιο στυλ με τα scope chips του `LibraryFilterBar` (N.18: reuse). */
const CategoryChip: React.FC<{
  readonly label: string;
  readonly isActive: boolean;
  readonly onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={[
        'rounded px-1.5 py-0.5 text-[10px] transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent',
      ].join(' ')}
    >
      {label}
    </button>
  </li>
);

export const FurniturePlanPanel: React.FC<FurniturePlanPanelProps> = ({
  isVisible,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { defs, thumbnails, busyId, error, selectFurniture } = useFurniturePlanPalette();
  const selection = useSelectedFurniturePlan();
  const [category, setCategory] = useState<CategoryFilter>(LIBRARY_FILTER_ALL);

  const displayNameOf = useCallback(
    (def: FurniturePlanDef): string => t(`furniturePlan.items.${def.labelKeySuffix}`),
    [t],
  );

  /** Chips ΜΟΝΟ για κατηγορίες που πραγματικά υπάρχουν στον κατάλογο. */
  const categoryOptions = useMemo(() => {
    const present = [...new Set(defs.map((d) => d.category))];
    return present.map((c) => ({ value: c, label: t(`furniturePlan.categories.${c}`) }));
  }, [defs, t]);

  const visibleDefs = useMemo(
    () => (category === LIBRARY_FILTER_ALL ? defs : defs.filter((d) => d.category === category)),
    [defs, category],
  );

  const handleSelect = useCallback(
    async (def: FurniturePlanDef) => {
      const ok = await selectFurniture(def);
      if (ok) onSelect();
    },
    [selectFurniture, onSelect],
  );

  if (!isVisible) return null;

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      isVisible={isVisible}
      className="flex w-[300px] max-h-[560px] flex-col"
    >
      <FloatingPanel.Header title={t('furniturePlan.title')} icon={<Armchair />} />
      <FloatingPanel.Content className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="flex-shrink-0 border-b border-border pb-2 text-xs text-muted-foreground">
          {t('furniturePlan.hint')}
        </p>

        {categoryOptions.length > 0 && (
          <ul
            className="flex flex-shrink-0 flex-wrap gap-0.5 py-2"
            aria-label={t('furniturePlan.title')}
          >
            <CategoryChip
              label={t('furniturePlan.allCategories')}
              isActive={category === LIBRARY_FILTER_ALL}
              onClick={() => setCategory(LIBRARY_FILTER_ALL)}
            />
            {categoryOptions.map((c) => (
              <CategoryChip
                key={c.value}
                label={c.label}
                isActive={category === c.value}
                onClick={() => setCategory(c.value)}
              />
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="pt-2 text-xs text-destructive">
            {t(`furniturePlan.errors.${error}`)}
          </p>
        )}

        {visibleDefs.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {defs.length === 0 ? t('furniturePlan.empty') : t('furniturePlan.noMatch')}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 overflow-auto py-2">
            {visibleDefs.map((def) => (
              <li key={def.id}>
                <FurniturePlanCard
                  def={def}
                  displayName={displayNameOf(def)}
                  thumbnailUrl={thumbnails.get(def.id)}
                  isActive={selection?.id === def.id}
                  isBusy={busyId === def.id}
                  onSelect={handleSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};
