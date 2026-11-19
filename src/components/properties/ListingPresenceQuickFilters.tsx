'use client';

/**
 * 🏢 Γρήγορα φίλτρα **παρουσίας αγγελίας**, με μετρητή ανά παρουσία (ADR-777 §8.103).
 *
 * «Όλα 20 · 🌐 8 · 👥 3 · 🔒 1 · ⊘ 7 · 🏁 1» — ο άνθρωπος βλέπει **πόσα** είναι στο κοινό **πριν** κάνει κλικ, και
 * με ένα κλικ βλέπει **μόνο** αυτά (πρότυπο Shopify «Status» / Gmail μετρητές). Τα σχήματα είναι **τα ίδια** με τα
 * σήματα της κάρτας (`listingPresenceSpec`), ώστε φίλτρο και κάρτα να διαβάζονται με το ίδιο λεξιλόγιο.
 *
 * 🔑 Λεπτό περιτύλιγμα του `TypeQuickFilters` — καμία δεύτερη υλοποίηση γραμμής φίλτρων.
 */

import React, { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';

import { TypeQuickFilters, type TypeFilterOption } from '@/components/shared/TypeQuickFilters';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  LISTING_PRESENCES,
  listingPresenceLabelKey,
  listingPresenceSpec,
  type ListingPresence,
} from '@/lib/listings/listing-presence';

/** «Όλα» + μία επιλογή ανά παρουσία, με το σχήμα της κάρτας. */
const PRESENCE_OPTIONS: TypeFilterOption[] = [
  {
    value: 'all',
    label: 'listingPresence.filter.all',
    icon: LayoutGrid,
    tooltip: 'listingPresence.filter.allTooltip',
  },
  ...LISTING_PRESENCES.map((presence) => ({
    value: presence,
    label: listingPresenceLabelKey(presence),
    icon: listingPresenceSpec(presence).icon,
    tooltip: listingPresenceLabelKey(presence),
  })),
];

export interface ListingPresenceQuickFiltersProps {
  /** Η επιλεγμένη παρουσία — `null` = όλα. */
  readonly selected: ListingPresence | null;
  readonly onChange: (presence: ListingPresence | null) => void;
  /** Πόσα ακίνητα ανά παρουσία (`countListingPresences`). */
  readonly counts: Readonly<Record<ListingPresence, number>>;
  /** Το σύνολο, για το «Όλα». */
  readonly total: number;
}

function isListingPresence(value: string): value is ListingPresence {
  return (LISTING_PRESENCES as readonly string[]).includes(value);
}

export function ListingPresenceQuickFilters({ selected, onChange, counts, total }: ListingPresenceQuickFiltersProps) {
  // Στατική δήλωση (CHECK 3.34 · 3.36): οι ετικέτες παρουσίας ζουν στο ίδιο namespace με τα σήματα κατάστασης.
  const { t } = useTranslation('properties-enums');
  const optionCounts = useMemo(() => ({ ...counts, all: total }), [counts, total]);

  return (
    <TypeQuickFilters
      options={PRESENCE_OPTIONS}
      selectedTypes={selected === null ? [] : [selected]}
      onTypeChange={(values) => {
        const next = values[0];
        onChange(next !== undefined && isListingPresence(next) ? next : null);
      }}
      counts={optionCounts}
      translateOption={t}
      ariaLabel={t('listingPresence.filter.ariaLabel')}
      compact
    />
  );
}
