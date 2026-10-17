'use client';

/**
 * @fileoverview ADR-915 §26 — **«Ορισμός / Αλλαγή υπευθύνου»**: ποιος από τους ιδιοκτήτες φροντίζει τα έγγραφα του
 *   ακινήτου. Ο Procore αλλάζει το «Ball in Court» χειροκίνητα· εδώ το ίδιο, πάνω από την παραγόμενη προεπιλογή.
 * @related obligor-designation-context.ts (οι ενέργειες) · registry-obligors.ts (`RegistryObligorChoice`)
 * @module components/document-registry/RegistryObligorLeadPicker
 *
 * 🔑 **Radio, όχι Select** (δόγμα `BrokeredMandateFields`): επιλογή με συνέπεια — όλες ορατές, με το μερίδιό τους.
 * 🔑 «Αυτόματη επιλογή» = **σβήσιμο** της ρητής επιλογής: η αλυσίδα (μοναδικός · πλειοψηφία · κύριος πωλητής) ξαναμιλά.
 * 🔑 Αισιόδοξα: ο διάλογος κλείνει αμέσως, η γραμμή δείχνει την επιλογή και «Αποθηκεύεται…» ώσπου να απαντήσει ο
 *    διακομιστής (`useObligorDesignation`).
 * ⚠️ Μη διαθέσιμη επαφή (ξένη · διαγραμμένη) **δεν** διαλέγεται — ο διακομιστής θα την ονόμαζε «υπεύθυνο» χωρίς όνομα.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatPercentage } from '@/lib/intl-formatting';
import type { RegistryObligorChoice } from '@/components/document-registry/registry-obligors';
import { useObligorDesignationActions } from '@/components/document-registry/obligor-designation-context';
import { ISSUER_KEYS, LEAD_KEYS, LEAD_PICKER_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';

/** Η τιμή της «Αυτόματης επιλογής» — καμία επαφή δεν μοιάζει με αυτήν (`cont_*`). */
const AUTOMATIC = 'automatic';

interface PickerFormProps {
  readonly choice: RegistryObligorChoice;
  readonly onCancel: () => void;
  readonly onSave: (contactId: string | null) => void;
}

function PickerForm({ choice, onCancel, onSave }: PickerFormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const [selected, setSelected] = useState<string>(choice.explicitContactId ?? AUTOMATIC);
  const legendId = `obligor-lead-${choice.propertyId}`;
  const changed = selected !== (choice.explicitContactId ?? AUTOMATIC);
  return (
    <>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId}>
        <legend id={legendId} className="mb-2 text-sm font-medium text-foreground">{t(LEAD_PICKER_KEYS.legend)}</legend>
        <RadioGroup value={selected} onValueChange={setSelected}>
          <Label className="flex items-start gap-2 text-sm font-normal">
            <RadioGroupItem value={AUTOMATIC} />
            <span className="flex flex-col">
              <span>{t(LEAD_PICKER_KEYS.automatic)}</span>
              <span className="text-xs text-muted-foreground">{t(LEAD_PICKER_KEYS.automaticHint)}</span>
            </span>
          </Label>
          {choice.owners.map((owner) => {
            const share = choice.shares[owner.contactId];
            return (
              <Label key={owner.contactId} className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value={owner.contactId} disabled={!owner.reachable} />
                <span>{owner.reachable ? owner.name ?? t(ISSUER_KEYS.obligorUnnamed) : t(ISSUER_KEYS.obligorUnavailable)}</span>
                {share === undefined ? null : (
                  <span className="text-xs text-muted-foreground">{t(LEAD_PICKER_KEYS.share, { share: formatPercentage(share) })}</span>
                )}
              </Label>
            );
          })}
        </RadioGroup>
      </fieldset>
      <DialogActionFooter
        cancelLabel={t(LEAD_PICKER_KEYS.cancel)}
        confirmLabel={t(LEAD_PICKER_KEYS.save)}
        busyLabel={t(LEAD_PICKER_KEYS.saving)}
        onCancel={onCancel}
        onConfirm={() => onSave(selected === AUTOMATIC ? null : selected)}
        isSubmitting={false}
        canSubmit={changed}
      />
    </>
  );
}

export interface RegistryObligorLeadPickerProps {
  readonly choice: RegistryObligorChoice;
  /** Υπάρχει ήδη υπεύθυνος ⇒ «Αλλαγή», αλλιώς «Ορισμός». */
  readonly hasLead: boolean;
}

export function RegistryObligorLeadPicker({ choice, hasLead }: RegistryObligorLeadPickerProps): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useObligorDesignationActions();
  const [open, setOpen] = useState(false);
  if (actions === null || !actions.canDesignate) return null;
  if (actions.pending.has(choice.propertyId)) {
    return <span role="status" className="text-xs text-muted-foreground">{t(LEAD_KEYS.saving)}</span>;
  }
  const save = (contactId: string | null) => {
    setOpen(false);
    actions.designate(choice.propertyId, contactId);
  };
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setOpen(true)}>
        {t(hasLead ? LEAD_PICKER_KEYS.change : LEAD_PICKER_KEYS.set)}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(LEAD_PICKER_KEYS.title)}</DialogTitle>
            <DialogDescription>{t(LEAD_PICKER_KEYS.description)}</DialogDescription>
          </DialogHeader>
          {/* `key` ⇒ κάθε άνοιγμα ξεκινά από την τρέχουσα επιλογή, ποτέ από μια εγκαταλειμμένη. */}
          {open ? <PickerForm key={choice.explicitContactId ?? AUTOMATIC} choice={choice} onCancel={() => setOpen(false)} onSave={save} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
