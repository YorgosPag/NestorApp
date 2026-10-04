'use client';

/**
 * @fileoverview **Οι μονάδες του κτιρίου, ανά στάθμη** (ADR-900 §8 #2, 2β.4) — ο πρώτος καταναλωτής του `public_units`.
 * @module components/geo/PlaceUnitLevels
 *
 * Σχήμα Zillow «building page», με την αυστηρότητα του επιπέδου Α: **πλήθος ανά στάθμη**, τίποτε άλλο — κανένας
 * κάτοχος, ΚΑΕΚ ή πόρτα (δεν υπάρχουν καν στο έγγραφο, ADR-900 §8 #2 Α1).
 *
 * ⚠️ **Μηδέν μονάδες ⇒ καμία γραμμή, και είναι απόφαση**: «0 επαληθευμένες» θα διαβαζόταν «το κτίριο δεν έχει
 * διαμερίσματα», ενώ σημαίνει μόνο ότι **κανείς δεν επαλήθευσε ακόμη**. Η αποτυχία ανάγνωσης καταγράφεται στο hook
 * και επίσης σωπαίνει εδώ: είναι συμπλήρωμα του τόπου, όχι ο τόπος — το πρόσωπό του το λέει ήδη το `PlaceSummary`.
 *
 * 🔑 **Namespace `property-market`, όχι το `search-results` του γονέα — μετρημένο** (CHECK 3.34): το `search-results`
 * φορτώνεται **ολόκληρο** στο κέλυφος και τα τρία κλειδιά το έβγαζαν πάνω από το ταβάνι του (15.440 / 15.200 bytes).
 * Το `property-market` κόβεται σε επίπεδο κλειδιού — πληρώνει μόνο όποιος το χρησιμοποιεί.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { floorRefKey } from '@/lib/floor/floor-ref';
import { publicUnitLevels } from '@/lib/places/public-unit-levels';
import { usePublicUnits } from '@/services/realtime/hooks/usePublicUnits';

const NS = 'property-market';

export function PlaceUnitLevels({ buildingId }: { readonly buildingId: string }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const floorLabel = useFloorLabel();
  const units = usePublicUnits(buildingId);

  if (units.state !== 'ready') return null;
  const { total, levels } = publicUnitLevels(units.units);
  if (total === 0) return null;

  const heading = t(`${NS}:publicUnits.heading`, { count: total });
  return (
    <section className="space-y-1" aria-label={heading}>
      <p className="text-sm text-foreground">{heading}</p>
      <ul className="text-xs text-muted-foreground">
        {levels.map(({ level, count }) => (
          <li key={level === null ? 'unknown' : floorRefKey(level)}>
            {level === null
              ? t(`${NS}:publicUnits.unknownLevel`, { count })
              : t(`${NS}:publicUnits.level`, { level: floorLabel(level), count })}
          </li>
        ))}
      </ul>
    </section>
  );
}
