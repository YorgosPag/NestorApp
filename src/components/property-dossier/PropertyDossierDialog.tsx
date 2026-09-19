'use client';

/**
 * @fileoverview **Ο διάλογος του φακέλου** — «Νέος φάκελος» **και** «Μετονομασία», ένα συστατικό.
 * @related ADR-866 Φ1.2 · §2.9.1 Α5 · §2.9.8 Δ1 · lib/property-dossier/property-dossier-form.ts
 * @module components/property-dossier/PropertyDossierDialog
 *
 * 🔑 **Ένας διάλογος, δύο πράξεις** (Drive: «New folder» και «Rename» είναι ο **ίδιος** διάλογος ενός πεδίου): τα
 * πεδία, ο κριτής (`validatePropertyDossierForm` → `propertyDossierInvariantViolations`, η **ίδια** συνάρτηση με
 * την πόρτα) και τα μηνύματα είναι κοινά· αλλάζουν μόνο ο τίτλος και η κλήση προς τον διακομιστή.
 *
 * 🔑 **Η ταυτότητα γεννιέται ΜΙΑ φορά ανά άνοιγμα** (Ε-Φ1.1-4): το σώμα του διαλόγου ξαναστήνεται σε κάθε άνοιγμα,
 * οπότε διπλό κλικ ή επανάληψη δικτύου στέλνουν την **ίδια** `pdos_*` και η πόρτα απαντά τον **υπάρχοντα** φάκελο.
 *
 * ⚠️ **Είδος με `ClearableSelect`** (ADR-001 SSoT για προαιρετικό enum) και **πλήρες** `PROPERTY_TYPES` — **όχι**
 * `CREATABLE_PROPERTY_TYPES`: εκείνο εξαιρεί τη γη, ενώ ο φάκελος οικοπέδου είναι πρώτης τάξης (§2.7.1).
 */

import React from 'react';
import '@/lib/design-system';
import { Controller, useForm, type Control } from 'react-hook-form';

import { FormInputField } from '@/components/shared/forms/form-field-primitives';
import { ClearableSelect } from '@/components/ui/clearable-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectItem } from '@/components/ui/select';
import { PROPERTY_TYPES, PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  EMPTY_PROPERTY_DOSSIER_FORM,
  propertyDossierFormFrom,
  validatePropertyDossierForm,
  type PropertyDossierFormValues,
} from '@/lib/property-dossier/property-dossier-form';
import { cn } from '@/lib/utils';
import {
  createPropertyDossierRequest,
  newPropertyDossierId,
  updatePropertyDossierDetails,
  type PropertyDossierRequestResult,
} from '@/services/property-dossier/property-dossier.service';
import {
  PROPERTY_DOSSIER_LABEL_MAX,
  type PropertyDossier,
  type PropertyDossierDraft,
  type PropertyDossierInvariant,
} from '@/types/property-dossier';

const NS = 'property-market';
const K = `${NS}:dossier.dialog`;

/** Γέννηση **ή** μετονομασία συγκεκριμένου φακέλου — κλειστό σύνολο. */
export type PropertyDossierDialogMode =
  | { readonly kind: 'create' }
  | { readonly kind: 'rename'; readonly dossier: PropertyDossier };

interface PropertyDossierDialogProps {
  readonly mode: PropertyDossierDialogMode | null;
  readonly onClose: () => void;
  /** Μετά την αποθήκευση — π.χ. η λίστα ανοίγει τον νέο φάκελο. */
  readonly onSaved?: (dossier: PropertyDossier) => void;
}

type SubmitState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'rejected'; readonly violations: readonly PropertyDossierInvariant[] }
  | { readonly kind: 'failed' };

/** Η **μία** κλήση προς τον διακομιστή ανά πράξη — η ταυτότητα γέννησης είναι σταθερή για όλο το άνοιγμα. */
function submitDraft(
  mode: PropertyDossierDialogMode,
  birthId: string,
  draft: PropertyDossierDraft,
): Promise<PropertyDossierRequestResult> {
  return mode.kind === 'create'
    ? createPropertyDossierRequest(birthId, draft)
    : updatePropertyDossierDetails(mode.dossier.id, draft);
}

/**
 * Το λάθος του **ονόματος** — όλοι οι κανόνες του φακέλου κρίνουν σήμερα **ένα** πεδίο (`PROPERTY_DOSSIER_INVARIANTS`),
 * άρα το μήνυμα ζει **δίπλα** του (ADR-866 §2.10 Π1), όχι σε λίστα κάτω από το «Είδος».
 */
function useLabelError(violations: readonly PropertyDossierInvariant[]): string | undefined {
  const { t } = useTranslation([NS]);
  const [first] = violations;
  return first === undefined ? undefined : t(`${NS}:dossier.invariant.${first}`, { max: PROPERTY_DOSSIER_LABEL_MAX });
}

/** Το πεδίο είδους — προαιρετικό, με «Χωρίς είδος» (SSoT `ClearableSelect`, ποτέ `<SelectItem value="">`). */
function DossierTypeField({ control }: { readonly control: Control<PropertyDossierFormValues> }) {
  const { t } = useTranslation([NS, 'properties-enums']);
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-foreground">{t(`${K}.typeLabel`)}</label>
      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <ClearableSelect
            id={id}
            value={field.value}
            onValueChange={field.onChange}
            placeholder={t(`${K}.typePlaceholder`)}
            clearLabel={t(`${K}.typeClear`)}
            size="lg"
          >
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[type]}`)}
              </SelectItem>
            ))}
          </ClearableSelect>
        )}
      />
    </div>
  );
}

type BodyProps = PropertyDossierDialogProps & { readonly mode: PropertyDossierDialogMode };

/**
 * **Η υποβολή** — κρίση με τον **ίδιο** κριτή της πόρτας, μία κλήση, ρητές καταστάσεις.
 *
 * ⚠️ Οι παραβιάσεις δείχνονται **μόλις** ο άνθρωπος **περάσει** από το πεδίο (blur/αλλαγή) ή πατήσει υποβολή — όχι
 * σε άδεια φόρμα που μόλις άνοιξε (δεν επιπλήττουμε πριν προλάβει να πληκτρολογήσει). ⚠️ **ΔΙΟΡΘΩΣΗ 2026-09-19
 * (ADR-866 §2.10 Π1)**: το «αγγίχτηκε» κρινόταν από την **τιμή** (`label !== ''`) ⇒ «γράφω και σβήνω» έκρυβε ξανά
 * το λάθος. Τώρα το λέει η φόρμα (`touched`/`dirty` του react-hook-form). Απόρριψη ⇒ **εστίαση** στο πεδίο (WCAG 3.3.1).
 * Η πόρτα (422) έχει **προτεραιότητα**: αν ο διακομιστής αρνηθεί με κωδικό, δείχνεται **αυτός**.
 */
function useDossierSubmit(
  { mode, onClose, onSaved }: BodyProps,
  values: PropertyDossierFormValues,
  interacted: boolean,
  focusLabel: () => void,
) {
  const [birthId] = React.useState(newPropertyDossierId);
  const [submit, setSubmit] = React.useState<SubmitState>({ kind: 'idle' });
  const validation = validatePropertyDossierForm(values);
  const touched = interacted || submit.kind !== 'idle';
  const local = touched && validation.kind === 'incomplete' ? validation.violations : [];

  const reject = (violations: readonly PropertyDossierInvariant[]): void => {
    setSubmit({ kind: 'rejected', violations });
    focusLabel();
  };

  const send = async (): Promise<void> => {
    if (validation.kind !== 'ready') {
      reject(validation.violations);
      return;
    }
    setSubmit({ kind: 'saving' });
    const result = await submitDraft(mode, birthId, validation.draft);
    if (result.kind === 'saved') {
      onSaved?.(result.dossier);
      onClose();
      return;
    }
    if (result.kind === 'invalid') reject(result.violations);
    else setSubmit({ kind: 'failed' });
  };

  const shown = submit.kind === 'rejected' ? submit.violations : local;
  return { submit, shown, send };
}

/** Το σώμα — ξαναστήνεται σε **κάθε** άνοιγμα, ώστε η ταυτότητα γέννησης και οι τιμές να ξεκινούν καθαρές. */
function DossierDialogBody(props: BodyProps) {
  const { mode, onClose } = props;
  const { t } = useTranslation([NS]);
  const { control, handleSubmit, watch, setFocus, formState } = useForm<PropertyDossierFormValues>({
    defaultValues: mode.kind === 'rename' ? propertyDossierFormFrom(mode.dossier) : EMPTY_PROPERTY_DOSSIER_FORM,
  });
  const interacted = formState.touchedFields.label === true || formState.dirtyFields.label === true;
  const { submit, shown, send } = useDossierSubmit(props, watch(), interacted, () => setFocus('label'));
  const labelError = useLabelError(shown);
  const onSubmit = handleSubmit(send);

  const saving = submit.kind === 'saving';
  const isCreate = mode.kind === 'create';

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t(isCreate ? `${K}.createTitle` : `${K}.renameTitle`)}</DialogTitle>
        <DialogDescription>{t(isCreate ? `${K}.createDescription` : `${K}.renameDescription`)}</DialogDescription>
      </DialogHeader>

      <FormInputField<PropertyDossierFormValues>
        control={control}
        name="label"
        kind="text"
        label={t(`${K}.labelLabel`)}
        placeholder={t(`${K}.labelPlaceholder`)}
        error={labelError}
      />
      <DossierTypeField control={control} />
      {submit.kind === 'failed' && <p aria-live="polite" className="m-0 text-sm text-foreground">{t(`${K}.failed`)}</p>}

      <DossierDialogFooter saving={saving} isCreate={isCreate} onClose={onClose} />
    </form>
  );
}

/** Ακύρωση · υποβολή — η υποβολή κλειδώνει όσο η αίτηση είναι σε πτήση (όχι διπλή γέννηση). */
function DossierDialogFooter({ saving, isCreate, onClose }: { readonly saving: boolean; readonly isCreate: boolean; readonly onClose: () => void }) {
  const { t } = useTranslation([NS]);
  return (
    <DialogFooter>
      <button type="button" onClick={onClose} className={cn('rounded-md px-4 py-2 font-medium', COLOR_BRIDGE.action.secondary)}>
        {t(`${K}.cancel`)}
      </button>
      <button type="submit" disabled={saving} className={cn('rounded-md px-4 py-2 font-medium disabled:opacity-50', COLOR_BRIDGE.action.primary)}>
        {saving ? t(`${K}.saving`) : t(isCreate ? `${K}.create` : `${K}.save`)}
      </button>
    </DialogFooter>
  );
}

export function PropertyDossierDialog({ mode, onClose, onSaved }: PropertyDossierDialogProps) {
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        {mode !== null && <DossierDialogBody mode={mode} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}
