import React from 'react';
import { Check, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useActionMessages } from '@/hooks/useEnterpriseMessages';
import { useActionTranslations } from '@/components/ui/form/action-button-config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useContactEditFocus } from './ContactEditFocusContext';

interface ContactDetailsMobileActionsProps {
  isEditing: boolean;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  /** ADR-317: Hide Edit/Save on subcollection tabs — focus context owns lifecycle */
  hideEditControls?: boolean;
  /** ADR-332 D27 Ζ5 — τρέχει αποθήκευση: το κουμπί κλειδώνει και δηλώνει `aria-busy`. */
  isSaving?: boolean;
}

export function ContactDetailsMobileActions({
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  hideEditControls = false,
  isSaving = false,
}: ContactDetailsMobileActionsProps) {
  const actionMessages = useActionMessages();
  const actions = useActionTranslations();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const { focus } = useContactEditFocus();

  // ADR-317: Adaptive actions — inline sub-form focus takes priority over global edit mode.
  if (focus) {
    return (
      <section className="md:hidden">
        <div className={`${layout.flexGap2} justify-end mb-4`}>
          <Button
            onClick={() => { void focus.submit(); }}
            className={layout.flexCenterGap2}
            variant="default"
            disabled={focus.loading}
          >
            <Check className={iconSizes.sm} />
            {actionMessages.save}
          </Button>
          <Button
            onClick={() => focus.cancel()}
            className={layout.flexCenterGap2}
            variant="outline"
            disabled={focus.loading}
          >
            <X className={iconSizes.sm} />
            {actionMessages.cancel}
          </Button>
        </div>
      </section>
    );
  }

  if (hideEditControls) {
    return null;
  }

  return (
    <section className="md:hidden">
      {!isEditing ? (
        <div className="flex justify-end mb-4">
          <Button onClick={onStartEdit} className={layout.flexCenterGap2} variant="outline">
            <Edit className={iconSizes.sm} />
            {actionMessages.edit}
          </Button>
        </div>
      ) : (
        <div className={`${layout.flexGap2} justify-end mb-4`}>
          {/*
            ADR-332 D27 Ζ5 — **το δεύτερο, ξεχωριστό κουμπί Αποθήκευσης.** Η κεφαλίδα του υπολογιστή
            κρύβεται στο κινητό (`hidden md:block`), οπότε αυτός ο κλάδος είναι **ο μόνος** δρόμος
            αποθήκευσης σε μικρή οθόνη — και ήταν εντελώς αφύλαχτος: κανένα `disabled`, καμία ένδειξη.
            Ο διπλανός κλάδος (inline φόρμα) το έκανε ήδη σωστά με `focus.loading`.
          */}
          <Button
            onClick={onSaveEdit}
            className={layout.flexCenterGap2}
            variant="default"
            disabled={isSaving}
            aria-busy={isSaving}
          >
            {isSaving ? <Spinner size="small" color="inherit" /> : <Check className={iconSizes.sm} />}
            {isSaving ? actions.save_loading : actionMessages.save}
          </Button>
          <Button
            onClick={onCancelEdit}
            className={layout.flexCenterGap2}
            variant="outline"
            disabled={isSaving}
          >
            <X className={iconSizes.sm} />
            {actionMessages.cancel}
          </Button>
        </div>
      )}
    </section>
  );
}
