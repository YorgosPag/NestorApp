/**
 * @fileoverview **ΠΟΙΕΣ ΟΝΟΜΑΣΜΕΝΕΣ ΠΕΡΙΟΧΕΣ ΕΞΥΠΗΡΕΤΕΙ ΜΙΑ ΑΚΤΙΝΑ Ή ΕΝΑ ΧΑΡΑΓΜΕΝΟ ΠΕΡΙΓΡΑΜΜΑ** (ADR-923 Ν11 ε · §22 Υ8).
 * @related `coverage-geometry.ts` (`coverageOutline`) · `lib/geo/geo-region-contact.ts` (ο κριτής επαφής) · ADR-883 (τα όρια)
 * @module lib/agency/coverage-served-areas
 *
 * 🏆 **Πρότυπο: Google Business Profile, service-area business** — έως **20** ονομασμένες περιοχές, ποτέ ακτίνα. Η δημόσια
 *    δήλωση (σελίδα και `areaServed`) λέει **ονόματα**, γιατί η ακτίνα θα έδινε το κέντρο, που μπορεί να είναι η κατοικία
 *    (ADR-923 §5.13 Ε2). Ούτε το χαραγμένο πολύγωνο δημοσιεύεται: η μορφή του λέει περισσότερα απ' όσα δήλωσε ο άνθρωπος.
 * 🔑 **Η λεπτότερη βαθμίδα που χωρά.** Δήμοι που αγγίζει το σχήμα· αν είναι πάνω από 20, οι Περιφερειακές Ενότητες τους· αν
 *    κι αυτές, οι Περιφέρειες. Ποτέ αποκοπή στα 20: μια κομμένη λίστα θα έλεγε σιωπηλά «όχι» σε περιοχές που εξυπηρετούνται.
 * 🔑 **«Αγγίζει» = αποδεδειγμένη επαφή** (`outlineTouchesRegion`). Δήμος που καλύπτεται εν μέρει **εξυπηρετείται** εν μέρει,
 *    όπως ακριβώς τον δέχεται και το GBP.
 * ⚠️ **Όριο που δεν διαβάστηκε ⇒ η βαθμίδα δεν αποφασίζεται**, και μένει η αμέσως χονδρότερη. Μια λίστα δήμων με κενό στη
 *    μέση θα ήταν ψευδώς πλήρης· μια σωστή λίστα Π.Ε. είναι απλώς χονδρότερη.
 *
 * **Layering**: καθαρό· τα όρια μπαίνουν με ένεση. Καλείται από τον αναγνώστη της βιτρίνας, ποτέ από σελίδα.
 */

import type { AdminAreaDeclarationSources } from '@/lib/geo/admin-area-declaration';
import { ADMIN_AREA_ROOT_KEY, ADMIN_LEVEL, type AdminArea } from '@/lib/geo/admin-area-index-file';
import { outlineTouchesRegion } from '@/lib/geo/geo-region-contact';
import type { GeoOutline } from '@/types/geo/coordinates';

/** Το όριο του Google Business Profile για ονομασμένες περιοχές εξυπηρέτησης. */
export const SERVED_AREA_LIMIT = 20;

/** Από τη χονδρότερη στη λεπτότερη. Κάτω από τον δήμο το όνομα δεν το αναγνωρίζει ούτε ο άνθρωπος ούτε η μηχανή. */
const SERVED_LEVELS = [ADMIN_LEVEL.region, ADMIN_LEVEL.regionalUnit, ADMIN_LEVEL.municipality] as const;

export type ServedAreaSources = Pick<AdminAreaDeclarationSources, 'childrenOf' | 'regionOf'>;

/** Όσες από τις υποψήφιες αγγίζει το σχήμα — ή `null` όταν έστω ένα όριο δεν διαβάστηκε. */
async function touchedAmong(
  candidates: readonly AdminArea[],
  outline: GeoOutline,
  regionOf: ServedAreaSources['regionOf'],
): Promise<readonly AdminArea[] | null> {
  const verdicts = await Promise.all(candidates.map(async (area) => {
    const region = await regionOf(area.id);
    return region === null ? null : outlineTouchesRegion(outline, region);
  }));
  if (verdicts.includes(null)) return null;
  return candidates.filter((_, index) => verdicts[index] === true);
}

/**
 * Οι περιοχές που εξυπηρετεί το περίγραμμα, στη λεπτότερη βαθμίδα με έως `limit` ονόματα, με τη σειρά του ευρετηρίου.
 * Κενή λίστα ⇒ καμία αποδεδειγμένη περιοχή (σχήμα στη θάλασσα ή εκτός χώρας), και τότε η δήλωση δεν λέει τίποτα.
 */
export async function servedAdminAreas(
  outline: GeoOutline,
  sources: ServedAreaSources,
  limit: number = SERVED_AREA_LIMIT,
): Promise<readonly AdminArea[]> {
  let served: readonly AdminArea[] = [];
  let candidates = sources.childrenOf(ADMIN_AREA_ROOT_KEY);
  for (const level of SERVED_LEVELS) {
    const touched = await touchedAmong(candidates.filter((area) => area.level === level), outline, sources.regionOf);
    if (touched === null || touched.length === 0 || touched.length > limit) return served;
    served = touched;
    candidates = touched.flatMap((area) => sources.childrenOf(area.id));
  }
  return served;
}
