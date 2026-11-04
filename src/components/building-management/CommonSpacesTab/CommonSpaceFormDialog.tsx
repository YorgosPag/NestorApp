'use client';

/**
 * Διάλογος δημιουργίας / επεξεργασίας κοινόχρηστου χώρου (ADR-931).
 * Η κατάσταση ζει στο `useCommonSpacesTabState`· εδώ μόνο αποδίδεται.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FloorSelect } from '@/components/shared/FloorSelectField';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { CommonSpaceDraft, CommonSpaceDraftError } from './common-space-draft';
import {
  CommonSpaceCategorySelect,
  CommonSpaceLegalNatureSelect,
  ExclusiveUsePropertyPicker,
  type ExclusiveUseOption,
} from './CommonSpaceFormFields';

const KEY = 'tab.form';

interface FieldsProps {
  readonly buildingId: string;
  readonly draft: CommonSpaceDraft;
  readonly saving: boolean;
  readonly propertyOptions: readonly ExclusiveUseOption[];
  readonly onChange: (patch: Partial<CommonSpaceDraft>) => void;
}

/** Τι είναι και πού βρίσκεται. */
function IdentityFields({ buildingId, draft, saving, onChange }: FieldsProps) {
  const { t } = useTranslation('common-spaces');
  const colors = useSemanticColors();
  return (
    <>
      <fieldset className="grid gap-1.5">
        <Label htmlFor="common-space-name">{t(`${KEY}.name`)}</Label>
        <Input id="common-space-name" value={draft.name} placeholder={t(`${KEY}.namePlaceholder`)} onChange={(e) => onChange({ name: e.target.value })} disabled={saving} autoFocus />
      </fieldset>
      <fieldset className="grid gap-1.5">
        <Label htmlFor="common-space-category">{t(`${KEY}.category`)}</Label>
        <CommonSpaceCategorySelect id="common-space-category" value={draft.category} onChange={(category) => onChange({ category })} disabled={saving} />
      </fieldset>
      <fieldset className="grid gap-1.5">
        <Label>{t(`${KEY}.floor`)}</Label>
        <FloorSelect buildingId={buildingId} value={draft.floorId} onChange={(selection) => onChange({ floorId: selection?.floorId ?? '' })} disabled={saving} />
        <p className={cn('text-xs', colors.text.muted)}>{t(`${KEY}.floorHint`)}</p>
      </fieldset>
      <section className="grid grid-cols-2 gap-4">
        <fieldset className="grid gap-1.5">
          <Label htmlFor="common-space-area">{t(`${KEY}.area`)}</Label>
          <Input id="common-space-area" inputMode="decimal" value={draft.area} onChange={(e) => onChange({ area: e.target.value })} disabled={saving} />
        </fieldset>
        <fieldset className="grid gap-1.5">
          <Label htmlFor="common-space-code">{t(`${KEY}.code`)}</Label>
          <Input id="common-space-code" value={draft.code} onChange={(e) => onChange({ code: e.target.value })} disabled={saving} />
        </fieldset>
      </section>
    </>
  );
}

/** Ποιος το χρησιμοποιεί (ΑΚ 1117) + σημειώσεις. */
function LegalFields({ draft, saving, propertyOptions, onChange }: FieldsProps) {
  const { t } = useTranslation('common-spaces');
  return (
    <>
      <fieldset className="grid gap-1.5">
        <Label htmlFor="common-space-legal">{t(`${KEY}.legalNature`)}</Label>
        <CommonSpaceLegalNatureSelect id="common-space-legal" value={draft.legalNature} onChange={(legalNature) => onChange({ legalNature })} disabled={saving} />
      </fieldset>
      {draft.legalNature === 'exclusive_use' && (
        <ExclusiveUsePropertyPicker options={propertyOptions} selected={draft.exclusiveUsePropertyIds} onChange={(ids) => onChange({ exclusiveUsePropertyIds: ids })} disabled={saving} />
      )}
      <fieldset className="grid gap-1.5">
        <Label htmlFor="common-space-notes">{t(`${KEY}.notes`)}</Label>
        <Textarea id="common-space-notes" value={draft.notes} onChange={(e) => onChange({ notes: e.target.value })} disabled={saving} rows={2} />
      </fieldset>
    </>
  );
}

export interface CommonSpaceFormDialogProps extends FieldsProps {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly error: CommonSpaceDraftError | null;
  readonly onSubmit: () => void;
  readonly onClose: () => void;
}

export function CommonSpaceFormDialog({ open, mode, error, onSubmit, onClose, ...fields }: CommonSpaceFormDialogProps) {
  const { t } = useTranslation('common-spaces');
  const colors = useSemanticColors();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !fields.saving) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(mode === 'create' ? `${KEY}.createTitle` : `${KEY}.editTitle`)}</DialogTitle>
          {error && <DialogDescription className={colors.text.error}>{t(`${KEY}.${error}`)}</DialogDescription>}
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
          <IdentityFields {...fields} />
          <LegalFields {...fields} />
        </form>
        <DialogActionFooter
          cancelLabel={t(`${KEY}.cancel`)}
          confirmLabel={t(`${KEY}.save`)}
          busyLabel={t(`${KEY}.saving`)}
          onCancel={onClose}
          onConfirm={onSubmit}
          isSubmitting={fields.saving}
        />
      </DialogContent>
    </Dialog>
  );
}
