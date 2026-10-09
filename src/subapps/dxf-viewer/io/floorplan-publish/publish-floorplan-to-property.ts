/**
 * @fileoverview **Η ΑΠΟΣΤΟΛΗ ΤΗΣ ΔΗΜΟΣΙΑΣ ΚΑΤΟΨΗΣ** — τρία πεδία, ένα κλειδί, και μια έκβαση με όνομα (ADR-909 Β2.4).
 * @related app/api/properties/[id]/floorplan/route (η πόρτα) · `@/lib/listings/floorplan-publication-contract`
 * @module subapps/dxf-viewer/io/floorplan-publish/publish-floorplan-to-property
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Ο BROWSER ΣΤΕΛΝΕΙ ΤΡΙΑ ΠΡΑΓΜΑΤΑ — ΚΑΙ ΚΑΝΕΝΑ ΑΠΟ ΤΑ 13 ΠΕΔΙΑ ΔΗΜΟΣΙΕΥΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `file` *(τα bytes που είδε ο άνθρωπος στην προεπισκόπηση)* · `levelId` · `recipe`. Διαβάθμιση, ταυτότητα,
 * κατηγορία, κάτοχο, αρχείο σκηνής και `revision` τα διαβάζει και τα γράφει **ο διακομιστής** (ADR-845 §7.17 Α4).
 *
 * 🔑 **ΕΝΑ `Idempotency-Key` ΑΝΑ ΠΡΟΕΤΟΙΜΑΣΜΕΝΗ ΕΙΚΟΝΑ, ΟΧΙ ΑΝΑ ΚΛΙΚ.** Το κλειδί γεννιέται μαζί με την
 * εικόνα ({@link prepareFloorplanPublication}) και ταξιδεύει με αυτήν: αν η απάντηση χαθεί στο δίκτυο και ο
 * άνθρωπος πατήσει ξανά «Δημοσίευση», φεύγουν **τα ίδια bytes με το ίδιο κλειδί** ⇒ το σύνορο αναπαράγει
 * την πρώτη απάντηση αντί να γεννήσει δεύτερη κάτοψη (ADR-872 §3 απόφαση 6β). Νέα εικόνα ⇒ νέο κλειδί.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import {
  FLOORPLAN_UPLOAD_FIELDS,
  isFloorplanRefusalCode,
  type FloorplanRefusalCode,
} from '@/lib/listings/floorplan-publication-contract';
import type { FloorplanRenderRecipe } from '@/lib/listings/floorplan-render-recipe';
import { generateIdempotencyKey } from '@/services/enterprise-id.service';

import {
  capturePublicFloorplan,
  type PublicFloorplanCaptureRefusal,
} from '../../print/public-floorplan/capture-public-floorplan';
import type { PrintFidelityNote } from '../../print/print-fidelity';
import type { ExportDeps } from '../../export/types';
import { announceSupersededFiles, archivedFileIdsOf } from '../publish-shared/announce-superseded-files';

/** Μια εικόνα **έτοιμη να φύγει**: ό,τι δείχνει η προεπισκόπηση είναι ακριβώς ό,τι θα σταλεί. */
export interface PreparedFloorplan {
  readonly blob: Blob;
  readonly recipe: FloorplanRenderRecipe;
  readonly levelId: string;
  readonly idempotencyKey: string;
  /** Τύποι στοιχείων που το προφίλ δεν γνωρίζει και έμειναν έξω — ο διάλογος τους ονομάζει. */
  readonly unruledTypes: readonly string[];
  /** Ό,τι έχασε η εικόνα έναντι του σχεδίου (εικόνα υλικού που δεν φόρτωσε κ.λπ.) — ο διάλογος το ονομάζει. */
  readonly fidelity: readonly PrintFidelityNote[];
}

/** Γιατί δεν υπάρχει εικόνα να φανεί: δεν υπάρχει ενεργό επίπεδο με σχέδιο, ή η λήψη αρνήθηκε. */
export type FloorplanPreparationRefusal = 'no-level' | PublicFloorplanCaptureRefusal;

export type FloorplanPreparation =
  | { readonly ok: true; readonly prepared: PreparedFloorplan }
  | { readonly ok: false; readonly refusal: FloorplanPreparationRefusal };

/**
 * **Φτιάξε την εικόνα του ΕΝΕΡΓΟΥ επιπέδου** — αυτού που βλέπει ο άνθρωπος στον καμβά.
 *
 * ⚠️ Το `levelId` είναι **ό,τι** στέλνει ο πελάτης για το «ποιο σχέδιο»· το αρχείο σκηνής και η έκδοσή του
 * διαβάζονται στον διακομιστή από το επίπεδο (ADR-909 §6.1).
 */
export async function prepareFloorplanPublication(
  deps: ExportDeps,
  options: { readonly furniture: boolean },
): Promise<FloorplanPreparation> {
  const levelId = deps.activeLevelId;
  const active = deps.levelScenes.find((entry) => entry.level.id === levelId);
  if (levelId === null || active === undefined) return { ok: false, refusal: 'no-level' };

  const capture = await capturePublicFloorplan({ scene: active.scene, furniture: options.furniture });
  if (!capture.ok) return { ok: false, refusal: capture.why };

  return {
    ok: true,
    prepared: {
      blob: capture.blob,
      recipe: capture.recipe,
      levelId,
      idempotencyKey: generateIdempotencyKey(),
      unruledTypes: capture.unruledTypes,
      fidelity: capture.fidelity,
    },
  };
}

/** Μπήκε η κάτοψη στη δήλωση του ακινήτου; `full`/`failed` ⇒ ανέβηκε αλλά **δεν** φεύγει ακόμη στο κοινό. */
export type FloorplanDeclared = 'declared' | 'already' | 'full' | 'failed' | 'unknown';
/** Τι έγινε στην αγγελία μετά τη δημοσίευση. */
export type FloorplanListing = 'published' | 'withdrawn' | 'failed' | 'absent' | 'unknown';

const DECLARED: ReadonlySet<string> = new Set<FloorplanDeclared>(['declared', 'already', 'full', 'failed']);
const LISTING: ReadonlySet<string> = new Set<FloorplanListing>(['published', 'withdrawn', 'failed', 'absent']);

/** `network` = δεν ξέρουμε αν έφτασε· `rejected` = ο διακομιστής αρνήθηκε για λόγο εκτός της λίστας της πόρτας. */
export type FloorplanPublishRefusal = FloorplanRefusalCode | 'network' | 'rejected';

export type FloorplanPublishOutcome =
  | {
      readonly ok: true;
      readonly fileId: string;
      readonly declared: FloorplanDeclared;
      readonly listing: FloorplanListing;
    }
  | { readonly ok: false; readonly refusal: FloorplanPublishRefusal };

function uploadBodyOf(prepared: PreparedFloorplan): FormData {
  const body = new FormData();
  // ⛔ Όνομα χωρίς νόημα: η πόρτα **δεν** το διαβάζει, και η ταυτότητα δεν δένεται ποτέ με όνομα (ADR-769).
  // 🔑 **Το ίδιο αντικείμενο `Blob`** που δείχνει η προεπισκόπηση — καμία δεύτερη κωδικοποίηση ανάμεσα.
  body.append(FLOORPLAN_UPLOAD_FIELDS.file, prepared.blob, 'floorplan.png');
  body.append(FLOORPLAN_UPLOAD_FIELDS.levelId, prepared.levelId);
  body.append(FLOORPLAN_UPLOAD_FIELDS.recipe, JSON.stringify(prepared.recipe));
  return body;
}

/** Ο κωδικός της πόρτας ταξιδεύει ως **μήνυμα** του `ApiError`· ο πελάτης τον δέχεται μόνο αν είναι της λίστας. */
function refusalOf(cause: unknown): FloorplanPublishRefusal {
  if (!ApiClientError.isApiClientError(cause)) return 'network';
  if (isFloorplanRefusalCode(cause.errorCode)) return cause.errorCode;
  return isFloorplanRefusalCode(cause.message) ? cause.message : 'rejected';
}

function fieldOf(data: unknown, field: string): unknown {
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>)[field] : undefined;
}

function oneOf<T extends string>(known: ReadonlySet<string>, value: unknown): T | 'unknown' {
  return typeof value === 'string' && known.has(value) ? (value as T) : 'unknown';
}

/**
 * **Στείλε την προετοιμασμένη εικόνα στο ακίνητο.**
 *
 * ⚠️ Δεν πετά για λόγο που ο άνθρωπος μπορεί να διορθώσει — επιστρέφει **ονομασμένη** άρνηση.
 */
export async function publishFloorplanToProperty(
  propertyId: string,
  prepared: PreparedFloorplan,
): Promise<FloorplanPublishOutcome> {
  let data: unknown;
  try {
    data = await apiClient.post<unknown>(API_ROUTES.PROPERTIES.FLOORPLAN(propertyId), uploadBodyOf(prepared), {
      headers: { [IDEMPOTENCY_KEY_HEADER]: prepared.idempotencyKey },
    });
  } catch (cause) {
    return { ok: false, refusal: refusalOf(cause) };
  }

  const fileId = fieldOf(data, 'fileId');
  if (typeof fileId !== 'string' || fileId === '') return { ok: false, refusal: 'rejected' };

  announceSupersededFiles(archivedFileIdsOf(fieldOf(data, 'archived')), fileId);

  return {
    ok: true,
    fileId,
    declared: oneOf<FloorplanDeclared>(DECLARED, fieldOf(data, 'declared')),
    listing: oneOf<FloorplanListing>(LISTING, fieldOf(data, 'listing')),
  };
}
