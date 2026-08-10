/**
 * ADR-782 §24 — το σύνορο ανάμεσα στο **έγγραφο** έργου (ΜΕΤΡΑ) και το **runtime**
 * {@link GeoReference} (canonical mm) για τη χειροκίνητη τοποθέτηση υποβάθρου.
 *
 * Δίδυμο του `geo-referencing/geo-reference-schema.ts`, με τον **ίδιο** ρόλο: εδώ, και **μόνο**
 * εδώ, γίνεται η μετατροπή μονάδων. Το I/O δεν μετατρέπει τίποτα και τα μαθηματικά μένουν σε mm.
 *
 * ⚠️ **Γιατί καθαρό module και όχι δύο γραμμές μέσα στο I/O**: η μετατροπή είναι το σημείο όπου
 * ένα σφάλμα κοστίζει 1000× και **δεν φαίνεται σε καμία οθόνη** — ο χάρτης απλώς κάθεται κάπου
 * αλλού. Καθαρή συνάρτηση σημαίνει ότι ο κύκλος έγγραφο → runtime → έγγραφο ελέγχεται με άγκυρα,
 * χωρίς ψεύτικη βάση δεδομένων.
 *
 * ⚠️ **Η ανάγνωση είναι αμυντική επίτηδες**: ένα παλιό, μισογραμμένο ή κατεστραμμένο έγγραφο
 * επιστρέφει `null` («κανείς δεν τοποθέτησε τίποτα») αντί να ρίξει τον viewer. Η **αυστηρή**
 * επικύρωση ζει στην **εγγραφή** (`ProjectBasemapPlacementSchema` στο `ProjectUpdateSchema`) —
 * εκεί έχει νόημα, γιατί εκεί μπορεί ακόμη να μην προσγειωθεί η κακή τιμή.
 *
 * @see @/types/project-basemap-placement.schemas — το σχήμα του εγγράφου (Zod, μέτρα)
 * @see ./basemap-placement-store.ts — το runtime store (mm)
 */

import type { ProjectBasemapPlacement } from '@/types/project-basemap-placement.schemas';
import type { GeoReference } from '../geo-referencing/geo-transform';

/** ADR-462 canonical-mm — γεωμετρία γραμμένη σε μέτρα ψήνεται ×1000. */
const M_TO_MM = 1000;
const MM_TO_M = 0.001;

/** Τα πεδία υποβάθρου όπως ζουν στο έγγραφο έργου. */
export interface ProjectBasemapPlacementFields {
  readonly basemapPlacement?: ProjectBasemapPlacement | null;
}

/** `true` όταν η τιμή είναι πεπερασμένος αριθμός — ό,τι δεν είναι, δεν είναι θέση. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Το runtime {@link GeoReference} (mm) από τα πεδία του εγγράφου (μέτρα).
 *
 * `null` σημαίνει «ο χρήστης δεν έχει τοποθετήσει τίποτα με το χέρι» — **όχι** «τοποθέτησε στο
 * μηδέν». Η διάκριση είναι ορατή στην οθόνη: με `null` ο χάρτης ακολουθεί τη διεύθυνση.
 */
export function basemapPlacementFromProject(
  fields: ProjectBasemapPlacementFields | null | undefined,
): GeoReference | null {
  const field = fields?.basemapPlacement;
  if (!field) return null;
  if (!isFiniteNumber(field.eastingM) || !isFiniteNumber(field.northingM)) return null;
  const rotationDeg = isFiniteNumber(field.rotationDeg) ? field.rotationDeg : 0;
  return {
    originWorld: { x: field.eastingM * M_TO_MM, y: field.northingM * M_TO_MM },
    rotationDeg,
  };
}

/**
 * Το πεδίο του εγγράφου (μέτρα) από ένα runtime {@link GeoReference} (mm).
 *
 * ⚠️ Δεν δέχεται `null`: το «δεν υπάρχει τοποθέτηση» **δεν είναι σχήμα**, είναι απουσία πεδίου —
 * και το εκφράζει ο καλών γράφοντας `null` στο έγγραφο. Μια συνάρτηση που επέστρεφε
 * «`ProjectBasemapPlacement` ή `null`» θα έδινε δύο νοήματα σε έναν τύπο επιστροφής.
 */
export function basemapPlacementToProject(geo: GeoReference): ProjectBasemapPlacement {
  return {
    eastingM: geo.originWorld.x * MM_TO_M,
    northingM: geo.originWorld.y * MM_TO_M,
    rotationDeg: geo.rotationDeg,
  };
}
