/**
 * @fileoverview **Η ΑΠΟΣΤΟΛΗ ΤΟΥ ΤΟΠΟΓΡΑΦΙΚΟΥ ΤΗΣ ΑΓΓΕΛΙΑΣ** — δύο πεδία, ένα κλειδί, μια έκβαση με όνομα (ADR-920 Β4.7).
 * @related app/api/properties/[id]/terrain · app/api/owner-properties/[ownerPropertyId]/terrain (οι δύο πόρτες, ΕΝΑ
 *   συμβόλαιο) · `@/lib/terrain/publication/terrain-publication-contract` · `@/lib/terrain/survey-import/survey-upload-preparation`
 * @module services/listings/publish-listing-terrain.client
 *
 * 🏆 **Ο browser στέλνει ό,τι είδε ο άνθρωπος — byte προς byte.** Το σώμα της πηγής είναι το `encoded` του
 * `prepareSurveyUpload`: η **κανονική** κωδικοποίηση, κριμένη ήδη από τον **ίδιο** κριτή με την πόρτα. Καμία δεύτερη
 * κωδικοποίηση ανάμεσα στην προεπισκόπηση και στο δίκτυο ⇒ η προεπισκόπηση είναι η ετυμηγορία του server.
 * Διαβάθμιση, ταυτότητα δημοσίευσης, κάτοχο και διαδοχή τα γράφει **η πόρτα** (ADR-845 §7.17 Α4).
 *
 * 🔑 **ΕΝΑ `Idempotency-Key` ΑΝΑ ΠΡΟΕΤΟΙΜΑΣΜΕΝΗ ΔΗΜΟΣΙΕΥΣΗ, ΟΧΙ ΑΝΑ ΚΛΙΚ** (ADR-872, ίδιο με την κάτοψη ADR-909).
 * Χαμένη απάντηση + δεύτερο «Δημοσίευση» ⇒ ίδια bytes, ίδιο κλειδί ⇒ το σύνορο αναπαράγει την πρώτη απάντηση
 * αντί να γεννήσει δεύτερο τοπογραφικό. Άλλα σημεία ή άλλη δήλωση ⇒ νέα προετοιμασία ⇒ νέο κλειδί.
 *
 * 🔑 **Μία διεύθυνση ανά κάτοχο, από το `API_ROUTES`** — ο client δεν ξέρει αν μιλά στο γραφείο ή στον ιδιοκτήτη·
 * το αποφασίζει η θύρα (`lib/terrain/publication/terrain-publish-target`).
 *
 * ⛔ Τα στατιστικά της απάντησης (`terrain.stats`) **δεν** ξαναδιαβάζονται: τα έχει ήδη η προεπισκόπηση από τον ίδιο
 * κριτή πάνω στα ίδια bytes. Δεύτερη ανάγνωση = δεύτερο σχήμα να εμπιστευτούμε, χωρίς καμία νέα πληροφορία.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { namedRefusalOf, type NamedRefusal } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import {
  isTerrainRefusalCode,
  TERRAIN_SOURCE_CONTENT_TYPE,
  TERRAIN_UPLOAD_FIELDS,
  type TerrainRefusalCode,
} from '@/lib/terrain/publication/terrain-publication-contract';
import {
  encodeTerrainSurveyDeclaration,
  type TerrainSurveyDeclaration,
} from '@/lib/terrain/publication/terrain-survey-declaration';
import type { TerrainPublishTarget } from '@/lib/terrain/publication/terrain-publish-target';
import { generateIdempotencyKey } from '@/services/enterprise-id.service';
import { announceSupersededFiles, archivedFileIdsOf } from '@/services/filesystem/announce-superseded-files';

/** Ό,τι θα φύγει, παγωμένο μαζί με το κλειδί του: ίδια bytes ⇔ ίδιο κλειδί. */
export interface PreparedTerrainPublication {
  /** Το κανονικό σώμα της πηγής (`SurveyUploadPreparation.encoded`) — ακριβώς ό,τι κρίθηκε στην προεπισκόπηση. */
  readonly encodedSource: string;
  readonly declaration: TerrainSurveyDeclaration;
  readonly idempotencyKey: string;
}

/** Τι έγινε στη δημόσια αγγελία μετά τη δημοσίευση (`ListingMediaRefreshOutcome` της πόρτας). */
export type TerrainListingOutcome = 'published' | 'withdrawn' | 'failed' | 'absent' | 'unknown';

export type TerrainPublishRefusal = NamedRefusal<TerrainRefusalCode>;

export type TerrainPublishOutcome =
  | { readonly ok: true; readonly fileId: string; readonly listing: TerrainListingOutcome }
  | { readonly ok: false; readonly refusal: TerrainPublishRefusal };

const LISTING_OUTCOMES: ReadonlySet<string> = new Set<TerrainListingOutcome>(['published', 'withdrawn', 'failed', 'absent']);

/** **Πάγωσε μια δημοσίευση**: το κλειδί γεννιέται εδώ και ταξιδεύει με τα bytes, όχι με το κλικ. */
export function prepareTerrainPublication(
  encodedSource: string,
  declaration: TerrainSurveyDeclaration,
): PreparedTerrainPublication {
  return { encodedSource, declaration, idempotencyKey: generateIdempotencyKey() };
}

/**
 * **Ίδια bytes + ίδια δήλωση ⇒ η ΙΔΙΑ προετοιμασία** (το ίδιο κλειδί)· οτιδήποτε άλλο ⇒ νέα. Έτσι ένα δεύτερο κλικ μετά
 * από χαμένη απάντηση αναπαράγεται από το σύνορο, ενώ μια διορθωμένη δήλωση δεν συγκρούεται με το παλιό αποτύπωμα.
 */
export function reuseTerrainPublication(
  previous: PreparedTerrainPublication | null,
  encodedSource: string,
  declaration: TerrainSurveyDeclaration,
): PreparedTerrainPublication {
  const same = previous !== null && previous.encodedSource === encodedSource &&
    encodeTerrainSurveyDeclaration(previous.declaration) === encodeTerrainSurveyDeclaration(declaration);
  return same ? previous : prepareTerrainPublication(encodedSource, declaration);
}

/** Η διεύθυνση της πόρτας του κατόχου — η ΜΙΑ αντιστοίχιση κατόχου → `API_ROUTES`. */
export function terrainEndpointOf(target: TerrainPublishTarget): string {
  return target.kind === 'property'
    ? API_ROUTES.PROPERTIES.TERRAIN(target.propertyId)
    : API_ROUTES.OWNER_PROPERTIES.TERRAIN(target.ownerPropertyId);
}

function uploadBodyOf(prepared: PreparedTerrainPublication): FormData {
  const body = new FormData();
  // ⛔ Όνομα χωρίς νόημα: η πόρτα κρίνει τύπο και περιεχόμενο, ποτέ το όνομα (ADR-769).
  const source = new Blob([prepared.encodedSource], { type: TERRAIN_SOURCE_CONTENT_TYPE });
  body.append(TERRAIN_UPLOAD_FIELDS.source, source, 'terrain-source.json');
  body.append(TERRAIN_UPLOAD_FIELDS.declaration, encodeTerrainSurveyDeclaration(prepared.declaration));
  return body;
}

/** Η απάντηση της πόρτας → έκβαση. Σχήμα που δεν αναγνωρίζεται ⇒ `rejected`, ποτέ «επιτυχία χωρίς αρχείο». */
function outcomeOf(data: unknown): TerrainPublishOutcome {
  if (typeof data !== 'object' || data === null) return { ok: false, refusal: 'rejected' };
  const { fileId, listing, archived } = data as { fileId?: unknown; listing?: unknown; archived?: unknown };
  if (typeof fileId !== 'string' || fileId === '') return { ok: false, refusal: 'rejected' };

  announceSupersededFiles(archivedFileIdsOf(archived), fileId);
  const known = typeof listing === 'string' && LISTING_OUTCOMES.has(listing);
  return { ok: true, fileId, listing: known ? (listing as TerrainListingOutcome) : 'unknown' };
}

/**
 * **Στείλε το προετοιμασμένο τοπογραφικό στην αγγελία.**
 *
 * ⚠️ Δεν πετά για λόγο που ο άνθρωπος μπορεί να διορθώσει — επιστρέφει **ονομασμένη** άρνηση από τον κλειστό
 * κατάλογο της πόρτας, ώστε το i18n να έχει μήνυμα για κάθε μία (`property-market:terrainPublication.refusals`).
 */
export async function publishListingTerrain(
  target: TerrainPublishTarget,
  prepared: PreparedTerrainPublication,
): Promise<TerrainPublishOutcome> {
  let data: unknown;
  try {
    data = await apiClient.post<unknown>(terrainEndpointOf(target), uploadBodyOf(prepared), {
      headers: { [IDEMPOTENCY_KEY_HEADER]: prepared.idempotencyKey },
    });
  } catch (cause) {
    return { ok: false, refusal: namedRefusalOf(cause, isTerrainRefusalCode) };
  }
  return outcomeOf(data);
}
