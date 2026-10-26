/**
 * **Τα μέλη ενός συνόλου** — καθαρή συναρμολόγηση, κοινή σε οθόνη και διακομιστή (ADR-923 §5.10.2 / §5.10.4 Β4).
 *
 * Ζούσε μέσα στο `catalog-aggregate-load.server.ts`, ανακατεμένη με αναγνώσεις (`server-only`) ⇒ η οθόνη δεν μπορούσε να
 * φτιάξει το **ίδιο** `CatalogAggregate` για να τρέξει την **ίδια** κρίση πριν από τη δέσμη (`judgeAggregate`) — θα
 * έπρεπε να το ξαναγράψει, και δύο συναρμολογήσεις κάποτε διαφωνούν. Εδώ μένει μόνο το καθαρό· οι **ισχυρισμοί**
 * (CAS, αμετάβλητα πεδία, «υπάρχει;») μένουν στον διακομιστή, όπου ζουν οι αναγνώσεις.
 *
 * @module subapps/catalog/aggregate/aggregate-members
 */

import type { CatalogProductDefinition, CatalogProductModelDefinition } from '../types/product';
import type { StoredCatalogProductDefinition, StoredCatalogProductModelDefinition } from '../types/product-derived';
import type { AggregateMember, ModelMember, ProductMember } from './aggregate-model';

/** Η αναθεώρηση μετά από εγγραφή — **ένας** κανόνας για γραφέα, κρίση και οθόνη. */
export function revisionAfterWrite(previousRevision: number): number {
  return previousRevision + 1;
}

/** Ό,τι χρειάζεται η συναρμολόγηση από μια αποθηκευμένη εγγραφή (υποσύνολο — δουλεύει και με εγγραφές «σύρματος»). */
interface StoredRecordShape {
  readonly id: string;
  readonly revision: number;
}

export type StoredModelShape = StoredCatalogProductModelDefinition & StoredRecordShape;
export type StoredProductShape = StoredCatalogProductDefinition & StoredRecordShape;

export type StoredMemberShape =
  | { readonly kind: 'productModel'; readonly record: StoredModelShape }
  | { readonly kind: 'product'; readonly record: StoredProductShape };

/** Μέλος που **δεν** άλλαξε (μπορεί να αλλάξουν μόνο τα παράγωγά του). */
export function unchangedMember(member: StoredMemberShape): AggregateMember {
  const base = { id: member.record.id, revisionAfter: member.record.revision, changed: false };
  return member.kind === 'productModel'
    ? ({ ...base, kind: 'productModel', before: member.record, after: member.record } satisfies ModelMember)
    : ({ ...base, kind: 'product', before: member.record, after: member.record } satisfies ProductMember);
}

export function updatedModelMember(record: StoredModelShape, definition: CatalogProductModelDefinition): ModelMember {
  return { id: record.id, kind: 'productModel', before: record, after: definition, revisionAfter: revisionAfterWrite(record.revision), changed: true };
}

export function updatedProductMember(record: StoredProductShape, definition: CatalogProductDefinition): ProductMember {
  return { id: record.id, kind: 'product', before: record, after: definition, revisionAfter: revisionAfterWrite(record.revision), changed: true };
}

export function deletedMember(member: StoredMemberShape): AggregateMember {
  const base = { id: member.record.id, revisionAfter: revisionAfterWrite(member.record.revision), changed: true, after: null };
  return member.kind === 'productModel' ? { ...base, kind: 'productModel', before: member.record } : { ...base, kind: 'product', before: member.record };
}

/** Νέο SKU — `previousRevision` > 0 όταν το id ξαναχρησιμοποιεί διαγραμμένο έγγραφο (το ξέρει μόνο ο διακομιστής). */
export function createdProductMember(id: string, definition: CatalogProductDefinition, previousRevision = 0): ProductMember {
  return { id, kind: 'product', before: null, after: definition, revisionAfter: revisionAfterWrite(previousRevision), changed: true };
}

export function createdModelMember(id: string, definition: CatalogProductModelDefinition, previousRevision = 0): ModelMember {
  return { id, kind: 'productModel', before: null, after: definition, revisionAfter: revisionAfterWrite(previousRevision), changed: true };
}

/** Διαγραφή σε καταρράκτη: κάθε μέλος που έχει το διαγραμμένο ως πρόγονο (υπο-μοντέλο ⇒ τα SKU του). */
export function cascadeDeletes(stored: ReadonlyMap<string, StoredMemberShape>, members: Map<string, AggregateMember>, deletedId: string): void {
  const parentOf = (member: StoredMemberShape) => (member.kind === 'productModel' ? member.record.parentId : member.record.modelId);
  for (const member of stored.values()) {
    if (parentOf(member) !== deletedId || members.get(member.record.id)?.after === null) continue;
    members.set(member.record.id, deletedMember(member));
    cascadeDeletes(stored, members, member.record.id);
  }
}
