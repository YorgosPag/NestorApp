'use client';

/**
 * @module ui/panels/entourage/EntouragePalette
 * @description ADR-654 M6 — generic palette για κάθε οικογένεια entourage (top-view raster cut-outs).
 *
 * Γενίκευση του `FurniturePlanPanel`: grid από κάρτες + faceted φίλτρα, οδηγούμενο 100% από τον
 * {@link EntouragePackDescriptor}. Δύο facet rows: **category** (πάντα) + **secondary** (ΜΟΝΟ όταν
 * η οικογένεια έχει secondary — τα οχήματα έχουν χρώμα, οι άνθρωποι όχι). Το εμφανιζόμενο όνομα
 * ΣΥΝΤΙΘΕΤΑΙ από τα facets (`descriptor.getLabelParts` → i18n) — μηδέν per-item strings.
 *
 * Container only: ο κύκλος ζωής (thumbnails + select) ζει στο `useEntouragePalette`, η κάρτα στο
 * `EntourageCard`. Μία μηχανή ⇒ People + Vehicles (N.18: μηδέν sibling clone).
 *
 * @see ./use-entourage-palette.ts — thumbnails + resolve-then-select
 * @see ./entourage-pack-descriptor.ts — τι δίνει η κάθε οικογένεια
 * @see ../shared/library-filter.ts — LIBRARY_FILTER_ALL (κοινό «όλα» sentinel)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FloatingPanel } from '@/components/ui/floating';
import { useTranslation } from '@/i18n';
import type { EntourageDef } from '../../../data/entourage-catalog-core';
import { LIBRARY_FILTER_ALL } from '../shared/library-filter';
import { EntourageCard } from './EntourageCard';
import { useEntouragePalette } from './use-entourage-palette';
import type { EntouragePackDescriptor } from './entourage-pack-descriptor';

const PANEL_DIMENSIONS = { width: 300, height: 600 } as const;
const SSR_FALLBACK_POSITION = { x: 160, y: 160 };

type FacetFilter = string | typeof LIBRARY_FILTER_ALL;

interface EntouragePaletteProps {
  readonly descriptor: EntouragePackDescriptor;
  readonly isVisible: boolean;
  readonly onClose: () => void;
  /** Επιλογή έγινε (selection store ήδη ενημερωμένο) → ενεργοποίηση tool στον καλούντα. */
  readonly onSelect: () => void;
}

interface ChipOption {
  readonly value: string;
  readonly label: string;
}

/** Ένα chip φίλτρου — ίδιο στυλ με τα scope chips του `LibraryFilterBar`. */
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

/** Μία σειρά chips («Όλα» + οι επιλογές) — κοινή για category & secondary ⇒ μηδέν διπλασιασμός. */
function ChipFilterRow({
  ariaLabel,
  allLabel,
  options,
  active,
  onSelect,
}: {
  readonly ariaLabel: string;
  readonly allLabel: string;
  readonly options: readonly ChipOption[];
  readonly active: FacetFilter;
  readonly onSelect: (value: FacetFilter) => void;
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

export const EntouragePalette: React.FC<EntouragePaletteProps> = ({
  descriptor,
  isVisible,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { i18nPrefix, icon, selection } = descriptor;
  const { defs, thumbnails, loading, locked, selectItem } = useEntouragePalette(descriptor);
  const active = selection.use();
  const [category, setCategory] = useState<FacetFilter>(LIBRARY_FILTER_ALL);
  const [secondary, setSecondary] = useState<FacetFilter>(LIBRARY_FILTER_ALL);

  // Ίδιο μοτίβο κλειδιών με τον core `getLabelParts` (category · secondary; series στο τέλος).
  const displayNameOf = useCallback(
    (def: EntourageDef): string => {
      const label = def.secondary
        ? `${t(`${i18nPrefix}.categories.${def.category}`)} · ${t(`${i18nPrefix}.secondary.${def.secondary}`)}`
        : t(`${i18nPrefix}.categories.${def.category}`);
      return `${label} ${def.series}`;
    },
    [t, i18nPrefix],
  );

  /** Chips ΜΟΝΟ για facets που πραγματικά υπάρχουν στον κατάλογο. */
  const categoryOptions = useMemo<ChipOption[]>(() => {
    const present = [...new Set(defs.map((d) => d.category))];
    return present.map((c) => ({ value: c, label: t(`${i18nPrefix}.categories.${c}`) }));
  }, [defs, t, i18nPrefix]);

  const secondaryOptions = useMemo<ChipOption[]>(() => {
    const present = [...new Set(defs.map((d) => d.secondary).filter((s): s is string => s !== null))];
    return present.map((s) => ({ value: s, label: t(`${i18nPrefix}.secondary.${s}`) }));
  }, [defs, t, i18nPrefix]);

  const visibleDefs = useMemo(
    () =>
      defs.filter(
        (d) =>
          (category === LIBRARY_FILTER_ALL || d.category === category) &&
          (secondary === LIBRARY_FILTER_ALL || d.secondary === secondary),
      ),
    [defs, category, secondary],
  );

  const handleSelect = useCallback(
    (def: EntourageDef) => {
      if (selectItem(def)) onSelect();
    },
    [selectItem, onSelect],
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
      <FloatingPanel.Header title={t(`${i18nPrefix}.title`)} icon={icon} />
      <FloatingPanel.Content className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="flex-shrink-0 border-b border-border pb-2 text-xs text-muted-foreground">
          {t(`${i18nPrefix}.hint`)}
        </p>

        <ChipFilterRow
          ariaLabel={t(`${i18nPrefix}.title`)}
          allLabel={t(`${i18nPrefix}.allCategories`)}
          options={categoryOptions}
          active={category}
          onSelect={setCategory}
        />
        <ChipFilterRow
          ariaLabel={t(`${i18nPrefix}.secondaryFilterLabel`)}
          allLabel={t(`${i18nPrefix}.allSecondary`)}
          options={secondaryOptions}
          active={secondary}
          onSelect={setSecondary}
        />

        {/* ADR-655 — «κλειδωμένο» ≠ «άδειο»: ο μη δικαιούχος πρέπει να καταλάβει ΓΙΑΤΙ δεν βλέπει τίποτα. */}
        {locked && (
          <p role="status" className="p-4 text-center text-sm text-muted-foreground">
            {t(`${i18nPrefix}.locked`)}
          </p>
        )}

        {loading && (
          <p role="status" className="p-4 text-center text-sm text-muted-foreground">
            {t(`${i18nPrefix}.loading`)}
          </p>
        )}

        {!loading && !locked && visibleDefs.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {defs.length === 0 ? t(`${i18nPrefix}.empty`) : t(`${i18nPrefix}.noMatch`)}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 overflow-auto py-2">
            {visibleDefs.map((def) => (
              <li key={def.id}>
                <EntourageCard
                  def={def}
                  displayName={displayNameOf(def)}
                  thumbnailUrl={thumbnails.get(def.id) ?? ''}
                  isActive={active?.id === def.id}
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
