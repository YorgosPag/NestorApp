import 'server-only';

/**
 * =============================================================================
 * ΤΟ ΕΝΑ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΩΝ ΔΗΜΟΣΙΕΥΜΕΝΩΝ ΕΚΔΟΣΕΩΝ (ADR-923 §5.15 Η3 · Η4)
 * =============================================================================
 *
 * | Ερώτηση | Συνάρτηση |
 * |---|---|
 * | Τι έχω δημοσιεύσει; (ιδιοκτήτης) | `readOwnedCatalogEditions` |
 * | Ποια έντυπα βλέπει αυτός ο θεατής; | `readCatalogEditionsFor` · `readPublicCatalogEditions` (ανώνυμος, ISR) |
 * | Ποιο είναι το ισχύον έντυπο ενός ραφιού γι' αυτόν; | `resolveLatestCatalogEdition` |
 * | Δώσε του το αρχείο | `signCatalogEditionFile` |
 * | Δώσε στον ιδιοκτήτη το δικό του αρχείο (προβολή πριν το μοιραστεί) | `signOwnedCatalogEditionFile` |
 *
 * 🔒 **Ο θεατής χτίζεται εδώ, μέσα στη συναλλαγή** (`showcaseViewerOf`), ποτέ από τον καλούντα: ανώνυμος ή αγοραστής μέσω της
 *    **σχέσης** του ζεύγους. Το αίτημα ονομάζει μόνο **ποιον** προμηθευτή και **ποια** έκδοση.
 * 🔒 **Η πύλη της βιτρίνας** (`readPublicSupplier`): ανώνυμο έντυπο φαίνεται μόνο όσο η βιτρίνα είναι έγκυρη — για **κάθε**
 *    θεατή. Η ανάκληση της βιτρίνας κλείνει και τα έντυπα· τα έντυπα ομάδας ζουν με τη σχέση.
 * 🔒 **Κρυφό ≡ ξένο ≡ αποσυρμένο ≡ ανύπαρκτο** ⇒ `null`, και ο καλών δίνει το ίδιο 404.
 * 🔒 **Η άδεια μετά την κρίση** (`lib/storage/signed-download-url`): 15′, `inline` (ποτέ `attachment`, Η4). Η προβολή **δεν**
 *    μετρά λήψη: το `recordPublicationDownload` είναι μόνο του ιδιοκτήτη και θα ξεκινούσε ρολόι τεκμηρίου.
 * ⛔ Δηλωμένος αναγνώστης ξένου καταλόγου (CHECK 3.106 `FOREIGN_READERS`).
 * @module server/catalog/editions/catalog-edition-reads.server
 */

import type { AuthContext } from '@/lib/auth';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { signedDownloadUrl } from '@/lib/storage/signed-download-url';
import { cached, readPublicSupplier } from '@/services/public-catalog/public-catalog.reader';
import { catalogEditionViewOf, currentEditionIds, editionVisibleTo, latestVisibleEdition } from '@/subapps/catalog/publishing/catalog-edition-policy';
import type { CatalogEditionOwnerView, CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { isEnterpriseIdOfPrefix } from '@/services/enterprise-id-parse';
import type { PricingViewer } from '@/subapps/catalog/types/price-list';
import { readBuyerRelationship } from '@/server/supply-relationships/supply-relationship-store.server';
import { runForeignCatalogRead, type CatalogReadScope } from '../catalog-store.server';
import { publicationBucket } from '../publishing/publication-bucket.server';
import { publicCatalogCompanyTag, publicCatalogEditionsTag } from '../public/public-catalog-cache-tag';
import { showcaseViewerOf, type ShowcaseViewerSource } from '../public/showcase-viewer.server';
import {
  readCatalogEdition,
  readCatalogEditionInTx,
  readCompanyEditions,
  readShelfInTx,
  readViewableEditionsInTx,
  type StoredCatalogEdition,
} from './catalog-edition-store.server';

/** Ταυτότητα από τη διεύθυνση: ό,τι δεν είναι id (π.χ. με `/`) δεν φτάνει ποτέ στη βάση — ίδιο «όχι» με το ανύπαρκτο. */
const isEditionId = (value: string): boolean => isEnterpriseIdOfPrefix(value, ENTERPRISE_ID_PREFIXES.CATALOG_EDITION);
const isRelationshipId = (value: string): boolean => isEnterpriseIdOfPrefix(value, ENTERPRISE_ID_PREFIXES.SUPPLY_RELATIONSHIP);

/** Ο θεατής και η κρίση του: δική του ορατότητα + πύλη βιτρίνας για τα ανώνυμα + ο σωστός προμηθευτής. */
interface EditionJudge {
  readonly viewer: PricingViewer;
  /** Πέρασε το σύνορο (προμηθευτής · βιτρίνα), ανεξάρτητα από το κοινό. */
  readonly admitted: (edition: StoredCatalogEdition) => boolean;
  /** Την βλέπει αυτός ο θεατής. */
  readonly visible: (edition: StoredCatalogEdition) => boolean;
}

/**
 * Η μία κρίση, σε **μία** συναλλαγή μόνο ανάγνωσης στη σκοπιά του προμηθευτή. Η πύλη της βιτρίνας διαβάζεται πριν (μνήμη με
 * tag εταιρείας· η ανάκληση το χτυπά αμέσως).
 */
async function judgeAs<T>(supplierCompanyId: string, source: ShowcaseViewerSource, work: (scope: CatalogReadScope, judge: EditionJudge) => Promise<T>): Promise<T> {
  const showcaseLive = (await readPublicSupplier(supplierCompanyId)) !== null;
  return runForeignCatalogRead(supplierCompanyId, async (scope) => {
    const viewer = await showcaseViewerOf(scope, source);
    const admitted = (edition: StoredCatalogEdition) =>
      isPayloadOwnedByCompany(edition, supplierCompanyId) && (edition.audience.kind !== 'anonymous' || showcaseLive);
    return work(scope, { viewer, admitted, visible: (edition) => admitted(edition) && editionVisibleTo(edition, viewer) });
  });
}

/** Η όψη του ιδιοκτήτη: πεδίο προς πεδίο, χωρίς διαδρομή αποθήκευσης και χωρίς τις σφραγίδες της εγγραφής. */
function ownerViewOf(edition: StoredCatalogEdition): CatalogEditionOwnerView {
  const file = { sizeBytes: edition.file.sizeBytes, pageCount: edition.file.pageCount, sha256: edition.file.sha256 };
  return {
    id: edition.id,
    shelfKey: edition.shelfKey,
    title: edition.title,
    language: edition.language,
    audience: edition.audience,
    source: edition.source,
    file,
    status: edition.status,
    publishedAt: edition.publishedAt,
    publishedBy: edition.publishedBy,
    endedAt: edition.endedAt,
    endedBy: edition.endedBy,
    supersededBy: edition.supersededBy,
  };
}

/** Ό,τι έχει δημοσιεύσει ο χώρος, με τις αποσυρμένες: η οθόνη του ιδιοκτήτη. */
export async function readOwnedCatalogEditions(ctx: AuthContext): Promise<CatalogEditionOwnerView[]> {
  return (await readCompanyEditions(getAdminFirestore(), ctx.companyId)).map(ownerViewOf);
}

/**
 * Τα έντυπα που βλέπει ο θεατής, τα νεότερα πρώτα. Το «αντικαταστάθηκε από» δείχνει μόνο σε ορατή έκδοση· το «ισχύον» κάθε
 * ραφιού το σημαδεύει ο **ίδιος** κριτής με τον σταθερό σύνδεσμο (`currentEditionIds` → `latestVisibleEdition`).
 */
export function readCatalogEditionsFor(supplierCompanyId: string, source: ShowcaseViewerSource): Promise<CatalogEditionView[]> {
  return judgeAs(supplierCompanyId, source, async (scope, { viewer, visible }) => {
    const shown = (await readViewableEditionsInTx(scope.tx, scope.db, supplierCompanyId)).filter(visible);
    const visibleIds = new Set(shown.map((edition) => edition.id));
    const currentIds = currentEditionIds(shown, viewer);
    return shown.flatMap((edition) => catalogEditionViewOf(edition.id, edition, { visibleIds, currentIds }) ?? []);
  });
}

/**
 * Τα ανώνυμα έντυπα της βιτρίνας, για τη σελίδα ISR: ίδια για κάθε επισκέπτη, άρα αποθηκεύσιμα. Tags εταιρείας (ανάκληση
 * βιτρίνας) και εκδόσεων (δημοσίευση · απόσυρση).
 */
export function readPublicCatalogEditions(supplierCompanyId: string): Promise<CatalogEditionView[]> {
  const tags = [publicCatalogCompanyTag(supplierCompanyId), publicCatalogEditionsTag(supplierCompanyId)];
  return cached(() => readCatalogEditionsFor(supplierCompanyId, { kind: 'anonymous' }), ['editions', supplierCompanyId], tags);
}

/** Το ισχύον έντυπο ενός ραφιού για αυτόν τον θεατή (ο στόχος του σταθερού συνδέσμου ραφιού). `null` ⇒ τίποτα ορατό. */
export function resolveLatestCatalogEdition(supplierCompanyId: string, source: ShowcaseViewerSource, shelfKey: string): Promise<string | null> {
  return judgeAs(supplierCompanyId, source, async (scope, { viewer, admitted }) => {
    const shelf = await readShelfInTx(scope.tx, scope.db, { companyId: supplierCompanyId, shelfKey, status: 'published' });
    return latestVisibleEdition(shelf.filter(admitted), viewer)?.id ?? null;
  });
}

export interface SignedCatalogEditionFile {
  readonly url: string;
  readonly expiresAt: number;
}

/** Η βραχύβια άδεια ανάγνωσης του αρχείου, **μόνο** αφού κριθεί ο θεατής. `null` ⇒ ίδιο 404 για κάθε «όχι». */
export async function signCatalogEditionFile(supplierCompanyId: string, source: ShowcaseViewerSource, editionId: string): Promise<SignedCatalogEditionFile | null> {
  if (!isEditionId(editionId)) return null;
  const storagePath = await judgeAs(supplierCompanyId, source, async (scope, { visible }) => {
    const edition = await readCatalogEditionInTx(scope.tx, scope.db, editionId);
    return edition !== null && visible(edition) ? edition.file.storagePath : null;
  });
  return storagePath === null ? null : signEditionPath(storagePath);
}

/** Η μία υπογραφή, για κάθε πόρτα — πάντα **μετά** την κρίση. */
async function signEditionPath(storagePath: string): Promise<SignedCatalogEditionFile | null> {
  // Ο κάδος των εκδόσεων, ρητά (ADR-895 Α2): το αρχείο ανήκει στη διαδρομή του εκδότη, όχι σε `FileRecord`.
  const signed = await signedDownloadUrl({ bucket: publicationBucket(), storagePath });
  return signed.outcome === 'signed' ? { url: signed.url, expiresAt: signed.expiresAt } : null;
}

/**
 * Η άδεια του **ιδιοκτήτη** για το δικό του έντυπο: βλέπει ό,τι θα δει το κοινό του πριν το μοιραστεί (ADR-923 §5.15.3).
 * 🔒 Κάτοχος = ο χώρος της σύνδεσης· ξένο ≡ ανύπαρκτο. Η αποσυρμένη **όχι**: η διατήρηση έχει ήδη το δικαίωμα να τη διαθέσει.
 */
export async function signOwnedCatalogEditionFile(ctx: AuthContext, editionId: string): Promise<SignedCatalogEditionFile | null> {
  if (!isEditionId(editionId)) return null;
  const edition = await readCatalogEdition(getAdminFirestore(), editionId);
  const readable = edition !== null && isPayloadOwnedByCompany(edition, ctx.companyId) && edition.status !== 'withdrawn';
  return readable ? signEditionPath(edition.file.storagePath) : null;
}

/** Ο προμηθευτής πίσω από τη σχέση **του αγοραστή** (ξένη ≡ ανύπαρκτη). Η ενεργότητα κρίνεται μέσα στη συναλλαγή της ανάγνωσης. */
export async function supplierOfBuyerRelationship(ctx: AuthContext, relationshipId: string): Promise<string | null> {
  if (!isRelationshipId(relationshipId)) return null;
  return (await readBuyerRelationship(getAdminFirestore(), ctx.companyId, relationshipId))?.companyId ?? null;
}
