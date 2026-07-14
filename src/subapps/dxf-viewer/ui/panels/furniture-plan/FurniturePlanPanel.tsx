'use client';

/**
 * @module ui/panels/furniture-plan/FurniturePlanPanel
 * @description ADR-654 — palette «Έπιπλα Κάτοψης» (raster entourage cut-outs, top view).
 *
 * Grid από κάρτες + faceted φίλτρα (κατηγορία & στυλ) — μικρότερο ζεύγος του `BlockLibraryPanel`
 * (ADR-652): σταθερός curated κατάλογος (`listFurniturePlanDefs`), χωρίς save/promote/delete. Το
 * εμφανιζόμενο όνομα ΣΥΝΤΙΘΕΤΑΙ από τα facets («Πολυθρόνα · Δέρμα · 03», ADR-654 M5) — μηδέν
 * per-item strings. Κλικ σε κάρτα → resolve FULL url, set στο `furniture-plan-selection-store`,
 * ενεργοποίηση του tool 'furniture-plan' στον καλούντα.
 *
 * Container only: ο κύκλος ζωής (thumbnails + select) ζει στο `useFurniturePlanPalette`, η κάρτα
 * στο `FurniturePlanCard`, η σύνθεση ονόματος στο `getFurniturePlanLabelParts` (catalog SSoT).
 *
 * @see ./hooks/useFurniturePlanPalette.ts — thumbnails + resolve-then-select
 * @see ../../../data/furniture-plan-catalog.ts — facets + getFurniturePlanLabelParts
 * @see ../shared/library-filter.ts — LIBRARY_FILTER_ALL (κοινό «όλα» sentinel)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Armchair } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { useTranslation } from '@/i18n';
import { useSelectedFurniturePlan } from '../../../bim/furniture-plan/furniture-plan-selection-store';
import {
  getFurniturePlanLabelParts,
  type FurniturePlanCategory,
  type FurniturePlanDef,
  type FurniturePlanStyle,
} from '../../../data/furniture-plan-catalog';
import { LIBRARY_FILTER_ALL } from '../shared/library-filter';
import { FurniturePlanCard } from './FurniturePlanCard';
import { useFurniturePlanPalette } from './hooks/useFurniturePlanPalette';

const PANEL_DIMENSIONS = { width: 300, height: 600 } as const;
const SSR_FALLBACK_POSITION = { x: 140, y: 140 };

type CategoryFilter = FurniturePlanCategory | typeof LIBRARY_FILTER_ALL;
type StyleFilter = FurniturePlanStyle | typeof LIBRARY_FILTER_ALL;

interface FurniturePlanPanelProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  /** Επιλογή έγινε (selection store ήδη ενημερωμένο) → ενεργοποίηση tool στον καλούντα. */
  readonly onSelect: () => void;
}

interface ChipOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

/** Ένα chip φίλτρου — ίδιο στυλ με τα scope chips του `LibraryFilterBar` (N.18: reuse). */
const FilterChip: React.FC<{
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

/** Μία σειρά chips («Όλα» + οι επιλογές) — κοινή για κατηγορία & στυλ ⇒ μηδέν διπλασιασμός. */
function ChipFilterRow<V extends string>({
  ariaLabel,
  allLabel,
  options,
  active,
  onSelect,
}: {
  readonly ariaLabel: string;
  readonly allLabel: string;
  readonly options: readonly ChipOption<V>[];
  readonly active: V | typeof LIBRARY_FILTER_ALL;
  readonly onSelect: (value: V | typeof LIBRARY_FILTER_ALL) => void;
}): React.ReactElement | null {
  if (options.length === 0) return null;
  return (
    <ul className="flex flex-shrink-0 flex-wrap gap-0.5 py-1" aria-label={ariaLabel}>
      <FilterChip
        label={allLabel}
        isActive={active === LIBRARY_FILTER_ALL}
        onClick={() => onSelect(LIBRARY_FILTER_ALL)}
      />
      {options.map((o) => (
        <FilterChip
          key={o.value}
          label={o.label}
          isActive={active === o.value}
          onClick={() => onSelect(o.value)}
        />
      ))}
    </ul>
  );
}

export const FurniturePlanPanel: React.FC<FurniturePlanPanelProps> = ({
  isVisible,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { defs, thumbnails, loading, locked, selectFurniture } = useFurniturePlanPalette();
  const selection = useSelectedFurniturePlan();
  const [category, setCategory] = useState<CategoryFilter>(LIBRARY_FILTER_ALL);
  const [style, setStyle] = useState<StyleFilter>(LIBRARY_FILTER_ALL);

  const displayNameOf = useCallback(
    (def: FurniturePlanDef): string => {
      const parts = getFurniturePlanLabelParts(def);
      return `${t(parts.categoryKey)} · ${t(parts.styleKey)} ${parts.series}`;
    },
    [t],
  );

  /** Chips ΜΟΝΟ για facets που πραγματικά υπάρχουν στον κατάλογο. */
  const categoryOptions = useMemo<ChipOption<FurniturePlanCategory>[]>(() => {
    const present = [...new Set(defs.map((d) => d.category))];
    return present.map((c) => ({ value: c, label: t(`furniturePlan.categories.${c}`) }));
  }, [defs, t]);

  const styleOptions = useMemo<ChipOption<FurniturePlanStyle>[]>(() => {
    const present = [...new Set(defs.map((d) => d.style))];
    return present.map((s) => ({ value: s, label: t(`furniturePlan.styles.${s}`) }));
  }, [defs, t]);

  const visibleDefs = useMemo(
    () =>
      defs.filter(
        (d) =>
          (category === LIBRARY_FILTER_ALL || d.category === category) &&
          (style === LIBRARY_FILTER_ALL || d.style === style),
      ),
    [defs, category, style],
  );

  const handleSelect = useCallback(
    (def: FurniturePlanDef) => {
      if (selectFurniture(def)) onSelect();
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
      className="flex w-[300px] max-h-[600px] flex-col"
    >
      <FloatingPanel.Header title={t('furniturePlan.title')} icon={<Armchair />} />
      <FloatingPanel.Content className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="flex-shrink-0 border-b border-border pb-2 text-xs text-muted-foreground">
          {t('furniturePlan.hint')}
        </p>

        <ChipFilterRow
          ariaLabel={t('furniturePlan.title')}
          allLabel={t('furniturePlan.allCategories')}
          options={categoryOptions}
          active={category}
          onSelect={setCategory}
        />
        <ChipFilterRow
          ariaLabel={t('furniturePlan.styleFilterLabel')}
          allLabel={t('furniturePlan.allStyles')}
          options={styleOptions}
          active={style}
          onSelect={setStyle}
        />

        {/* ADR-655 — «κλειδωμένο» ≠ «άδειο». Ο μη δικαιούχος πρέπει να καταλάβει ΓΙΑΤΙ δεν
            βλέπει τίποτα, αλλιώς μοιάζει με bug. */}
        {locked && (
          <p role="status" className="p-4 text-center text-sm text-muted-foreground">
            {t('furniturePlan.locked')}
          </p>
        )}

        {loading && (
          <p role="status" className="p-4 text-center text-sm text-muted-foreground">
            {t('furniturePlan.loading')}
          </p>
        )}

        {!loading && !locked && visibleDefs.length === 0 ? (
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
                  thumbnailUrl={thumbnails.get(def.id) ?? ''}
                  isActive={selection?.id === def.id}
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
