'use client';

/**
 * @fileoverview ADR-915 §35 — **η απόφαση** μιας μόνιμης υποχρέωσης: «Επιβεβαίωση» · «Δεν ισχύει» (με λόγο) · «Αναίρεση».
 * @related RegistryUpkeepPanel.tsx (η ενότητα) · RegistryUpkeepExemptForm.tsx (ο λόγος, `next/dynamic`) ·
 *   hooks/document-registry/useUpkeepDeclaration.ts (η αποστολή)
 * @module components/document-registry/RegistryUpkeepDecision
 *
 * 🔑 Τα κουμπιά λένε «Αποθηκεύεται…» **μόνο** στο (ακίνητο, είδος) που στέλνεται· ο φρουρός του hook αγνοεί δεύτερη
 *    αποστολή όσο η πρώτη είναι σε πτήση.
 */

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { UpkeepItem } from '@/lib/document-validity/property-upkeep';
import type { UpkeepDeclarationBody } from '@/lib/document-validity/upkeep-declaration-request';
import { CONVEYANCE_NS, LEGALITY_NS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { UPKEEP_KEYS } from '@/components/document-registry/upkeep-labels';

// Όριο κλειστότητας (CHECK 3.34): η φόρμα εξαίρεσης φαίνεται μόνο μετά το «Δεν ισχύει».
const UpkeepExemptForm = dynamic(
  () => import('./RegistryUpkeepExemptForm').then((mod) => mod.UpkeepExemptForm),
  { ssr: false },
);

export interface UpkeepDecisionProps {
  readonly item: UpkeepItem;
  readonly busy: boolean;
  readonly onSubmit: (body: UpkeepDeclarationBody) => Promise<boolean>;
}

/** Χωρίς απόφαση: «Επιβεβαίωση» · «Δεν ισχύει». Με απόφαση: «Αναίρεση» (γυρίζει η πρόταση — κι αυτό με ίχνος). */
export function RegistryUpkeepDecision({ item, busy, onSubmit }: UpkeepDecisionProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const [exempting, setExempting] = useState(false);
  const send = (decision: UpkeepDeclarationBody['decision']): Promise<boolean> =>
    onSubmit({ propertyId: item.propertyId, documentKind: item.documentKind, decision, exemptionReason: null });
  if (exempting) return <UpkeepExemptForm item={item} busy={busy} onSubmit={onSubmit} onCancel={() => setExempting(false)} />;
  if (item.declaration !== null) {
    return (
      <nav className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => send(null)} disabled={busy}>
          {t(busy ? UPKEEP_KEYS.saving : UPKEEP_KEYS.reask)}
        </Button>
      </nav>
    );
  }
  return (
    <nav className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => send('required')} disabled={busy}>
        {t(busy ? UPKEEP_KEYS.saving : UPKEEP_KEYS.confirm)}
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => setExempting(true)} disabled={busy}>
        {t(UPKEEP_KEYS.exempt)}
      </Button>
    </nav>
  );
}
