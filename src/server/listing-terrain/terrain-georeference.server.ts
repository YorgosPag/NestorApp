import 'server-only';

/**
 * @fileoverview 📍 **ΤΟ ΣΚΕΛΟΣ ΓΕΩΑΝΑΦΟΡΑΣ ΤΗΣ ΠΟΡΤΑΣ ΕΔΑΦΟΥΣ** — δήλωση συστήματος και συγκατάθεση θέσης (ADR-920 §14.12 φάση Α).
 * @related app/api/owner-properties/[ownerPropertyId]/terrain/route (`PATCH` · `GET ?view=georeference`, η πόρτα) ·
 *   lib/terrain/publication/terrain-georeference-declaration (το συμβόλαιο + ο ΕΝΑΣ κριτής της δήλωσης) ·
 *   ./plot-outline-confirmation.server (το αδελφό σκέλος: ίδιος κινητήρας, ίδια ταυτοδυναμία)
 * @module server/listing-terrain/terrain-georeference.server
 *
 * ```
 * [πόρτα: κηδεμονία + φάκελος, ΗΔΗ κριμένα] → τρέχουσα πηγή του φακέλου + η θέση που δηλώνει η αγγελία
 *   → δήλωση ΕΓΣΑ'87: περιοχή χρήσης + διασταύρωση με τη θέση της αγγελίας ─┐   όλα ΠΡΙΝ από κάθε εγγραφή
 *   → ο ΕΝΑΣ γραφέας του πεδίου → ο ΕΝΑΣ κριτής → επαναδημοσίευση από τον ΕΝΑ κινητήρα (νέα πηγή · διαδοχή · ΕΠΑΝΑΠΡΟΒΟΛΗ)
 * ```
 *
 * 🔑 **Η διασταύρωση ζει ΕΔΩ, όχι στο ράφι**: ο ψήστης βλέπει μόνο τα bytes της πηγής, και το κλειδί του δεν ξέρει θέση
 *    αγγελίας. Στο ψήσιμο ξανακρίνεται ό,τι κρίνεται από την ίδια την πηγή (περιοχή χρήσης). ⚠️ Γνωστό όριο: αν ο ιδιοκτήτης
 *    αλλάξει αργότερα τη διεύθυνση, η γεωαναφορά **δεν** ξανακρίνεται — η μετρημένη θέση είναι ούτως ή άλλως η ισχυρότερη
 *    πηγή (`survey` > `geocoded`, `location-provenance.ts`).
 * 🔑 **Νέο ανάγλυφο μεταφέρει τη δήλωση** (Revit · Civil 3D: το σύστημα είναι ιδιότητα του μοντέλου), αλλά την **ξανακρίνει**
 *    πάνω στα νέα σημεία ({@link carriedOwnerGeoreference}) — δήλωση που δεν στέκει πια γίνεται «αδήλωτη», ποτέ σιωπηλή θέση.
 * 🔑 **Ταυτοδύναμο**: ίδια bytes πηγής ⇒ τίποτα δεν γράφεται (η κανονική σειριοποίηση είναι η ΜΙΑ σύγκριση).
 */

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { nowISO } from '@/lib/date-local';
import { GREEK_GRID_CRS } from '@/lib/geo/greek-grid';
import { placeKnowledgeFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import {
  NO_TERRAIN_GEOREFERENCE_CHOICE,
  encodeListingTerrainSource,
  withCoordinateSystem,
  withLocationConsent,
  type ListingTerrainSource,
  type TerrainGeoreferenceChoice,
} from '@/lib/terrain/publication/listing-terrain-source';
import {
  readAsGreekGrid,
  refusalOfGreekGridReading,
  terrainGeoreferenceStatusOf,
  type TerrainGeoreferenceAmendment,
  type TerrainGeoreferenceStatus,
} from '@/lib/terrain/publication/terrain-georeference-declaration';
import {
  republishOwnerMaterial,
  type OwnerMaterialDoorEnv,
  type OwnerMaterialPublicationDoor,
} from '@/server/listing-material/publish-owner-property-material';
import { resolveListingPosition } from '@/services/listings/public-listing-position';
import type { OwnerProperty } from '@/types/owner-property';
import type { ListingPosition } from '@/types/public-listing';

import { loadCurrentDossierTerrainSource, type CurrentDossierTerrainSource } from './dossier-terrain.reader';
import {
  terrainResponseOf,
  terrainUploadOfSource,
  type TerrainPublicationResponse,
  type TerrainUpload,
} from './terrain-upload.server';

const UNREADABLE_SOURCE = 'TERRAIN_CURRENT_SOURCE_UNREADABLE';

/**
 * **Η θέση που δηλώνει η αγγελία ΣΗΜΕΡΑ** — από τον ΙΔΙΟ δρόμο με τη δημόσια προβολή (`placeKnowledgeFromOwnerProperty` →
 * `resolveListingPosition`), ώστε η διασταύρωση να κρίνει απέναντι σε ό,τι βλέπει ο κόσμος, όχι σε δεύτερη ανάγνωση.
 */
function listingPositionOf(property: Pick<OwnerProperty, 'place'>): ListingPosition {
  const knowledge = placeKnowledgeFromOwnerProperty(property, nowISO());
  return resolveListingPosition(knowledge, property.place.kind === 'declined' ? 'declined' : null);
}

/** Ό,τι μαθαίνει ο άνθρωπος από μια αλλαγή — `changed: false` = ήδη ίσχυε, τίποτα δεν γράφτηκε. */
export interface TerrainGeoreferenceAmendmentResponse {
  readonly changed: boolean;
  readonly georeference: TerrainGeoreferenceChoice;
  readonly terrain: TerrainPublicationResponse | null;
}

/** Η δήλωση ΕΓΣΑ'87 κριμένη από τον ΕΝΑ κριτή — ή ονομασμένη άρνηση, πριν από κάθε εγγραφή. */
function assertGreekGridHolds(source: ListingTerrainSource, property: Pick<OwnerProperty, 'place'>): void {
  const reading = readAsGreekGrid(source, listingPositionOf(property));
  if (reading === null) throw new ApiError(503, UNREADABLE_SOURCE);
  const refusal = refusalOfGreekGridReading(reading);
  if (refusal !== null) throw new ApiError(422, refusal);
}

/** Η πηγή μετά την αλλαγή, από τον ΕΝΑΝ γραφέα του πεδίου της — οι άρνησεις κρίνονται εδώ, πριν γραφτεί οτιδήποτε. */
function amendedSource(
  current: ListingTerrainSource,
  amendment: TerrainGeoreferenceAmendment,
  property: Pick<OwnerProperty, 'place'>,
): ListingTerrainSource {
  if (amendment.kind === 'location-visibility') {
    // Συγκατάθεση χωρίς δηλωμένο ΕΓΣΑ'87: δεν υπάρχει θέση να φανεί. Η άρση της επιτρέπεται πάντα.
    if (amendment.showInListing && current.coordinateSystem !== GREEK_GRID_CRS.name) {
      throw new ApiError(409, 'TERRAIN_GEOREFERENCE_NOT_DECLARED');
    }
    return orUnreadable(withLocationConsent(current, amendment.showInListing));
  }
  if (amendment.system === GREEK_GRID_CRS.name) assertGreekGridHolds(current, property);
  // «Τοπικές συντεταγμένες» ⇒ καμία θέση ⇒ καμία συγκατάθεση που να κρέμεται από αυτήν.
  const declared = orUnreadable(withCoordinateSystem(current, amendment.system));
  return amendment.system === GREEK_GRID_CRS.name ? declared : orUnreadable(withLocationConsent(declared, false));
}

function orUnreadable(source: ListingTerrainSource | null): ListingTerrainSource {
  if (source === null) throw new ApiError(503, UNREADABLE_SOURCE);
  return source;
}

function choiceOf(source: ListingTerrainSource): TerrainGeoreferenceChoice {
  return { coordinateSystem: source.coordinateSystem, showLocationInListing: source.showLocationInListing };
}

function uploadOf(current: CurrentDossierTerrainSource, source: ListingTerrainSource): TerrainUpload {
  return terrainUploadOfSource({ source, declaration: current.declaration, fileName: 'terrain-source.json', sceneFileIds: [] });
}

/**
 * 🏆 **ΔΗΛΩΣΗ ΣΥΣΤΗΜΑΤΟΣ / ΣΥΓΚΑΤΑΘΕΣΗ ΘΕΣΗΣ** (`PATCH`). Ο φάκελος είναι ήδη κριμένος από την πόρτα (`enterOwnerDoor`).
 *
 * ⛔ Χωρίς ανάγλυφο ⇒ 409: δεν υπάρχουν συντεταγμένες να δηλωθούν.
 */
export async function amendOwnerTerrainGeoreference(
  env: OwnerMaterialDoorEnv,
  amendment: TerrainGeoreferenceAmendment,
  terrainDoor: OwnerMaterialPublicationDoor<TerrainUpload>,
): Promise<TerrainGeoreferenceAmendmentResponse> {
  const current = await loadCurrentDossierTerrainSource(env.adminDb, env.dossier);
  if (current === null) throw new ApiError(409, 'TERRAIN_GEOREFERENCE_NO_RELIEF');

  const next = amendedSource(current.source, amendment, env.property);
  if (encodeListingTerrainSource(next) === encodeListingTerrainSource(current.source)) {
    return { changed: false, georeference: choiceOf(next), terrain: null };
  }
  const published = await republishOwnerMaterial(env, terrainDoor, uploadOf(current, next));
  return { changed: true, georeference: choiceOf(next), terrain: terrainResponseOf(published) };
}

/**
 * **Ό,τι δείχνει η κάρτα του ιδιοκτήτη** (`GET ?view=georeference`) — `null` όταν δεν δημοσιεύτηκε ποτέ ανάγλυφο. Μόνο
 * ανάγνωση. Fail-closed: πηγή που ο κριτής αρνείται ⇒ 503 με όνομα, ποτέ «καμία γεωαναφορά».
 */
export async function loadOwnerTerrainGeoreferenceStatus(env: OwnerMaterialDoorEnv): Promise<TerrainGeoreferenceStatus | null> {
  const current = await loadCurrentDossierTerrainSource(env.adminDb, env.dossier);
  if (current === null) return null;
  const status = terrainGeoreferenceStatusOf(current.source, listingPositionOf(env.property));
  if (status === null) throw new ApiError(503, UNREADABLE_SOURCE);
  return status;
}

/**
 * **Τι ισχύει για τα ΝΕΑ σημεία** (δημοσίευση ισοϋψών): η δήλωση ΕΓΣΑ'87 και η συγκατάθεση μεταφέρονται **μόνο αν η δήλωση
 * στέκει και για τα νέα σημεία** (ίδιος κριτής με τη δήλωση). Αλλιώς η νέα πηγή γράφεται «αδήλωτη» **και χωρίς συγκατάθεση**:
 * η συγκατάθεση αφορούσε μια θέση που δεν ισχύει πια. Η κάρτα θα ξαναρωτήσει, και μέχρι τότε καμία θέση δεν φεύγει πουθενά.
 * 🔒 Αμετάβλητο: συγκατάθεση ⇒ δηλωμένο ΕΓΣΑ'87 (το ίδιο κρατά και το {@link amendOwnerTerrainGeoreference}).
 *
 * 🔑 **Καθαρή**: η προηγούμενη πηγή έρχεται ήδη διαβασμένη από το `loadDossierTerrainInheritance` (το ΙΔΙΟ κατέβασμα που
 * δίνει και το περίγραμμα) — εδώ δεν ρωτιέται ξανά ο φάκελος. `previous === null` = δεν δημοσιεύτηκε ποτέ ανάγλυφο.
 */
export function carriedOwnerGeoreference(
  previous: ListingTerrainSource | null,
  incoming: ListingTerrainSource,
  property: Pick<OwnerProperty, 'place'>,
): TerrainGeoreferenceChoice {
  if (previous === null) return NO_TERRAIN_GEOREFERENCE_CHOICE;

  const carried = choiceOf(previous);
  if (carried.coordinateSystem !== GREEK_GRID_CRS.name) return carried;
  const reading = readAsGreekGrid(incoming, listingPositionOf(property));
  return reading !== null && reading.kind === 'agrees' ? carried : NO_TERRAIN_GEOREFERENCE_CHOICE;
}
