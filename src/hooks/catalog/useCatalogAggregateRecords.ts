'use client';
/**
 * **Ένα σύνολο προϊόντος, ζωντανά** — ρίζα · υπο-μοντέλα · SKU (ADR-923 §5.10.2 / §5.10.4 Β3/Β4).
 *
 * Η μονάδα κρίσης **είναι** το σύνολο (κανόνες συνέπειας ανάμεσα σε αδελφές παραλλαγές, μοναδικότητα συνδυασμού
 * αξόνων) ⇒ ο επεξεργαστής ακόμη και **μίας** παραλλαγής φορτώνει όλο το σύνολο, για να κρίνει πριν από την αποστολή
 * όπως θα κρίνει ο διακομιστής (`judgeAggregate`). Ερωτήματα με υπάρχοντες δείκτες: υπο-μοντέλα `parentId ==` ·
 * SKU `modelId in [ρίζα, …υπο-μοντέλα]` (≤ 200 απόγονοι ⇒ πάντα μέσα στο όριο του `in`).
 *
 * @module hooks/catalog/useCatalogAggregateRecords
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { where } from 'firebase/firestore';

import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { ProductModelRecord, ProductRecord } from '@/services/catalog/catalog-api.client';
import type { StoredMemberShape } from '@/subapps/catalog/aggregate/aggregate-members';

import type { CatalogLoadState } from './useCatalogCollection';

export type CatalogHolderKind = 'productModel' | 'product';

/** Το είδος από το id — το πρόθεμα είναι η ταυτότητα του είδους (`cpmod` · `cprod`), όχι χειρόγραφο κείμενο. */
export function holderKindOfId(id: string): CatalogHolderKind | null {
  if (id.startsWith(`${ENTERPRISE_ID_PREFIXES.CATALOG_PRODUCT_MODEL}_`)) return 'productModel';
  if (id.startsWith(`${ENTERPRISE_ID_PREFIXES.CATALOG_PRODUCT}_`)) return 'product';
  return null;
}

export interface CatalogAggregateRecords {
  readonly state: CatalogLoadState | 'missing';
  readonly target: ProductModelRecord | ProductRecord | null;
  /** `null` = απλό προϊόν (σύνολο ενός μέλους). */
  readonly rootId: string | null;
  readonly members: readonly StoredMemberShape[];
}

const COLLECTION = { productModel: 'CATALOG_PRODUCT_MODELS', product: 'CATALOG_PRODUCTS' } as const;

function useTargetDoc(id: string, kind: CatalogHolderKind | null) {
  const [doc, setDoc] = useState<{ id: string; record: ProductModelRecord | ProductRecord | null; state: CatalogLoadState } | null>(null);
  useEffect(() => {
    if (!kind) return undefined;
    return firestoreQueryService.subscribeDoc<(ProductModelRecord | ProductRecord) & Record<string, unknown>>(
      COLLECTION[kind], id,
      (record) => setDoc({ id, record: record && !record.isDeleted ? record : null, state: 'ready' }),
      () => setDoc({ id, record: null, state: 'failed' }),
    );
  }, [id, kind]);
  return doc?.id === id ? doc : null;
}

function rootIdOf(record: ProductModelRecord | ProductRecord): string | null {
  if ('parentId' in record) return record.parentId ?? record.id;
  return record.modelId === null ? null : record.derived?.rootModelId ?? record.modelId;
}

/** Μία ζωντανή ανάγνωση, δεμένη σε ένα κλειδί — αποτέλεσμα άλλου κλειδιού δεν φαίνεται ποτέ (κανένας αγώνας). */
function useKeyed<T>(key: string | null, subscribe: (key: string, set: (value: T) => void) => () => void): T | null {
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;
  useEffect(() => (key === null ? undefined : subscribeRef.current(key, (value) => setState({ key, value }))), [key]);
  return state !== null && state.key === key ? state.value : null;
}

function useTree(rootId: string | null) {
  const root = useKeyed<ProductModelRecord | null>(rootId, (id, set) =>
    firestoreQueryService.subscribeDoc<ProductModelRecord & Record<string, unknown>>('CATALOG_PRODUCT_MODELS', id, (doc) => set(doc && !doc.isDeleted ? doc : null), () => set(null)));
  const subModels = useKeyed<readonly ProductModelRecord[]>(rootId, (id, set) =>
    firestoreQueryService.subscribe<ProductModelRecord & Record<string, unknown>>('CATALOG_PRODUCT_MODELS', (result) => set(result.documents), () => set([]),
      { constraints: [where('isDeleted', '==', false), where('parentId', '==', id)] }));
  const models = useMemo(() => (root === null || subModels === null ? null : [root, ...subModels]), [root, subModels]);
  const modelKey = models ? models.map((model) => model.id).sort().join(',') : null;
  const products = useKeyed<readonly ProductRecord[]>(modelKey, (key, set) =>
    firestoreQueryService.subscribe<ProductRecord & Record<string, unknown>>('CATALOG_PRODUCTS', (result) => set(result.documents), () => set([]),
      { constraints: [where('isDeleted', '==', false), where('modelId', 'in', key.split(','))] }));
  return { models, products };
}

export function useCatalogAggregateRecords(id: string): CatalogAggregateRecords {
  const kind = holderKindOfId(id);
  const doc = useTargetDoc(id, kind);
  const rootId = doc?.record ? rootIdOf(doc.record) : null;
  const tree = useTree(rootId);
  return useMemo((): CatalogAggregateRecords => {
    if (!kind || doc?.state === 'failed') return { state: 'failed', target: null, rootId: null, members: [] };
    if (!doc) return { state: 'loading', target: null, rootId: null, members: [] };
    if (!doc.record) return { state: 'missing', target: null, rootId: null, members: [] };
    if (rootId === null) {
      const simple = doc.record;
      return 'modelId' in simple
        ? { state: 'ready', target: simple, rootId: null, members: [{ kind: 'product', record: simple }] }
        : { state: 'failed', target: null, rootId: null, members: [] };
    }
    if (!tree.models || !tree.products) return { state: 'loading', target: doc.record, rootId, members: [] };
    const members: StoredMemberShape[] = [
      ...tree.models.map((record) => ({ kind: 'productModel' as const, record })),
      ...tree.products.map((record) => ({ kind: 'product' as const, record })),
    ];
    return { state: 'ready', target: doc.record, rootId, members };
  }, [kind, doc, rootId, tree.models, tree.products]);
}
