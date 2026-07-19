/**
 * material-color-registry — ADR-679 Φ2a (επέκταση ADR-539). SSoT «χρώμα (CSS hex) ενός
 * υλικού από το id του», ενοποιημένο για ΟΛΟΥΣ τους καταλόγους όψης: wall-covering
 * (ADR-511) + δάπεδα (ADR-419) + τα library υλικά του χρήστη (`bmat_*`, Firestore).
 *
 * **Γιατί registry κι όχι hardcoded if/else (full parity, ADR-679):** το per-face
 * appearance (ADR-539) έλυνε χρώμα ΜΟΝΟ για wall-covering ids (`getWallCoveringColor`).
 * Άρα μια όψη βαμμένη με υλικό δαπέδου ή με δικό σου library υλικό έβγαινε γκρι. Ο
 * extensible provider-registry κρατά το SSoT **ΕΝΑ**: προσθήκη καταλόγου = **ΕΝΑΣ**
 * provider, όχι αλλαγή σε 3 renderers/resolvers. Ο σοβάς (ADR-449) διαβάζει το ΙΔΙΟ.
 *
 * **Layering (γιατί registry & όχι απλό import):** οι στατικοί κατάλογοι (wall-covering/
 * floor-finish) είναι pure bim-layer → δηλώνονται εδώ κατευθείαν. Τα runtime library
 * υλικά (`bmat_*`) ζουν στο `bim-3d/materials/user-material-registry` (higher layer)·
 * αυτό δηλώνει τον provider του μέσω {@link registerMaterialColorProvider}, ώστε αυτό
 * το χαμηλό αρχείο να ΜΗΝ εξαρτάται ανοδικά από το bim-3d (καμία κυκλική εξάρτηση).
 *
 * **Εκτός εύρους (by design, όχι τεμπελιά):** ο procedural κατάλογος (`proc:<generator>`,
 * ADR-653) είναι 2D hatch generator — ΠΟΤΕ `FaceAppearance.materialId` — άρα δεν είναι
 * face-material provider. Αν ποτέ γίνει face-paintable, δηλώνεται κι αυτός με έναν provider.
 *
 * @see ../utils/face-appearance-color — ο καταναλωτής (3D painted material + 2D plan fill)
 * @see ../../bim-3d/materials/user-material-registry — δηλώνει τον `bmat_*` provider
 * @see docs/centralized-systems/reference/adrs/ADR-679-pbr-material-full-parity.md §4
 */

import { getWallCoveringMaterial } from '../wall-coverings/wall-covering-material-catalog';
import type { WallCoveringMaterialId } from '../types/wall-covering-types';
import { getFloorFinishMaterial } from '../floor-finishes/floor-finish-material-catalog';

/**
 * Λύνει το CSS hex ενός material id, ή `null` αν ο provider ΔΕΝ κατέχει αυτό το id
 * (→ δοκιμάζεται ο επόμενος). **Κρίσιμο:** επιστρέφει `null` (όχι fallback γκρι) για
 * ξένα ids — αλλιώς ο πρώτος provider θα «άρπαζε» κάθε id.
 */
export type MaterialColorProvider = (id: string) => string | null;

/** Οι μόνιμοι στατικοί providers (pure bim-layer). Restorable για test isolation. */
function staticProviders(): MaterialColorProvider[] {
  return [
    // Wall-covering (ADR-511) — getWallCoveringMaterial → undefined για ξένο id.
    (id) => getWallCoveringMaterial(id as WallCoveringMaterialId)?.color ?? null,
    // Floor-finish (ADR-419) — getFloorFinishMaterial → undefined για ξένο id.
    (id) => getFloorFinishMaterial(id)?.color ?? null,
  ];
}

let providers: MaterialColorProvider[] = staticProviders();

/**
 * Δηλώνει επιπλέον color provider (π.χ. runtime library `bmat_*` υλικά από το bim-3d
 * registry). Οι providers δοκιμάζονται με σειρά εγγραφής· ο **πρώτος non-null κερδίζει**.
 * Ο caller εγγυάται μία εγγραφή ανά provider (module-load side effect).
 */
export function registerMaterialColorProvider(provider: MaterialColorProvider): void {
  providers.push(provider);
}

/**
 * CSS hex (π.χ. `#C0392B`) ενός catalog/library material id, ή `null` αν κανένας
 * κατάλογος δεν το γνωρίζει (→ ο caller πέφτει στο base look της entity).
 */
export function getMaterialColorById(id: string): string | null {
  for (const provider of providers) {
    const hex = provider(id);
    if (hex !== null) return hex;
  }
  return null;
}

/** Test-only: επαναφορά μόνο στους στατικούς providers (μηδενίζει τις εγγραφές). */
export function __resetMaterialColorProvidersForTests(): void {
  providers = staticProviders();
}
