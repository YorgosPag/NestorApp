'use client';

/**
 * **«ΝΑ ΜΑΘΑΙΝΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ, ΑΝΩΝΥΜΑ, ΟΤΙ ΥΠΑΡΧΕΙ ΕΝΔΙΑΦΕΡΟΝ;»** — η ενημέρωση και το δικαίωμα αντίρρησης.
 *
 * @related ADR-900 · lib/demand/demand-owner-signal.ts · types/property-demand.ts (`DEMAND_OWNER_SIGNALS`)
 * @module components/demand/form/DemandOwnerSignalField
 *
 * 🔑 **Ενημέρωση ΠΑΝΤΑ, επιλογή εξαίρεσης ΔΙΠΛΑ της** — όχι υποχρεωτικό τικ. Η καταμέτρηση είναι
 * ανώνυμη (καμία ταυτότητα, κανένα κριτήριο, κανένα ποσό), άρα το ζητούμενο είναι **διαφάνεια +
 * αντίρρηση** (GDPR άρθ. 13 · 21), ίδια στάση με τα αθροιστικά «buyer demand» των Zoopla/Boneo — που
 * όμως **δεν** δίνουν επιλογή εξαίρεσης. Η επιλογή αποθηκεύεται και τη σέβεται ο **ένας** κριτής.
 *
 * ⚠️ Μετρά **κάθε** μορφή τόπου, όχι μόνο «αυτό το κτίριο»: και μια ζήτηση περιοχής μετρά στο
 * «πόσοι ψάχνουν σαν το δικό σας» του ιδιοκτήτη μέσα σε αυτήν.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DEMAND_OWNER_SIGNALS, type DemandOwnerSignal } from '@/types/property-demand';
import { DemandFieldset, DemandOptionsField } from './demand-field-primitives';

const NS = 'property-market';
const K = `${NS}:demand.form.ownerSignal`;

export function DemandOwnerSignalField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <DemandFieldset legend={t(`${K}.legend`)} help={t(`${K}.help`)}>
      <DemandOptionsField<DemandOwnerSignal>
        name="ownerSignal"
        mode="single"
        options={DEMAND_OWNER_SIGNALS}
        labelOf={(signal) => t(`${K}.${signal}`)}
      />
    </DemandFieldset>
  );
}
