import 'server-only';

/**
 * =============================================================================
 * Η ΔΗΜΟΣΙΕΥΣΗ ΕΚΔΟΣΗΣ ΤΙΜΟΚΑΤΑΛΟΓΟΥ — «επιβεβαιώνεις ό,τι είδες» (ADR-923 §5.11 «3β» απόφαση Γ · §18)
 * =============================================================================
 *
 * Δύο βήματα, γιατί οι γραμμές μπορεί να είναι χιλιάδες:
 *   1. **Εκτός** συναλλαγής: διαβάζονται οι γραμμές πρόχειρης **και** τρέχουσας δημοσιευμένης, υπολογίζονται
 *      `linesHash` (fnv1a64 του κανονικού JSON), διαφορά (`diffPriceVersions`, με τον φράχτη **της λίστας**) και το
 *      **αποτύπωμα της φραγμένης διαφοράς** (`diffDigest`).
 *   2. **Μέσα** στη συναλλαγή: CAS στην αναθεώρηση της έκδοσης **και** στο `linesRevision` (καμία γραμμή δεν άλλαξε
 *      από το βήμα 1) · ίδια βάση σύγκρισης (καμία άλλη δημοσίευση στο μεταξύ) · `judgeVersionPublication` · φράχτης ·
 *      σφραγίδα · η προηγούμενη `published` → `superseded`. **Δύο** εγγραφές, άρα κανένα όριο μεγέθους.
 *
 * 🏆 Πέρα από τους μεγάλους (SAP release status: «released» ή όχι): η επιβεβαίωση **δεν** είναι σημαία «ναι, σίγουρα»
 * αλλά το **αποτύπωμα** της διαφοράς που είδε ο άνθρωπος. Αν άλλαξε κάτι από τότε (άλλη γραμμή, άλλη βάση), το
 * αποτύπωμα δεν ταιριάζει ⇒ 409 — δεν δημοσιεύεται ποτέ διαφορά που δεν είδε κανείς.
 * @module server/catalog/price-publication.server
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { fnv1a64Hex } from '@/lib/hash/fnv1a';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { diffPriceVersions } from '@/subapps/catalog/pricing/diff-price-versions';
import { judgeVersionPublication, publishedTimeline } from '@/subapps/catalog/pricing/version-timeline';
import type { PricePublicationPreview, PublishPriceVersionRequest } from '@/subapps/catalog/types/price-list-requests';
import type { PriceListDefinition, PriceListLineDefinition, StoredPriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import { effectiveFenceBp } from '@/subapps/catalog/vocabulary/pricing';
import { assertRevision, readOwned, runCatalogTransaction, stageReplace, type CatalogTx } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertSeeded, versionDefinitionOf, type StoredPriceLine, type StoredPriceVersion } from './price-version-aggregate.server';
import { readListVersions, readListVersionsSnapshot, readVersionLines, versionRefOf } from './price-version-reads.server';

/** Μόνο ο **ορισμός** της γραμμής (χωρίς περίβλημα/παράγωγα) — ό,τι συγκρίνει η διαφορά και σφραγίζει το hash. */
function lineDefinitionOf(line: StoredPriceLine): PriceListLineDefinition {
  const { versionId, subject, netPrice, priceQuantity, unitCode, discountGroupId, breakdown } = line;
  return { versionId, subject, netPrice, priceQuantity, unitCode, discountGroupId, breakdown };
}

/**
 * Το περιεχόμενο της έκδοσης χωρίς την ταυτότητά της: δύο εκδόσεις με ίδιες γραμμές έχουν **ίδιο** hash. Η σειρά
 * είναι **ρητά** το κλειδί υποκειμένου — όχι η σειρά ανάγνωσης (κατά id, που αλλάζει από έκδοση σε έκδοση).
 */
function linesHashOf(lines: readonly StoredPriceLine[]): string {
  const ordered = [...lines].sort((a, b) => (a.derived.subjectKey < b.derived.subjectKey ? -1 : a.derived.subjectKey > b.derived.subjectKey ? 1 : 0));
  return fnv1a64Hex(canonicalJson(ordered.map((line) => ({ ...lineDefinitionOf(line), versionId: null }))));
}

interface PublicationPlan {
  readonly preview: PricePublicationPreview;
  readonly linesHash: string;
  readonly lineCount: number;
}

function latestPublished(versions: readonly StoredPriceVersion[], exceptId: string): StoredPriceVersion | null {
  const timeline = publishedTimeline(versions.filter((version) => version.id !== exceptId).map(versionRefOf));
  const latestId = timeline.length === 0 ? null : timeline[timeline.length - 1].version.id;
  return versions.find((version) => version.id === latestId) ?? null;
}

async function planPublication(
  db: Firestore,
  ctx: AuthContext,
  version: StoredPriceVersion,
  list: PriceListDefinition,
): Promise<PublicationPlan> {
  const versions = await readListVersionsSnapshot(db, ctx.companyId, version.priceListId);
  const previous = latestPublished(versions, version.id);
  const draftLines = await readVersionLines(db, ctx.companyId, version.id);
  const previousLines = previous === null ? [] : await readVersionLines(db, ctx.companyId, previous.id);
  const fenceBp = effectiveFenceBp(list.changeFenceBp);
  const diff = diffPriceVersions(previousLines.map(lineDefinitionOf), draftLines.map(lineDefinitionOf), fenceBp);
  const fenced = diff.changes.filter((change) => change.exceedsFence);
  const diffDigest =
    fenced.length === 0 ? null : fnv1a64Hex(canonicalJson({ previousVersionId: previous?.id ?? null, fenceBp, fenced }));
  const preview: PricePublicationPreview = {
    versionId: version.id,
    previousVersionId: previous?.id ?? null,
    linesRevision: version.derived.linesRevision,
    fenceBp,
    diff,
    diffDigest,
  };
  return { preview, linesHash: linesHashOf(draftLines), lineCount: draftLines.length };
}

interface PlanInputs {
  readonly version: StoredPriceVersion;
  readonly list: PriceListDefinition;
}

async function readPlanInputs(ctx: AuthContext, versionId: string): Promise<PlanInputs> {
  return runCatalogTransaction(ctx, async (scope) => {
    const version = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', versionId);
    const list = await readOwned<PriceListDefinition>(scope, 'priceList', version.priceListId);
    return { version, list };
  });
}

/** `GET /api/catalog/price-list-versions/[id]/diff` — ό,τι θα δει ο άνθρωπος πριν δημοσιεύσει. */
export async function previewPublication(ctx: AuthContext, versionId: string): Promise<PricePublicationPreview> {
  const { version, list } = await readPlanInputs(ctx, versionId);
  return (await planPublication(getAdminFirestore(), ctx, version, list)).preview;
}

/** Ο φράχτης: φραγμένη διαφορά ⇒ χρειάζεται **το ίδιο** αποτύπωμα που είδε ο άνθρωπος. */
function assertFenceConfirmed(preview: PricePublicationPreview, confirmed: string | null): void {
  if (preview.diffDigest === null) return;
  const details = { fencedCount: preview.diff.fenced, diffDigest: preview.diffDigest };
  const path = 'confirmedDiffDigest';
  if (confirmed === null) {
    const issue = { code: 'fenceConfirmationRequired' as const, path, params: { count: preview.diff.fenced } };
    throw new CatalogWriteError('confirmationRequired', [issue], details);
  }
  if (confirmed !== preview.diffDigest) {
    throw new CatalogWriteError('confirmationRequired', [{ code: 'fenceDigestStale', path }], details);
  }
}

/** Μέσα στη συναλλαγή: τίποτα από όσα κρίθηκαν στο βήμα 1 δεν άλλαξε. */
async function readForPublish(scope: CatalogTx, plan: PublicationPlan, request: PublishPriceVersionRequest) {
  const version = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', plan.preview.versionId);
  assertRevision(version, request.expectedRevision);
  assertSeeded(version);
  const linesRevision = version.derived.linesRevision;
  if (linesRevision !== request.expectedLinesRevision || linesRevision !== plan.preview.linesRevision) {
    throw new CatalogWriteError('revisionMismatch', [], { currentRevision: linesRevision });
  }
  const versions = await readListVersions(scope, version.priceListId);
  const previous = latestPublished(versions, version.id);
  // Άλλη δημοσίευση στο μεταξύ ⇒ η διαφορά που είδε ο άνθρωπος συγκρίθηκε με **άλλη** βάση.
  if ((previous?.id ?? null) !== plan.preview.previousVersionId) {
    throw new CatalogWriteError('revisionMismatch', [], { currentRevision: version.revision });
  }
  const issue = judgeVersionPublication(versionRefOf(version), versions.map(versionRefOf));
  if (issue === 'versionNotDraft') throw new CatalogWriteError('immutable', [{ code: issue, path: 'status' }]);
  if (issue !== null) throw new CatalogWriteError('invalid', [{ code: issue, path: 'validFrom' }]);
  return { version, previous };
}

/** `POST /api/catalog/price-list-versions/[id]/publish`. */
export async function publishPriceListVersion(
  ctx: AuthContext,
  versionId: string,
  request: PublishPriceVersionRequest,
): Promise<StoredPriceVersion> {
  const { version, list } = await readPlanInputs(ctx, versionId);
  const plan = await planPublication(getAdminFirestore(), ctx, version, list);
  assertFenceConfirmed(plan.preview, request.confirmedDiffDigest);
  return runCatalogTransaction(ctx, async (scope) => {
    const { version: current, previous } = await readForPublish(scope, plan, request);
    const seal = {
      linesHash: plan.linesHash,
      lineCount: plan.lineCount,
      publishedAt: scope.now,
      publishedBy: ctx.uid,
      fenceBp: plan.preview.fenceBp,
      fencedCount: plan.preview.diff.fenced,
      confirmedDiffDigest: plan.preview.diffDigest,
    };
    if (previous !== null) stageReplace(scope, 'priceListVersion', previous, { ...versionDefinitionOf(previous), status: 'superseded' });
    return stageReplace(scope, 'priceListVersion', current, { ...versionDefinitionOf(current), status: 'published', seal });
  });
}
