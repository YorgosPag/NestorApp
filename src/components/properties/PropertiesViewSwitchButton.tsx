'use client';

/**
 * @fileoverview **Το κουμπί «πλέγμα ↔ κάτοψη» της «Διαθέσιμα Ακίνητα»** — ΕΝΑ, για τις δύο προβολές.
 * @module components/properties/PropertiesViewSwitchButton
 * @see hooks/usePropertiesView · ADR-840 Α2 + §7.7
 *
 * 🔑 Ζούσε inline μόνο στο πλέγμα («Προβολή σε Κάτοψη»)· η κάτοψη **δεν είχε δρόμο πίσω** εκτός από το «πίσω» του
 *    browser. Τώρα που η εναλλαγή είναι `replace` (τα φίλτρα μένουν στην ίδια εγγραφή), η κάτοψη χρειάζεται το
 *    αντίστροφο κουμπί — και δεύτερο χειρόγραφο αντίγραφο του JSX θα απέκλινε στο πρώτο restyle (N.18).
 */

import React from 'react';
import { LayoutGrid, MapPin, type LucideIcon } from 'lucide-react';

import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { usePropertiesView } from '@/hooks/usePropertiesView';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertiesView } from '@/lib/properties/property-filters-url';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/** Ετικέτα + εικονίδιο ανά **προορισμό** — `Record`, ώστε νέα προβολή να μη μεταγλωττίζεται χωρίς κουμπί. */
const SWITCH_TO: Readonly<Record<PropertiesView, { readonly labelKey: string; readonly icon: LucideIcon }>> = {
  floorplan: { labelKey: 'grid.actions.viewFloorPlan', icon: MapPin },
  grid: { labelKey: 'grid.actions.viewGrid', icon: LayoutGrid },
};

interface PropertiesViewSwitchButtonProps {
  /** Η προβολή στην οποία **πηγαίνει** το κουμπί. */
  readonly to: PropertiesView;
}

export function PropertiesViewSwitchButton({ to }: PropertiesViewSwitchButtonProps) {
  const { setView } = usePropertiesView();
  const { t } = useTranslation('properties');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { radius } = useBorderTokens();
  const { labelKey, icon: Icon } = SWITCH_TO[to];

  return (
    <button
      type="button"
      onClick={() => setView(to)}
      className={`px-4 py-2 ${colors.bg.gradient} ${colors.text.inverse} ${radius.lg} transition-all flex items-center gap-2 font-medium h-8 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
    >
      <Icon className={iconSizes.sm} />
      {t(labelKey)}
    </button>
  );
}
