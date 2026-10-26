'use client';
/**
 * **Οι στόχοι αναφορών που αναφέρει ένα σύνολο** — με την οικογένειά τους (ADR-923 §5.10.2 `referenceFamilyNotAllowed`).
 *
 * Ο γραφέας τους διαβάζει μέσα στη συναλλαγή (`readReferenceSnapshot`)· η οθόνη τους διαβάζει **εδώ**, ώστε η ίδια
 * κρίση (`validateHolderValues` → `targetFamilyCodes`) να τρέξει πριν από την αποστολή. Επίσης δίνει το **όνομα** κάθε
 * στόχου για προβολή (κωδικός μοντέλου · αναγνωριστικό SKU).
 *
 * @module hooks/catalog/useCatalogReferenceLookup
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { FamilyRecord } from '@/services/catalog/catalog-api.client';
import { referenceTargetKey, type ReferenceLookup } from '@/subapps/catalog/schema/product-validation-context';
import type { CatalogReferenceTarget } from '@/subapps/catalog/types/product';

interface TargetFacts {
  readonly familyId: string;
  readonly name: string;
}

export interface CatalogReferenceLookup {
  readonly lookup: ReferenceLookup;
  readonly describe: (target: CatalogReferenceTarget) => string;
}

async function readTarget(target: CatalogReferenceTarget): Promise<TargetFacts | null> {
  const doc = await firestoreQueryService.getById<Record<string, unknown>>(target.kind === 'product' ? 'CATALOG_PRODUCTS' : 'CATALOG_PRODUCT_MODELS', target.id);
  if (!doc || doc.isDeleted === true || typeof doc.familyId !== 'string') return null;
  const derived = (doc.derived ?? {}) as Record<string, unknown>;
  const name = typeof doc.code === 'string' ? doc.code : typeof derived.identifier === 'string' ? derived.identifier : target.id;
  return { familyId: doc.familyId, name };
}

export function useCatalogReferenceLookup(targets: readonly CatalogReferenceTarget[], familyById: ReadonlyMap<string, FamilyRecord>): CatalogReferenceLookup {
  const key = targets.map(referenceTargetKey).sort().join(',');
  const [facts, setFacts] = useState<ReadonlyMap<string, TargetFacts>>(new Map());
  // Η εξάρτηση είναι η ταυτότητα ΠΕΡΙΕΧΟΜΕΝΟΥ (`key`)· στόχοι και γνωστά διαβάζονται από refs (τιμή της στιγμής).
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const factsRef = useRef(facts);
  factsRef.current = facts;
  useEffect(() => {
    const missing = targetsRef.current.filter((target) => !factsRef.current.has(referenceTargetKey(target)));
    if (missing.length === 0) return undefined;
    let alive = true;
    void Promise.all(missing.map(async (target) => [referenceTargetKey(target), await readTarget(target)] as const)).then((entries) => {
      if (!alive) return;
      setFacts((prev) => {
        const next = new Map(prev);
        entries.forEach(([targetKey, fact]) => { if (fact) next.set(targetKey, fact); });
        return next;
      });
    });
    return () => { alive = false; };
  }, [key]);

  return useMemo(() => {
    const lookup = new Map<string, { readonly familyCode: string }>();
    for (const [targetKey, fact] of facts) {
      const family = familyById.get(fact.familyId);
      if (family) lookup.set(targetKey, { familyCode: family.code });
    }
    return { lookup, describe: (target) => facts.get(referenceTargetKey(target))?.name ?? target.id };
  }, [facts, familyById]);
}
