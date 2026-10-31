/**
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ ΔΕΣΜΟΥ ΤΙΜΗΣ ΜΙΑΣ ΓΡΑΜΜΗΣ BOQ (ADR-923 §5.4 · §5.11 «3ε» · απόφαση #3).
 *
 * `priceSource` + `priceAuthority` + οι τρεις τιμές αλλάζουν **μαζί**, μόνο από εδώ:
 * - `priceFieldsFromRate`: η γραμμή παίρνει τιμή από τον τιμοκατάλογο κόστους (ρητή πράξη).
 * - `detachedPriceFields`: ο άνθρωπος πληκτρολόγησε **άλλη** τιμή ⇒ η γραμμή δεν κληρονομεί πια.
 *
 * 🔑 Χωρίς αυτό το σημείο το `priceAuthority` θα ξαναγινόταν δήλωση: έτσι έφτασαν 116/116 γραμμές να λένε `master` ενώ
 *    master δεν υπήρχε.
 * 🔑 Η φύρα ακολουθεί μόνο όσο είναι `inherited`· η φύρα που όρισε ο άνθρωπος δεν αγγίζεται (Revit: η παράμετρος που
 *    πληκτρολογήθηκε επιβιώνει).
 * 🔑 Μόνο πρόχειρη γραμμή παίρνει τιμή: σε γραμμή που δόθηκε, ο δεσμός δείχνει απόκλιση αλλά δεν αλλάζει ποσό.
 *
 * @module services/measurements/boq-price-source
 */

import { atoeGroupCodeOf } from '@/config/boq-categories';
import { majorFromMinor, type MinorAmount } from '@/lib/money/money';
import { BP_PER_WHOLE } from '@/lib/pricing/discount-rule';
import type { CostRate } from '@/subapps/catalog/types/cost-rate';
import { BOQ_ITEM_DEFAULTS, type BOQItem, type BOQMeasurementUnit, type BoqPriceSource, type UpdateBOQItemInput } from '@/types/boq';
import { BOQ_PRICE_FIELDS, isSummaryBoqLine } from './boq-line-role';

/** Ποιος και πότε έδεσε την τιμή — έρχεται από τον καλούντα, ώστε η συνάρτηση να μένει καθαρή. */
export interface PriceApplication {
  readonly appliedAt: string;
  readonly appliedBy: string;
}

type PricedLine = Pick<BOQItem, 'id' | 'status' | 'wastePolicy'> & Partial<Pick<BOQItem, 'isGroupParent' | 'groupRole' | 'parentBoqItemId' | 'sourceEntityType'>>;

/** Παίρνει η γραμμή τιμή; Όχι αν έχει δοθεί, όχι αν είναι σύνοψη (η τιμή της είναι Σ των στρώσεων, Ε2). */
export function canApplyPrice(item: PricedLine): boolean {
  return item.status === 'draft' && !isSummaryBoqLine(item);
}

const unitCost = (amount: MinorAmount, priceQuantity: number): number => majorFromMinor(amount) / priceQuantity;

export function priceSourceOf(rate: CostRate, unit: BOQMeasurementUnit, application: PriceApplication): BoqPriceSource {
  const { material, labor, equipment, defaultWasteBp } = rate.breakdown;
  return {
    authority: rate.projectId === null ? 'master' : 'project',
    priceListId: rate.priceListId,
    priceListVersionId: rate.versionId,
    versionNumber: rate.versionNumber,
    lineId: rate.lineId,
    subjectKey: rate.subjectKey,
    unit,
    priceQuantity: rate.priceQuantity,
    breakdown: { material, labor, equipment },
    defaultWasteBp,
    appliedAt: application.appliedAt,
    appliedBy: application.appliedBy,
  };
}

/** Οι τιμές μονάδας σε €, όπως τις διαβάζει το `cost-engine`: η γραμμή μετρά **ανά ποσότητα τιμής**. */
export function unitCostsOf(source: BoqPriceSource): Required<Pick<UpdateBOQItemInput, (typeof BOQ_PRICE_FIELDS)[number]>> {
  const { material, labor, equipment } = source.breakdown;
  return {
    materialUnitCost: unitCost(material, source.priceQuantity),
    laborUnitCost: unitCost(labor, source.priceQuantity),
    equipmentUnitCost: unitCost(equipment, source.priceQuantity),
  };
}

/** Ο συντελεστής φύρας της πηγής (0,08 = 8%). */
export const wasteFactorOf = (source: BoqPriceSource): number => source.defaultWasteBp / BP_PER_WHOLE;

/** Ο δεσμός και η προέλευση: πάντα μαζί, ώστε να μη μπορούν να διαφωνήσουν. */
export function priceLinkFields(source: BoqPriceSource | null): Required<Pick<BOQItem, 'priceSource' | 'priceAuthority'>> {
  return { priceSource: source, priceAuthority: source?.authority ?? BOQ_ITEM_DEFAULTS.priceAuthority };
}

/** Τιμές, φύρα, δεσμός και προέλευση από μία γραμμή του τιμοκαταλόγου, σε **ένα** σύνολο πεδίων. */
export function priceFieldsFromRate(item: Pick<BOQItem, 'unit' | 'wastePolicy'>, rate: CostRate, application: PriceApplication): UpdateBOQItemInput {
  const source = priceSourceOf(rate, item.unit, application);
  return {
    ...unitCostsOf(source),
    ...priceLinkFields(source),
    ...(item.wastePolicy === 'inherited' ? { wasteFactor: wasteFactorOf(source) } : {}),
  };
}

/** Ίδιος δεσμός; Η ίδια γραμμή της ίδιας έκδοσης, δηλαδή ίδια ποσά: η εγγραφή θα ήταν περιττή. */
export function isSamePriceSource(a: BoqPriceSource | null | undefined, b: BoqPriceSource | null | undefined): boolean {
  return (a ?? null) === (b ?? null) || (!!a && !!b && a.lineId === b.lineId && a.priceListVersionId === b.priceListVersionId);
}

/**
 * Τα πεδία που πρέπει να μπουν μαζί με μια ενημέρωση ώστε ο δεσμός να μη λέει ψέματα: πληκτρολογημένη διαφορετική τιμή
 * σε δεμένη γραμμή ⇒ αποσύνδεση. Ίδια τιμή (η φόρμα στέλνει πάντα και τις τρεις) ⇒ τίποτα.
 */
export function detachedPriceFields(current: Pick<BOQItem, 'priceSource' | (typeof BOQ_PRICE_FIELDS)[number]>, update: UpdateBOQItemInput): UpdateBOQItemInput {
  if (!current.priceSource || update.priceSource !== undefined) return {};
  const typed = BOQ_PRICE_FIELDS.some((field) => update[field] !== undefined && update[field] !== current[field]);
  return typed ? priceLinkFields(null) : {};
}

/** Ο κωδικός που αντιστοιχεί η γραμμή στον τιμοκατάλογο: το άρθρο αν υπάρχει (BIM: `OIK-4.01` στο `categoryCode`). */
export function boqLineAtoeCode(item: Pick<BOQItem, 'categoryCode' | 'subCategoryCode'>): string {
  return item.subCategoryCode ?? item.categoryCode;
}

/** Οι επιλογές για μια γραμμή: ίδια ομάδα ΑΤΟΕ και ίδια μονάδα. Μετατροπή μονάδας δεν γίνεται ποτέ σιωπηλά. */
export function costRatesForLine(rates: readonly CostRate[], item: { readonly categoryCode: string; readonly unit: string }): readonly CostRate[] {
  const group = atoeGroupCodeOf(item.categoryCode);
  return rates
    .filter((rate) => atoeGroupCodeOf(rate.atoeCode) === group && rate.unitCode === item.unit)
    .sort((a, b) => a.atoeCode.localeCompare(b.atoeCode) || (a.region ?? '').localeCompare(b.region ?? ''));
}
