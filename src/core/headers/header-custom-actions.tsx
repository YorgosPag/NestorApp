'use client';

/**
 * 🏢 HEADER CUSTOM ACTIONS — SSoT (ADR-584 / N.18)
 *
 * Τα δύο κουμπιά που περνούν στο `actions.customActions` του `PageHeader`:
 * το mobile-only filter toggle και το trash toggle με badge μετρητή.
 *
 * Καλύπτει ΟΛΟΥΣ τους headers σελίδας-λίστας (Buildings/Parkings/Storages/
 * Projects/Properties×2/SalesAvailable). Καταναλωτής που χρειάζεται τα ίδια
 * κουμπιά ΔΕΝ τα ξαναγράφει — καλεί το `buildHeaderCustomActions`.
 *
 * ⚠️ ΜΙΑ οπτική γλώσσα, ΟΧΙ `variant` (Giorgio 2026-07-16 — «όπως οι μεγάλοι»).
 * Υπήρχαν δύο διάλεκτοι (`ACCENT_HOVER` vs `BUTTON_SUBTLE`). Ένα variant prop θα
 * κωδικοποιούσε μόνιμα την ασυνέπεια αντί να τη λύσει· Figma/Revit/C4D έχουν ΕΝΑ
 * hover state ανά icon-button. Κρατήθηκε το `ACCENT_HOVER` — είναι το canonical
 * hover του design system για ghost/icon buttons (βλ. `BUTTON_GHOST`) και αλλάζει
 * και το text color (contrast).
 *
 * ⚠️ Tooltip: ΠΑΝΤΑ στο trash, ΠΟΤΕ στο filter. Icon-only κουμπί χωρίς tooltip
 * είναι affordance gap — αλλά το filter είναι `md:hidden` (mobile-only) και το
 * tooltip θέλει hover που δεν υπάρχει σε touch → θα ήταν νεκρός κώδικας. Εκεί ο
 * `aria-label` καλύπτει τον screen reader.
 *
 * @see enterprise-system/components — το ίδιο το PageHeader
 */

import React from 'react';
import { Filter, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  const { quick, radiusClass } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <button
      onClick={() => setShowFilters(!showFilters)}
      className={`md:hidden p-2 ${radiusClass.md} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
        showFilters
          ? `bg-primary text-primary-foreground ${quick.focus}`
          : `${colors.bg.primary} ${quick.input} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
      }`}
      aria-label={ariaLabel}
      aria-pressed={showFilters}
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
  tooltip: string;
}

/** Εναλλαγή προβολής κάδου με badge μετρητή (ADR-281 / ADR-308). */
function HeaderTrashToggle({
  showTrash,
  onToggleTrash,
  trashCount,
  ariaLabel,
  tooltip,
}: HeaderTrashToggleProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
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
  /**
   * Υποχρεωτικό όταν δίνεις `onToggleTrash` — αλλιώς αγνοείται. Δεν επιβάλλεται
   * με discriminated union επειδή οι καλούντες περνούν `onToggleTrash` τύπου
   * `(() => void) | undefined` κατευθείαν από props: κανένα union member δεν θα
   * ταίριαζε και ο τύπος θα έσπαγε σε κάθε call site.
   */
  trashAriaLabel?: string;
  /**
   * Κείμενο του tooltip του κάδου. Default: το `trashAriaLabel` — ο tooltip λέει
   * ό,τι ακούει και ο screen reader. Δώσε το ρητά μόνο όταν το κουμπί εναλλάσσει
   * νόημα (π.χ. «Κάδος» ↔ «Πίσω στη λίστα»).
   */
  trashTooltip?: string;
}

/**
 * Χτίζει τον πίνακα `customActions` του `PageHeader`. Τα κλειδιά
 * (`mobile-filter` / `trash-toggle`) και η σειρά (φίλτρα → κάδος) είναι ενιαία
 * για όλες τις σελίδες-λίστες.
 */
export function buildHeaderCustomActions({
  showFilters,
  setShowFilters,
  filtersAriaLabel,
  showTrash,
  onToggleTrash,
  trashCount = 0,
  trashAriaLabel,
  trashTooltip,
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
        ariaLabel={trashAriaLabel ?? ''}
        tooltip={trashTooltip ?? trashAriaLabel ?? ''}
      />
    );
  }

  return actions;
}
