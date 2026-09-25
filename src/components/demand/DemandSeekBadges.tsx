'use client';

/**
 * **Τα σήματα μιας ζήτησης** — τι συναλλαγή ζητά (Αγορά · Ενοικίαση · Διαμονή · Αντιπαροχή) και σε
 * ποια κατάσταση βρίσκεται. Ίδια σήματα σε κατάλογο και λεπτομέρεια.
 *
 * @related ADR-886 · lib/demand/seek-kind-labels.ts · lib/demand/demand-display-name.ts
 * @module components/demand/DemandSeekBadges
 *
 * 🔑 **Η σειρά είναι του λεξιλογίου (`OFFER_KINDS`), όχι της εισαγωγής** — δύο ζητήσεις με τα ίδια
 * είδη δείχνουν τα ίδια σήματα με την ίδια σειρά, όπως και το αυτόματο όνομα. Το μάτι συγκρίνει
 * κάρτες κατά **θέση**· ανακατεμένη σειρά θα έκανε ίδιες ζητήσεις να μοιάζουν διαφορετικές.
 *
 * ⚠️ Το `lifecycle` ήταν ο **τίτλος** της κάρτας («Ψάχνω»): πέντε κάρτες με τον ίδιο τίτλο. Είναι
 * **κατάσταση**, όχι όνομα — γι' αυτό έγινε σήμα, και ο τίτλος πέρασε στο όνομα της ζήτησης.
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DEMAND_LIFECYCLE_I18N_KEYS } from '@/lib/demand/demand-lifecycle-labels';
import { SEEK_KIND_I18N_KEYS } from '@/lib/demand/seek-kind-labels';
import { OFFER_KINDS } from '@/types/property-offers';
import { seekKindsOf, type PropertyDemand } from '@/types/property-demand';

export function DemandSeekBadges({
  demand,
}: {
  demand: Pick<PropertyDemand, 'seeks' | 'lifecycle'>;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const kinds = new Set(seekKindsOf(demand.seeks));

  return (
    <ul className="flex list-none flex-wrap items-center gap-1 p-0">
      {OFFER_KINDS.filter((kind) => kinds.has(kind)).map((kind) => (
        <li key={kind}>
          <Badge variant="outline">{t(SEEK_KIND_I18N_KEYS[kind])}</Badge>
        </li>
      ))}
      <li>
        <Badge variant={demand.lifecycle === 'active' ? 'secondary' : 'muted'}>
          {t(DEMAND_LIFECYCLE_I18N_KEYS[demand.lifecycle])}
        </Badge>
      </li>
    </ul>
  );
}
