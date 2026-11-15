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
 *    - ανάθεση σε εξέλιξη, **μπάλα στο γραφείο** (§45 Φ1: `proposed` · `ownerApproved` · `declined`) ⇒ κουμπί με το
 *      βήμα του γραφείου («Ζητήστε προσφορά» …), που ανοίγει το πάνελ — εκεί ζει η φόρμα.
 *    - ανάθεση σε εξέλιξη, **μπάλα σε τρίτον** ⇒ το στάδιο ως κείμενο: δεν υπάρχει τι να πατηθεί.
 *    - και στις δύο, δεύτερη γραμμή «<επαφή> · από <ημέρα>» — **ποιος** και **από πότε** (Procore Ball in Court)·
 *      μετά την ανάθεση (§45 Φ2) και «· έως <ημέρα>» + βαθμίδα καθυστέρησης + «μετά την υπογραφή».
 *    - §45 Φ3: η προθεσμία λήγει σήμερα ή πέρασε ⇒ και κουμπί «Υπενθύμιση» (DocuSign «Remind»), εκεί που φαίνεται η
 *      καθυστέρηση· πριν από αυτό το κουμπί ζει μόνο στο πάνελ (η αυτόματη υπενθύμιση φροντίζει την παραμονή).
 * 🔑 **Καμία δεύτερη κρίση**: στάδιο, μπάλα και ενέργεια από τους ΙΔΙΟΥΣ πυρήνες με την κάρτα (`registryIssuanceOf` ·
 *    `issuanceStateOf` · `documentNextSteps`)· το «από πότε» από το γεγονός που γέννησε το στάδιο (`issuanceStageSinceOf`).
 * ⚠️ Κάθε `t(…)` με **κυριολεκτικό** κλειδί ή επίπεδο χάρτη: ο γεννήτορας του route slice τα λύνει μόνο έτσι.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { documentNextSteps, type DocumentNextStep } from '@/lib/document-validity/document-next-step';
import { registryRowIdOf, registryRowKindOf, type RegistryRow } from '@/lib/document-validity/document-registry';
import type { IssuanceState } from '@/lib/document-validity/issuance-assignment';
import { issuanceStageSinceOf } from '@/lib/document-validity/issuance-stage';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { registryIssuanceOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { registryPersonOf } from '@/components/document-registry/registry-obligors';
import { ObligorPerson } from '@/components/document-registry/registry-links';
import { RegistryAuthorityLink } from '@/components/document-registry/RegistryAuthorityLink';
import { DeliveryCellLine } from '@/components/document-registry/RegistryIssuanceDeliveryCell';
import { DeliveryReminderButton } from '@/components/document-registry/RegistryDeliveryReminder';
import { ISSUANCE_ROW_ACTION_KEYS, ISSUANCE_STAGE_KEYS } from '@/components/document-registry/issuance-labels';
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

/** Το κουμπί που ανοίγει το πάνελ της γραμμής — ένα σημείο πράξης, όποια κι αν είναι η λέξη. */
function OpenPanelButton({ rowId, onOpen, children }: { readonly rowId: string; readonly onOpen: (rowId: string) => void; readonly children: React.ReactNode }): React.ReactElement {
  return (
    <Button type="button" variant="outline" size="sm" className="w-fit" aria-haspopup="dialog" onClick={() => onOpen(rowId)}>
      {children}
    </Button>
  );
}

type OpenIssuance = Extract<IssuanceState, { kind: 'open' }>;

/** §45 Φ3 — η γραμμή δείχνει «Υπενθύμιση» μόνο όταν η καθυστέρηση **φαίνεται**: λήγει σήμερα ή πέρασε. */
function remindsInRow(delivery: RegistryIssuanceView['delivery']): boolean {
  const tier = delivery?.lateness.tier;
  return tier === 'overdue' || tier === 'due-today';
}

/** §45 Φ1 — ανάθεση σε εξέλιξη: κουμπί αν η μπάλα είναι στο γραφείο, αλλιώς το στάδιο· από κάτω «ποιος · από πότε». */
function IssuanceRowAction({ issuance, state, rowId, registry, onOpen }: {
  readonly issuance: RegistryIssuanceView;
  readonly state: OpenIssuance;
  readonly rowId: string;
  readonly registry: DocumentRegistryResponse;
  readonly onOpen: (rowId: string) => void;
}): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const { delivery, signingDay } = issuance;
  const actionKey = ISSUANCE_ROW_ACTION_KEYS[state.stage];
  const officeTurn = state.ballInCourt === 'office' && actionKey !== null;
  return (
    <span className="flex flex-col gap-1">
      {officeTurn
        ? <OpenPanelButton rowId={rowId} onOpen={onOpen}>{t(actionKey)}</OpenPanelButton>
        : <span className="text-foreground">{t(ISSUANCE_STAGE_KEYS[state.stage])}</span>}
      {remindsInRow(delivery) ? <DeliveryReminderButton target={issuance} /> : null}
      <span className="text-xs text-muted-foreground">
        <ObligorPerson person={registryPersonOf(state.record.professionalContactId, registry)} />{' '}
        <span>{t(LAYOUT_KEYS.nextSince, { date: formatDate(issuanceStageSinceOf(state.record)) })}</span>
        {delivery === null ? null : <>{' '}<DeliveryCellLine status={delivery} signingDay={signingDay} /></>}
      </span>
    </span>
  );
}

export function RegistryRowAction({ row, registry, onOpen }: RegistryRowActionProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const issuance = registryIssuanceOf(row, registry);
  const rowId = registryRowIdOf(row);
  if (issuance !== null && issuance !== 'unavailable' && issuance.state.kind === 'open') {
    return (
      <IssuanceRowAction issuance={issuance} state={issuance.state} rowId={rowId} registry={registry} onOpen={onOpen} />
    );
  }
  const first = row.state === 'superseded' ? undefined : documentNextSteps(registryRowKindOf(row), row.state)[0];
  if (first === undefined) return <span className="text-muted-foreground">{t(LAYOUT_KEYS.nextNone)}</span>;
  if (first.kind === 'self-service') return <RegistryAuthorityLink service={first.service} />;
  return <OpenPanelButton rowId={rowId} onOpen={onOpen}>{panelActionText(t, first)}</OpenPanelButton>;
}
