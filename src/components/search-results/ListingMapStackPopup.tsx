'use client';

/**
 * **«Εδώ είναι πολλά — ποιο θέλεις;»** — η λίστα διαλέγματος του χάρτη (ADR-777 §8.76).
 *
 * 🔑 Ανοίγει όταν ο κριτής του κλικ (`lib/maps/map-pick.ts`) αποδείξει ότι ο χάρτης **δεν
 * μπορεί** να χωρίσει τους στόχους: δύο αγγελίες στο ίδιο κτίριο, ή δύο «κάπου στην πόλη»
 * στο ίδιο κέντρο. Πρότυπο **Zillow** (μονάδες ίδιου κτιρίου) και **AutoCAD Selection
 * Cycling** (λίστα επικαλυπτόμενων) — **όχι** spiderfy, που θα ζωγράφιζε αγγελίες εκεί που
 * δεν είναι.
 *
 * 🏆 **Πέρα από τους μεγάλους**: το πέρασμα από μια γραμμή **φωτίζει** την αγγελία στη
 * λίστα και στον χάρτη (το ίδιο `peek` με την πινέζα) — ο άνθρωπος βλέπει **ποια είναι
 * ποια** πριν διαλέξει, και η λίστα είναι πλήρως προσβάσιμη από πληκτρολόγιο (η MapLibre
 * εστιάζει την πρώτη γραμμή στο άνοιγμα· `Escape` κλείνει **μόνο** τη λίστα — στρώση
 * `useEscapeKey`, ADR-711).
 */

import React, { useEffect, useId } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { displayPriceLabel } from '@/lib/listings/listing-price-label';
import type { DisplayPrice } from '@/lib/properties/price-resolver';
import type { GeoPoint } from '@/types/geo/coordinates';

import { ListingMapPopupFrame } from './ListingMapPopupFrame';
import { useStayTotal } from './StayTotalsContext';

/** **Πώς περιγράφεται μια αγγελία σε μία γραμμή** — ο καταναλωτής ξέρει το πεδίο του. */
export interface ListingMapEntry {
  readonly id: string;
  readonly title: string;
  /**
   * Η τιμή **όπως τη βλέπει ο κόσμος** (`resolveDisplayPrice`) — **ΟΧΙ** έτοιμη ετικέτα.
   *
   * 🔑 Η μορφοποίηση γίνεται στη γραμμή, με το **ίδιο** `displayPriceLabel` + `useStayTotal`
   * της φούσκας: με ημερομηνίες διαμονής η λίστα λέει το **ίδιο σύνολο** με τη φούσκα και
   * την πινακίδα, αντί για δεύτερη τιμή για το ίδιο ακίνητο.
   */
  readonly price: DisplayPrice;
}

interface StackRowProps {
  readonly entry: ListingMapEntry;
  readonly onPick: (id: string) => void;
  readonly onPeek?: (id: string | null) => void;
}

function StackRow({ entry, onPick, onPeek }: StackRowProps) {
  const { t } = useTranslation(['search-results', 'search-focus']);
  const stayTotal = useStayTotal(entry.id);

  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(entry.id)}
        onMouseEnter={() => onPeek?.(entry.id)}
        onFocus={() => onPeek?.(entry.id)}
        className="flex w-full items-start justify-between gap-2 rounded px-1.5 py-1 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/*
          ⚠️ **`line-clamp-2`, ΟΧΙ `truncate`** — μετρημένο ζωντανά: με μία γραμμή οι δύο
          τίτλοι έγιναν «…κτίριο, 1…» και «…κτίριο, 3…», δηλαδή κόπηκε **ακριβώς** ό,τι τους
          ξεχωρίζει. Σε λίστα **διαλέγματος** η διαφορά είναι το περιεχόμενο.
        */}
        <span className="line-clamp-2">{entry.title}</span>
        <span className="shrink-0 font-semibold">{displayPriceLabel(t, entry.price, stayTotal)}</span>
      </button>
    </li>
  );
}

interface ListingMapStackPopupProps {
  readonly point: GeoPoint;
  readonly entries: readonly ListingMapEntry[];
  readonly onPick: (id: string) => void;
  readonly onPeek?: (id: string | null) => void;
  readonly onClose: () => void;
}

export function ListingMapStackPopup({ point, entries, onPick, onPeek, onClose }: ListingMapStackPopupProps) {
  // `search-focus`, ΟΧΙ `search-results`: εκείνο φορτώνεται **ολόκληρο** στο κέλυφος και είναι
  // στο όριό του (ADR-744) — η λίστα διαλέγματος ανήκει στον δεσμό λίστας↔χάρτη, που είναι lazy.
  const { t } = useTranslation('search-focus');
  const headingId = useId();
  useEscapeKey(onClose, true, 'search-results/listing-map-stack');
  // Η λίστα φεύγει ⇒ και ο φωτισμός που άναψε: αλλιώς η αγγελία μένει «φωτισμένη» χωρίς αιτία.
  useEffect(() => () => onPeek?.(null), [onPeek]);

  return (
    <ListingMapPopupFrame point={point} onClose={onClose}>
      <section className="w-56" aria-labelledby={headingId}>
        {/* `popover-foreground`: το ζεύγος της αιωρούμενης επιφάνειας (ADR-770 · CHECK 3.39). */}
        <h3 id={headingId} className="mb-1 text-xs font-medium text-popover-foreground">
          {t('stack.heading', { count: entries.length })}
        </h3>
        <ul className="max-h-64 overflow-y-auto" onMouseLeave={() => onPeek?.(null)}>
          {entries.map((entry) => (
            <StackRow key={entry.id} entry={entry} onPick={onPick} onPeek={onPeek} />
          ))}
        </ul>
      </section>
    </ListingMapPopupFrame>
  );
}
