'use client';

/**
 * 🏢 HEADER CUSTOM ACTIONS — SSoT (ADR-584 / N.18)
 *
 * Τα κουμπιά που περνούν στο `actions.customActions` του `PageHeader`:
 * το mobile-only filter toggle και οι εναλλαγές «κάδων» με badge μετρητή —
 * ο κάδος και, όπου η οντότητα έχει, το αρχείο (ADR-329 §3.9).
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
 * ⚠️ Tooltip: ΠΑΝΤΑ στους κάδους (trash/αρχείο), ΠΟΤΕ στο filter. Icon-only κουμπί
 * χωρίς tooltip είναι affordance gap — αλλά το filter είναι `md:hidden` (mobile-only)
 * και το tooltip θέλει hover που δεν υπάρχει σε touch → θα ήταν νεκρός κώδικας. Εκεί ο
 * `aria-label` καλύπτει τον screen reader.
 *
 * @see enterprise-system/components — το ίδιο το PageHeader
 */

import React from 'react';
import { Archive, Filter, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { IconCountBadge } from '@/core/badges';

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

/**
 * Οι δύο κάδοι του κύκλου ζωής διαφέρουν ΜΟΝΟ στο εικονίδιο.
 *
 * 🔴 Η «πατημένη» όψη ΔΕΝ ορίζεται εδώ (ADR-281 · ADR-329 §3.9, 2026-10-07). Ήταν χειρόγραφο ζεύγος
 * ανά κάδο (`bg-accent` για το αρχείο, `bg-destructive/10` για τον κάδο): στο σκοτεινό θέμα το
 * `bg-accent` απέχει ~1% φωτεινότητας από το ανενεργό φόντο ⇒ το ανοιχτό αρχείο **δεν φαινόταν
 * ανοιχτό**. Η πατημένη κατάσταση είναι ΕΝΑΣ ρόλος για κάθε κουμπί εναλλαγής
 * (`ToggleButton` → `COLOR_BRIDGE.selectionControl.pressed`, ADR-770 §19) — ίδια με το κουμπί
 * πίνακα ελέγχου και τα κουμπιά όψης που κάθονται δίπλα.
 */
const BIN_TOGGLE_ICONS = {
  trash: Trash2,
  archive: Archive,
} as const satisfies Record<string, LucideIcon>;

type BinToggleKind = keyof typeof BIN_TOGGLE_ICONS;

interface HeaderBinToggleProps {
  kind: BinToggleKind;
  active?: boolean;
  onToggle: () => void;
  count: number;
  ariaLabel: string;
  tooltip: string;
}

/**
 * Εναλλαγή προβολής ενός κάδου με badge μετρητή (ADR-281 / ADR-308 · ADR-329 §3.9).
 * ΕΝΑ component, δύο χρήσεις (κάδος, αρχείο) — ποτέ δεύτερο αντίγραφο ανά κάδο.
 */
function HeaderBinToggle({ kind, active, onToggle, count, ariaLabel, tooltip }: HeaderBinToggleProps) {
  const iconSizes = useIconSizes();
  const Icon = BIN_TOGGLE_ICONS[kind];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleButton
          pressed={Boolean(active)}
          variant="outline"
          size="icon"
          onClick={onToggle}
          className="relative"
          aria-label={ariaLabel}
        >
          <Icon className={iconSizes.sm} />
          {/* ADR-854: το `w-4` εδώ ήταν ΣΤΑΘΕΡΟ πλάτος — έκοβε το ίδιο του το «99+».
              Το IconCountBadge χρησιμοποιεί `min-w`, και η οροφή 99 ζει πλέον ως
              προεπιλογή του SSoT (η τοπική σταθερά TRASH_BADGE_MAX διαγράφηκε). */}
          <IconCountBadge count={count} announce />
        </ToggleButton>
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
  /**
   * Το toggle του αρχείου (ADR-329 §3.9) αποδίδεται ΜΟΝΟ αν δοθεί
   * `onToggleArchive` — σήμερα μόνο τα ακίνητα έχουν αρχείο, άρα κάθε άλλη
   * σελίδα μένει ανέγγιχτη. Ίδιοι κανόνες με τον κάδο: `archiveAriaLabel`
   * υποχρεωτικό όταν δίνεις handler, `archiveTooltip` default = το aria label.
   */
  showArchive?: boolean;
  onToggleArchive?: () => void;
  archiveCount?: number;
  archiveAriaLabel?: string;
  archiveTooltip?: string;
}

/**
 * Χτίζει τον πίνακα `customActions` του `PageHeader`. Τα κλειδιά
 * (`mobile-filter` / `archive-toggle` / `trash-toggle`) και η σειρά
 * (φίλτρα → αρχείο → κάδος) είναι ενιαία για όλες τις σελίδες-λίστες. Ο κάδος
 * μένει ΤΕΛΕΥΤΑΙΟΣ: εκεί τον ξέρει ο άνθρωπος, και το αρχείο δεν τον μετακινεί.
 */
export function buildHeaderCustomActions(options: HeaderCustomActionsOptions): React.ReactElement[] {
  const { showFilters, setShowFilters, filtersAriaLabel } = options;
  const { showTrash, onToggleTrash, trashCount = 0, trashAriaLabel, trashTooltip } = options;
  const { showArchive, onToggleArchive, archiveCount = 0, archiveAriaLabel, archiveTooltip } = options;
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

  if (onToggleArchive) {
    actions.push(
      <HeaderBinToggle
        key="archive-toggle"
        kind="archive"
        active={showArchive}
        onToggle={onToggleArchive}
        count={archiveCount}
        ariaLabel={archiveAriaLabel ?? ''}
        tooltip={archiveTooltip ?? archiveAriaLabel ?? ''}
      />
    );
  }

  if (onToggleTrash) {
    actions.push(
      <HeaderBinToggle
        key="trash-toggle"
        kind="trash"
        active={showTrash}
        onToggle={onToggleTrash}
        count={trashCount}
        ariaLabel={trashAriaLabel ?? ''}
        tooltip={trashTooltip ?? trashAriaLabel ?? ''}
      />
    );
  }

  return actions;
}
