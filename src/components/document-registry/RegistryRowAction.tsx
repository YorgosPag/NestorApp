'use client';

/**
 * @fileoverview ADR-915 §43 — **η ενέργεια μιας γραμμής** του πίνακα («Επόμενο βήμα»): ένα κουμπί, εκεί που φαίνεται το
 *   πρόβλημα — όχι κείμενο που στέλνει τον άνθρωπο να ψάξει.
 * @related RegistryRowCells.tsx (οι υπόλοιπες τιμές) · RegistryNextStep.tsx (οι πλήρεις ενέργειες, στο πάνελ) ·
 *   RegistryAuthorityLink.tsx (το εξωτερικό κουμπί) · lib/document-validity/document-next-step.ts (ο πυρήνας)
 * @module components/document-registry/RegistryRowAction
 *
 * 🏆 Linear · Vanta: **μία** κύρια ενέργεια ανά γραμμή· η πλήρης φόρμα ζει στη λεπτομέρεια (πλαϊνό πάνελ).
 *    - `self-service`        ⇒ κατευθείαν η υπηρεσία της αρχής (myAADE · e-ΕΦΚΑ), σε νέα καρτέλα.
 *    - `assign-professional` · `find-professional` · `declare-facts` ⇒ ανοίγει το πάνελ (`?doc=`), όπου ζει η φόρμα —
 *      πολυβηματική ανάθεση ή δήλωση με CAS· **ένα** σημείο πράξης, καμία δεύτερη φόρμα στον πίνακα.
 *    - ανάθεση σε εξέλιξη    ⇒ το **στάδιο** ως κείμενο: η μπάλα είναι σε τρίτον, δεν υπάρχει τι να πατηθεί.
 * 🔑 **Καμία δεύτερη κρίση**: στάδιο και ενέργεια από τους ΙΔΙΟΥΣ πυρήνες με την κάρτα (`registryIssuanceOf` +
 *    `visibleIssuanceStage` · `documentNextSteps`).
 * ⚠️ Κάθε `t(…)` με **κυριολεκτικό** κλειδί ή επίπεδο χάρτη: ο γεννήτορας του route slice τα λύνει μόνο έτσι.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { documentNextSteps, type DocumentNextStep } from '@/lib/document-validity/document-next-step';
import { registryRowIdOf, registryRowKindOf, type RegistryRow } from '@/lib/document-validity/document-registry';
import { visibleIssuanceStage } from '@/lib/document-validity/issuance-assignment';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { registryIssuanceOf } from '@/components/document-registry/registry-issuance';
import { RegistryAuthorityLink } from '@/components/document-registry/RegistryAuthorityLink';
import { ISSUANCE_STAGE_KEYS } from '@/components/document-registry/issuance-labels';
import { LAYOUT_KEYS } from '@/components/document-registry/registry-layout-labels';
import {
  CONVEYANCE_NS,
  FACTS_DECLARATION_KEYS,
  LEGALITY_NS,
  NEXT_STEP_KEYS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

export interface RegistryRowActionProps {
  readonly row: RegistryRow;
  readonly registry: DocumentRegistryResponse;
  readonly onOpen: (rowId: string) => void;
}

/** Η λέξη του κουμπιού που ανοίγει το πάνελ — εξαντλητικά πάνω στα βήματα που ζουν εκεί. */
function panelActionText(t: Translate, step: Exclude<DocumentNextStep, { kind: 'self-service' }>): string {
  switch (step.kind) {
    case 'assign-professional': return t(LAYOUT_KEYS.nextAssign);
    case 'find-professional': return t(NEXT_STEP_KEYS.findProfessional);
    case 'declare-facts': return t(FACTS_DECLARATION_KEYS.declare);
  }
}

export function RegistryRowAction({ row, registry, onOpen }: RegistryRowActionProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const issuance = registryIssuanceOf(row, registry);
  const stage = issuance === null || issuance === 'unavailable' ? null : visibleIssuanceStage(issuance.state);
  if (stage !== null) return <span className="text-foreground">{t(ISSUANCE_STAGE_KEYS[stage])}</span>;
  const first = row.state === 'superseded' ? undefined : documentNextSteps(registryRowKindOf(row), row.state)[0];
  if (first === undefined) return <span className="text-muted-foreground">{t(LAYOUT_KEYS.nextNone)}</span>;
  if (first.kind === 'self-service') return <RegistryAuthorityLink service={first.service} />;
  return (
    <Button type="button" variant="outline" size="sm" className="w-fit" aria-haspopup="dialog" onClick={() => onOpen(registryRowIdOf(row))}>
      {panelActionText(t, first)}
    </Button>
  );
}
