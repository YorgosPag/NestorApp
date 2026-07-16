'use client';

/**
 * 🏢 HEADER CUSTOM ACTIONS — SSoT (ADR-584 / N.18)
 *
 * Τα δύο κουμπιά που περνούν στο `actions.customActions` του `PageHeader`:
 * το mobile-only filter toggle και το trash toggle με badge μετρητή.
 *
 * Ήταν αντιγραμμένα αυτούσια σε BuildingsHeader / ParkingsHeader / StoragesHeader
 * (byte-identical). Καταναλωτής που χρειάζεται τα ίδια κουμπιά ΔΕΝ τα ξαναγράφει —
 * καλεί το `buildHeaderCustomActions`.
 *
 * ⚠️ Δεύτερη οπτική διάλεκτος (properties/page, property-management, sales,
 * projects) ΔΕΝ καλύπτεται εδώ: χρησιμοποιεί `spacing.padding.sm` + `rounded-md`
 * + `BUTTON_SUBTLE` + `<Tooltip>` wrapper + badge χωρίς cap. Η ενοποίησή της
 * αλλάζει εμφάνιση → απόφαση προϊόντος, όχι refactor. Βλ. ADR-584.
 *
 * @see enterprise-system/components — το ίδιο το PageHeader
 */

import React from 'react';
import { Filter, Trash2 } from 'lucide-react';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/** Πάνω από αυτό ο μετρητής του κάδου κόβεται σε «99+». */
const TRASH_BADGE_MAX = 99;

interface HeaderFilterToggleProps {
  showFilters?: boolean;
  setShowFilters: (show: boolean) => void;
  ariaLabel: string;
}

/** Mobile-only εναλλαγή φίλτρων (κρύβεται από `md:` και πάνω). */
function HeaderFilterToggle({ showFilters, setShowFilters, ariaLabel }: HeaderFilterToggleProps) {
  const iconSizes = useIconSizes();
  const { quick, radius } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <button
      onClick={() => setShowFilters(!showFilters)}
      className={`md:hidden p-2 ${radius.md} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
        showFilters
          ? `bg-primary text-primary-foreground ${quick.focus}`
          : `${colors.bg.primary} ${quick.input} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
      }`}
      aria-label={ariaLabel}
    >
      <Filter className={iconSizes.sm} />
    </button>
  );
}

interface HeaderTrashToggleProps {
  showTrash?: boolean;
  onToggleTrash: () => void;
  trashCount: number;
  ariaLabel: string;
}

/** Εναλλαγή προβολής κάδου με badge μετρητή (ADR-281 / ADR-308). */
function HeaderTrashToggle({ showTrash, onToggleTrash, trashCount, ariaLabel }: HeaderTrashToggleProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <button
      onClick={onToggleTrash}
      className={`relative p-2 ${quick.button} transition-colors ${
        showTrash
          ? `bg-destructive/10 text-destructive ${getStatusBorder('default')}`
          : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
      }`}
      aria-label={ariaLabel}
      aria-pressed={showTrash}
    >
      <Trash2 className={iconSizes.sm} />
      {trashCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
          {trashCount > TRASH_BADGE_MAX ? `${TRASH_BADGE_MAX}+` : trashCount}
        </span>
      )}
    </button>
  );
}

export interface HeaderCustomActionsOptions {
  /** Το filter toggle αποδίδεται ΜΟΝΟ αν δοθεί `setShowFilters`. */
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  filtersAriaLabel: string;
  /** Το trash toggle αποδίδεται ΜΟΝΟ αν δοθεί `onToggleTrash`. */
  showTrash?: boolean;
  onToggleTrash?: () => void;
  trashCount?: number;
  trashAriaLabel: string;
}

/**
 * Χτίζει τον πίνακα `customActions` του `PageHeader`. Τα κλειδιά
 * (`mobile-filter` / `trash-toggle`) και η σειρά (φίλτρα → κάδος) διατηρούνται
 * ακριβώς όπως στα αρχικά inline αντίγραφα.
 */
export function buildHeaderCustomActions({
  showFilters,
  setShowFilters,
  filtersAriaLabel,
  showTrash,
  onToggleTrash,
  trashCount = 0,
  trashAriaLabel,
}: HeaderCustomActionsOptions): React.ReactElement[] {
  const actions: React.ReactElement[] = [];

  if (setShowFilters) {
    actions.push(
      <HeaderFilterToggle
        key="mobile-filter"
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        ariaLabel={filtersAriaLabel}
      />
    );
  }

  if (onToggleTrash) {
    actions.push(
      <HeaderTrashToggle
        key="trash-toggle"
        showTrash={showTrash}
        onToggleTrash={onToggleTrash}
        trashCount={trashCount}
        ariaLabel={trashAriaLabel}
      />
    );
  }

  return actions;
}
