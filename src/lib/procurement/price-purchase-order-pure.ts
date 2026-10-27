/**
 * =============================================================================
 * ΤΙΜΟΛΟΓΗΣΗ ΠΑΡΑΓΓΕΛΙΑΣ — συμβάσεις ανά γραμμή → εκπτώσεις → σύνολα (ADR-923 §5.11 «3γ»)
 * =============================================================================
 *
 * Η ΜΙΑ συνάρτηση που τιμολογεί μια PO· την καλούν **και** ο server (αυθεντικά, tamper-proof —
 * ADR-330 C.2) **και** η φόρμα (ζωντανή προεπισκόπηση). Ίδια είσοδος ⇒ ίδιο αποτέλεσμα, παντού.
 *
 * 1. ακαθάριστο κάθε γραμμής (`po-totals`) · 2. σύμβαση κάθε γραμμής (`selectLineAgreement`) ·
 * 3. 🔑 **group condition** (SAP): η κλίμακα μιας σύμβασης μετρά στο **άθροισμα** των γραμμών που
 *    καλύπτει, και το ποσοστό εφαρμόζεται σε **κάθε** γραμμή της · 4. σύνολα με ΦΠΑ **μετά** την έκπτωση.
 *
 * Χωρίς I/O και χωρίς `server-only` ⇒ τρέχει σε jest, σε browser και στον server.
 * @module lib/procurement/price-purchase-order-pure
 */

import type { MinorAmount } from '@/lib/money/money';
import { majorFromMinor, minorFromMajor, sumMinor } from '@/lib/money/money';
import {
  applyDiscountSteps,
  basisPointsFromPercent,
  effectivePercent,
  stepsForBasis,
  type BasisPoints,
} from '@/lib/pricing/discount-rule';
import type { FrameworkAgreementLike } from '@/subapps/procurement/types/framework-agreement';
import {
  faDiscountRule,
  selectLineAgreement,
  type FaSelection,
} from '@/subapps/procurement/utils/framework-agreement-discount';
import type { POLineFaDiscount } from '@/types/procurement/purchase-order';
import { computePOTotalsMinor, poLineGrossMinor, poTotalsInMajor, type POTotals } from './po-totals';
import {
  planLineCarry,
  type POCarryInput,
  type POLineCarry,
  type POLineOrigin,
  type POStoredPricing,
} from './po-pricing-carry';

export interface POPricingLine {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly materialId?: string | null;
  readonly categoryCode: string;
}

export interface POPricingInput {
  readonly supplierId: string | null | undefined;
  readonly projectId: string | null | undefined;
  readonly items: readonly POPricingLine[];
  readonly taxRate: number;
  /** Ημερομηνία τιμολόγησης (SAP pricing date): δημιουργία = τώρα, επεξεργασία = `dateCreated`. */
  readonly atMs: number;
}

export interface PricedPOLine {
  /** `null` αν ποσότητα/τιμή δεν αναπαρίστανται ακριβώς — ο server αρνείται, η φόρμα το δείχνει. */
  readonly grossMinor: MinorAmount | null;
  readonly faDiscount: POLineFaDiscount | null;
  /** Το ίχνος της επιλογής (SAP «pricing analysis») — `null` όταν δεν έγινε επιλογή. */
  readonly selection: FaSelection | null;
  /** Από πού ήρθαν οι όροι της γραμμής (Α9): παγωμένοι · ίδια σύμβαση νέο ποσό · σημερινή επιλογή. */
  readonly origin: POLineOrigin;
  /** Η αποθηκευμένη γραμμή που αντιστοιχεί (επεξεργασία) — ο server κρατά το `id` της. */
  readonly storedIndex: number | null;
}

export interface POPricing {
  readonly lines: readonly PricedPOLine[];
  readonly totals: POTotals;
  readonly appliedFaIds: readonly string[];
  readonly ambiguousLineIndexes: readonly number[];
  readonly invalidLineIndexes: readonly number[];
  /** Γραμμές που ΔΕΝ κράτησαν αυτούσιους τους όρους τους (νέες, αλλαγμένες, ή ρητή τιμολόγηση). */
  readonly repricedLineIndexes: readonly number[];
}

/** Η σημερινή επιλογή σύμβασης για κάθε γραμμή (ίχνος SAP «pricing analysis»). */
function freshSelections(
  agreements: readonly FrameworkAgreementLike[],
  input: POPricingInput,
  grosses: readonly (MinorAmount | null)[],
): (FaSelection | null)[] {
  const { supplierId, projectId } = input;
  return input.items.map((item, index) => {
    if (!supplierId || !projectId || grosses[index] === null || agreements.length === 0) return null;
    const line = { supplierId, projectId, materialId: item.materialId ?? null, categoryCode: item.categoryCode };
    return selectLineAgreement(agreements, line, input.atMs);
  });
}

/** Μέλος ομάδας σύμβασης (group condition): η γραμμή, το μικτό της, και οι παγωμένοι όροι της αν έχει. */
interface GroupMember {
  readonly index: number;
  readonly gross: MinorAmount;
  /** Αποθηκευμένοι όροι — μόνο για γραμμή δεμένη στη σύμβαση-πηγή της. */
  readonly kept: POLineFaDiscount | null;
  /** Ίδια γραμμή με την αποθηκευμένη (ταυτότητα + βάση). */
  readonly exact: boolean;
}

interface PricingContext {
  readonly grosses: readonly (MinorAmount | null)[];
  readonly carries: readonly POLineCarry[];
  readonly selections: readonly (FaSelection | null)[];
}

function winnerId(selection: FaSelection | null): string | null {
  return selection?.kind === 'selected' ? selection.winner.id : null;
}

function addMember(groups: Map<string, GroupMember[]>, agreementId: string, member: GroupMember): void {
  groups.set(agreementId, [...(groups.get(agreementId) ?? []), member]);
}

/**
 * Ομάδες ανά σύμβαση. Γραμμή με αποθηκευμένη πηγή μένει στη σύμβασή της (καμία νέα επιλογή —
 * Oracle). Γραμμή χωρίς αντιστοίχιση παίρνει τη σημερινή επιλογή. Αμετάβλητη γραμμή χωρίς πηγή
 * περιμένει: μπαίνει σε ομάδα μόνο αν εκείνη άλλαξε (βλ. `joinChangedGroups`).
 */
function groupMembers({ grosses, carries, selections }: PricingContext): Map<string, GroupMember[]> {
  const groups = new Map<string, GroupMember[]>();
  carries.forEach((carry, index) => {
    const gross = grosses[index];
    if (gross === null) return;
    if (carry.stored !== null) {
      addMember(groups, carry.stored.agreementId, { index, gross, kept: carry.stored, exact: carry.exact });
      return;
    }
    if (carry.storedIndex !== null && carry.exact) return;
    const fresh = winnerId(selections[index]);
    if (fresh !== null) addMember(groups, fresh, { index, gross, kept: null, exact: false });
  });
  return groups;
}

/** Το άθροισμα που είχε η ομάδα κάθε σύμβασης όταν αποθηκεύτηκε η PO. */
function storedBases(stored: POStoredPricing | null): Map<string, MinorAmount> {
  const bases = new Map<string, MinorAmount>();
  for (const item of stored?.items ?? []) {
    const agreementId = item.faDiscount?.agreementId;
    if (!agreementId) continue;
    bases.set(agreementId, (bases.get(agreementId) ?? 0) + (poLineGrossMinor(item) ?? 0));
  }
  return bases;
}

/** Ομάδα αμετάβλητη = όλα τα μέλη ίδια με τα αποθηκευμένα **και** ίδιο άθροισμα. */
function isGroupFrozen(members: readonly GroupMember[], storedBasis: MinorAmount | undefined): boolean {
  return members.every((m) => m.kept !== null && m.exact) && sumMinor(members.map((m) => m.gross)) === storedBasis;
}

/**
 * Group condition: όταν μια ομάδα άλλαξε, ξαναβγαίνει το άθροισμά της — και μια αμετάβλητη γραμμή
 * χωρίς πηγή (π.χ. κάτω από την πρώτη κλίμακα) που σήμερα ανήκει στην ίδια σύμβαση μετρά κι αυτή.
 */
function joinChangedGroups(
  context: PricingContext,
  groups: Map<string, GroupMember[]>,
  bases: ReadonlyMap<string, MinorAmount>,
): ReadonlySet<string> {
  const changed = new Set([...groups].filter(([id, members]) => !isGroupFrozen(members, bases.get(id))).map(([id]) => id));
  context.carries.forEach((carry, index) => {
    const gross = context.grosses[index];
    const fresh = winnerId(context.selections[index]);
    const waiting = carry.storedIndex !== null && carry.exact && carry.stored === null;
    if (waiting && gross !== null && fresh !== null && changed.has(fresh)) {
      addMember(groups, fresh, { index, gross, kept: null, exact: true });
    }
  });
  return changed;
}

interface LineDiscount {
  readonly record: POLineFaDiscount;
  readonly minor: MinorAmount;
  readonly origin: POLineOrigin;
}

/** Τα βήματα μιας αλλαγμένης ομάδας: η κλίμακα της σύμβασης στο νέο άθροισμα· διαγραμμένη ⇒ το αποθηκευμένο ποσοστό. */
function changedGroupSteps(fa: FrameworkAgreementLike | undefined, member: GroupMember, basis: MinorAmount): readonly BasisPoints[] {
  if (fa) return stepsForBasis(faDiscountRule(fa), basis);
  const kept = member.kept ? basisPointsFromPercent(member.kept.discountPercent) : null;
  return kept === null || kept === 0 ? [] : [kept];
}

function discountOf(agreementId: string, member: GroupMember, steps: readonly BasisPoints[]): LineDiscount | null {
  if (steps.length === 0) return null;
  const { discount } = applyDiscountSteps(member.gross, steps);
  const record = { agreementId, discountPercent: effectivePercent(steps), discountAmount: majorFromMinor(discount) };
  return { record, minor: discount, origin: member.kept !== null || member.exact ? 'adjusted' : 'sourced' };
}

function groupDiscounts(
  agreementId: string,
  members: readonly GroupMember[],
  fa: FrameworkAgreementLike | undefined,
  frozen: boolean,
): [number, LineDiscount | null][] {
  if (frozen) {
    return members.map((m) => [m.index, m.kept && { record: m.kept, minor: minorFromMajor(m.kept.discountAmount) ?? 0, origin: 'frozen' }]);
  }
  const basis = sumMinor(members.map((m) => m.gross));
  return members.map((m) => [m.index, discountOf(agreementId, m, changedGroupSteps(fa, m, basis))]);
}

function lineDiscounts(
  agreements: readonly FrameworkAgreementLike[],
  context: PricingContext,
  stored: POStoredPricing | null,
): Map<number, LineDiscount | null> {
  const groups = groupMembers(context);
  const changed = joinChangedGroups(context, groups, storedBases(stored));
  const byId = new Map(agreements.map((fa) => [fa.id, fa]));
  const discounts = new Map<number, LineDiscount | null>();
  for (const [id, members] of groups) {
    for (const [index, discount] of groupDiscounts(id, members, byId.get(id), !changed.has(id))) discounts.set(index, discount);
  }
  return discounts;
}

/**
 * Προέλευση γραμμής χωρίς έκπτωση: δεμένη στην πηγή της ⇒ `adjusted` (η ομάδα της άλλαξε) ·
 * αμετάβλητη χωρίς πηγή ⇒ `frozen`, ή `adjusted` αν μπήκε σε ομάδα που άλλαξε · αλλιώς `sourced`.
 */
function originOf(carry: POLineCarry, discount: LineDiscount | null | undefined, inGroup: boolean): POLineOrigin {
  if (discount) return discount.origin;
  if (carry.stored !== null) return 'adjusted';
  if (carry.storedIndex !== null && carry.exact) return inGroup ? 'adjusted' : 'frozen';
  return 'sourced';
}

function indexesWhere<T>(values: readonly T[], predicate: (value: T, index: number) => boolean): number[] {
  return values.flatMap((value, index) => (predicate(value, index) ? [index] : []));
}

function pricedLines(context: PricingContext, discounts: ReadonlyMap<number, LineDiscount | null>): PricedPOLine[] {
  return context.carries.map((carry, index) => {
    const discount = discounts.get(index);
    const origin = originOf(carry, discount, discounts.has(index));
    return {
      grossMinor: context.grosses[index],
      faDiscount: discount?.record ?? null,
      selection: origin === 'sourced' ? context.selections[index] : null,
      origin,
      storedIndex: carry.storedIndex,
    };
  });
}

/**
 * Τιμολογεί την παραγγελία. Γραμμή με μη αναπαραστάσιμο ποσό μετρά 0 και αναφέρεται στο `invalidLineIndexes`.
 * Με `carry` (επεξεργασία) οι όροι της αποθηκευμένης PO κρατιούνται — βλ. `po-pricing-carry`.
 */
export function pricePurchaseOrder(
  agreements: readonly FrameworkAgreementLike[],
  input: POPricingInput,
  carry?: POCarryInput | null,
): POPricing {
  const grosses = input.items.map(poLineGrossMinor);
  const context: PricingContext = {
    grosses,
    carries: planLineCarry(input, carry),
    selections: freshSelections(agreements, input, grosses),
  };
  const discounts = lineDiscounts(agreements, context, carry?.mode === 'carry' ? carry.stored : null);
  const lines = pricedLines(context, discounts);
  const totals = computePOTotalsMinor(
    lines.map((line, index) => ({ gross: line.grossMinor ?? 0, discount: discounts.get(index)?.minor ?? 0 })),
    input.taxRate,
  );
  return {
    lines,
    totals: poTotalsInMajor(totals),
    appliedFaIds: [...new Set(lines.flatMap((line) => (line.faDiscount ? [line.faDiscount.agreementId] : [])))],
    ambiguousLineIndexes: indexesWhere(lines, (line) => line.selection?.kind === 'ambiguous'),
    invalidLineIndexes: indexesWhere(grosses, (gross) => gross === null),
    repricedLineIndexes: indexesWhere(lines, (line) => line.origin !== 'frozen'),
  };
}

/** Τα πεδία της PO που ανήκουν στην τιμολόγηση: γραμμές με `total` + `faDiscount`, σύνολα, συμβάσεις. */
export type POPricedItem<TItem> = TItem & { total: number; faDiscount: POLineFaDiscount | null };

export interface POPricedRecord<TItem> extends POTotals {
  readonly items: POPricedItem<TItem>[];
  readonly appliedFaIds: string[];
}

/**
 * Ενώνει τις γραμμές με την τιμολόγησή τους. Το `total` γραμμής είναι **πάντα** του server —
 * ό,τι έστειλε ο πελάτης αγνοείται. Ο ΕΝΑΣ τρόπος να γεμίσει μια PO τα οικονομικά της.
 */
export function pricedRecord<TItem>(items: readonly TItem[], pricing: POPricing): POPricedRecord<TItem> {
  const { subtotal, discountAmount, taxableAmount, taxAmount, total } = pricing.totals;
  return {
    items: items.map((item, index) => ({
      ...item,
      total: majorFromMinor(pricing.lines[index]?.grossMinor ?? 0),
      faDiscount: pricing.lines[index]?.faDiscount ?? null,
    })),
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    total,
    appliedFaIds: [...pricing.appliedFaIds],
  };
}
