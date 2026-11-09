import 'server-only';

/**
 * =============================================================================
 * ΤΑΥΤΟΤΗΤΑ ΔΙΕΥΘΥΝΣΗΣ ΜΕΣΟΥ — ο ΕΝΑΣ γραφέας του `catalog_media_sources` (ADR-934 §5.2 Μ5 · §5.2.2 Μ-β3)
 * =============================================================================
 *
 * Μία εγγραφή ανά (χώρος, κανονικό URI): τα validators για το **conditional GET** της επόμενης λήψης, το sha256 που δίνει
 * τώρα η διεύθυνση, και τα προηγούμενα (≤ 10). Η κρίση «νέο · ίδιο περιεχόμενο · αμετάβλητο · νέα έκδοση» βγαίνει **μέσα**
 * στη συναλλαγή, πάνω στην ξαναδιαβασμένη κατάσταση (`media-source-identity`, καθαρό) ⇒ δύο ταυτόχρονες λήψεις της ίδιας
 * διεύθυνσης σειριοποιούνται, και η δεύτερη βλέπει την πρώτη.
 *
 * Αποτέλεσμα μηχανής, όπως το `catalog_import_page_readings`: καμία αναθεώρηση, κανένα ίχνος οντότητας, όχι είδος της
 * μηχανής του καταλόγου· η προέλευση του **αρχείου** καταγράφεται στο ίχνος του αρχείου (`remote_fetch`).
 *
 * @module server/catalog/media-source.server
 */

import type { DocumentReference } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { OutboundTransport } from '@/lib/security/outbound-fetch';
import { generateDeterministicCatalogMediaSourceId } from '@/services/enterprise-id.service';
import {
  mediaSourceFromDocument,
  nextMediaSource,
  revalidatedMediaSource,
  type ObservedMediaContent,
} from '@/subapps/catalog/import/media-source-identity';
import type { CatalogMediaSourceDefinition, MediaSourceVerdict } from '@/subapps/catalog/types/catalog-media';

function sourceRef(ctx: AuthContext, canonicalUri: string): DocumentReference {
  const id = generateDeterministicCatalogMediaSourceId(ctx.companyId, canonicalUri);
  return getAdminFirestore().collection(COLLECTIONS.CATALOG_MEDIA_SOURCES).doc(id);
}

/** Ό,τι είναι αποθηκευμένο — μόνο αν ανήκει σε **αυτόν** τον χώρο και σε **αυτή** τη διεύθυνση (ξένο ≡ ανύπαρκτο). */
const sourceOf = (ctx: AuthContext, canonicalUri: string, data: Readonly<Record<string, unknown>> | undefined) =>
  mediaSourceFromDocument(data, { companyId: ctx.companyId, uri: canonicalUri });

/** **Η γνωστή κατάσταση της διεύθυνσης** — για τα validators του conditional GET. `null` ⇒ πρώτη φορά. */
export async function readMediaSource(ctx: AuthContext, canonicalUri: string): Promise<CatalogMediaSourceDefinition | null> {
  const snap = await sourceRef(ctx, canonicalUri).get();
  return sourceOf(ctx, canonicalUri, snap.data());
}

/** Ό,τι έφερε μια απάντηση 200, από τη σκοπιά της διεύθυνσης. */
export type FetchedMediaContent = Omit<ObservedMediaContent, 'companyId' | 'checkedAt'>;

/** **Απάντηση 200**: γράφει τη νέα κατάσταση της διεύθυνσης και επιστρέφει την κρίση. Ιδεμπότητο: ίδια bytes ⇒ `unchanged`. */
export async function recordFetchedMediaSource(ctx: AuthContext, fetched: FetchedMediaContent, checkedAt: string): Promise<MediaSourceVerdict> {
  const ref = sourceRef(ctx, fetched.uri);
  return getAdminFirestore().runTransaction(async (tx) => {
    const previous = sourceOf(ctx, fetched.uri, (await tx.get(ref)).data());
    const { source, verdict } = nextMediaSource(previous, { ...fetched, companyId: ctx.companyId, checkedAt });
    tx.set(ref, source);
    return verdict;
  });
}

/**
 * **Απάντηση 304**: τίποτα δεν κατέβηκε· η διεύθυνση δίνει ό,τι ήξερε (`unchanged`). `null` ⇒ η διεύθυνση δεν είναι γνωστή
 * — 304 σε GET που δεν ήταν conditional είναι λάθος του server, και ο καλών ξαναζητά χωρίς validators.
 */
export async function recordRevalidatedMediaSource(
  ctx: AuthContext,
  canonicalUri: string,
  revalidated: { readonly transport: OutboundTransport; readonly checkedAt: string },
): Promise<CatalogMediaSourceDefinition | null> {
  const ref = sourceRef(ctx, canonicalUri);
  return getAdminFirestore().runTransaction(async (tx) => {
    const previous = sourceOf(ctx, canonicalUri, (await tx.get(ref)).data());
    if (previous === null) return null;
    const source = revalidatedMediaSource(previous, { etag: null, lastModified: null, ...revalidated });
    tx.set(ref, source);
    return source;
  });
}
