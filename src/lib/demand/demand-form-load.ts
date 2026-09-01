/**
 * @fileoverview **ΖΗΤΗΣΗ → ΦΟΡΜΑ** — η αντίστροφη μετάφραση, για επεξεργασία.
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · lib/demand/demand-form-values.ts
 * @module lib/demand/demand-form-load
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — split κατά ΚΑΤΕΥΘΥΝΣΗ, όχι κούρεμα γραμμών
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `demand-form-values.ts` πέρασε τις **500 γραμμές** (N.7.1) όταν προστέθηκε η
 * **Ζ4 δομημένη** (`frontage`). Η μετάφραση έχει **δύο** κατευθύνσεις — «φόρμα → ζήτηση»
 * (πολλοί καταναλωτές: η υπηρεσία γραφής, η επικύρωση) και «ζήτηση → φόρμα» (**ένας**
 * καταναλωτής: η σελίδα επεξεργασίας και η δική της δοκιμή) — και το σπάσιμο
 * ακολουθεί **αυτήν** την ασυμμετρία, ίδιο ιδίωμα με το
 * `demand-match-vocabulary.ts` / `demand-match-axes.ts` / `demand-matching.ts`.
 *
 * ⚠️ **Δεν είναι δεύτερη αρχή.** Το `demandFormFrom` **διαβάζει** τις ίδιες σταθερές
 * ({@link FORM_PLACE_KINDS} · {@link DEFAULT_SEARCH_RADIUS_KM} ·
 * {@link DEFAULT_FRONTAGE_DEPTH_METRES}) από το `demand-form-values.ts` — δεν τις
 * ξαναδηλώνει. Η κενή φόρμα και οι προεπιλογές της παραμένουν **εκεί**, μοναδικές.
 *
 * **Layering**: leaf — τύποι + καθαρή συνάρτηση. Καμία εξάρτηση από React.
 */

import {
  DEFAULT_FRONTAGE_DEPTH_METRES,
  FORM_PLACE_KINDS,
} from './demand-form-values';
import { DEFAULT_SEARCH_RADIUS_KM } from '@/lib/listings/listing-filters';
import type { DemandFormValues } from './demand-form-values';
import type { DemandPlace, PropertyDemand } from '@/types/property-demand';

/**
 * Τι έγινε όταν ζητήθηκε να ανοίξει υπάρχουσα ζήτηση για επεξεργασία.
 *
 * 🔴 **Δύο ρητές καταστάσεις, ποτέ `DemandFormValues | null`.** Το `null` θα σήμαινε
 * ταυτόχρονα «δεν φορτώθηκε» και «δεν υποστηρίζεται εδώ» — δύο πράγματα με **εντελώς
 * διαφορετική** θεραπεία για τον άνθρωπο: το πρώτο του λέει να ξαναδοκιμάσει, το
 * δεύτερο ότι η ζήτησή του είναι **μια χαρά** αλλά αυτή η οθόνη δεν τη συντάσσει
 * ακόμη. Ίδιο ιδίωμα με το `PublicListingLookup`.
 */
export type DemandFormLoad =
  | { readonly kind: 'editable'; readonly values: DemandFormValues }
  | { readonly kind: 'place-not-editable'; readonly placeKind: DemandPlace['kind'] };

/** **Ζήτηση → φόρμα**, ή ονομασμένη άρνηση. */
export function demandFormFrom(demand: PropertyDemand): DemandFormLoad {
  if (!(FORM_PLACE_KINDS as readonly string[]).includes(demand.place.kind)) {
    return { kind: 'place-not-editable', placeKind: demand.place.kind };
  }

  const near = demand.place.kind === 'near' ? demand.place : null;
  const identified = demand.place.kind === 'place' ? demand.place : null;
  const drawn = demand.place.kind === 'area' ? demand.place : null;
  const frontage = demand.place.kind === 'frontage' ? demand.place : null;
  const window = demand.timing.kind === 'window' ? demand.timing : null;

  return {
    kind: 'editable',
    values: {
      seeks: [...demand.seeks],
      // ⚠️ **Η μορφή διαβάζεται από την οντότητα, όχι συνάγεται από το τι είναι
      // γεμάτο.** Ένα `near === null ? 'anywhere' : 'near'` ήταν σωστό όσο υπήρχαν
      // δύο μορφές· με πέντε θα έστελνε κάθε Ζ3/Ζ5, κάθε Ζ4 και κάθε μέτωπο πίσω ως
      // «οπουδήποτε» — δηλαδή θα **έσβηνε τον τόπο** κάθε φορά που κάποιος άνοιγε τη
      // ζήτησή του για επεξεργασία.
      placeKind: demand.place.kind,
      placeQuery: '',
      placeCenter: near?.center ?? null,
      radiusKm: near?.radiusKm ?? DEFAULT_SEARCH_RADIUS_KM,
      placeRef:
        identified === null
          ? null
          : { landId: identified.landId, buildingId: identified.buildingId },
      placeOutline: drawn === null ? null : drawn.outline.map((vertex) => ({ ...vertex })),
      frontageStreetName: frontage?.streetName ?? '',
      frontageAxis: frontage === null ? null : frontage.axis.map((vertex) => ({ ...vertex })),
      frontageSide: frontage?.side ?? 'both',
      frontageDepthMetres: frontage?.depthMetres ?? DEFAULT_FRONTAGE_DEPTH_METRES,
      timingKind: demand.timing.kind,
      fromDate: window?.fromDate ?? '',
      toDate: window?.toDate ?? '',
      types: [...demand.features.types],
      priceMin: demand.features.priceMin,
      priceMax: demand.features.priceMax,
      areaMin: demand.features.areaMin,
      areaMax: demand.features.areaMax,
      bedroomsMin: demand.features.bedroomsMin,
      floorMin: demand.features.floorMin,
      floorMax: demand.features.floorMax,
      proximity: demand.proximity.map((p) => ({ ...p })),
      lifeContext: demand.lifeContext,
    },
  };
}
