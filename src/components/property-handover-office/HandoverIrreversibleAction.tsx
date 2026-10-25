'use client';

/**
 * @fileoverview **Μία μη αναστρέψιμη πράξη γραφείου** — κουμπί + διάλογος καταστροφικής πράξης: τι σημαίνει, υποχρεωτική
 *   αιτιολογία, ρητή επιβεβαίωση (ADR-916 §5.19 Φ-Δ.5 «Ανάκληση παράδοσης» · §5.23 Φ-Δ.7γ «Κλείσιμο γραμμής»).
 * @related HandoverWithdrawal.tsx · HandoverUnprovenLines.tsx (οι πράξεις) · config/property-handover-office-policy.ts
 *          (τα όρια της αιτιολογίας — τα ΙΔΙΑ με την πόρτα) · hooks/property-handover/useHandoverOfficeActions (το `busyId`)
 * @module components/property-handover-office/HandoverIrreversibleAction
 *
 * 🔑 **Ένα σχήμα για κάθε DocuSign-void πράξη**: δύο διάλογοι με δικά τους πεδία θα απέκλιναν στο πρώτο όριο ή στο πρώτο
 *    κείμενο. Τα κείμενα έρχονται από το πρόθεμα κλειδιών της πράξης: `action` · `title` · `confirmAction` · `means.*` ·
 *    `reasonLabel` · `confirmIrreversible`. Η πόρτα τα ξαναελέγχει όλα, όποιος κι αν είναι ο πελάτης.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/textarea';
import { HANDOVER_OFFICE_REASON_MAX, HANDOVER_OFFICE_REASON_MIN } from '@/config/property-handover-office-policy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface HandoverIrreversibleActionProps {
  /** Το πρόθεμα κλειδιών της πράξης, π.χ. `properties-detail:handover.withdrawal`. */
  readonly keys: string;
  /** Τα σημεία του «τι σημαίνει» — κλειδιά κάτω από `${keys}.means`. */
  readonly means: readonly string[];
  /** Η περιγραφή του διαλόγου — ήδη μεταφρασμένη (π.χ. η αιτία που μέτρησε η μηχανή). */
  readonly description: string;
  readonly icon: LucideIcon;
  readonly buttonVariant: 'destructive' | 'outline';
  /** Το `busyId` της καρτέλας και το κλειδί αυτής της πράξης — μία πράξη τη φορά σε όλη την καρτέλα. */
  readonly busyId: string | null;
  readonly busyKey: string;
  /** `true` ⇒ ολοκληρώθηκε (επιτυχία ή άρνηση) και ο διάλογος κλείνει· `false` ⇒ «δεν μπόρεσα», μένει ανοιχτός. */
  readonly onSubmit: (reason: string) => Promise<boolean>;
}

interface FieldsProps {
  readonly keys: string;
  readonly means: readonly string[];
  readonly reason: string;
  readonly onReason: (reason: string) => void;
  readonly confirmed: boolean;
  readonly onConfirmed: (confirmed: boolean) => void;
}

/** Τα πεδία του διαλόγου — τι σημαίνει η πράξη, η αιτιολογία, η επιβεβαίωση. */
function IrreversibleFields({ keys, means, reason, onReason, confirmed, onConfirmed }: FieldsProps): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const confirmId = React.useId();
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        {means.map((point) => <li key={point}>{t(`${keys}.means.${point}`)}</li>)}
      </ul>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{t(`${keys}.reasonLabel`, { min: HANDOVER_OFFICE_REASON_MIN })}</span>
        <Textarea rows={3} maxLength={HANDOVER_OFFICE_REASON_MAX} value={reason} onChange={(event) => onReason(event.target.value)} />
      </label>
      <p className="m-0 flex items-start gap-2 text-sm text-foreground">
        <Checkbox id={confirmId} checked={confirmed} onCheckedChange={(state) => onConfirmed(state === true)} />
        <label htmlFor={confirmId}>{t(`${keys}.confirmIrreversible`)}</label>
      </p>
    </fieldset>
  );
}

export function HandoverIrreversibleAction(props: HandoverIrreversibleActionProps): React.ReactElement {
  const { keys, means, description, icon: Icon, buttonVariant, busyId, busyKey, onSubmit } = props;
  const { t } = useTranslation(['properties-detail']);
  const iconSizes = useIconSizes();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const busy = busyId === busyKey;
  const ready = reason.trim().length >= HANDOVER_OFFICE_REASON_MIN && confirmed;
  const onConfirm = async () => {
    if (await onSubmit(reason)) setOpen(false);
  };
  return (
    <>
      <Button type="button" size="sm" variant={buttonVariant} className="w-fit gap-1.5" disabled={busyId !== null}
        aria-busy={busy} onClick={() => setOpen(true)}>
        <Icon className={iconSizes.sm} aria-hidden="true" />
        {t(`${keys}.action`)}
      </Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} title={t(`${keys}.title`)} description={description}
        confirmText={t(`${keys}.confirmAction`)} variant="destructive" loading={busy} disabled={!ready} keepOpenWhilePending
        onConfirm={onConfirm}>
        <IrreversibleFields keys={keys} means={means} reason={reason} onReason={setReason} confirmed={confirmed} onConfirmed={setConfirmed} />
      </ConfirmDialog>
    </>
  );
}
