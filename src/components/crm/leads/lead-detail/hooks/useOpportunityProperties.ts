'use client';

/**
 * Ονόματα των ακινήτων που ενδιαφέρουν μια ευκαιρία.
 * Το φίλτρο εταιρείας το βάζει το `firestoreQueryService`· ακίνητο που δεν βρίσκεται
 * ή δεν διαβάζεται μένει στη λίστα χωρίς όνομα.
 */

import { useEffect, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore';

const logger = createModuleLogger('useOpportunityProperties');

export interface OpportunityPropertyRef {
  readonly id: string;
  readonly name: string | null;
}

interface PropertyNameDoc {
  readonly id: string;
  readonly name?: string;
  readonly code?: string;
}

async function loadPropertyRef(id: string): Promise<OpportunityPropertyRef> {
  try {
    const property = await firestoreQueryService.getById<PropertyNameDoc>('PROPERTIES', id);
    return { id, name: property?.name ?? property?.code ?? null };
  } catch (error) {
    logger.warn('Failed to load opportunity property', { id, error });
    return { id, name: null };
  }
}

export function useOpportunityProperties(
  propertyIds: readonly string[] | undefined,
): readonly OpportunityPropertyRef[] {
  const [properties, setProperties] = useState<readonly OpportunityPropertyRef[]>([]);
  const idsKey = propertyIds?.join('|') ?? '';

  useEffect(() => {
    if (idsKey === '') {
      setProperties([]);
      return;
    }
    let alive = true;
    void Promise.all(idsKey.split('|').map(loadPropertyRef)).then((refs) => {
      if (alive) setProperties(refs);
    });
    return () => {
      alive = false;
    };
  }, [idsKey]);

  return properties;
}
