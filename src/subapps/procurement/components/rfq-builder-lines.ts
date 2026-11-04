/**
 * **Η λογική των γραμμών του `RfqBuilder`** (ADR-327 Q29 · ADR-923 §5.13 Τ6): μορφή φόρμας, προσυμπλήρωση, σώμα δημιουργίας.
 *
 * 🔑 Τρεις προελεύσεις, όσες και το `RFQ_LINE_SOURCES`: επιμέτρηση (`boq`), χειρόγραφη (`ad_hoc`), κατάλογος (`catalog`).
 * 🔒 Η γραμμή καταλόγου στέλνει **μόνο** τη διεύθυνση του SKU και τη ζήτηση του αγοραστή (ποσότητα, μονάδα). Η περιγραφή της
 *    στη φόρμα είναι για ανάγνωση: ο διακομιστής γράφει το κείμενο του κριμένου SKU (`CatalogLineSchema` είναι `.strict()`).
 *
 * Καθαρές συναρτήσεις, χωρίς React: τις ελέγχει το `rfq-builder-lines.test.ts`.
 * @module subapps/procurement/components/rfq-builder-lines
 */

import { generateTempId } from '@/services/enterprise-id.service';
import { getAtoeCodesForTrade, getTradeCodeForAtoeCategory } from '@/subapps/procurement/data/trades';
import { RFQ_FALLBACK_TRADE } from '@/subapps/procurement/types/rfq';
import type { RfqLine, RfqDraftLine, CreateRfqDTO, AwardMode, ReminderTemplate } from '@/subapps/procurement/types/rfq';
import type {
  CreateRfqCatalogLineDTO, CreateRfqLineDTO, RfqCatalogDraft, RfqCatalogSupplierSent, RfqLineSource,
} from '@/subapps/procurement/types/rfq-line';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { BOQItem } from '@/types/boq/boq';

/** Από ποιο SKU ήρθε μια γραμμή καταλόγου: η διεύθυνση που στέλνεται και ο προμηθευτής που δείχνεται. */
export type CatalogLineOrigin = Pick<RfqCatalogDraft, 'address' | 'supplierName'>;

export type FormLine = RfqLine & { source: RfqLineSource; boqItemId?: string | null; catalog?: CatalogLineOrigin };

export interface FormState {
  projectId: string;
  title: string;
  description: string;
  deadlineDate: string;
  awardMode: AwardMode;
  reminderTemplate: ReminderTemplate;
  lines: FormLine[];
  invitedVendorIds: string[];
}

export type BoqPick = Pick<BOQItem, 'id' | 'title' | 'categoryCode' | 'estimatedQuantity' | 'unit' | 'description'>;

/** Τα κλειδιά γραμμών εδώ είναι ΠΡΟΣΩΡΙΝΑ (κλειδιά React) — τις γραμμές τις γράφει ο server με `generateRfqLineId`. */
export function newAdHocLine(): FormLine {
  const trade: TradeCode = 'concrete';
  return {
    id: generateTempId(), description: '', trade, categoryCode: getAtoeCodesForTrade(trade)[0] ?? null,
    quantity: null, unit: null, notes: null, source: 'ad_hoc',
  };
}

export function boqItemToLine(item: BoqPick): FormLine {
  return {
    id: generateTempId(),
    description: item.title,
    trade: getTradeCodeForAtoeCategory(item.categoryCode) ?? RFQ_FALLBACK_TRADE,
    categoryCode: item.categoryCode,
    quantity: item.estimatedQuantity,
    unit: item.unit as string,
    notes: item.description ?? null,
    source: 'boq',
    boqItemId: item.id,
  };
}

/**
 * Το πρόχειρο του καταλόγου ως γραμμή. **Ποσότητα και μονάδα κενές**: τις δίνει ο αγοραστής, γιατί η δημόσια παραλλαγή δεν
 * έχει μονάδα (Ε6ε) και μια μαντεμένη ποσότητα θα έφευγε κλειδωμένη στον προμηθευτή (`defaultResponseLock`).
 */
export function catalogDraftToLine(draft: CatalogLineOrigin & Pick<RfqCatalogDraft, 'description'>): FormLine {
  return {
    id: generateTempId(),
    description: draft.description,
    trade: RFQ_FALLBACK_TRADE,
    categoryCode: null,
    quantity: null,
    unit: null,
    notes: null,
    source: 'catalog',
    catalog: { address: draft.address, supplierName: draft.supplierName },
  };
}

/** A pre-filled line stays a BOQ line when it came from one — else submit would send it ad-hoc (ADR-327 P5-BOQ). */
export function toFormLine(line: RfqDraftLine): FormLine {
  return line.boqItemId ? { ...line, source: 'boq', boqItemId: line.boqItemId } : { ...line, source: 'ad_hoc' };
}

/** Γραμμή καταλόγου χωρίς θετική ποσότητα ή μονάδα δεν είναι ζήτηση: ο διακομιστής θα την αρνιόταν με 400. */
export function catalogLinesComplete(lines: readonly FormLine[]): boolean {
  return lines.every((l) => l.source !== 'catalog' || ((l.quantity ?? 0) > 0 && Boolean(l.unit?.trim())));
}

function toAdHocDTO(l: FormLine): CreateRfqLineDTO {
  return {
    source: 'ad_hoc',
    description: l.description,
    trade: l.trade as TradeCode,
    categoryCode: l.categoryCode ?? null,
    quantity: l.quantity ?? null,
    unit: l.unit ?? null,
    notes: l.notes ?? null,
  };
}

/** 🔒 Μόνο διεύθυνση και ζήτηση: καμία περιγραφή, τιμή ή κλάδος από τον πελάτη. */
function toCatalogDTO(l: FormLine & { catalog: CatalogLineOrigin }): CreateRfqCatalogLineDTO {
  return { ...l.catalog.address, quantity: l.quantity ?? 0, unit: (l.unit ?? '').trim() };
}

const hasCatalog = (l: FormLine): l is FormLine & { catalog: CatalogLineOrigin } => l.source === 'catalog' && l.catalog !== undefined;
const orUndefined = <T>(items: T[]): T[] | undefined => (items.length > 0 ? items : undefined);

export function toCreateRfqDTO(form: FormState, sourcingEventId: string | undefined): CreateRfqDTO {
  const boqItemIds = form.lines.filter((l) => l.source === 'boq' && l.boqItemId).map((l) => l.boqItemId as string);
  return {
    projectId: form.projectId,
    title: form.title,
    description: form.description || null,
    deadlineDate: form.deadlineDate || null,
    awardMode: form.awardMode,
    reminderTemplate: form.reminderTemplate,
    lines: [],
    boqItemIds: orUndefined(boqItemIds),
    adHocLines: orUndefined(form.lines.filter((l) => l.source === 'ad_hoc').map(toAdHocDTO)),
    catalogLines: orUndefined(form.lines.filter(hasCatalog).map(toCatalogDTO)),
    ...(sourcingEventId ? { sourcingEventId } : {}),
    invitedVendorIds: orUndefined(form.invitedVendorIds),
  };
}

/** Ένας προσκεκλημένος προμηθευτής με ζωντανή πρόταση πρόσβασης στους τιμοκαταλόγους. */
export type SupplierWithAccess = RfqCatalogSupplierSent & { readonly priceListAccessHref: string };

/**
 * **Ποιοι προμηθευτές παίρνουν πρόταση πρόσβασης μετά την αποστολή** (ADR-923 §5.13 Ε6δ, Τ6) — από την απάντηση της
 * δημιουργίας, ποτέ από το πρόχειρο. Κενό ⇒ η σελίδα πηγαίνει κατευθείαν στο αίτημα.
 */
export function suppliersToOfferAccess(sent: readonly RfqCatalogSupplierSent[]): SupplierWithAccess[] {
  return sent.filter((supplier): supplier is SupplierWithAccess => supplier.priceListAccessHref !== null);
}
