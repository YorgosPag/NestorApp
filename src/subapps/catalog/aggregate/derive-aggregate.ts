/**
 * =============================================================================
 * ΤΑ ΠΑΡΑΓΩΓΑ ΕΝΟΣ ΣΥΝΟΛΟΥ — όλα τα μέλη, από μία καθαρή συνάρτηση (ADR-923 §5.10 Δ7 · Δ11 · Θωράκιση 5)
 * =============================================================================
 *
 * Υπολογίζει τα παράγωγα **κάθε** ζωντανού μέλους της όψης «μετά» — όχι μόνο όσων άλλαξαν: μια αλλαγή στη ρίζα
 * (π.χ. η ελληνική περιγραφή) αλλάζει την πληρότητα **κάθε** SKU. Ο γραφέας συγκρίνει με τα αποθηκευμένα και
 * γράφει (`stageDerived`) μόνο όσα διαφέρουν. Akeneo: ο επανυπολογισμός απογόνων είναι ασύγχρονη εργασία· εδώ,
 * με ≤ 200 απογόνους, γίνεται **στην ίδια συναλλαγή** — ο άνθρωπος δεν βλέπει ποτέ μπαγιάτικο ποσοστό.
 *
 * @module subapps/catalog/aggregate/derive-aggregate
 */

import { productChainDerived, rootModelDerived, subModelDerived, type CatalogSchemaSnapshot } from '../derived/chain-derived';
import { ownHolderDerived } from '../derived/holder-derived';
import type { ConsistencyViolation } from '../rules/evaluate-consistency';
import type { CatalogIssue } from '../schema/catalog-issues';
import type {
  CatalogDescendantEntry,
  CatalogHolderDerived,
  CatalogProductDerived,
  CatalogProductModelDerived,
} from '../types/product-derived';
import { axesAtDepth } from '../values/attribute-levels';
import { axisCombinationKey } from '../values/axis-combination';
import { chainOf, liveMembers, parentIdOf, type AggregateMember, type CatalogAggregate } from './aggregate-model';

export interface AggregateDeriveInput {
  readonly aggregate: CatalogAggregate;
  readonly schema: CatalogSchemaSnapshot;
  /** Τα μη μπλοκάροντα ευρήματα κανόνων — στη ρίζα. */
  readonly findings: readonly ConsistencyViolation[];
  /** Οι προειδοποιήσεις ανά μέλος (π.χ. «μοιάζει με υπάρχοντα κωδικό»). */
  readonly warnings: ReadonlyMap<string, readonly CatalogIssue[]>;
}

export type MemberDerived =
  | { readonly kind: 'productModel'; readonly derived: CatalogProductModelDerived }
  | { readonly kind: 'product'; readonly derived: CatalogProductDerived };

function ownOf(input: AggregateDeriveInput, member: AggregateMember): CatalogHolderDerived {
  const holder = member.after;
  if (!holder) throw new Error(`deriving a deleted member ${member.id}`);
  return ownHolderDerived(holder, input.schema.attributes, input.schema.registry, input.warnings.get(member.id) ?? []);
}

function descendantEntry(input: AggregateDeriveInput, member: AggregateMember, productDerived: CatalogProductDerived | null): CatalogDescendantEntry {
  const { aggregate, schema } = input;
  const depth = chainOf(aggregate, member.id, 'after').length - 1;
  const values = member.after?.values ?? {};
  return {
    kind: member.kind,
    parentId: parentIdOf(member, 'after') ?? '',
    axisKey: axisCombinationKey(values, axesAtDepth(schema.scheme, depth), schema.attributes, schema.registry),
    completeChannels: productDerived?.completeChannels ?? [],
    facetKeys: productDerived?.facetKeys ?? [],
  };
}

/** Τα παράγωγα κάθε ζωντανού μέλους της όψης «μετά». */
export function deriveAggregate(input: AggregateDeriveInput): ReadonlyMap<string, MemberDerived> {
  const { aggregate, schema } = input;
  const result = new Map<string, MemberDerived>();
  const descendants: Record<string, CatalogDescendantEntry> = {};
  for (const member of liveMembers(aggregate, 'after')) {
    if (member.id === aggregate.rootId) continue;
    const chain = chainOf(aggregate, member.id, 'after');
    if (member.kind === 'product') {
      const derived = productChainDerived(schema, chain, ownOf(input, member));
      result.set(member.id, { kind: 'product', derived });
      if (aggregate.rootId !== null) descendants[member.id] = descendantEntry(input, member, derived);
    } else {
      result.set(member.id, { kind: 'productModel', derived: subModelDerived(schema, chain, ownOf(input, member)) });
      descendants[member.id] = descendantEntry(input, member, null);
    }
  }
  const root = aggregate.rootId === null ? undefined : aggregate.members.get(aggregate.rootId);
  if (root?.after) {
    const [rootLink] = chainOf(aggregate, root.id, 'after');
    const derived = rootModelDerived(schema, rootLink, ownOf(input, root), descendants, input.findings);
    result.set(root.id, { kind: 'productModel', derived });
  }
  return result;
}
