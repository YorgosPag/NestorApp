/**
 * **Τι δείχνει η λίστα κάτω από το πεδίο τόπου** — καθαρή συνάρτηση, χωρίς React (ADR-882).
 *
 * | Κείμενο στο πεδίο | Επιλογές |
 * |---|---|
 * | κενό | «Τρέχουσα τοποθεσία» · όλο το ιστορικό · «Καθαρισμός ιστορικού» *(αν υπάρχει ιστορικό)* |
 * | κάτι | οι αναζητήσεις του ιστορικού που **ταιριάζουν** · οι **διοικητικές περιοχές** που ταιριάζουν *(ADR-883)* |
 *
 * 🔑 **Οι περιοχές έρχονται ΜΕΤΑ το ιστορικό**: ό,τι έψαξε ο ίδιος ο άνθρωπος είναι η πιο
 * πιθανή του πρόθεση. Μια περιοχή δεν προτείνεται ποτέ **χωρίς** κείμενο — θα ήταν 7.432.
 *
 * 🔑 **Η «Τρέχουσα τοποθεσία» μόνο με κενό πεδίο** — όπως Zillow/Google Maps: μόλις ο
 * άνθρωπος γράψει, δήλωσε ότι ψάχνει **εκεί**, όχι «εδώ».
 *
 * 🔑 **Ο «Καθαρισμός» είναι ΕΠΙΛΟΓΗ, όχι κουμπί έξω από τη λίστα** — η εστίαση DOM μένει πάντα
 * στο πεδίο (APG «list autocomplete»), άρα κουμπί εκτός listbox θα ήταν απρόσιτο από
 * πληκτρολόγιο (WCAG 2.1.1). Ίδια απόφαση με την «Προσθήκη» του `searchable-combobox`
 * (ADR-841 §7 Α19.4δ).
 */

import {
  matchRecentPlaceSearches,
  type RecentPlaceSearch,
} from '@/lib/geo/recent-place-searches';
import { adminAreaLineage, searchAdminAreas, type AdminAreaIndex } from '@/lib/geo/admin-area-search';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';

export type PlaceRecallOption =
  | { readonly kind: 'current-location' }
  | { readonly kind: 'recent'; readonly place: RecentPlaceSearch }
  /** ADR-883 — διοικητική περιοχή με όριο· `within` = ο άμεσος γονέας, για να ξεχωρίζουν ομώνυμες. */
  | { readonly kind: 'area'; readonly area: AdminArea; readonly within: string | null }
  | { readonly kind: 'clear-history' };

/** Πόσες περιοχές προτείνονται — αρκετές για ομώνυμες σε άλλες βαθμίδες, όχι λίστα καταλόγου. */
const AREA_SUGGESTIONS = 5;

export function buildPlaceRecallOptions(
  query: string,
  history: readonly RecentPlaceSearch[],
  areas: AdminAreaIndex | null = null,
): readonly PlaceRecallOption[] {
  if (query.trim() !== '') {
    const recents: PlaceRecallOption[] = matchRecentPlaceSearches(history, query).map((place) => ({ kind: 'recent', place }));
    if (areas === null) return recents;
    const found = searchAdminAreas(areas, query, AREA_SUGGESTIONS).map(
      (area): PlaceRecallOption => ({ kind: 'area', area, within: adminAreaLineage(areas, area.id)[0]?.name ?? null }),
    );
    return [...recents, ...found];
  }
  const options: PlaceRecallOption[] = [{ kind: 'current-location' }];
  for (const place of history) options.push({ kind: 'recent', place });
  if (history.length > 0) options.push({ kind: 'clear-history' });
  return options;
}

/** Σταθερό κλειδί React ανά επιλογή — η ετικέτα είναι ήδη μοναδική στο ιστορικό. */
export function placeRecallOptionKey(option: PlaceRecallOption): string {
  if (option.kind === 'recent') return `recent:${option.place.label}`;
  if (option.kind === 'area') return `area:${option.area.id}`;
  return option.kind;
}
