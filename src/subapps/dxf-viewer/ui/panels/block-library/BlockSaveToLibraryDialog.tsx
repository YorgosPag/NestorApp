'use client';

/**
 * ADR-652 M2 — «Αποθήκευση στη βιβλιοθήκη»: φόρμα προέλευσης + άδειας.
 *
 * Εμφανίζεται ΤΗ ΣΤΙΓΜΗ που ο χρήστης αποφασίζει να κρατήσει μόνιμα ένα block που ήρθε από
 * ξένο DXF (Revit «Save Family» / AutoCAD `WBLOCK` semantics — ρητή ενέργεια, όχι αυτόματο
 * upload). Εκεί ακριβώς μπαίνει και η **νομική ερώτηση**: τι άδεια έχει αυτό το σχέδιο;
 *
 * Ασφαλή defaults (ADR-652 §Νομική ασφάλεια): άδεια `unknown`, `redistributable: false` →
 * το block μένει στην ΙΔΙΩΤΙΚΗ βιβλιοθήκη του χρήστη.
 *
 * Το ΣΩΜΑ της φόρμας (όνομα/κατηγορία/άδεια) ζει στο κοινό {@link BlockMetadataFormFields} —
 * το ίδιο σώμα με τη φόρμα «Επεξεργασία» (M4). Εδώ μένει μόνο ό,τι διαφέρει: τίτλος,
 * ετικέτες και η ενέργεια αποθήκευσης (N.18 — το `jscpd` πιάνει τα δίδυμα JSX σώματα).
 *
 * Radix Dialog + Radix Select (ADR-001). Mirror του `MaterialEditorDialog`.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { DEFAULT_USER_IMPORT_LICENSE } from '../../../bim/block-library/block-library-types';
import { BlockDialogFooter } from './BlockDialogFooter';
import {
  BlockMetadataFormFields,
  initialBlockMetadataForm,
  toBlockMetadataValues,
  type BlockMetadataFormState,
} from './BlockMetadataFields';
import type { BlockSaveFormValues } from './hooks/useBlockLibraryPalette';

export interface BlockSaveToLibraryDialogProps {
  readonly open: boolean;
  /** Το όνομα του block που αποθηκεύεται (prefill). */
  readonly blockName: string;
  readonly saving: boolean;
  /**
   * Ανήκει ήδη το όνομα σε ΑΛΛΗ κάρτα; Ο χρήστης μπορεί να το αλλάξει εδώ — και ένα όνομα που
   * «πατάει» υπάρχον block θα οδηγούσε σε τοποθέτηση λάθος γεωμετρίας (το όνομα είναι το κλειδί
   * ταυτότητας του ορισμού). Ο κανόνας: `isBlockNameTaken` (pure SSoT).
   */
  readonly isNameTaken: (name: string) => boolean;
  readonly onSave: (values: BlockSaveFormValues) => void;
  readonly onCancel: () => void;
}

function initialState(blockName: string): BlockMetadataFormState {
  return initialBlockMetadataForm(blockName, 'furniture', DEFAULT_USER_IMPORT_LICENSE);
}

export const BlockSaveToLibraryDialog: React.FC<BlockSaveToLibraryDialogProps> = ({
  open,
  blockName,
  saving,
  isNameTaken,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [form, setForm] = useState<BlockMetadataFormState>(() => initialState(blockName));

  useEffect(() => {
    if (open) setForm(initialState(blockName));
  }, [open, blockName]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onCancel();
    },
    [onCancel],
  );

  const handleSubmit = useCallback(() => {
    onSave(toBlockMetadataValues(form));
  }, [form, onSave]);

  const nameTaken = isNameTaken(form.name);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {t('blockLibrary.save.title')}
          </DialogTitle>
        </DialogHeader>

        <fieldset disabled={saving} className="m-0 flex flex-col gap-3 border-0 p-0">
          <BlockMetadataFormFields value={form} onChange={setForm} nameTaken={nameTaken} />
        </fieldset>

        <BlockDialogFooter
          confirmLabel={t('blockLibrary.save.confirm')}
          busyLabel={t('blockLibrary.save.saving')}
          busy={saving}
          canConfirm={form.name.trim().length > 0 && !nameTaken}
          onConfirm={handleSubmit}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
};
