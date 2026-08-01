/**
 * =============================================================================
 * ΟΙ ΠΕΝΤΕ ΕΠΙΦΑΝΕΙΕΣ SHOWCASE — μία δήλωση, όχι πέντε αλυσίδες `?:`
 * =============================================================================
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ (μετρημένο 2026-08-01, ADR-742 §7quaterdecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ίδια γνώση — *«ποιες είναι οι επιφάνειες showcase, πώς λέγεται το id της
 * καθεμιάς, ποια έχει PDF, ποιο route δέχεται το email της»* — ήταν γραμμένη
 * **τέσσερις φορές**, όλες ως χειρόγραφη αλυσίδα τριαδικών:
 *
 * | Πού | Τι χαρτογραφούσε |
 * |---|---|
 * | `UnifiedShareDialog` × 1 | `entityType` → `showcaseContext` (5 κλάδοι) |
 * | `UnifiedShareDialog` × 2 | «έχει PDF;» (ιδιότητα μέλους 3 όρων) |
 * | `UnifiedShareDialog` × 3 | `entityType` → διαδρομή PDF (3 κλάδοι) |
 * | `UserAuthPermissionPanel` | `showcaseContext.type` → διαδρομή email (5 κλάδοι) |
 *
 * 🔴 **Ο κίνδυνος δεν είναι οι γραμμές — είναι η ΣΙΩΠΗΛΗ ΠΑΡΑΛΕΙΨΗ.** Κάθε
 * αλυσίδα τελειώνει σε `else`, οπότε **νέα** επιφάνεια δεν γεννά σφάλμα
 * μεταγλώττισης· γλιστράει στον τελευταίο κλάδο και στέλνει τον χρήστη στο
 * **λάθος** route. Ήδη είχε αποκλίνει: οι κλάδοι PDF ήταν **τρεις** ενώ οι
 * κλάδοι context **πέντε** — σωστό σήμερα (storage/parking δεν έχουν γεννήτρια
 * PDF, ADR-315 `requiresPdfPath: false`), αλλά **κατά σύμπτωση**, όχι κατά
 * δήλωση: τίποτα δεν συνέδεε τα δύο.
 *
 * Εδώ η απουσία PDF είναι **δεδομένο** (`pdfRoutePrefix: null`) και το
 * `exhaustive` δίχτυ του TypeScript πάνω στο `ShowcaseShareEntityType` κάνει τη
 * νέα επιφάνεια **σφάλμα μεταγλώττισης**, όχι λάθος σύνδεσμο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΕΝΟΠΟΙΕΙΤΑΙ ΜΕ ΤΟΝ ΠΙΝΑΚΑ ΤΩΝ RESOLVERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `showcase-surfaces.resolvers.ts` περιγράφει την **ανάγνωση από τη βάση**
 * (συλλογή, πεδία τίτλου) και εισάγει `COLLECTIONS` + Admin SDK ⇒ είναι
 * **server-only**. Αυτό εδώ περιγράφει την **πλοήγηση του πελάτη** και φορτώνεται
 * σε client bundle. Η ένωσή τους θα έσερνε το Admin SDK στον browser.
 *
 * ⚠️ **Καθαρό module**: μόνο εισαγωγές **τύπων**. Καμία εξάρτηση χρόνου
 * εκτέλεσης — αν αποκτήσει μία, το `UnifiedShareDialog` θα την πληρώσει.
 *
 * @module services/sharing/showcase-surfaces
 * @see adrs/ADR-742 §7quaterdecies · ADR-315 (registry) · ADR-698 (public routes)
 */

import type { ShareEntityType } from '@/types/sharing';

/** Οι τύποι share που **είναι** επιφάνεια showcase — υποσύνολο του `ShareEntityType`. */
export type ShowcaseShareEntityType = Extract<ShareEntityType, `${string}_showcase`>;

/**
 * Το διακριτό «είδος» της επιφάνειας, όπως το ονομάζει το `showcaseContext`
 * του `UserAuthPermissionPanel`. Ξεχωριστό από το `ShowcaseShareEntityType`
 * επειδή είναι **δημόσιο συμβόλαιο prop** — αλλαγή του θα ήταν αλλαγή API.
 */
export type ShowcaseSurfaceKind =
  | 'property'
  | 'project'
  | 'building'
  | 'storage'
  | 'parking';

/** Το σχήμα `showcaseContext` που δέχεται το `UserAuthPermissionPanel`. */
export type ShowcaseContext =
  | { type: 'property'; propertyId: string }
  | { type: 'project'; projectId: string }
  | { type: 'building'; buildingId: string }
  | { type: 'storage'; storageId: string }
  | { type: 'parking'; parkingId: string };

export interface ShowcaseSurface {
  readonly entityType: ShowcaseShareEntityType;
  readonly kind: ShowcaseSurfaceKind;
  /** Το όνομα του πεδίου id μέσα στο {@link ShowcaseContext}. */
  readonly contextIdKey: `${ShowcaseSurfaceKind}Id`;
  /**
   * Πρόθεμα της δημόσιας διαδρομής PDF, ή `null` όταν η επιφάνεια **δεν έχει**
   * γεννήτρια PDF (ADR-315: storage/parking, `requiresPdfPath: false`).
   *
   * ⚠️ Το ακίνητο κρατά το **ιστορικό** `/api/showcase` — δεν είναι παράλειψη:
   * είναι η αρχική διαδρομή του ADR-312, ζωντανό συμβόλαιο σε μοιρασμένους
   * συνδέσμους που κυκλοφορούν ήδη.
   */
  readonly pdfRoutePrefix: string | null;
  /** Βάση της διαδρομής αποστολής email (`{base}/{id}/showcase/email`). */
  readonly emailRouteBase: string;
}

/**
 * 🔑 **Η μοναδική δήλωση.** Η σειρά δεν έχει σημασία· η **πληρότητα** έχει, και
 * την επιβάλλει το `Record<ShowcaseShareEntityType, …>`: νέα τιμή στο
 * `ShareEntityType` που τελειώνει σε `_showcase` **σπάει τη μεταγλώττιση εδώ**.
 */
export const SHOWCASE_SURFACES: Readonly<Record<ShowcaseShareEntityType, ShowcaseSurface>> = {
  property_showcase: {
    entityType: 'property_showcase',
    kind: 'property',
    contextIdKey: 'propertyId',
    pdfRoutePrefix: '/api/showcase',
    emailRouteBase: '/api/properties',
  },
  project_showcase: {
    entityType: 'project_showcase',
    kind: 'project',
    contextIdKey: 'projectId',
    pdfRoutePrefix: '/api/project-showcase',
    emailRouteBase: '/api/projects',
  },
  building_showcase: {
    entityType: 'building_showcase',
    kind: 'building',
    contextIdKey: 'buildingId',
    pdfRoutePrefix: '/api/building-showcase',
    emailRouteBase: '/api/buildings',
  },
  storage_showcase: {
    entityType: 'storage_showcase',
    kind: 'storage',
    contextIdKey: 'storageId',
    pdfRoutePrefix: null,
    emailRouteBase: '/api/storages',
  },
  parking_showcase: {
    entityType: 'parking_showcase',
    kind: 'parking',
    contextIdKey: 'parkingId',
    pdfRoutePrefix: null,
    emailRouteBase: '/api/parking',
  },
};

/** Ο πίνακας ανά «είδος» — η ίδια εγγραφή, άλλο κλειδί. Καμία δεύτερη αλήθεια. */
const BY_KIND: Readonly<Record<ShowcaseSurfaceKind, ShowcaseSurface>> = Object.values(
  SHOWCASE_SURFACES,
).reduce(
  (acc, surface) => ({ ...acc, [surface.kind]: surface }),
  {} as Record<ShowcaseSurfaceKind, ShowcaseSurface>,
);

/**
 * Η επιφάνεια για έναν **οποιονδήποτε** τύπο share, ή `null` για όσους δεν
 * είναι showcase (`file`, `contact`, `vendor_rfq_invite`).
 */
export function findShowcaseSurface(entityType: ShareEntityType): ShowcaseSurface | null {
  return SHOWCASE_SURFACES[entityType as ShowcaseShareEntityType] ?? null;
}

/**
 * Το `showcaseContext` της επιφάνειας, ή `undefined` αν ο τύπος δεν είναι
 * showcase. Η **μία** κατασκευή του σχήματος με το ανά-είδος κλειδί id.
 */
export function buildShowcaseContext(
  entityType: ShareEntityType,
  entityId: string,
): ShowcaseContext | undefined {
  const surface = findShowcaseSurface(entityType);
  if (surface === null) return undefined;
  return { type: surface.kind, [surface.contextIdKey]: entityId } as ShowcaseContext;
}

/**
 * Ο δημόσιος σύνδεσμος PDF, ή `null` όταν η επιφάνεια **δεν έχει** PDF.
 *
 * 🔑 «Δεν έχει PDF» και «δεν είναι showcase» επιστρέφουν το ίδιο `null`
 * **επίτηδες**: ο μοναδικός καλών ρωτά *«να δείξω το κουμπί;»*, και η απάντηση
 * είναι όχι και στις δύο περιπτώσεις. Ξεχωριστές τιμές θα υποχρέωναν τον
 * καλούντα σε δεύτερο έλεγχο που δεν έχει τι να τον κάνει.
 */
export function showcasePdfHref(entityType: ShareEntityType, token: string): string | null {
  const surface = findShowcaseSurface(entityType);
  if (surface === null || surface.pdfRoutePrefix === null) return null;
  return `${surface.pdfRoutePrefix}/${encodeURIComponent(token)}/pdf`;
}

/** Η διαδρομή αποστολής email της επιφάνειας — η **μία** σύνθεσή της. */
export function showcaseEmailEndpoint(context: ShowcaseContext): string {
  const surface = BY_KIND[context.type];
  const entityId = (context as Record<string, string>)[surface.contextIdKey];
  return `${surface.emailRouteBase}/${encodeURIComponent(entityId)}/showcase/email`;
}
