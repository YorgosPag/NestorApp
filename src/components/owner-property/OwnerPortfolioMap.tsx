'use client';

/**
 * **Ο χάρτης χαρτοφυλακίου του κατόχου** — «πού είναι τα ακίνητά μου, όπως τα βλέπει ο κόσμος» (ADR-777 §8.71).
 *
 * 🔑 **Ένας χάρτης, όχι δεύτερος**: ο ίδιος πυρήνας με τη δημόσια αναζήτηση (`ListingMapCanvas`:
 * ίδιες πηγές, ίδια επίπεδα, ίδια χρώματα, ίδιο καδράρισμα, ίδια ομαδοποίηση). Αλλάζουν μόνο η
 * **πηγή** (το σημάδι της δημοσίευσης, ποτέ το `place`) και η **φούσκα** (κάρτα του κατόχου).
 *
 * 🔑 **Κοινή εστίαση** με το `useListingFocus`: πέρασμα ⇒ επισήμανση, κλικ ⇒ φούσκα, `Escape` /
 * κλικ στο κενό / `×` ⇒ ακύρωση. Τρεις διαδρομές εξόδου, όπως στην αναζήτηση.
 *
 * ⚠️ Φορτώνεται με `next/dynamic` **μόνο** όταν ζητηθεί η προβολή χάρτη: ο κάτοχος που δεν την
 * ανοίγει ποτέ δεν κατεβάζει τη MapLibre (πρότυπο `ListingMapSnapshotProvider`).
 */

import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useListingFocus } from '@/hooks/listings/useListingFocus';
import {
  ownerPortfolioGeoJson,
  type MappedOwnerProperty,
  type UnmappedOwnerProperty,
} from '@/lib/owner-property/owner-portfolio-map';
import { ListingMapCanvas } from '@/components/search-results/ListingMapCanvas';

import { OWNER_PORTFOLIO_MAP_HEIGHT } from './owner-portfolio-layout';
import { OwnerPortfolioUnmappedRow } from './OwnerPortfolioUnmappedRow';
import { OwnerPropertyMapPopup } from './OwnerPropertyMapPopup';

const K = 'property-market:offer.portfolio.map';

export interface OwnerPortfolioMapProps {
  readonly mapped: readonly MappedOwnerProperty[];
  readonly unmapped: readonly UnmappedOwnerProperty[];
}

export default function OwnerPortfolioMap({ mapped, unmapped }: OwnerPortfolioMapProps) {
  const { t } = useTranslation(['property-market']);
  const { focus, peek, select, clear } = useListingFocus();

  const geojson = useMemo(() => ownerPortfolioGeoJson(mapped), [mapped]);
  const selected = useMemo(
    () => (focus.selected === null ? null : (mapped.find((m) => m.property.id === focus.selected) ?? null)),
    [mapped, focus.selected],
  );

  return (
    <section aria-label={t(`${K}.label`)} className="flex flex-col overflow-hidden rounded-md border border-border">
      <p className="px-3 py-2 text-xs text-muted-foreground">{t(`${K}.hint`)}</p>
      <figure className={`${OWNER_PORTFOLIO_MAP_HEIGHT} relative m-0`}>
        <ListingMapCanvas geojson={geojson} focus={focus} onPeek={peek} onSelect={select} onClear={clear}>
          {/* Δεμένο στο `selected`, ΠΟΤΕ στο `peeked` (βλ. `ListingMapPopup`). */}
          {selected !== null && (
            <OwnerPropertyMapPopup property={selected.property} mark={selected.mark} onClose={clear} />
          )}
        </ListingMapCanvas>
      </figure>
      <OwnerPortfolioUnmappedRow unmapped={unmapped} />
    </section>
  );
}
