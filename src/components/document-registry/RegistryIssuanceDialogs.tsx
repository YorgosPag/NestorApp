'use client';

/**
 * @fileoverview ADR-915 §27 — οι διάλογοι της ανάθεσης έκδοσης: **πρόταση** · **απόφαση ιδιοκτήτη** · **ενημέρωση
 *   επαγγελματία** · **ακύρωση**, πάνω σε ΕΝΑ κέλυφος (κουμπί + διάλογος + φόρμα που ξεκινά καθαρή σε κάθε άνοιγμα).
 * @related RegistryIssuanceStep.tsx (ο καταναλωτής) · RegistryIssuanceDecisionForms.tsx · RegistryIssuanceProposeForm.tsx
 * @module components/document-registry/RegistryIssuanceDialogs
 *
 * 🔑 **Οι φόρμες φορτώνονται όταν ανοίξει ο διάλογος** (`next/dynamic`): εδώ μένουν μόνο κουμπί, τίτλος και περιγραφή —
 *    όριο της κλειστότητας του route slice (CHECK 3.34), όχι νέα σφράγιση.
 * 🔑 **Η απόφαση είναι του ΥΠΕΥΘΥΝΟΥ** (§26), και ο διάλογος τον **ονομάζει**: «καταγράφετε την απόφαση του Χ». Χωρίς
 *    υπεύθυνο, ο διάλογος **δεν** δίνει φόρμα — λέει «ορίστε πρώτα υπεύθυνο» (ένας για όλο το ακίνητο, ΑΚ 789).
 * 🔑 **Καταγραφή, όχι αποστολή**: κανένας διάλογος δεν στέλνει μήνυμα — το λέει ρητά (§18.5: ποτέ αυτόματη αποστολή).
 */

import dynamic from 'next/dynamic';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  LEGALITY_NS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';
import {
  CANCEL_KEYS,
  DECISION_KEYS,
  ISSUANCE_KEYS,
  NOTICE_KEYS,
  PROPOSE_KEYS,
} from '@/components/document-registry/issuance-labels';

const DecisionForm = dynamic(() => import('./RegistryIssuanceDecisionForms').then((mod) => mod.DecisionForm), { ssr: false });
const NoticeForm = dynamic(() => import('./RegistryIssuanceDecisionForms').then((mod) => mod.NoticeForm), { ssr: false });
const ProposeForm = dynamic(() => import('./RegistryIssuanceProposeForm').then((mod) => mod.ProposeForm), { ssr: false });

export interface IssuanceDialogShellProps {
  readonly trigger: string;
  readonly triggerVariant?: 'outline' | 'ghost';
  readonly title: string;
  readonly description: string;
  /** Η φόρμα — φτιάχνεται **μόνο** όσο ο διάλογος είναι ανοιχτός ⇒ κάθε άνοιγμα ξεκινά καθαρό. */
  readonly children: (close: () => void) => React.ReactNode;
}

function IssuanceDialogShell({ trigger, triggerVariant = 'outline', title, description, children }: IssuanceDialogShellProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant={triggerVariant} className="w-fit" onClick={() => setOpen(true)}>{trigger}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {open ? children(() => setOpen(false)) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface IssuanceProposeDialogProps {
  readonly view: RegistryIssuanceView;
  /** Τα ονόματα των υποψηφίων (επαφές του μισθωτή, ήδη διαβασμένες από τον διακομιστή). */
  readonly names: Readonly<Record<string, string>>;
  /** «Ανάθεση σε επαγγελματία» (καμία ενεργή) ή «Πρόταση άλλου» (αλλαγή πριν δεσμευτεί κάτι). */
  readonly trigger: 'assign' | 'proposeOther';
}

export function IssuanceProposeDialog({ view, names, trigger }: IssuanceProposeDialogProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <IssuanceDialogShell
      trigger={t(trigger === 'assign' ? ISSUANCE_KEYS.assign : ISSUANCE_KEYS.proposeOther)}
      title={t(PROPOSE_KEYS.title, { document: t(DOCUMENT_KIND_LABEL_KEYS[view.kind]) })}
      description={t(PROPOSE_KEYS.description)}
    >
      {(close) => <ProposeForm view={view} names={names} close={close} />}
    </IssuanceDialogShell>
  );
}

export interface DecisionDialogProps {
  readonly view: RegistryIssuanceView;
  readonly professionalName: string;
  /** Ο υπεύθυνος (§26) — όνομα για τη φράση και ταυτότητα για τη CAS· `null` ⇒ δεν υπάρχει υπεύθυνος. */
  readonly lead: { readonly contactId: string; readonly name: string } | null;
}

export function IssuanceDecisionDialog({ view, professionalName, lead }: DecisionDialogProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const description = lead === null ? t(DECISION_KEYS.needsLead) : t(DECISION_KEYS.description, { name: lead.name });
  return (
    <IssuanceDialogShell trigger={t(ISSUANCE_KEYS.recordDecision)} title={t(DECISION_KEYS.title)} description={description}>
      {(close) => (lead === null ? null : <DecisionForm view={view} close={close} professionalName={professionalName} leadId={lead.contactId} />)}
    </IssuanceDialogShell>
  );
}

export function IssuanceNoticeDialog({ view, professionalName }: { readonly view: RegistryIssuanceView; readonly professionalName: string }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  return (
    <IssuanceDialogShell trigger={t(ISSUANCE_KEYS.markNotified)} title={t(NOTICE_KEYS.title)} description={t(NOTICE_KEYS.description, { name: professionalName })}>
      {(close) => <NoticeForm view={view} close={close} />}
    </IssuanceDialogShell>
  );
}

export function IssuanceCancelDialog({ view }: { readonly view: RegistryIssuanceView }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  return (
    <IssuanceDialogShell trigger={t(ISSUANCE_KEYS.cancel)} triggerVariant="ghost" title={t(CANCEL_KEYS.title)} description={t(CANCEL_KEYS.description)}>
      {(close) => (
        <DialogActionFooter
          cancelLabel={t(CANCEL_KEYS.keep)} confirmLabel={t(CANCEL_KEYS.confirm)} busyLabel={t(ISSUANCE_KEYS.saving)}
          confirmVariant="destructive" onCancel={close} isSubmitting={false}
          onConfirm={() => { close(); actions?.act({ action: 'cancel', ...issuanceTargetOf(view) }); }}
        />
      )}
    </IssuanceDialogShell>
  );
}
