'use client';

/**
 * ADR-652 M6 — «Δημιουργία Block» από επιλογή (AutoCAD BLOCK/BMAKE + WBLOCK σε ΕΝΑ διάλογο).
 *
 * Εμφανίζεται όταν ο χρήστης, με ενεργή επιλογή, ζητά «Δημιουργία Block» (Home → Modify). Καταγράφει
 * ταυτότητα (όνομα/κατηγορία/άδεια) + την ΜΙΑ απόφαση που διαφοροποιεί το BLOCK από το WBLOCK:
 * **«αντικατάσταση με instance»** — ON (AutoCAD BLOCK) η επιλογή γίνεται instance στο σχέδιο· OFF
 * (WBLOCK) το σχέδιο μένει ανέπαφο. Και στις δύο, το block σώζεται στην ΙΔΙΩΤΙΚΗ βιβλιοθήκη.
 *
 * Το ΣΩΜΑ ταυτότητας ζει στο κοινό {@link BlockMetadataFormFields} — το ΙΔΙΟ με «Αποθήκευση»/
 * «Επεξεργασία» (N.18: κανένα δίδυμο JSX σώμα). Εδώ μένει μόνο ο τίτλος + ο toggle + η ενέργεια.
 *
 * Radix Dialog (ADR-001). Mirror του {@link BlockSaveToLibraryDialog}.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { Point2D } from '../../../rendering/types/Types';
import { DEFAULT_USER_IMPORT_LICENSE } from '../../../bim/block-library/block-library-types';
import { BlockDialogFooter } from './BlockDialogFooter';
import {
  BlockMetadataFormFields,
  initialBlockMetadataForm,
  toBlockMetadataValues,
  type BlockMetadataFormState,
  type BlockMetadataValues,
} from './BlockMetadataFields';

/** Ό,τι επιστρέφει ο διάλογος: ταυτότητα block + η απόφαση αντικατάστασης. */
export interface CreateBlockFormValues extends BlockMetadataValues {
  /** `true` (AutoCAD BLOCK) ⇒ η επιλογή αντικαθίσταται από instance· `false` (WBLOCK) ⇒ ανέπαφο. */
  readonly replaceWithInstance: boolean;
}

export interface CreateBlockDialogProps {
  readonly open: boolean;
  readonly saving: boolean;
  /** Ανήκει ήδη το όνομα σε άλλο block; (το όνομα είναι κλειδί ταυτότητας — βλ. `isBlockNameTaken`). */
  readonly isNameTaken: (name: string) => boolean;
  /** Επιλεγμένο σημείο βάσης (world)· `null` ⇒ αυτόματο AABB min-corner (ADR-652 M6). */
  readonly basePoint: Point2D | null;
  /** «Επιλογή σημείου βάσης»: κρύβει τον διάλογο & arm-άρει το one-click pick στον καμβά. */
  readonly onPickBasePoint: () => void;
  /** Επαναφορά στο αυτόματο base (AABB min-corner). */
  readonly onClearBasePoint: () => void;
  readonly onSubmit: (values: CreateBlockFormValues) => void;
  readonly onCancel: () => void;
}

function initialState(): BlockMetadataFormState {
  return initialBlockMetadataForm('', 'furniture', DEFAULT_USER_IMPORT_LICENSE);
}

export const CreateBlockDialog: React.FC<CreateBlockDialogProps> = ({
  open,
  saving,
  isNameTaken,
  basePoint,
  onPickBasePoint,
  onClearBasePoint,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [form, setForm] = useState<BlockMetadataFormState>(initialState);
  // AutoCAD BLOCK default: αντικατάσταση της επιλογής με instance.
  const [replaceWithInstance, setReplaceWithInstance] = useState(true);

  // Init ΜΙΑ φορά στο mount (gate-at-mount: ο host mount-άρει fresh inner ανά αίτημα). ΟΧΙ reset
  // στο `open` toggle — ο διάλογος κρύβεται/επανέρχεται όσο ο χρήστης διαλέγει σημείο βάσης στον
  // καμβά (ADR-652 M6), και η φόρμα (όνομα/κατηγορία) πρέπει να επιβιώνει αυτού του κύκλου.
  useEffect(() => {
    setForm(initialState());
    setReplaceWithInstance(true);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onCancel();
    },
    [onCancel],
  );

  const nameTaken = isNameTaken(form.name);

  const handleSubmit = useCallback(() => {
    onSubmit({ ...toBlockMetadataValues(form), replaceWithInstance });
  }, [form, replaceWithInstance, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {t('blockLibrary.create.title')}
          </DialogTitle>
        </DialogHeader>

        <fieldset disabled={saving} className="m-0 flex flex-col gap-3 border-0 p-0">
          <BlockMetadataFormFields value={form} onChange={setForm} nameTaken={nameTaken} />

          <section className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">
              {t('blockLibrary.create.basePointLabel')}
            </span>
            <div className="flex items-center gap-2">
              <output className="flex-1 text-[11px] tabular-nums text-muted-foreground">
                {basePoint
                  ? `${basePoint.x.toFixed(1)}, ${basePoint.y.toFixed(1)}`
                  : t('blockLibrary.create.basePointAuto')}
              </output>
              <Button type="button" variant="outline" size="sm" onClick={onPickBasePoint}>
                {t('blockLibrary.create.pickBasePoint')}
              </Button>
              {basePoint && (
                <Button type="button" variant="ghost" size="sm" onClick={onClearBasePoint}>
                  {t('blockLibrary.create.basePointClear')}
                </Button>
              )}
            </div>
          </section>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={replaceWithInstance}
              onChange={(e) => setReplaceWithInstance(e.target.checked)}
            />
            <span className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {t('blockLibrary.create.replaceWithInstance')}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t('blockLibrary.create.replaceHint')}
              </span>
            </span>
          </label>
        </fieldset>

        <BlockDialogFooter
          confirmLabel={t('blockLibrary.create.confirm')}
          busyLabel={t('blockLibrary.create.saving')}
          busy={saving}
          canConfirm={form.name.trim().length > 0 && !nameTaken}
          onConfirm={handleSubmit}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
};
