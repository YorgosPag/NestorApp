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
 * 🔑 **Μια περιοχή του ιστορικού ΔΕΝ ξαναπροτείνεται** από κάτω (ADR-882 §3.7): ο ίδιος τόπος σε
 * δύο ομάδες θα ήταν θόρυβος — μένει εκεί που έχει προτεραιότητα, στο ιστορικό. Και μια περιοχή
 * του ιστορικού που το ευρετήριο **δεν έχει πια** (καταργήθηκε) **δεν δείχνεται**: θα ήταν
 * υπόσχεση για όριο που δεν υπάρχει.
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
  recentPlaceKey,
  type RecentPlaceSearch,
} from '@/lib/geo/recent-place-searches';
import { adminAreaLineage, searchAdminAreas, type AdminAreaIndex } from '@/lib/geo/admin-area-search';
import { SETTLEMENT_LEVEL, type AdminArea } from '@/lib/geo/admin-area-index-file';

export type PlaceRecallOption =
  | { readonly kind: 'current-location' }
  /**
   * `area` + `within` = για αναζήτηση **περιοχής** (§3.7), λυμένη από το ευρετήριο — ίδια γραμμή
   * γενεαλογίας με τις προτάσεις, ώστε οι ομώνυμες να ξεχωρίζουν και στο ιστορικό.
   */
  | {
      readonly kind: 'recent';
      readonly place: RecentPlaceSearch;
      readonly area: AdminArea | null;
      readonly within: string | null;
    }
  /**
   * ADR-883 — διοικητική περιοχή με όριο (ή οικισμός, §5.10)· `within` = ο άμεσος γονέας, για να
   * ξεχωρίζουν ομώνυμες — για οικισμό **και ο δήμος**: υπάρχουν δεκάδες «Καλοχώρι».
   */
  | { readonly kind: 'area'; readonly area: AdminArea; readonly within: string | null }
  | { readonly kind: 'clear-history' };

/** Η βαθμίδα του δήμου — ο τόπος που αναγνωρίζει ο κόσμος πάνω από ένα χωριό. */
const MUNICIPALITY_LEVEL = 5;

function withinOf(areas: AdminAreaIndex, area: AdminArea): string | null {
  const lineage = adminAreaLineage(areas, area.id);
  if (area.level !== SETTLEMENT_LEVEL) return lineage[0]?.name ?? null;
  const shown = [lineage[0], lineage.find((ancestor) => ancestor.level === MUNICIPALITY_LEVEL)]
    .filter((ancestor): ancestor is AdminArea => ancestor !== undefined);
  const names = [...new Set(shown.map((ancestor) => ancestor.name))];
  return names.length === 0 ? null : names.join(' · ');
}

/** Πόσες περιοχές προτείνονται — αρκετές για ομώνυμες σε άλλες βαθμίδες, όχι λίστα καταλόγου. */
const AREA_SUGGESTIONS = 5;

/** Η εγγραφή του ιστορικού ως επιλογή — ή `null` όταν η περιοχή της **δεν υπάρχει πια**. */
function recentOption(place: RecentPlaceSearch, areas: AdminAreaIndex | null): PlaceRecallOption | null {
  if (place.kind !== 'area' || areas === null) return { kind: 'recent', place, area: null, within: null };
  const area = areas.areas.get(place.areaId);
  if (area === undefined) return null;
  return { kind: 'recent', place, area, within: withinOf(areas, area) };
}

function recentOptions(history: readonly RecentPlaceSearch[], areas: AdminAreaIndex | null): PlaceRecallOption[] {
  return history
    .map((place) => recentOption(place, areas))
    .filter((option): option is PlaceRecallOption => option !== null);
}

export function buildPlaceRecallOptions(
  query: string,
  history: readonly RecentPlaceSearch[],
  areas: AdminAreaIndex | null = null,
): readonly PlaceRecallOption[] {
  if (query.trim() !== '') {
    const matched = matchRecentPlaceSearches(history, query);
    const recents = recentOptions(matched, areas);
    if (areas === null) return recents;
    const remembered = new Set(matched.flatMap((place) => (place.kind === 'area' ? [place.areaId] : [])));
    const found = searchAdminAreas(areas, query, AREA_SUGGESTIONS)
      .filter((area) => !remembered.has(area.id))
      .map((area): PlaceRecallOption => ({ kind: 'area', area, within: withinOf(areas, area) }));
    return [...recents, ...found];
  }
  const options: PlaceRecallOption[] = [{ kind: 'current-location' }, ...recentOptions(history, areas)];
  if (history.length > 0) options.push({ kind: 'clear-history' });
  return options;
}

/** Σταθερό κλειδί React ανά επιλογή — η ταυτότητα (`recentPlaceKey`) είναι μοναδική στο ιστορικό. */
export function placeRecallOptionKey(option: PlaceRecallOption): string {
  if (option.kind === 'recent') return `recent:${recentPlaceKey(option.place)}`;
  if (option.kind === 'area') return `area:${option.area.id}`;
  return option.kind;
}
