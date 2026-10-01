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

/** Οι προβολές. Η `list` είναι η προεπιλογή και **δεν** γράφεται στο URL. */
export const LIST_MAP_VIEWS = ['list', 'map'] as const;
export type ListMapView = (typeof LIST_MAP_VIEWS)[number];

/** Το κλειδί του query string: το ίδιο όνομα που χρησιμοποιούν τα portals (`view=map`). */
export const LIST_MAP_VIEW_PARAM = 'view';

export function isListMapView(value: unknown): value is ListMapView {
  return typeof value === 'string' && (LIST_MAP_VIEWS as readonly string[]).includes(value);
}

/** Ανάγνωση. Άγνωστη ή απούσα τιμή ⇒ `list`, ποτέ σφάλμα (ο σύνδεσμος μπορεί να είναι παλιός). */
export function parseListMapView(params: URLSearchParams): ListMapView {
  const raw = params.get(LIST_MAP_VIEW_PARAM);
  return isListMapView(raw) ? raw : 'list';
}

/** Γραφή. Η προεπιλογή **σβήνει** το κλειδί: ένα URL, μία μορφή για την ίδια οθόνη. */
export function writeListMapView(view: ListMapView, params: URLSearchParams): void {
  if (view === 'list') params.delete(LIST_MAP_VIEW_PARAM);
  else params.set(LIST_MAP_VIEW_PARAM, view);
}
