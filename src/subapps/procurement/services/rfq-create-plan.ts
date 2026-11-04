import 'server-only';

/**
 * **Ό,τι γίνεται ΠΡΙΝ από τη συναλλαγή του `createRfq`** (ADR-923 §5.13 Ε6, Τ4): ασύγχρονες κρίσεις χωρίς κλειδώματα.
 *
 * 🔑 Η συναλλαγή του Firestore ξανατρέχει σε σύγκρουση. Ό,τι κοστίζει δίκτυο ή κρυπτογραφία και **δεν** χρειάζεται συνέπεια
 *    με τα έγγραφα που γράφονται γίνεται εδώ, **μία** φορά: κρίση SKU (σχέση ή βιτρίνα), επωνυμία από τη βιτρίνα, πρόσκληση
 *    με διαπιστευτήριο, όνομα του δρώντα. Η επαφή του προμηθευτή έχει **ντετερμινιστικό** id, άρα η πρόσκλησή της
 *    προετοιμάζεται εδώ, πριν μάθουμε αν η επαφή υπάρχει.
 * 🔑 Κάθε άρνηση φεύγει **πριν** γραφτεί οτιδήποτε. Ό,τι πρέπει να κερδίσει αγώνα (το opt-in, η επαφή) ξανακρίνεται μέσα
 *    στη συναλλαγή (`rfq-create-transaction.ts`).
 *
 * @module subapps/procurement/services/rfq-create-plan
 */

import admin from 'firebase-admin';

import { SAFE_BATCH_WRITES } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { userPerformer } from '@/lib/audit/audit-performer';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { resolvePerformer, type ResolvedPerformer } from '@/server/lib/performer-stamp';
import { resolveQuoteSku, type QuoteSku } from '@/server/supply-relationships/supply-quote-sku.server';
import { generateDeterministicPlatformCompanyContactId } from '@/services/enterprise-id-convenience-catalog';
import { readPublicSupplier } from '@/services/public-catalog/public-catalog.reader';

import type { CreateRfqDTO, RFQ } from '../types/rfq';
import { RFQ_FROM_BOQ_MAX_ITEMS } from '../types/rfq';
import { RfqCreateRefusal } from '../types/rfq-create-refusal';
import { pendingInviteDelivery } from '../types/vendor-invite-delivery';
import type { CatalogSkuAddress, CreateRfqCatalogLineDTO, RfqLineSource } from '../types/rfq-line';
import { defaultResponseLock } from '../utils/rfq-response-lock';
import { toAdminTimestampOrNull } from './procurement-timestamps';
import { admitQuoteRequestPairs, readQuoteRequestPairCounts } from './quote-request-pair-quota';
import { prepareVendorInvite, type PreparedVendorInvite } from './vendor-invite-issue';
import { fetchVendorContact } from './vendor-recipient';

/** Μια γραμμή καταλόγου με το SKU που έκρινε ο διακομιστής. */
export interface PlannedCatalogLine {
  readonly line: CreateRfqCatalogLineDTO;
  readonly sku: QuoteSku;
}

/** Ένας προμηθευτής της πλατφόρμας που θα λάβει πρόσκληση μέσω της επαφής του στον αγοραστή. */
export interface PlannedSupplier {
  readonly supplierCompanyId: string;
  /** Από τη **βιτρίνα** του προμηθευτή — ποτέ από τον πελάτη. */
  readonly legalName: string;
  readonly contactId: string;
}

export interface RfqCreatePlan {
  readonly rfqId: string;
  readonly catalogLines: readonly PlannedCatalogLine[];
  readonly suppliers: readonly PlannedSupplier[];
  /** Οι προσκεκλημένοι του σώματος **και** οι επαφές των προμηθευτών, χωρίς διπλότυπα, με τη σειρά που ήρθαν. */
  readonly invitedVendorIds: readonly string[];
  readonly invites: readonly PreparedVendorInvite[];
  /**
   * ADR-923 §5.13 Τ5 — **κάθε** χώρος της πλατφόρμας που θα λάβει αυτό το RFQ: οι προμηθευτές των γραμμών καταλόγου **και**
   * οι επαφές πλατφόρμας του `invitedVendorIds`. Η ποσόστωση ζεύγους μετρά όλους, μέσα στη συναλλαγή.
   */
  readonly quotaSupplierIds: readonly string[];
  /** Μόνο όταν θα γεννηθεί επαφή: το όνομα του δρώντα λύνεται έξω από τη συναλλαγή, ώστε η επανάληψή της να μη διαβάζει. */
  readonly performer: ResolvedPerformer | null;
}

/** Οι εγγραφές μιας δημιουργίας RFQ, στο **άνω** όριό τους: κάθε προμηθευτής μετρά σαν να γεννά επαφή. */
export interface RfqWriteCount {
  readonly boqItems: number;
  readonly adHocLines: number;
  readonly catalogLines: number;
  readonly invites: number;
  readonly suppliers: number;
  readonly sourcingEvent: boolean;
  /** ADR-923 §5.13 Τ5 — το έγγραφο της ποσόστωσης ζεύγους (`quote_request_pair_quotas`), όταν μπορεί να γραφτεί. */
  readonly pairQuota?: boolean;
}

/** RFQ + γραμμές + {πρόσκληση, διαπιστευτήριο} ανά παραλήπτη + επαφές + το πακέτο + η ποσόστωση ζεύγους. */
export function countRfqWrites(count: RfqWriteCount): number {
  const lines = count.boqItems + count.adHocLines + count.catalogLines;
  return 1 + lines + 2 * count.invites + count.suppliers + (count.sourcingEvent ? 1 : 0) + (count.pairQuota ? 1 : 0);
}

/** Το ένα commit του έργου (`SAFE_BATCH_WRITES`): πάνω από αυτό το RFQ δεν γεννιέται μισό, αρνείται ολόκληρο. */
export function assertRfqFitsOneCommit(count: RfqWriteCount): void {
  const writes = countRfqWrites(count);
  if (writes > SAFE_BATCH_WRITES) throw new RfqCreateRefusal('rfqTooLarge', `${writes} writes > ${SAFE_BATCH_WRITES}`);
}

/** Το κριμένο SKU ή η άρνησή του: **μία** κρίση για τη δημιουργία και για την προσυμπλήρωση (`rfq-catalog-draft.ts`, Τ6). */
export async function requireQuoteSku(ctx: AuthContext, address: CatalogSkuAddress): Promise<QuoteSku> {
  const sku = await resolveQuoteSku(ctx, address);
  if (sku === null) throw new RfqCreateRefusal('catalogSkuUnavailable', `${address.supplierCompanyId}/${address.variantId}`);
  return sku;
}

async function planCatalogLine(ctx: AuthContext, line: CreateRfqCatalogLineDTO): Promise<PlannedCatalogLine> {
  return { line, sku: await requireQuoteSku(ctx, line) };
}

/**
 * Η επωνυμία από τη βιτρίνα ή η άρνηση. Ο προμηθευτής χωρίς επιβεβαιωμένη βιτρίνα δεν έχει opt-in (§5.13 Ε6β), άρα δεν δέχεται
 * αιτήματα σε καμία διαδρομή. Την ίδια κρίση κάνει και η προσυμπλήρωση.
 */
export async function requireQuoteSupplierName(supplierCompanyId: string): Promise<string> {
  const showcase = await readPublicSupplier(supplierCompanyId);
  if (showcase === null) throw new RfqCreateRefusal('supplierNotAcceptingQuotes', supplierCompanyId);
  return showcase.legalName;
}

async function planSupplier(buyerCompanyId: string, supplierCompanyId: string): Promise<PlannedSupplier> {
  const legalName = await requireQuoteSupplierName(supplierCompanyId);
  const contactId = generateDeterministicPlatformCompanyContactId(buyerCompanyId, supplierCompanyId);
  return { supplierCompanyId, legalName, contactId };
}

function prepareInvites(ctx: AuthContext, rfqId: string, vendorIds: readonly string[]): Promise<PreparedVendorInvite[]> {
  return Promise.all(vendorIds.map((vendorContactId) => prepareVendorInvite({
    companyId: ctx.companyId,
    rfqId,
    vendorContactId,
    deliveryChannel: 'email',
    preferredChannel: null,
    status: 'sent',
    recipientEmail: null,
    recipientName: null,
    issuedVia: 'rfq_fanout',
    issuedBy: ctx.uid,
    // ADR-923 §5.13 Τ5 — η πρόθεση «οφείλει να σταλεί» γράφεται ΜΑΖΙ με το RFQ (transactional outbox).
    delivery: pendingInviteDelivery(Date.now()),
  })));
}

const uniqueInOrder = (ids: readonly string[]): string[] => [...new Set(ids)];

/**
 * Οι χώροι της πλατφόρμας πίσω από τους προσκεκλημένους του σώματος. Το `platformCompanyId` το γράφει μόνο ο διακομιστής
 * (`firestore.rules`), άρα η ανάγνωση έξω από τη συναλλαγή δεν ανοίγει αγώνα.
 */
async function platformSuppliersOf(buyerCompanyId: string, contactIds: readonly string[]): Promise<string[]> {
  const contacts = await Promise.all(contactIds.map((id) => fetchVendorContact(buyerCompanyId, id)));
  return contacts.flatMap((contact) => (contact?.platformCompanyId ? [contact.platformCompanyId] : []));
}

/**
 * Πρόωρη άρνηση (ADR-923 §5.13 Τ5), **πριν** από κάθε κρυπτογραφία και εγγραφή: ανάγνωση **χωρίς** κατανάλωση. Η κρίση που
 * μετρά γίνεται ξανά μέσα στη συναλλαγή (`rfq-create-transaction.ts`), ατομικά με το RFQ.
 */
async function precheckQuoteRequestPairs(buyerCompanyId: string, supplierIds: readonly string[]): Promise<void> {
  if (supplierIds.length === 0) return;
  const counts = await readQuoteRequestPairCounts(null, getAdminFirestore(), buyerCompanyId, Date.now());
  const admission = admitQuoteRequestPairs(counts, supplierIds);
  if (admission.kind === 'exhausted') throw new RfqCreateRefusal('quoteRequestQuotaExhausted', admission.supplierCompanyId);
}

/**
 * Το σχέδιο μιας δημιουργίας. Σειρά: πρώτα οι φθηνές αρνήσεις (SKU, βιτρίνα, μέγεθος), μετά η έκδοση διαπιστευτηρίων, ώστε
 * ένα RFQ που θα αρνηθεί να μην κοστίσει κρυπτογραφία.
 */
export async function planRfqCreate(ctx: AuthContext, dto: CreateRfqDTO, rfqId: string): Promise<RfqCreatePlan> {
  const catalogLines = await Promise.all((dto.catalogLines ?? []).map((line) => planCatalogLine(ctx, line)));
  const supplierIds = uniqueInOrder(catalogLines.map(({ sku }) => sku.ref.supplierCompanyId));
  const suppliers = await Promise.all(supplierIds.map((id) => planSupplier(ctx.companyId, id)));
  const invitedVendorIds = uniqueInOrder([...(dto.invitedVendorIds ?? []), ...suppliers.map((s) => s.contactId)]);
  assertRfqFitsOneCommit({
    boqItems: Math.min(dto.boqItemIds?.length ?? 0, RFQ_FROM_BOQ_MAX_ITEMS),
    adHocLines: dto.adHocLines?.length ?? 0,
    catalogLines: catalogLines.length,
    invites: invitedVendorIds.length,
    suppliers: suppliers.length,
    sourcingEvent: !!dto.sourcingEventId,
    // Άνω όριο: κάθε προσκεκλημένος μπορεί να είναι επαφή πλατφόρμας.
    pairQuota: invitedVendorIds.length > 0,
  });
  const quotaSupplierIds = uniqueInOrder([
    ...supplierIds,
    ...(await platformSuppliersOf(ctx.companyId, dto.invitedVendorIds ?? [])),
  ]).filter((id) => id !== ctx.companyId);
  await precheckQuoteRequestPairs(ctx.companyId, quotaSupplierIds);
  const invites = await prepareInvites(ctx, rfqId, invitedVendorIds);
  const performer = suppliers.length > 0 ? await resolvePerformer(userPerformer(ctx.uid, ctx.email)) : null;
  return { rfqId, catalogLines, suppliers, invitedVendorIds, invites, quotaSupplierIds, performer };
}

/**
 * Πού ζουν οι γραμμές, γραμμένο **μία** φορά στη δημιουργία (ADR-327 Q29). Σειρά: επιμέτρηση, κατάλογος, ad-hoc, inline.
 * Το BOQ και ο κατάλογος προηγούνται επειδή η ποσότητά τους είναι η **ζήτηση του αγοραστή** ⇒ κλειδωμένη απάντηση (§8.5 Β).
 */
export function createdLinesStorage(dto: CreateRfqDTO): RfqLineSource | 'inline_legacy' | null {
  if (dto.boqItemIds?.length) return 'boq';
  if (dto.catalogLines?.length) return 'catalog';
  if (dto.adHocLines?.length) return 'ad_hoc';
  return dto.lines?.length ? 'inline_legacy' : null;
}

/** Το έγγραφο του νέου RFQ. Οι προσκεκλημένοι είναι του **σχεδίου**: περιλαμβάνουν τις επαφές των προμηθευτών του καταλόγου. */
export function newRfqDocument(ctx: AuthContext, dto: CreateRfqDTO, plan: RfqCreatePlan, now: admin.firestore.Timestamp): RFQ {
  const linesStorage = createdLinesStorage(dto);
  return {
    id: plan.rfqId,
    projectId: dto.projectId,
    buildingId: dto.buildingId ?? null,
    companyId: ctx.companyId,
    title: dto.title,
    description: dto.description ?? null,
    lines: dto.lines ?? [],
    deadlineDate: toAdminTimestampOrNull(dto.deadlineDate),
    status: 'draft',
    awardMode: dto.awardMode ?? 'whole_package',
    reminderTemplate: dto.reminderTemplate ?? 'standard',
    invitedVendorIds: [...plan.invitedVendorIds],
    winnerQuoteId: null,
    comparisonTemplateId: dto.comparisonTemplateId ?? 'standard',
    auditTrail: [{ timestamp: now, userId: ctx.uid, action: 'created', detail: null }],
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.uid,
    sourcingEventId: dto.sourcingEventId ?? null,
    sourcingEventStatus: null,
    invitedVendorCount: plan.invitedVendorIds.length,
    respondedCount: 0,
    linesStorage,
    // ADR-327 §8.5 Β — γραμμένο ΤΗ ΣΤΙΓΜΗ της δημιουργίας, ποτέ συμπέρασμα αργότερα.
    responseLock: dto.responseLock ?? defaultResponseLock(linesStorage),
  };
}
