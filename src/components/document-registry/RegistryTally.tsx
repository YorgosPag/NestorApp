'use client';

/**
 * @fileoverview **Οι κάρτες σύνοψης** — μία ανά κατάσταση, **και οι μηδενικές** (ADR-915 Φ4γ).
 * @related components/property-management/dashboard/StatsCard.tsx (η κάρτα) · document-registry-labels.ts
 * @module components/document-registry/RegistryTally
 *
 * 🔴 **Η μηδενική κάρτα ΔΕΝ κρύβεται**: «κοίταξα, 0 έληξαν» είναι πληροφορία· μια κάρτα που λείπει διαβάζεται «δεν
 *    υπάρχει τέτοιος έλεγχος». Η σειρά είναι η σειρά επείγοντος του πυρήνα (`REGISTRY_ROW_STATES`).
 * 🔑 Τιμές **μόνο** από το `tally` του διακομιστή — η οθόνη δεν ξαναμετρά.
 * 🔑 **Κάθε κάρτα είναι εναλλαγή φίλτρου** (ADR-840 §7.8 · `aria-pressed`): ανοίγει την προβολή της κατάστασής της,
 *    ξαναπατημένη γυρνά στο «Όλα». Η κατάσταση ζει **μία** φορά, στη διεύθυνση — κάρτες και επιλογέας τη διαβάζουν.
 */

import React from 'react';

import { StatsCard } from '@/components/property-management/dashboard/StatsCard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { REGISTRY_ROW_STATES, type DocumentRegistry } from '@/lib/document-validity/document-registry';
import { toggledRegistryView, type RegistryView } from '@/lib/document-validity/document-registry-view';
import {
  REGISTRY_KEYS,
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_NS,
  REGISTRY_STATE_LABEL_KEYS,
  REGISTRY_STATE_LOOK,
} from '@/components/document-registry/document-registry-labels';

interface RegistryTallyProps {
  readonly tally: DocumentRegistry['tally'];
  /** Η τρέχουσα προβολή — η κάρτα της ίδιας κατάστασης δείχνεται πατημένη. */
  readonly view: RegistryView;
  readonly onSelect: (next: RegistryView) => void;
}

export function RegistryTally({ tally, view, onSelect }: RegistryTallyProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <section aria-labelledby="document-registry-tally" className="flex flex-col gap-2">
      <h2 id="document-registry-tally" className="m-0 text-sm font-medium text-muted-foreground">
        {t(REGISTRY_KEYS.tallyHeading)}
      </h2>
      {/* Έξι καταστάσεις (Φ4δ: + «λείπει») ⇒ 2 · 3 · 6 στήλες: κάθε σειρά γεμάτη, καμία ορφανή κάρτα. */}
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 xl:grid-cols-6">
        {REGISTRY_ROW_STATES.map((state) => {
          const look = REGISTRY_STATE_LOOK[state];
          return (
            <li key={state} className="min-w-0">
              <StatsCard
                title={t(REGISTRY_STATE_LABEL_KEYS[state])}
                value={tally[state]}
                icon={look.icon}
                color={tally[state] === 0 ? 'gray' : look.tone}
                pressed={view === state}
                onClick={() => onSelect(toggledRegistryView(view, state))}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
