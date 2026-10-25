/**
 * =============================================================================
 * ΤΟ ΣΥΝΟΛΟ ΕΝΟΣ ΜΟΝΤΕΛΟΥ — η μονάδα συνέπειας των δεδομένων (ADR-923 §5.10 Δ1 · Δ8 · Θωράκιση 5)
 * =============================================================================
 *
 * Ρίζα + υπο-μοντέλα + SKU είναι **ένα** σύνολο (DDD aggregate): οι κανόνες συνέπειας κρίνουν **όλες** τις
 * παραλλαγές μαζί, ο συνδυασμός αξόνων είναι μοναδικός ανάμεσα στα αδέλφια, η πληρότητα του SKU εξαρτάται από τις
 * τιμές των προγόνων. Κάθε εγγραφή ενός μέλους είναι αλλαγή **του συνόλου** — και κρίνεται στο σύνολο.
 * Απλό προϊόν (χωρίς σχήμα) = σύνολο ενός μέλους.
 *
 * Το σύνολο έχει **δύο όψεις** σε κάθε μέλος: `before` (όπως διαβάστηκε) και `after` (όπως θα γραφτεί· `null` =
 * διαγράφεται). Η κρίση συγκρίνει τις δύο (πολιτική «καμία **νέα** παράβαση», Δ8) — και είναι **καθαρή**, άρα
 * την τρέχει και η οθόνη (πλέγμα παραλλαγών, 2δ) πριν στείλει.
 *
 * @module subapps/catalog/aggregate/aggregate-model
 */

import type { CatalogProductDefinition, CatalogProductModelDefinition, CatalogValueHolder } from '../types/product';
import type { CatalogProductDerived, CatalogProductModelDerived } from '../types/product-derived';
import type { InheritanceLink } from '../values/resolve-inherited';

/** Ό,τι χρειάζεται η κρίση από ένα αποθηκευμένο μέλος (υποσύνολο της εγγραφής). */
interface StoredShape<TDerived> {
  readonly revision: number;
  readonly derived: TDerived;
}

interface MemberBase<TDefinition, TDerived> {
  readonly id: string;
  readonly before: (TDefinition & StoredShape<TDerived>) | null;
  /** `null` = διαγράφεται σε αυτή την αλλαγή. */
  readonly after: TDefinition | null;
  /** Η αναθεώρηση **μετά** την αλλαγή (ίδια με την τρέχουσα για ανέγγιχτο μέλος). */
  readonly revisionAfter: number;
  /** Το άλλαξε ο άνθρωπος σε αυτή την εγγραφή; (αλλιώς αλλάζουν, ίσως, μόνο τα παράγωγά του) */
  readonly changed: boolean;
}

export type ModelMember = MemberBase<CatalogProductModelDefinition, CatalogProductModelDerived> & { readonly kind: 'productModel' };
export type ProductMember = MemberBase<CatalogProductDefinition, CatalogProductDerived> & { readonly kind: 'product' };
export type AggregateMember = ModelMember | ProductMember;

export interface CatalogAggregate {
  /** Η ρίζα (μοντέλο χωρίς γονέα) — `null` για απλό προϊόν. */
  readonly rootId: string | null;
  readonly members: ReadonlyMap<string, AggregateMember>;
}

export type AggregateSide = 'before' | 'after';

/** Ο ορισμός του μέλους στη μία όψη (`null` = δεν υπάρχει σε αυτή την όψη). */
export function definitionOf(member: AggregateMember, side: AggregateSide): CatalogValueHolder | null {
  return side === 'before' ? member.before : member.after;
}

/** Ο άμεσος γονέας ενός μέλους (ρίζα → `null`). */
export function parentIdOf(member: AggregateMember, side: AggregateSide): string | null {
  if (member.kind === 'productModel') return (side === 'before' ? member.before : member.after)?.parentId ?? null;
  return (side === 'before' ? member.before : member.after)?.modelId ?? null;
}

/** Τα ζωντανά μέλη της όψης. */
export function liveMembers(aggregate: CatalogAggregate, side: AggregateSide): AggregateMember[] {
  return [...aggregate.members.values()].filter((member) => definitionOf(member, side) !== null);
}

/**
 * Η αλυσίδα κληρονομιάς ενός μέλους, **ρίζα → μέλος**, στην όψη `side`. Γονέας που λείπει από το σύνολο ⇒ η αλυσίδα
 * σταματά εκεί (η τοποθέτηση το αναφέρει — `unknownReference` — δεν μαντεύουμε).
 */
export function chainOf(aggregate: CatalogAggregate, memberId: string, side: AggregateSide): InheritanceLink[] {
  const chain: InheritanceLink[] = [];
  let current = aggregate.members.get(memberId);
  while (current) {
    const holder = definitionOf(current, side);
    if (!holder) break;
    const revision = side === 'before' ? current.before?.revision ?? 0 : current.revisionAfter;
    chain.unshift({ id: current.id, kind: current.kind, revision, holder });
    const parentId = parentIdOf(current, side);
    current = parentId === null ? undefined : aggregate.members.get(parentId);
  }
  return chain;
}

/** Τα SKU της όψης — οι «γραμμές» των κανόνων και οι φορείς της πληρότητας. */
export function productMembers(aggregate: CatalogAggregate, side: AggregateSide): ProductMember[] {
  return liveMembers(aggregate, side).filter((member): member is ProductMember => member.kind === 'product');
}
