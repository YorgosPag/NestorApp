'use client';

/**
 * ADR-652 M2 — «Αποθήκευση στη βιβλιοθήκη»: φόρμα προέλευσης + άδειας.
 *
 * Εμφανίζεται ΤΗ ΣΤΙΓΜΗ που ο χρήστης αποφασίζει να κρατήσει μόνιμα ένα block που ήρθε από
 * ξένο DXF (Revit «Save Family» / AutoCAD `WBLOCK` semantics — ρητή ενέργεια, όχι αυτόματο
 * upload). Εκεί ακριβώς μπαίνει και η **νομική ερώτηση**: τι άδεια έχει αυτό το σχέδιο;
 *
 * Ασφαλή defaults (ADR-652 §Νομική ασφάλεια): άδεια `unknown`, `redistributable: false` →
 * το block μένει στην ΙΔΙΩΤΙΚΗ βιβλιοθήκη του χρήστη. M3: τα πεδία άδειας ζουν στο κοινό
 * {@link BlockLicenseFields} (τα μοιράζεται με τη φόρμα δημοσίευσης) και οι κατηγορίες
 * έρχονται από τον SSoT κατάλογο `BLOCK_CATEGORIES` — όχι δεύτερη χειρόγραφη λίστα.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import {
  BLOCK_CATEGORIES,
  DEFAULT_USER_IMPORT_LICENSE,
  type BlockCategory,
} from '../../../bim/block-library/block-library-types';
import { BlockDialogFooter } from './BlockDialogFooter';
import {
  BlockLicenseFields,
  toBlockLicense,
  toBlockLicenseForm,
  type BlockLicenseFormState,
} from './BlockLicenseFields';
import type { BlockSaveFormValues } from './hooks/useBlockLibraryPalette';

export interface BlockSaveToLibraryDialogProps {
  readonly open: boolean;
  /** Το όνομα του block που αποθηκεύεται (prefill). */
  readonly blockName: string;
  readonly saving: boolean;
  readonly onSave: (values: BlockSaveFormValues) => void;
  readonly onCancel: () => void;
}

interface FormState {
  readonly name: string;
  readonly category: BlockCategory;
  readonly license: BlockLicenseFormState;
}

function initialState(blockName: string): FormState {
  return {
    name: blockName,
    category: 'furniture',
    license: toBlockLicenseForm(DEFAULT_USER_IMPORT_LICENSE),
  };
}

export const BlockSaveToLibraryDialog: React.FC<BlockSaveToLibraryDialogProps> = ({
  open,
  blockName,
  saving,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [form, setForm] = useState<FormState>(() => initialState(blockName));

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
    onSave({
      name: form.name.trim(),
      category: form.category,
      license: toBlockLicense(form.license),
    });
  }, [form, onSave]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {t('blockLibrary.save.title')}
          </DialogTitle>
        </DialogHeader>

        <fieldset disabled={saving} className="m-0 flex flex-col gap-3 border-0 p-0">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('blockLibrary.save.name')}
            </span>
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('blockLibrary.save.category')}
            </span>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((prev) => ({ ...prev, category: v as BlockCategory }))}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`blockLibrary.categories.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <BlockLicenseFields
            value={form.license}
            onChange={(license) => setForm((prev) => ({ ...prev, license }))}
          />
        </fieldset>

        <BlockDialogFooter
          confirmLabel={t('blockLibrary.save.confirm')}
          busyLabel={t('blockLibrary.save.saving')}
          busy={saving}
          canConfirm={form.name.trim().length > 0}
          onConfirm={handleSubmit}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
};
