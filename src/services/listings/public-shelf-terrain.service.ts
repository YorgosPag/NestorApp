/**
 * @fileoverview ⛰️ **ΤΟ ΚΕΦΑΛΙ ΤΟΥ ΕΔΑΦΟΥΣ** — συμφιλίωση του ραφιού `'terrain'`, με τον ίδιο πυρήνα κάδου (ADR-920 Β3β).
 * @related ADR-920 §12 · ADR-845 §6.2 (ίδιο συμβόλαιο) · ./public-shelf-model.service (αδελφός)
 * @module services/listings/public-shelf-terrain.service
 *
 * Το συμβόλαιο είναι **ταυτόσημο** με τα άλλα κεφάλια:
 *   επιθυμητό σύνολο ⇒ το πρόθεμα γίνεται ακριβώς αυτό · κενό ⇒ αδειάζει (η απόσυρση ΣΥΜΒΑΙΝΕΙ) ·
 *   αποτυχία ⇒ ονομαστική, ποτέ `throw`.
 * Και ο κάδος είναι **ο ίδιος κώδικας** (`reconcileOnePerSource` → `uploadMissing` / `deleteExtra`): τα `.json`
 * μοιράζονται το πρόθεμα `listings/<id>/` με `.webp`/`.glb`/`.mp4`, και ο σβήστης αγγίζει μόνο τη δική του κατάληξη.
 *
 * 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΓΕΝΝΙΕΤΑΙ ΑΠΟ ΤΗΝ ΕΞΟΔΟ ΤΟΥ ΨΗΣΤΗ** (Α12.7): χωρίς στιγμιότυπο δεν υπάρχει κλειδί, χωρίς κλειδί δεν
 * υπάρχει δημοσίευση. Η πηγή του τοπογράφου δεν φτάνει ποτέ στο δημόσιο κάδο.
 *
 * 🔑 **Cache hit = καμία λήψη, κανένα ψήσιμο**: η κάρτα ζει στα metadata του δημόσιου αντικειμένου. Αν δεν διαβάζεται
 * (π.χ. γράφτηκε από παλαιότερη μορφή), το ράφι **ξαναψήνει** — ποτέ κάρτα από μαντεψιά.
 *
 * ⚠️ **SERVER-ONLY**.
 */

import type { File } from '@google-cloud/storage';

import { GCS_PUBLIC_MEDIA_BUCKET } from '@/config/gcs-buckets';
import { readListingTerrainCard, type ListingTerrainCard } from '@/lib/terrain/publication/listing-terrain-card';
import {
  TERRAIN_DECLARATION_METADATA_KEY,
  decodeTerrainSurveyDeclaration,
} from '@/lib/terrain/publication/terrain-survey-declaration';
import { createModuleLogger } from '@/lib/telemetry';
import { shelfRecipe, type PublicShelfKind } from '@/services/upload/utils/public-shelf-kinds';
import { isTerrainShelfKind, type TerrainShelfKind } from '@/services/upload/utils/public-shelf-terrain-kind';
import {
  buildPublicShelfKey,
  publicShelfUrl,
  shelfExtension,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';

import { asLogMessage, shelfFailure, type ShelfWrite } from './public-shelf-bucket';
import { readPrivateOrigin, reconcileOnePerSource, type ShelfOrigin } from './public-shelf-origin';
import { META_RECIPE, META_SOURCE_REF, contentAddress } from './public-shelf-plan';
import {
  META_TERRAIN_CARD,
  PUBLIC_SHELF_TERRAIN_CONTENT_TYPE,
  bakeListingTerrain,
  type TerrainBakeFailure,
} from './public-shelf-terrain-bake';

const logger = createModuleLogger('public-shelf-terrain');

/** **Ένα δημοσιευμένο έδαφος**: η διεύθυνση, πότε εμφανίστηκε η πηγή, και η κάρτα του. */
export interface PublishedShelfTerrain {
  readonly key: string;
  readonly url: string;
  /** ISO — το `timeCreated` του **ιδιωτικού** αντικειμένου, ποτέ το ρολόι του διακομιστή. */
  readonly at: string;
  readonly card: ListingTerrainCard;
}

export interface PublicShelfTerrainReport {
  readonly outcome: 'reconciled' | 'failed';
  readonly published: readonly PublishedShelfTerrain[];
  readonly removed: number;
  readonly rejected: number;
}

/** Οι ερωτήσεις **αυτού** του συνόρου, μαζί με του ψήστη. */
type TerrainSourceRefusal = TerrainBakeFailure | 'missing-declaration' | 'undated-source' | 'unreadable-source';

interface AddressedTerrain extends PublishedShelfTerrain {
  /** `null` ⇒ τα bytes κάθονται ήδη στο ράφι. */
  readonly upload: ShelfWrite | null;
}

function refuse(subjectId: string, privateStoragePath: string, failure: TerrainSourceRefusal, detail: string): null {
  logger.warn('Έδαφος ΔΕΝ δημοσιεύεται — ονομασμένη άρνηση', { subjectId, privateStoragePath, failure, detail });
  return null;
}

/** Η κάρτα ενός ήδη δημοσιευμένου αντικειμένου — ή `null`, που σημαίνει «ξαναψήσε». */
function cachedCardOf(hit: File): ListingTerrainCard | null {
  const raw = hit.metadata.metadata?.[META_TERRAIN_CARD];
  if (typeof raw !== 'string') return null;
  try {
    return readListingTerrainCard(JSON.parse(raw));
  } catch {
    return null;
  }
}

function toUpload(kind: TerrainShelfKind<unknown>, origin: ShelfOrigin, json: Buffer, gzipped: Buffer, card: ListingTerrainCard): AddressedTerrain {
  const key = buildPublicShelfKey(kind, {
    subjectId: origin.subjectId,
    contentHash: contentAddress(json),
    ext: shelfExtension(kind.encoding),
  });
  const metadata = { [META_SOURCE_REF]: origin.sourceRef, [META_RECIPE]: origin.recipe, [META_TERRAIN_CARD]: JSON.stringify(card) };

  return {
    key,
    url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, key),
    at: origin.at,
    card,
    upload: { key, bytes: gzipped, contentType: PUBLIC_SHELF_TERRAIN_CONTENT_TYPE, contentEncoding: 'gzip', metadata },
  };
}

/** Διαβάζει την ιδιωτική πηγή, την ψήνει, και τη διευθυνσιοδοτεί — ή αρνείται με όνομα. */
async function bakeOne<M>(
  kind: TerrainShelfKind<M>,
  subjectId: string,
  source: PublicShelfSource<M>,
  own: readonly File[],
): Promise<AddressedTerrain | null> {
  const path = source.privateStoragePath;

  try {
    const { original, meta, origin, hit } = await readPrivateOrigin(source, shelfRecipe(kind.encoding), subjectId, own);
    if (origin === null) return refuse(subjectId, path, 'undated-source', 'no timeCreated');

    const cached = hit === null ? null : cachedCardOf(hit);
    if (hit !== null && cached !== null) {
      return { key: hit.name, url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, hit.name), at: origin.at, card: cached, upload: null };
    }

    const declaration = decodeTerrainSurveyDeclaration(meta.metadata?.[TERRAIN_DECLARATION_METADATA_KEY]);
    if (declaration === null) return refuse(subjectId, path, 'missing-declaration', 'no readable Δ2 declaration');

    const [raw] = await original.download();
    const baked = bakeListingTerrain(raw, declaration);
    if (!baked.ok) return refuse(subjectId, path, baked.failure, 'bake refused');
    return toUpload(kind, origin, baked.json, baked.gzipped, baked.card);
  } catch (error) {
    return refuse(subjectId, path, 'unreadable-source', asLogMessage(error));
  }
}

/**
 * **Κάνε το ράφι ΕΔΑΦΟΥΣ αυτού του υποκειμένου ΑΚΡΙΒΩΣ ίσο με το επιθυμητό σύνολο.** Δεν πετά ποτέ.
 * Ο φρουρός είναι **καταφατικός** (`isTerrainShelfKind`), όπως στα αδέλφια του.
 */
export async function reconcilePublicTerrainShelf<M>(
  kind: PublicShelfKind<M>,
  subjectId: string,
  sources: readonly PublicShelfSource<M>[],
): Promise<PublicShelfTerrainReport> {
  if (!isTerrainShelfKind(kind)) {
    return shelfFailure(
      logger,
      'Αυτό το κεφάλι δημοσιεύει ΜΟΝΟ έδαφος — η γραμμή δεν είναι εδάφους',
      { root: kind.root, subjectId, encoding: kind.encoding.kind },
      sources.length,
    );
  }

  try {
    const { desired, removed, rejected } = await reconcileOnePerSource(kind, subjectId, sources, (source: PublicShelfSource<M>, own) =>
      bakeOne(kind, subjectId, source, own),
    );
    return { outcome: 'reconciled', published: desired.map(({ key, url, at, card }) => ({ key, url, at, card })), removed, rejected };
  } catch (error) {
    return shelfFailure(
      logger,
      'Το ράφι ΕΔΑΦΟΥΣ ΔΕΝ συμφιλιώθηκε — μένει ΜΠΑΓΙΑΤΙΚΟ ως την επανασύνθεση',
      { root: kind.root, subjectId, error: asLogMessage(error) },
      0,
    );
  }
}
