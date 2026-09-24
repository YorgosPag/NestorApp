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
 * ⚠️ **Ο ελεγκτής έρχεται από τον ΓΟΝΕΑ** (§8.75): στη διάταξη δίπλα-δίπλα η λίστα και ο χάρτης
 * μοιράζονται **μία** εστίαση — δύο `useListingFocus` θα ήταν δύο αλήθειες για το «ποιο κοιτάζω».
 *
 * 🔑 **Γεμίζει τον περιέκτη** (`h-full`): το ύψος το ορίζει η διάταξη (`owner-portfolio-layout.ts`),
 * ώστε κράτηση θέσης και χάρτης να πιάνουν το ίδιο κουτί.
 *
 * ⚠️ Φορτώνεται με `next/dynamic` **μόνο** όταν ζητηθεί η προβολή χάρτη: ο κάτοχος που δεν την
 * ανοίγει ποτέ δεν κατεβάζει τη MapLibre (πρότυπο `ListingMapSnapshotProvider`).
 */

import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingFocusController } from '@/hooks/listings/useListingFocus';
import {
  ownerPortfolioGeoJson,
  type MappedOwnerProperty,
  type UnmappedOwnerProperty,
} from '@/lib/owner-property/owner-portfolio-map';
import { ListingMapCanvas } from '@/components/search-results/ListingMapCanvas';

import { OwnerPortfolioUnmappedRow } from './OwnerPortfolioUnmappedRow';
import { OwnerPropertyMapPopup } from './OwnerPropertyMapPopup';

const K = 'property-market:offer.portfolio.map';

export interface OwnerPortfolioMapProps {
  readonly mapped: readonly MappedOwnerProperty[];
  readonly unmapped: readonly UnmappedOwnerProperty[];
  /** Η **μία** εστίαση της σελίδας — κοινή με τη λίστα (§8.75). */
  readonly focusController: ListingFocusController;
}

export default function OwnerPortfolioMap({ mapped, unmapped, focusController }: OwnerPortfolioMapProps) {
  const { t } = useTranslation(['property-market']);
  const { focus, peek, select, clear } = focusController;

  const geojson = useMemo(() => ownerPortfolioGeoJson(mapped), [mapped]);
  const selected = useMemo(
    () => (focus.selected === null ? null : (mapped.find((m) => m.property.id === focus.selected) ?? null)),
    [mapped, focus.selected],
  );

  return (
    <section aria-label={t(`${K}.label`)} className="flex h-full flex-col overflow-hidden rounded-md border border-border">
      <p className="px-3 py-2 text-xs text-muted-foreground">{t(`${K}.hint`)}</p>
      <figure className="relative m-0 min-h-0 flex-1">
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
