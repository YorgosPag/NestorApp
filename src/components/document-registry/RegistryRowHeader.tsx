'use client';

/**
 * @fileoverview **Η κεφαλίδα κάθε γραμμής του μητρώου** — το σήμα κατάστασης (ADR-915 Φ4γ · Φ4δ · §41.5).
 *
 * 🔑 §41.5 — η κάρτα ζει ΜΟΝΟ στο πλαϊνό πάνελ, που ήδη ονομάζει το είδος στον τίτλο του (`SheetTitle`): ο τίτλος
 *    λέγεται **μία** φορά. Δεύτερος τίτλος ακριβώς από κάτω ήταν διπλότυπο (βρέθηκε στον browser, 2026-11-15).
 * @related RegistryRowItem.tsx (έγγραφο) · RegistryGapItem.tsx (κενό)
 * @module components/document-registry/RegistryRowHeader
 *
 * 🔑 **Ένα σημείο για έγγραφο ΚΑΙ κενό**: η κατάσταση διαβάζεται χωρίς χρώμα (εικονίδιο **και** λέξη, CHECK 3.41) με τον
 *    ΙΔΙΟ τρόπο σε κάθε γραμμή — δύο αντίγραφα θα μπορούσαν να αποκλίνουν στην πρώτη αλλαγή.
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RegistryRowState } from '@/lib/document-validity/document-registry';
import {
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_NS,
  REGISTRY_STATE_LABEL_KEYS,
  REGISTRY_STATE_LOOK,
} from '@/components/document-registry/document-registry-labels';

/** Το σήμα κατάστασης — εικονίδιο **και** λέξη (CHECK 3.41). Κοινό με τον πίνακα του μητρώου (ADR-915 §41.5). */
export function RegistryStateBadge({ state }: { readonly state: RegistryRowState }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const look = REGISTRY_STATE_LOOK[state];
  const Icon = look.icon;
  return (
    <Badge variant={look.badge} className="gap-1">
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {t(REGISTRY_STATE_LABEL_KEYS[state])}
    </Badge>
  );
}

export function RegistryRowHeader({ state }: { readonly state: RegistryRowState }): React.ReactElement {
  return (
    <header className="flex flex-wrap items-start gap-2">
      <RegistryStateBadge state={state} />
    </header>
  );
}
