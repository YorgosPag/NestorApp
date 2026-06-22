'use client';

/**
 * ADR-363/412 — «Αποθήκευση ως νέος τύπος» για το draft panel του τοίχου.
 *
 * Στο draft mode (εργαλείο τοίχου ενεργό, χωρίς επιλεγμένο τοίχο) δεν υπάρχει
 * entity να αποθηκευτεί· αντί για persistence, ο χρήστης σώζει την τρέχουσα
 * σύνθεση (πάχος/στρώσεις) ως **επαναχρησιμοποιήσιμο τύπο τοίχου** (Revit
 * «Duplicate type»). FULL SSoT: reuse `useWallFamilyTypeController.saveNewType`
 * (→ `BimFamilyTypeService.saveType` + optimistic catalog + audit) και του
 * κεντρικού `usePromptDialog` για το όνομα — μηδέν νέος μηχανισμός persistence.
 *
 * @see ../../ribbon/hooks/useWallFamilyTypeController.ts §saveNewType
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { WallEntity } from '../../../bim/types/wall-types';
import { useWallFamilyTypeController } from '../../ribbon/hooks/useWallFamilyTypeController';
import { usePromptDialog } from '../../../systems/prompt-dialog/usePromptDialog';

export interface WallDraftSaveTypeSectionProps {
  /** Ο εικονικός draft τοίχος (draw-defaults) του οποίου τη σύνθεση σώζουμε. */
  readonly wall: WallEntity;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function WallDraftSaveTypeSection({
  wall,
}: WallDraftSaveTypeSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { saveNewType, canWrite } = useWallFamilyTypeController();
  const { prompt } = usePromptDialog();
  const [status, setStatus] = useState<SaveStatus>('idle');

  const dna = wall.params.dna;
  // Χρειάζεται σύνθεση (dna) + auth ready ώστε ο τύπος να έχει στρώσεις.
  const canSave = canWrite && !!dna;

  const onSave = useCallback(async (): Promise<void> => {
    if (!dna) return;
    const name = await prompt({
      title: t('wallAdvancedPanel.sections.saveAsType.promptTitle'),
      label: t('wallAdvancedPanel.sections.saveAsType.promptLabel'),
    });
    if (!name || !name.trim()) return;
    setStatus('saving');
    try {
      const id = await saveNewType(
        { category: wall.params.category, thickness: wall.params.thickness, dna },
        name.trim(),
      );
      setStatus(id ? 'saved' : 'error');
    } catch {
      setStatus('error');
    }
  }, [dna, prompt, t, saveNewType, wall.params.category, wall.params.thickness]);

  const statusText =
    status === 'saved'
      ? t('wallAdvancedPanel.sections.saveAsType.saved')
      : status === 'error'
        ? t('wallAdvancedPanel.sections.saveAsType.error')
        : t('wallAdvancedPanel.sections.saveAsType.hint');

  return (
    <section
      aria-label={t('wallAdvancedPanel.sections.saveAsType.title')}
      className="flex flex-col gap-2"
    >
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('wallAdvancedPanel.sections.saveAsType.title')}
        </h4>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={!canSave || status === 'saving'}
          className="rounded border border-[hsl(var(--text-success))] bg-[hsl(var(--status-success))] px-2 py-1 text-xs text-white hover:bg-[hsl(var(--status-success))]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('wallAdvancedPanel.sections.saveAsType.button')}
        </button>
      </header>
      <p
        role="status"
        aria-live="polite"
        className={
          status === 'error'
            ? 'text-xs text-destructive'
            : 'text-xs text-muted-foreground'
        }
      >
        {statusText}
      </p>
    </section>
  );
}
