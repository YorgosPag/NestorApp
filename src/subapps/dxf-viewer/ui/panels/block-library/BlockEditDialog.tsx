'use client';

/**
 * ADR-652 M4 — «Επεξεργασία» metadata σωσμένου block.
 *
 * Πρακτική μεγάλων παικτών: Revit «Family Properties» / ArchiCAD «Object Settings» — το
 * metadata ενός αντικειμένου βιβλιοθήκης διορθώνεται **επί τόπου**, χωρίς να ξαναχτιστεί το
 * αρχείο του. Εδώ: ίδιο doc, ίδιο geometry blob, ίδιο id — αλλάζουν ΜΟΝΟ όνομα / κατηγορία /
 * άδεια. Η **ορατότητα** (scope) ΔΕΝ αλλάζει από εδώ: είναι ξεχωριστή, ρητή ενέργεια
 * («Δημοσίευση») που περνά από το νομικό gate — δεν γίνεται πλαγίως μέσα από μια μετονομασία.
 *
 * Καμία νέα φόρμα: το σώμα είναι το ΙΔΙΟ {@link BlockMetadataFormFields} με την «Αποθήκευση»
 * (N.18). Εδώ ζει μόνο ό,τι διαφέρει: prefill από το αποθηκευμένο αντικείμενο + ο έλεγχος
 * «ήδη δημοσιευμένο».
 *
 * ⚠️ Αν το block είναι ΗΔΗ κοινόχρηστο, ο service απορρίπτει «υποβάθμιση» της άδειας σε
 * μη-αναδιανεμήσιμη (ο ΙΔΙΟΣ guard με το promote — αλλιώς η επεξεργασία θα ήταν πίσω πόρτα
 * του νομικού gate). Το UI το λέει εδώ, πριν καν σταλεί το αίτημα.
 *
 * @see ../../../bim/services/BlockLibraryService.ts — `updateBlock` (πάνω στον υπάρχοντα `patch`)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { canPromoteToSharedScope } from '../../../bim/block-library/block-scope-guard';
import {
  DEFAULT_USER_IMPORT_LICENSE,
  type BlockLibraryItem,
} from '../../../bim/block-library/block-library-types';
import { BlockDialogFooter } from './BlockDialogFooter';
import {
  BlockMetadataFormFields,
  initialBlockMetadataForm,
  toBlockMetadataValues,
  type BlockMetadataFormState,
} from './BlockMetadataFields';
import type { BlockEditFormValues } from './hooks/useBlockLibraryPalette';

export interface BlockEditDialogProps {
  readonly open: boolean;
  /** Το αντικείμενο που επεξεργαζόμαστε (prefill) — `null` όσο ο διάλογος είναι κλειστός. */
  readonly item: BlockLibraryItem | null;
  readonly saving: boolean;
  readonly isNameTaken: (name: string) => boolean;
  readonly onSubmit: (values: BlockEditFormValues) => void;
  readonly onCancel: () => void;
}

function initialState(item: BlockLibraryItem | null): BlockMetadataFormState {
  return initialBlockMetadataForm(
    item?.name ?? '',
    item?.category ?? 'furniture',
    item?.license ?? DEFAULT_USER_IMPORT_LICENSE,
  );
}

export const BlockEditDialog: React.FC<BlockEditDialogProps> = ({
  open,
  item,
  saving,
  isNameTaken,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [form, setForm] = useState<BlockMetadataFormState>(() => initialState(item));

  useEffect(() => {
    if (open) setForm(initialState(item));
  }, [open, item]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onCancel();
    },
    [onCancel],
  );

  const handleSubmit = useCallback(() => {
    onSubmit(toBlockMetadataValues(form));
  }, [form, onSubmit]);

  const nameTaken = isNameTaken(form.name);
  // Ήδη κοινόχρηστο (δημοσιευμένο) ⇒ η άδεια ΠΡΕΠΕΙ να παραμείνει αναδιανεμήσιμη — ο ΙΔΙΟΣ
  // κανόνας που φυλά ο service (`assertBlockScopeAllowed` πάνω στο ΤΡΕΧΟΝ scope).
  const isShared = item !== null && item.scope !== 'user';
  const licenseBlocked = isShared && !canPromoteToSharedScope(toBlockMetadataValues(form).license);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {t('blockLibrary.edit.title')}
          </DialogTitle>
        </DialogHeader>

        <fieldset disabled={saving} className="m-0 flex flex-col gap-3 border-0 p-0">
          <p className="text-xs text-muted-foreground">{t('blockLibrary.edit.description')}</p>

          <BlockMetadataFormFields value={form} onChange={setForm} nameTaken={nameTaken} />

          {licenseBlocked && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span>{t('blockLibrary.edit.sharedLicenseLocked')}</span>
            </p>
          )}
        </fieldset>

        <BlockDialogFooter
          confirmLabel={t('blockLibrary.edit.confirm')}
          busyLabel={t('blockLibrary.edit.saving')}
          busy={saving}
          canConfirm={form.name.trim().length > 0 && !nameTaken && !licenseBlocked}
          onConfirm={handleSubmit}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
};
