'use client';

/**
 * 🏢 Το ΠΛΕΓΜΑ καρτών — η όψη `grid` της ενιαίας οθόνης ακινήτων (ADR-840 Σ3).
 *
 * Ήταν το σώμα του `PropertyGridView`, που ήταν **ολόκληρη σελίδα** με δική του κεφαλίδα, φίλτρα και ταμπλό (και
 * δεύτερη, «λίστα», παραλλαγή καρτών). Στην ενιαία οθόνη κεφαλίδα/φίλτρα/ταμπλό είναι **της οθόνης**, και η «λίστα»
 * είναι πια η πραγματική όψη `list` (κατάλογος + επιθεωρητής) — εδώ μένει μόνο το πλέγμα.
 *
 * ⚠️ ADR-777 §8.21: το πλήθος στηλών το απαντά η μηχανή διάταξης (`gridPatterns.cards.media`) από το πραγματικό
 *    πλάτος — όχι δοχείο καρφωμένο στα 640 px.
 */

import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { gridPatterns } from '@/styles/design-tokens';
import type { Property } from '@/types/property-viewer';
import { PropertyCard } from './components/PropertyCard';
import '@/lib/design-system';

interface PropertyCardGridProps {
  properties: Property[];
  /** «Δες το στην κάτοψη» — αλλαγή ΟΨΗΣ με το ακίνητο επιλεγμένο, όχι πλοήγηση (ADR-840 §7.7). */
  onViewFloorPlan: (propertyId: string) => void;
}

export function PropertyCardGrid({ properties, onViewFloorPlan }: PropertyCardGridProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['properties']);

  if (properties.length === 0) {
    return (
      <section className="text-center py-12 px-4 sm:px-0" role="status" aria-live="polite">
        {React.createElement(NAVIGATION_ENTITIES.property.icon, { className: `${iconSizes.xl} ${colors.text.muted} mx-auto mb-4`, 'aria-hidden': true })}
        <h3 className={`text-lg font-medium ${colors.text.primary} mb-2`}>{t('grid.emptyState.title')}</h3>
        <p className={colors.text.muted}>{t('grid.emptyState.subtitle')}</p>
      </section>
    );
  }

  return (
    // ADR-840 Σ3: γραμμές = ύψος περιεχομένου σε δοχείο σταθερού ύψους που κυλά — το `auto-rows-max` ζει πλέον στο
    //    `gridPatterns.cards.*` (`CATALOG_ROW_PACKING`), για ΚΑΘΕ κατάλογο (ADR-912 §12.19).
    <ul
      className={`grid w-full overflow-y-auto p-2 ${gridPatterns.cards.gap} ${gridPatterns.cards.media}`}
      role="list"
      aria-label={t('header.title')}
    >
      {properties.map((property) => (
        <li key={property.id} className="w-full min-w-0 overflow-hidden">
          <PropertyCard property={property} onViewFloorPlan={onViewFloorPlan} />
        </li>
      ))}
    </ul>
  );
}
