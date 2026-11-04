import 'server-only';

/**
 * **Το σώμα της ΜΙΑΣ συναλλαγής του `createRfq`** (ADR-923 §5.13 Ε6γ, Τ4): RFQ, γραμμές, προσκλήσεις, επαφές προμηθευτών και
 * σύνδεση με το πακέτο — **όλα ή τίποτα** (πρότυπο Ariba/Coupa).
 *
 * 🔴 Πριν, το RFQ και οι προσκλήσεις γράφονταν σε batch και οι γραμμές **μετά** το commit: αποτυχία στις γραμμές άφηνε RFQ
 *    χωρίς γραμμές, ήδη σταλμένο σε προμηθευτές.
 * 🔑 **Όλες οι αναγνώσεις πριν από κάθε εγγραφή** (κανόνας του Firestore): στοιχεία BOQ, opt-in κάθε προμηθευτή, επαφή κάθε
 *    προμηθευτή. Το opt-in διαβάζεται **εδώ**, ώστε το κλείσιμό του να κερδίζει τον αγώνα με τη δημιουργία.
 * 🔑 ADR-923 §5.13 Τ5 — η ποσόστωση ζεύγους (αγοραστής, προμηθευτής) διαβάζεται και γράφεται **εδώ**: ατομική με το RFQ,
 *    ιδεμποτική στην επανάληψη, και δύο ταυτόχρονες δημιουργίες συγκρούονται αντί να περάσουν και οι δύο.
 * 🔑 Ξανατρέχει σε σύγκρουση: δεν κάνει δίκτυο ούτε κρυπτογραφία, όλα αυτά τα έκανε το σχέδιο (`rfq-create-plan.ts`).
 *
 * @module subapps/procurement/services/rfq-create-transaction
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from '@/lib/firebaseAdmin';
import { supplierAcceptsQuotesInTx } from '@/server/catalog/public/public-model-snapshot.server';
import { resolvePlatformCompanyContact } from '@/services/contact/platform-company-contact-resolver';
import type { BOQItem } from '@/types/boq/boq';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';

import type { CreateRfqDTO, RFQ } from '../types/rfq';
import { RFQ_FALLBACK_TRADE } from '../types/rfq';
import { RfqCreateRefusal } from '../types/rfq-create-refusal';
import type { CreateRfqLineDTO, RfqLine, RfqLineCatalogFields } from '../types/rfq-line';
import { rfqLineCatalogFields } from '../types/rfq-line';
import {
  admitQuoteRequestPairs,
  readQuoteRequestPairCounts,
  writeQuoteRequestPairCounts,
  type QuoteRequestPairCounts,
} from './quote-request-pair-quota';
import { boqItemsByIdQuery, ownedBoqItems } from './rfq-boq-items';
import type { PlannedCatalogLine, PlannedSupplier, RfqCreatePlan } from './rfq-create-plan';
import { boqItemToLineDto, buildRfqLine, rfqLinesRef } from './rfq-line-service';
import { writePreparedVendorInvite } from './vendor-invite-issue';

type Db = admin.firestore.Firestore;
type Tx = admin.firestore.Transaction;

export interface RfqCreateInput {
  readonly companyId: string;
  readonly dto: CreateRfqDTO;
  readonly plan: RfqCreatePlan;
  readonly rfq: RFQ;
  /** Η στιγμή της δημιουργίας — η ΙΔΙΑ στο RFQ, στις γραμμές και στο πακέτο. */
  readonly now: admin.firestore.Timestamp;
}

/** Μια επαφή προμηθευτή που **γεννήθηκε** σε αυτή τη συναλλαγή: το ίχνος ADR-195 γράφεται μετά το commit. */
export interface BornSupplierContact {
  readonly contactId: string;
  readonly displayName: string;
  readonly supplierCompanyId: string;
}

export interface RfqCreateCommit {
  readonly lines: readonly RfqLine[];
  readonly bornContacts: readonly BornSupplierContact[];
}

interface NewSupplierContact extends BornSupplierContact {
  readonly doc: Record<string, unknown>;
}

interface RfqCreateReads {
  readonly boqItems: readonly BOQItem[];
  readonly newContacts: readonly NewSupplierContact[];
  /** Οι μετρητές μετά από αυτό το RFQ· `null` ⇒ κανένας χώρος της πλατφόρμας, τίποτα να γραφτεί. */
  readonly pairCounts: QuoteRequestPairCounts | null;
}

/** Η ποσόστωση ζεύγους: εξαντλημένη για **έναν** προμηθευτή ⇒ ολόκληρο το RFQ αρνείται, πριν από κάθε εγγραφή. */
async function admitPairsInTx(tx: Tx, db: Db, input: RfqCreateInput): Promise<QuoteRequestPairCounts | null> {
  const suppliers = input.plan.quotaSupplierIds;
  if (suppliers.length === 0) return null;
  const counts = await readQuoteRequestPairCounts(tx, db, input.companyId, input.now.toMillis());
  const admission = admitQuoteRequestPairs(counts, suppliers);
  if (admission.kind === 'exhausted') throw new RfqCreateRefusal('quoteRequestQuotaExhausted', admission.supplierCompanyId);
  return admission.counts;
}

async function readBoqItems(tx: Tx, db: Db, companyId: string, boqItemIds: readonly string[] | undefined): Promise<BOQItem[]> {
  if (!boqItemIds?.length) return [];
  return ownedBoqItems(await tx.get(boqItemsByIdQuery(db, boqItemIds)), companyId);
}

async function assertSupplierAccepts(tx: Tx, db: Db, supplier: PlannedSupplier): Promise<void> {
  if (!(await supplierAcceptsQuotesInTx(tx, db, supplier.supplierCompanyId))) {
    throw new RfqCreateRefusal('supplierNotAcceptingQuotes', supplier.supplierCompanyId);
  }
}

/** Η επαφή του προμηθευτή: υπάρχουσα ⇒ τίποτα να γραφτεί · νέα ⇒ το έγγραφο · άρνηση ⇒ ολόκληρο το RFQ αρνείται. */
async function readSupplierContact(tx: Tx, db: Db, input: RfqCreateInput, supplier: PlannedSupplier): Promise<NewSupplierContact | null> {
  const performer = input.plan.performer;
  if (performer === null) throw new Error('RFQ create plan has suppliers but no performer');
  const resolution = await resolvePlatformCompanyContact(tx, db, {
    buyerCompanyId: input.companyId,
    supplierCompanyId: supplier.supplierCompanyId,
    legalName: supplier.legalName,
    performer,
  });
  if (resolution.kind === 'refused') {
    throw new RfqCreateRefusal('supplierContactUnavailable', `${supplier.supplierCompanyId} (${resolution.reason})`);
  }
  if (resolution.kind === 'existing') return null;
  const { contactId, displayName, doc } = resolution;
  return { contactId, displayName, doc, supplierCompanyId: supplier.supplierCompanyId };
}

/** Η φάση ανάγνωσης — τίποτα δεν γράφεται πριν τελειώσει ολόκληρη. */
async function readRfqCreateInputs(tx: Tx, db: Db, input: RfqCreateInput): Promise<RfqCreateReads> {
  const { suppliers } = input.plan;
  const [boqItems, , contacts, pairCounts] = await Promise.all([
    readBoqItems(tx, db, input.companyId, input.dto.boqItemIds),
    Promise.all(suppliers.map((supplier) => assertSupplierAccepts(tx, db, supplier))),
    Promise.all(suppliers.map((supplier) => readSupplierContact(tx, db, input, supplier))),
    admitPairsInTx(tx, db, input),
  ]);
  return { boqItems, newContacts: contacts.filter((contact): contact is NewSupplierContact => contact !== null), pairCounts };
}

/** Μια γραμμή προς κατασκευή: το DTO και, μόνο για τον κατάλογο, ο δεσμός με το SKU. */
interface LineSpec {
  readonly dto: CreateRfqLineDTO;
  readonly catalog?: RfqLineCatalogFields;
}

function catalogLineSpec({ line, sku }: PlannedCatalogLine): LineSpec {
  const dto: CreateRfqLineDTO = {
    source: 'catalog',
    boqItemId: null,
    // 🔒 Ποτέ από τον πελάτη: το κείμενο του SKU που έκρινε ο διακομιστής· SKU χωρίς κωδικό και ετικέτα ⇒ η ταυτότητά του.
    description: sku.text === '' ? sku.ref.variantId : sku.text,
    trade: RFQ_FALLBACK_TRADE,
    quantity: line.quantity,
    unit: line.unit,
  };
  // ⛔ Καμία τιμή (Ε4): το SKU ζητείται για προσφορά, δεν φέρνει στιγμιότυπο.
  return { dto, catalog: { catalogRef: sku.ref, priceSnapshot: null } };
}

/**
 * Οι γραμμές του νέου RFQ, με τη σειρά της φόρμας: επιμέτρηση, ad-hoc, κατάλογος. Το RFQ είναι νέο, άρα η αρίθμηση ξεκινά
 * από 0 χωρίς `count`. Το ad-hoc κρατά το δικό του `displayOrder` όπου το δίνει, όπως η μαζική εισαγωγή.
 */
export function buildCreatedRfqLines(input: RfqCreateInput, boqItems: readonly BOQItem[]): RfqLine[] {
  const { companyId, rfq, dto, plan, now } = input;
  const base = { rfqId: rfq.id, companyId, now };
  // Η επιμέτρηση κρατά τον δεσμό της πηγής τιμής της (Q29), όπως το στιγμιότυπο `snapshotFromBoq`.
  const boq: LineSpec[] = boqItems.map((item) => ({ dto: boqItemToLineDto(item, RFQ_FALLBACK_TRADE), catalog: rfqLineCatalogFields(item.priceSource) }));
  const tail: LineSpec[] = [...(dto.adHocLines ?? []).map((line) => ({ dto: line })), ...plan.catalogLines.map(catalogLineSpec)];
  const boqLines = boq.map((spec, index) => buildRfqLine({ ...base, ...spec, displayOrder: index }));
  const tailLines = tail.map((spec, index) => buildRfqLine({ ...base, ...spec, displayOrder: spec.dto.displayOrder ?? boq.length + index }));
  return [...boqLines, ...tailLines];
}

/** Η φάση εγγραφής — σύγχρονη: μετά από αυτήν δεν διαβάζεται τίποτα. */
function writeRfqCreate(tx: Tx, db: Db, input: RfqCreateInput, reads: RfqCreateReads): RfqCreateCommit {
  const { rfq, plan, dto } = input;
  const lines = buildCreatedRfqLines(input, reads.boqItems);
  tx.set(db.collection(COLLECTIONS.RFQS).doc(rfq.id), sanitizeForFirestore(rfq));
  for (const line of lines) tx.set(rfqLinesRef(db, rfq.id).doc(line.id), sanitizeForFirestore(line));
  for (const prepared of plan.invites) writePreparedVendorInvite(tx, db, prepared);
  for (const contact of reads.newContacts) tx.set(db.collection(COLLECTIONS.CONTACTS).doc(contact.contactId), contact.doc);
  if (reads.pairCounts !== null) writeQuoteRequestPairCounts(tx, db, input.companyId, reads.pairCounts, input.now.toMillis());
  if (dto.sourcingEventId) {
    tx.update(db.collection(COLLECTIONS.SOURCING_EVENTS).doc(dto.sourcingEventId), sanitizeForFirestore({
      rfqIds: FieldValue.arrayUnion(rfq.id),
      rfqCount: FieldValue.increment(1),
      updatedAt: input.now,
    }));
  }
  const bornContacts = reads.newContacts.map(({ contactId, displayName, supplierCompanyId }) => ({ contactId, displayName, supplierCompanyId }));
  return { lines, bornContacts };
}

/** Η μία συναλλαγή. Μια άρνηση μέσα της (opt-in, επαφή) ακυρώνει ολόκληρη τη δημιουργία, πριν από κάθε εγγραφή. */
export function runRfqCreateTransaction(db: Db, input: RfqCreateInput): Promise<RfqCreateCommit> {
  return db.runTransaction(async (tx) => writeRfqCreate(tx, db, input, await readRfqCreateInputs(tx, db, input)));
}
