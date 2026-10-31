import 'server-only';

/**
 * Η **όψη του εκδότη** (ADR-923 §5.6): συνταγές + πρόσφατες εκδόσεις, από τον διακομιστή (`read: false`, κριτής `pricingView`).
 * Οι εκδόσεις παρακολουθούνται με σταθερό ρυθμό όσο κάποια είναι ανοιχτή· ⇒ μία ανάγνωση της όψης ανά κύκλο.
 * @module server/catalog/publishing/publication-views.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { PublicationRecipeDefinition } from '@/subapps/catalog/types/publication';
import type { StoredCatalogRecord } from '../catalog-store.server';
import { readRecentPublicationRuns, type StoredPublicationRun } from './publication-run.server';

const RECENT_RUNS = 30;

export interface PublicationsView {
  readonly recipes: readonly StoredCatalogRecord<PublicationRecipeDefinition>[];
  readonly runs: readonly StoredPublicationRun[];
}

/** Οι ζωντανές συνταγές του χώρου. ⚠️ Χωρίς κριτή: ό,τι καλεί αυτό αποφασίζει τι επιστρέφει στον άνθρωπο. */
export async function readPublicationRecipes(ctx: AuthContext): Promise<readonly StoredCatalogRecord<PublicationRecipeDefinition>[]> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.CATALOG_PUBLICATION_RECIPES)
    .where('companyId', '==', ctx.companyId)
    .where('isDeleted', '==', false)
    .get();
  return snap.docs.map((doc) => doc.data() as StoredCatalogRecord<PublicationRecipeDefinition>);
}

export async function readPublicationsView(ctx: AuthContext): Promise<PublicationsView> {
  return { recipes: await readPublicationRecipes(ctx), runs: await readRecentPublicationRuns(ctx, RECENT_RUNS) };
}
