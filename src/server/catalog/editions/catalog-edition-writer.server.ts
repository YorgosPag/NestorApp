import 'server-only';

/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΩΝ ΔΗΜΟΣΙΕΥΜΕΝΩΝ ΕΚΔΟΣΕΩΝ (ADR-923 §5.15 Η1 · Η2)
 * =============================================================================
 *
 * ```
 * δημοσίευση: κρίση (εκτός) → κράτηση GCS → συναλλαγή { κρίση ξανά · ιδεμποτία · νέα · αντικατάσταση · μετρητής +1 }
 * απόσυρση:   συναλλαγή { → withdrawn · επαναφορά προκατόχου · μετρητής −1 } → κράτηση GCS κατά τον ένα κριτή
 * ```
 *
 * 🔑 **Μία συναλλαγή** για τις εγγραφές εκδόσεων και τον μετρητή `publishedEditions` της διαδρομής του εκδότη: η διατήρηση
 *    δεν βλέπει ποτέ δημοσιευμένο έντυπο με μετρητή μηδέν (Η2). Ο μετρητής μετρά τις **μη αποσυρμένες** εκδόσεις: η
 *    αντικατεστημένη μένει ανοιχτή ως «παλαιότερη έκδοση» (πρακτική Publitas / ArchiExpo), άρα και το αρχείο της.
 * 🔑 **Η απόσυρση της ισχύουσας επαναφέρει τον προκάτοχο** (`restoredOnWithdrawal`): μια λανθασμένη νέα έκδοση δεν αφήνει το
 *    κοινό χωρίς έντυπο. Ο προκάτοχος δεν αλλάζει μετρητή: ήταν ήδη μη αποσυρμένος.
 * 🔑 **Σειρά της κράτησης** (§5.6.1): μπαίνει **πριν** από την εγγραφή που τη χρειάζεται, φεύγει **μετά** από την εγγραφή που
 *    αφαιρεί τον λόγο της· και τα δύο τα κρίνει το `publicationHeldByPlatform`.
 * 🔑 **Ιδεμπότητο**: ίδια έκδοση εκδότη + ίδιο κοινό + ήδη ισχύουσα ⇒ η ίδια, καμία εγγραφή· αποσυρμένη ⇒ η ίδια.
 * 🔒 Τίτλος, γλώσσα και αρχείο από τον διακομιστή (συνταγή · artifact), ποτέ από το αίτημα. Θ4 στον κριτή (`publishabilityOf`).
 * @module server/catalog/editions/catalog-edition-writer.server
 */

import type { Transaction } from 'firebase-admin/firestore';

import { CATALOG_EDITION_TRACKED_FIELDS } from '@/config/audit-tracked-fields-catalog';
import { resolveLocalizedText } from '@/i18n/localized-text';
import type { AuthContext } from '@/lib/auth';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import { generateCatalogEditionId } from '@/services/enterprise-id.service';
import { isEnterpriseIdOfPrefix } from '@/services/enterprise-id-parse';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import {
  editionAudienceKey,
  publishabilityOf,
  restoredOnWithdrawal,
  supersededBy,
  type CatalogEditionRefusal,
} from '@/subapps/catalog/publishing/catalog-edition-policy';
import { retentionPatch } from '@/subapps/catalog/publishing/publication-retention';
import type { CatalogIssueCode } from '@/subapps/catalog/schema/catalog-issues';
import type { PublishCatalogEditionBody } from '@/subapps/catalog/schema/zod/catalog-edition.schema';
import type { CatalogEditionAudience } from '@/subapps/catalog/types/catalog-edition';
import type { CustomerGroupDefinition } from '@/subapps/catalog/types/price-list';
import type { PublicationArtifact, PublicationRecipeDefinition } from '@/subapps/catalog/types/publication';
import { readActiveByIds } from '../catalog-library-reads.server';
import { readOwned, runCatalogReadOnly, type StoredCatalogRecord } from '../catalog-store.server';
import { assertNoIssues } from '../catalog-write-error';
import {
  readOwnedPublicationRun,
  readPublicationRunInTx,
  recordPublicationRunChange,
  stagePublicationRunChange,
  type StagedPublicationRunChange,
  type StoredPublicationRun,
} from '../publishing/publication-run.server';
import { placeArtifactHolds, syncArtifactHolds } from '../publishing/publication-retention.server';
import { revalidatePublicEditions } from '../public/public-model-revalidate.server';
import { catalogEditionRef, readCatalogEditionInTx, readShelfInTx, type StoredCatalogEdition } from './catalog-edition-store.server';

/** Κάθε άρνηση του κριτή, με τον κωδικό που βλέπει ο άνθρωπος (εξαντλητικό: νέα άρνηση ⇒ σφάλμα τύπου εδώ). */
const REFUSAL_ISSUES: Readonly<Record<CatalogEditionRefusal, CatalogIssueCode>> = {
  notReady: 'catalogEditionNotReady',
  disposed: 'catalogEditionDisposed',
  disposalDue: 'catalogEditionDisposalDue',
  priced: 'catalogEditionPriced',
  noScreenFile: 'catalogEditionNoScreenFile',
};

function refuse(code: CatalogIssueCode, path: string): never {
  assertNoIssues([{ code, path }]);
  throw new Error(code);
}

interface Publishable {
  readonly run: StoredPublicationRun;
  readonly artifact: PublicationArtifact;
}

/** Η έκδοση του εκδότη, δημοσιεύσιμη **τώρα** από αυτόν τον χώρο — αλλιώς άρνηση με τον λόγο της. Ξένη ≡ ανύπαρκτη. */
function publishableOf(run: StoredPublicationRun | null, ctx: AuthContext, now: string): Publishable {
  if (run === null || !isPayloadOwnedByCompany(run, ctx.companyId)) return refuse('unknownReference', 'runId');
  const verdict = publishabilityOf(run, now);
  return verdict.ok ? { run, artifact: verdict.artifact } : refuse(REFUSAL_ISSUES[verdict.refusal], 'runId');
}

interface PublishingFacts {
  readonly run: StoredPublicationRun;
  readonly recipe: StoredCatalogRecord<PublicationRecipeDefinition>;
}

/** Η πρώτη κρίση (γρήγορη άρνηση πριν από κάθε κράτηση), η συνταγή (τίτλος · γλώσσα · ράφι) και η ύπαρξη της ομάδας. */
async function readPublishingFacts(ctx: AuthContext, body: PublishCatalogEditionBody): Promise<PublishingFacts> {
  if (!isEnterpriseIdOfPrefix(body.runId, ENTERPRISE_ID_PREFIXES.CATALOG_PUBLICATION_RUN)) refuse('unknownReference', 'runId');
  const { run } = publishableOf(await readOwnedPublicationRun(ctx, body.runId), ctx, nowISO());
  const recipe = await runCatalogReadOnly(ctx, async (scope) => {
    if (body.audience.kind === 'customerGroup') {
      const groups = await readActiveByIds<CustomerGroupDefinition>(scope, 'customerGroup', [body.audience.customerGroupId]);
      if (groups.size !== 1) refuse('unknownReference', 'audience.customerGroupId');
    }
    return readOwned<PublicationRecipeDefinition>(scope, 'publicationRecipe', run.recipeId);
  });
  return { run, recipe };
}

function newEdition(ctx: AuthContext, recipe: PublishingFacts['recipe'], audience: CatalogEditionAudience, source: Publishable, now: string): StoredCatalogEdition {
  const { run, artifact } = source;
  return {
    id: generateCatalogEditionId(),
    companyId: ctx.companyId,
    shelfKey: recipe.id,
    title: recipe.title,
    language: recipe.language,
    audience,
    source: { kind: 'publication', runId: run.id, profile: 'screen' },
    file: { storagePath: artifact.storagePath, sizeBytes: artifact.sizeBytes, pageCount: artifact.pageCount, sha256: artifact.sha256 },
    status: 'published',
    publishedAt: now,
    publishedBy: ctx.uid,
    endedAt: null,
    endedBy: null,
    supersededBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

type EditionWrite = { readonly before: StoredCatalogEdition | null; readonly after: StoredCatalogEdition };

interface EditionOutcome {
  readonly edition: StoredCatalogEdition;
  readonly writes: readonly EditionWrite[];
  readonly run: StagedPublicationRunChange | null;
}

const unchanged = (edition: StoredCatalogEdition): EditionOutcome => ({ edition, writes: [], run: null });

/** Μία αλλαγή κατάστασης μέσα στη συναλλαγή, έτοιμη για το ιστορικό. */
function stageEdition(tx: Transaction, before: StoredCatalogEdition, patch: Partial<StoredCatalogEdition>, now: string): EditionWrite {
  const after: StoredCatalogEdition = { ...before, ...patch, updatedAt: now };
  tx.set(catalogEditionRef(getAdminFirestore(), after.id), after);
  return { before, after };
}

/** Μετά το commit: η μνήμη της βιτρίνας (μόνο αν άλλαξε κάτι) και το ιστορικό κάθε έκδοσης και της διαδρομής (ADR-195). */
async function recordOutcome(outcome: EditionOutcome, performedBy: string): Promise<void> {
  if (outcome.writes.length > 0) revalidatePublicEditions(outcome.edition.companyId);
  await Promise.all(outcome.writes.map(({ before, after }) => recordTrackedEntityWrite({
    entityType: 'catalog_edition',
    entityId: after.id,
    entityName: resolveLocalizedText(after.title, after.language),
    trackedFields: CATALOG_EDITION_TRACKED_FIELDS,
    before,
    after,
    performedBy,
    ledger: { companyId: after.companyId },
  })));
  await recordPublicationRunChange(outcome.run, performedBy);
}

const countPublished = (delta: 1 | -1) => (run: StoredPublicationRun) =>
  retentionPatch(run, { publishedEditions: Math.max(0, run.retention.publishedEditions + delta) });

function publishInTx(ctx: AuthContext, facts: PublishingFacts, audience: CatalogEditionAudience): Promise<EditionOutcome> {
  const db = getAdminFirestore();
  return db.runTransaction(async (tx) => {
    const now = nowISO();
    const source = publishableOf(await readPublicationRunInTx(tx, facts.run.id), ctx, now);
    const shelf = await readShelfInTx(tx, db, { companyId: ctx.companyId, shelfKey: facts.recipe.id, status: 'published' });
    const key = editionAudienceKey(audience);
    const same = shelf.find((edition) => edition.source.runId === source.run.id && editionAudienceKey(edition.audience) === key);
    if (same) return unchanged(same);
    const edition = newEdition(ctx, facts.recipe, audience, source, now);
    tx.set(catalogEditionRef(db, edition.id), edition);
    const ended = { status: 'superseded' as const, supersededBy: edition.id, endedAt: now, endedBy: ctx.uid };
    const replaced = supersededBy(shelf, edition).map((old) => stageEdition(tx, old, ended, now));
    const run = stagePublicationRunChange(tx, source.run, countPublished(1));
    return { edition, writes: [{ before: null, after: edition }, ...replaced], run };
  });
}

/**
 * «Δημοσίευση σε…»: η έκδοση του εκδότη γίνεται έντυπο που διαβάζει αυτό το κοινό. Η προηγούμενη ισχύουσα του ίδιου ραφιού
 * και κοινού γίνεται «παλαιότερη έκδοση» και δείχνει στη νέα.
 */
export async function publishCatalogEdition(ctx: AuthContext, body: PublishCatalogEditionBody): Promise<StoredCatalogEdition> {
  const facts = await readPublishingFacts(ctx, body);
  await placeArtifactHolds(facts.run);
  try {
    const outcome = await publishInTx(ctx, facts, body.audience);
    await recordOutcome(outcome, ctx.uid);
    return outcome.edition;
  } catch (cause) {
    // Η κράτηση μπήκε για εγγραφή που δεν έγινε: επιστρέφει σε ό,τι λέει η εγγραφή της διαδρομής.
    const current = await readOwnedPublicationRun(ctx, facts.run.id);
    if (current !== null) await syncArtifactHolds(current);
    throw cause;
  }
}

function withdrawInTx(ctx: AuthContext, id: string): Promise<EditionOutcome> {
  if (!isEnterpriseIdOfPrefix(id, ENTERPRISE_ID_PREFIXES.CATALOG_EDITION)) refuse('unknownReference', 'id');
  const db = getAdminFirestore();
  return db.runTransaction(async (tx) => {
    const edition = await readCatalogEditionInTx(tx, db, id);
    if (edition === null || !isPayloadOwnedByCompany(edition, ctx.companyId)) return refuse('unknownReference', 'id');
    if (edition.status === 'withdrawn') return unchanged(edition);
    // Όλες οι αναγνώσεις πριν από κάθε εγγραφή (κανόνας συναλλαγών Firestore).
    const predecessors = await readShelfInTx(tx, db, { companyId: edition.companyId, shelfKey: edition.shelfKey, status: 'superseded' });
    const run = await readPublicationRunInTx(tx, edition.source.runId);
    const now = nowISO();
    const withdrawn = stageEdition(tx, edition, { status: 'withdrawn', endedAt: now, endedBy: ctx.uid }, now);
    const restored = restoredOnWithdrawal(predecessors, edition);
    const reopened = restored === null ? [] : [stageEdition(tx, restored, { status: 'published', supersededBy: null, endedAt: null, endedBy: null }, now)];
    const staged = run === null ? null : stagePublicationRunChange(tx, run, countPublished(-1));
    return { edition: withdrawn.after, writes: [withdrawn, ...reopened], run: staged };
  });
}

/**
 * «Απόσυρση»: το έντυπο κλείνει για κάθε θεατή (ίδιο 404 με το ανύπαρκτο). Η διαδρομή του εκδότη επιστρέφει στον κανονικό
 * κανόνα διατήρησης μόλις δεν τη δείχνει καμία μη αποσυρμένη έκδοση. Ιδεμπότητο.
 */
export async function withdrawCatalogEdition(ctx: AuthContext, id: string): Promise<StoredCatalogEdition> {
  const outcome = await withdrawInTx(ctx, id);
  await recordOutcome(outcome, ctx.uid);
  if (outcome.run?.changed) await syncArtifactHolds(outcome.run.after);
  return outcome.edition;
}
