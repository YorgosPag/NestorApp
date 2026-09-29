/**
 * @fileoverview **Οι λέξεις κάθε βαθμίδας της σελίδας περιοχής** (ADR-890 §16) — πώς λέγεται η βαθμίδα, και τι λέει ο
 * χάρτης σύγκρισης για τα **παιδιά** της (Περιφέρεια → Π.Ε. · Π.Ε. → Δήμοι · Δήμος → Δ.Ε.).
 * @related `AreaMarketContent.tsx` · `useAreaChildMap.ts` · `components/market/choropleth/price-map-words.tsx`
 * @module components/area-market/area-level-words
 *
 * 🔑 **Κάθε κλειδί γραμμένο ΚΥΡΙΟΛΕΚΤΙΚΑ μέσα σε `t('…')`**, ανά βαθμίδα: ο έλεγχος κλειδιών (CHECK 3.8) βλέπει και
 *   τα 20, και το route slice (CHECK 3.34) τα λύνει στατικά. Πίνακας κλειδιών με `t(πίνακας[βαθμίδα])` θα ήταν
 *   αόρατος στο 3.8 — ένα τυπογραφικό λάθος θα έφτανε ως ωμό κλειδί στην οθόνη.
 * 🔑 **Η Δ.Ε. δεν έχει παιδιά** ⇒ `null`: καμία σελίδα δεν μπορεί να ζητήσει λέξεις για χάρτη που δεν υπάρχει.
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import { ADMIN_LEVEL } from '@/lib/geo/admin-area-index-file';
import type { AreaMarketLevel } from '@/types/area-market';

type T = ReturnType<typeof useTranslation>['t'];

/** Πώς λέγεται η βαθμίδα στο eyebrow της σελίδας. */
export function areaLevelName(t: T, level: AreaMarketLevel): string {
  switch (level) {
    case ADMIN_LEVEL.region:
      return t('area-market:level.region');
    case ADMIN_LEVEL.regionalUnit:
      return t('area-market:level.regionalUnit');
    case ADMIN_LEVEL.municipality:
      return t('area-market:level.municipality');
    case ADMIN_LEVEL.municipalUnit:
      return t('area-market:level.municipalUnit');
  }
}

/** Ό,τι λέει ο χάρτης σύγκρισης και ο πίνακας για τα παιδιά μιας σελίδας. */
export interface ChildMapWords {
  /** Τίτλος του πίνακα / της λίστας παιδιών («Δήμοι»). */
  readonly title: string;
  readonly caption: (segment: string) => string;
  /** Ο χάρτης σε λέξεις («Τιμές ανά Δήμο») — και η ετικέτα του τρόπου, όπου υπάρχουν και ζώνες. */
  readonly prices: string;
  readonly hint: string;
  /** Η ετικέτα πάνω σε παιδί με λίγα δεδομένα: η τιμή του γονέα, με το όνομα της βαθμίδας του. */
  readonly parentLabel: (price: string) => string;
  /** Γραμμή υπομνήματος της διαγράμμισης. */
  readonly inherited: string;
  /** Το ίδιο, σύντομο, μέσα στο κελί τιμής του πίνακα. */
  readonly inheritedShort: string;
}

/** Οι λέξεις του χάρτη σύγκρισης της σελίδας αυτής της βαθμίδας — `null` όταν η βαθμίδα δεν έχει παιδιά με σελίδα. */
export function childMapWordsOf(t: T, level: number): ChildMapWords | null {
  switch (level) {
    case ADMIN_LEVEL.region:
      return {
        title: t('area-market:childMap.regionalUnits.title'),
        caption: (segment) => t('area-market:childMap.regionalUnits.caption', { segment }),
        prices: t('area-market:childMap.regionalUnits.prices'),
        hint: t('area-market:childMap.regionalUnits.hint'),
        parentLabel: (price) => t('area-market:childMap.regionalUnits.parentLabel', { price }),
        inherited: t('area-market:childMap.regionalUnits.inherited'),
        inheritedShort: t('area-market:childMap.regionalUnits.inheritedShort'),
      };
    case ADMIN_LEVEL.regionalUnit:
      return {
        title: t('area-market:childMap.municipalities.title'),
        caption: (segment) => t('area-market:childMap.municipalities.caption', { segment }),
        prices: t('area-market:childMap.municipalities.prices'),
        hint: t('area-market:childMap.municipalities.hint'),
        parentLabel: (price) => t('area-market:childMap.municipalities.parentLabel', { price }),
        inherited: t('area-market:childMap.municipalities.inherited'),
        inheritedShort: t('area-market:childMap.municipalities.inheritedShort'),
      };
    case ADMIN_LEVEL.municipality:
      // Η διαγράμμιση «τιμή Δήμου» λέγεται ήδη στον χάρτη της αναζήτησης — ίδιες λέξεις, ένα κλειδί (`price-map`).
      return {
        title: t('area-market:childMap.municipalUnits.title'),
        caption: (segment) => t('area-market:childMap.municipalUnits.caption', { segment }),
        prices: t('area-market:childMap.municipalUnits.prices'),
        hint: t('area-market:childMap.municipalUnits.hint'),
        parentLabel: (price) => t('area-market:childMap.municipalUnits.parentLabel', { price }),
        inherited: t('price-map:legend.inherited'),
        inheritedShort: t('price-map:table.inherited'),
      };
    default:
      return null;
  }
}
