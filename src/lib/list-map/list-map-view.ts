/**
 * @fileoverview **Η ΠΡΟΒΟΛΗ ΛΙΣΤΑ ‖ ΧΑΡΤΗΣ ΣΤΟ URL** (`?view=map`) — μία γλώσσα για κάθε οθόνη
 * που δείχνει τα ίδια πράγματα ως λίστα **και** ως χάρτη.
 * @related ADR-777 §8.75 (χαρτοφυλάκιο κατόχου) · ADR-896 (κατάλογος επαγγελματιών)
 * @module lib/list-map/list-map-view
 *
 * 🔑 **Εξήχθη από το `lib/owner-property/owner-portfolio-map.ts`** τη στιγμή που απέκτησε
 * δεύτερο καταναλωτή (`/pro`). Δύο αντίγραφα του ίδιου `view=map` θα διαφωνούσαν στην
 * πρώτη αλλαγή — π.χ. αν το ένα άρχιζε να γράφει `view=list` και το άλλο όχι.
 */

import { urlEnumParam } from '@/lib/url-filters/enum-param';

/** Οι προβολές. Η `list` είναι η προεπιλογή και **δεν** γράφεται στο URL. */
export const LIST_MAP_VIEWS = ['list', 'map'] as const;
export type ListMapView = (typeof LIST_MAP_VIEWS)[number];

/** Το κλειδί του query string: το ίδιο όνομα που χρησιμοποιούν τα portals (`view=map`). */
export const LIST_MAP_VIEW_PARAM = 'view';

/**
 * 🔑 ADR-840 §7.7 — ο κανόνας «κλειστό σύνολο · προεπιλογή που σβήνει το κλειδί» ζει πλέον στο
 *    `lib/url-filters/enum-param` (δεύτερος καταναλωτής: η προβολή της «Διαθέσιμα Ακίνητα»).
 */
const LIST_MAP_VIEW = urlEnumParam<ListMapView>({
  param: LIST_MAP_VIEW_PARAM,
  values: LIST_MAP_VIEWS,
  fallback: 'list',
});

export const isListMapView = LIST_MAP_VIEW.is;

/** Ανάγνωση. Άγνωστη ή απούσα τιμή ⇒ `list`, ποτέ σφάλμα (ο σύνδεσμος μπορεί να είναι παλιός). */
export const parseListMapView = LIST_MAP_VIEW.parse;

/** Γραφή. Η προεπιλογή **σβήνει** το κλειδί: ένα URL, μία μορφή για την ίδια οθόνη. */
export const writeListMapView = LIST_MAP_VIEW.write;
