'use client';

/**
 * ADR-652 M3 — «Δημοσίευση στη βιβλιοθήκη της εταιρείας/του έργου».
 *
 * Πρακτική μεγάλων παικτών: ArchiCAD «publish to office library», Figma «publish to team
 * library» — ρητή ενέργεια πάνω σε ΥΠΑΡΧΟΝ αντικείμενο (όχι αντίγραφο), με ρητή στιγμή
 * απόφασης. Αυτό που ΠΡΟΣΘΕΤΟΥΜΕ εμείς (και δεν έχουν εκείνοι) είναι το **νομικό gate**:
 * το περιεχόμενο που ήρθε από ξένο DXF δεν φεύγει από την ιδιωτική βιβλιοθήκη χωρίς ρητό
 * δικαίωμα αναδιανομής.
 *
 * ΓΙ' ΑΥΤΟ το κουμπί ΔΕΝ κρύβεται όταν λείπει το δικαίωμα: ο χρήστης πρέπει να ΔΕΙ τον λόγο
 * («δεν έχεις δηλώσει δικαίωμα αναδιανομής») και να μπορεί να ΔΙΟΡΘΩΣΕΙ την άδεια εδώ, στην
 * ίδια κίνηση. Ο έλεγχος που φράζει το κουμπί είναι ο ΙΔΙΟΣ που φυλά τον service
 * (`canPromoteToSharedScope` / `assertBlockScopeAllowed`) — καμία δεύτερη κρίση.
 *
 * @see ../../../bim/block-library/block-scope-guard.ts — το gate (SSoT)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
import { BlockDialogFooter } from './BlockDialogFooter';
import { canPromoteToSharedScope } from '../../../bim/block-library/block-scope-guard';
import { DEFAULT_USER_IMPORT_LICENSE } from '../../../bim/block-library/block-library-types';
import type { BlockLicense } from '../../../bim/block-library/block-library-types';
import {
  BlockLicenseFields,
  toBlockLicense,
  toBlockLicenseForm,
  type BlockLicenseFormState,
} from './BlockLicenseFields';
import type { BlockPromoteFormValues } from './hooks/useBlockLibraryPalette';

/** Τα scopes που μπορεί να επιλέξει ο χρήστης· `'project'` μόνο όταν υπάρχει ενεργό έργο. */
type PromoteScope = BlockPromoteFormValues['scope'];

export interface BlockPromoteDialogProps {
  readonly open: boolean;
  readonly blockName: string;
  /** Η ΑΠΟΘΗΚΕΥΜΕΝΗ άδεια του block (prefill — ο χρήστης μπορεί να τη διορθώσει). */
  readonly license: BlockLicense | null;
  readonly hasProject: boolean;
  readonly saving: boolean;
  readonly onPromote: (values: BlockPromoteFormValues) => void;
  readonly onCancel: () => void;
}

export const BlockPromoteDialog: React.FC<BlockPromoteDialogProps> = ({
  open,
  blockName,
  license,
  hasProject,
  saving,
  onPromote,
  onCancel,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [scope, setScope] = useState<PromoteScope>('company');
  const [licenseForm, setLicenseForm] = useState<BlockLicenseFormState>(() =>
    toBlockLicenseForm(license ?? DEFAULT_USER_IMPORT_LICENSE),
  );

  useEffect(() => {
    if (!open) return;
    setScope('company');
    setLicenseForm(toBlockLicenseForm(license ?? DEFAULT_USER_IMPORT_LICENSE));
  }, [open, license]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onCancel();
    },
    [onCancel],
  );

  const nextLicense = toBlockLicense(licenseForm);
  // Ο ΙΔΙΟΣ κανόνας με τον service — απλώς εδώ απαντά «ναι/όχι» αντί να πετάει.
  const allowed = canPromoteToSharedScope(nextLicense);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {t('blockLibrary.promote.title', { name: blockName })}
          </DialogTitle>
        </DialogHeader>

        <fieldset disabled={saving} className="m-0 flex flex-col gap-3 border-0 p-0">
          <p className="text-xs text-muted-foreground">{t('blockLibrary.promote.description')}</p>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('blockLibrary.promote.target')}
            </span>
            <Select value={scope} onValueChange={(v) => setScope(v as PromoteScope)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">{t('blockLibrary.scopes.company')}</SelectItem>
                {hasProject && (
                  <SelectItem value="project">{t('blockLibrary.scopes.project')}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </label>

          <BlockLicenseFields value={licenseForm} onChange={setLicenseForm} />

          {!allowed && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span>{t('blockLibrary.promote.blockedReason')}</span>
            </p>
          )}
        </fieldset>

        <BlockDialogFooter
          confirmLabel={t('blockLibrary.promote.confirm')}
          busyLabel={t('blockLibrary.promote.publishing')}
          busy={saving}
          canConfirm={allowed}
          onConfirm={() => onPromote({ scope, license: nextLicense })}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
};
