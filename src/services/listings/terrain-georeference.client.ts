/**
 * @fileoverview 📍 **Η γεωαναφορά του ανάγλυφου, από τον browser** (ADR-920 §14.12 φάση Α): η κατάσταση (`GET ?view=georeference`)
 *   και οι δύο αλλαγές (`PATCH`) — δήλωση συστήματος, συγκατάθεση θέσης.
 * @related app/api/owner-properties/[ownerPropertyId]/terrain/route (η πόρτα) ·
 *   lib/terrain/publication/terrain-georeference-declaration (το συμβόλαιο, κοινό με τον server) · ./plot-outline.client (το αδελφό)
 * @module services/listings/terrain-georeference.client
 *
 * 🔑 Ο browser στέλνει μια **επιλογή**, ποτέ συντεταγμένη: τη θέση τη βγάζει ο server από τα bytes που ήδη κρατά.
 * 🔑 Ό,τι επιστρέφει η πόρτα κρίνεται με το **ίδιο** σχήμα που το έγραψε (zod)· ό,τι δεν διαβάζεται ⇒ `rejected`.
 */

import { namedRefusalOf, type NamedRefusal } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import { OWNER_TERRAIN_VIEW_PARAM } from '@/lib/terrain/plot-outline/plot-outline-status';
import {
  OWNER_TERRAIN_GEOREFERENCE_VIEW,
  parseTerrainGeoreferenceView,
  type TerrainGeoreferenceAmendment,
  type TerrainGeoreferenceStatus,
} from '@/lib/terrain/publication/terrain-georeference-declaration';
import { isTerrainRefusalCode, type TerrainRefusalCode } from '@/lib/terrain/publication/terrain-publication-contract';
import { generateIdempotencyKey } from '@/services/enterprise-id.service';

import type { OwnerTerrainTarget } from './plot-outline.client';
import { terrainEndpointOf } from './publish-listing-terrain.client';

export type TerrainGeoreferenceRefusal = NamedRefusal<TerrainRefusalCode>;

/** `georeference: null` = δεν δημοσιεύτηκε ποτέ ανάγλυφο — δεν υπάρχει τίποτα να τοποθετηθεί. */
export type TerrainGeoreferenceOutcome =
  | { readonly ok: true; readonly georeference: TerrainGeoreferenceStatus | null }
  | { readonly ok: false; readonly refusal: TerrainGeoreferenceRefusal };

export type TerrainGeoreferenceAmendOutcome =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly refusal: TerrainGeoreferenceRefusal };

/** **Τι δηλώθηκε, τι προτείνουν τα σημεία, και τι θα έδινε η ανάγνωση ως ΕΓΣΑ'87** — πριν δηλώσει ο ιδιοκτήτης οτιδήποτε. */
export async function fetchTerrainGeoreference(target: OwnerTerrainTarget): Promise<TerrainGeoreferenceOutcome> {
  try {
    const data = await apiClient.get<unknown>(
      `${terrainEndpointOf(target)}?${OWNER_TERRAIN_VIEW_PARAM}=${OWNER_TERRAIN_GEOREFERENCE_VIEW}`,
    );
    const view = parseTerrainGeoreferenceView(data);
    return view === null ? { ok: false, refusal: 'rejected' } : { ok: true, georeference: view.georeference };
  } catch (cause) {
    return { ok: false, refusal: namedRefusalOf(cause, isTerrainRefusalCode) };
  }
}

function hasChangedFlag(data: unknown): data is { readonly changed: boolean } {
  return typeof data === 'object' && data !== null && 'changed' in data && typeof data.changed === 'boolean';
}

/** **Δήλωσε το σύστημα ή άλλαξε τη συγκατάθεση θέσης** (`PATCH`). Ταυτοδύναμο στον server (`changed: false`). */
export async function amendTerrainGeoreference(
  target: OwnerTerrainTarget,
  amendment: TerrainGeoreferenceAmendment,
): Promise<TerrainGeoreferenceAmendOutcome> {
  try {
    const data = await apiClient.patch<unknown>(terrainEndpointOf(target), amendment, {
      headers: { [IDEMPOTENCY_KEY_HEADER]: generateIdempotencyKey() },
    });
    return hasChangedFlag(data) ? { ok: true, changed: data.changed } : { ok: false, refusal: 'rejected' };
  } catch (cause) {
    return { ok: false, refusal: namedRefusalOf(cause, isTerrainRefusalCode) };
  }
}
