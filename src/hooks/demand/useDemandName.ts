'use client';

/**
 * **Το όνομα της ζήτησης στην οθόνη** — ο καθαρός παραγωγός, δεμένος με τον μεταφραστή της σελίδας.
 *
 * @related ADR-886 · lib/demand/demand-display-name.ts
 * @module hooks/demand/useDemandName
 *
 * 🔑 Υπάρχει για **ένα** πράγμα: τα namespaces που χρειάζεται το όνομα (η ζήτηση · τα είδη ακινήτου ·
 * οι μονάδες τιμής) δηλώνονται **μία** φορά. Κάρτα, λεπτομέρεια και φόρμα με τρεις χειρόγραφες λίστες
 * θα απέκλιναν — και ένα namespace που λείπει βάφει **ωμό κλειδί** μέσα στο όνομα.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  demandAutoName,
  demandDisplayName,
  type DemandNameCriteria,
} from '@/lib/demand/demand-display-name';
import type { PropertyDemand } from '@/types/property-demand';

/** Τα namespaces του ονόματος — βλ. την κεφαλίδα. */
const NAME_NAMESPACES = ['property-market', 'properties-enums', 'common'] as const;

interface DemandNamer {
  /** Το αυτόματο όνομα — και για κριτήρια που **δεν** αποθηκεύτηκαν ακόμη (η φόρμα). */
  readonly autoName: (criteria: DemandNameCriteria) => string;
  /** Ό,τι έγραψε ο άνθρωπος, αλλιώς το αυτόματο. */
  readonly displayName: (demand: DemandNameCriteria & Pick<PropertyDemand, 'title'>) => string;
}

export function useDemandName(): DemandNamer {
  const { t } = useTranslation([...NAME_NAMESPACES]);

  return React.useMemo(
    () => ({
      autoName: (criteria) => demandAutoName(criteria, t),
      displayName: (demand) => demandDisplayName(demand, t),
    }),
    [t],
  );
}
