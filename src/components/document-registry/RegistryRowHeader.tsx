'use client';

/**
 * @fileoverview **Η κεφαλίδα κάθε γραμμής του μητρώου** — είδος εγγράφου + σήμα κατάστασης (ADR-915 Φ4γ · Φ4δ).
 * @related RegistryRowItem.tsx (έγγραφο) · RegistryGapItem.tsx (κενό)
 * @module components/document-registry/RegistryRowHeader
 *
 * 🔑 **Ένα σημείο για έγγραφο ΚΑΙ κενό**: η κατάσταση διαβάζεται χωρίς χρώμα (εικονίδιο **και** λέξη, CHECK 3.41) με τον
 *    ΙΔΙΟ τρόπο σε κάθε γραμμή — δύο αντίγραφα θα μπορούσαν να αποκλίνουν στην πρώτη αλλαγή.
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { RegistryRowState } from '@/lib/document-validity/document-registry';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  LEGALITY_NS,
  REGISTRY_NS,
  REGISTRY_STATE_LABEL_KEYS,
  REGISTRY_STATE_LOOK,
} from '@/components/document-registry/document-registry-labels';

export function RegistryRowHeader({ kind, state }: { readonly kind: DocumentKind; readonly state: RegistryRowState }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const look = REGISTRY_STATE_LOOK[state];
  const Icon = look.icon;
  return (
    <header className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="m-0 text-base font-semibold text-foreground">{t(DOCUMENT_KIND_LABEL_KEYS[kind])}</h3>
      <Badge variant={look.badge} className="gap-1">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {t(REGISTRY_STATE_LABEL_KEYS[state])}
      </Badge>
    </header>
  );
}
