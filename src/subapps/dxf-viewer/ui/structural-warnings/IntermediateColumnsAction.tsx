'use client';

/**
 * ADR-504 Φ2 S6 — opt-in action «Πρόσθεσε ενδιάμεσες κολώνες».
 *
 * Εμφανίζεται **μόνο** όταν ο practical-span advisory (ADR-504 Φ1) έχει βγάλει
 * `beamSpanImpractical` για τη δοκό. Με **ρητή συγκατάθεση** (confirm dialog — ΠΟΤΕ
 * σιωπηλά, ADR-487 §8.4) εισάγει `K` ισαπέχουσες ενδιάμεσες κολώνες ως **ΕΝΑ atomic
 * undo** (`CompoundCommand[CreateColumnsCommand]`). Πέδιλα + re-size ακολουθούν
 * **αυτόματα** από τον proactive κύκλο — μηδέν νέος reactive trigger εδώ.
 *
 * Self-contained: `useLevels` + `useCommandHistory` (ίδια context plumbing με τον
 * `useBeamParamsDispatcher`). Η command σύνθεση ζει pure στο SSoT
 * `buildAddIntermediateColumnsCommand`. Modal markup = ίδιες `dxf-modal-*` κλάσεις
 * με τον `ColumnPerimeterConfirmDialog` (μηδέν inline style, N.3)· ESC = κεντρικό bus.
 *
 * @see ../../bim/columns/add-intermediate-columns-command.ts — pure command builder (S6)
 * @see ../dialogs/ColumnPerimeterConfirmDialog.tsx — confirm precedent
 */

import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BeamEntity } from '../../bim/types/beam-types';
import { useLevels } from '../../systems/levels';
import { useCommandHistory } from '../../core/commands';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { useEntityStructuralDiagnostics } from '../../bim/structural/organism/useEntityStructuralDiagnostics';
import { buildAddIntermediateColumnsCommand } from '../../bim/columns/add-intermediate-columns-command';

export interface IntermediateColumnsActionProps {
  readonly beam: BeamEntity;
}

type DialogT = ReturnType<typeof useTranslation>['t'];

interface ConfirmModalProps {
  readonly t: DialogT;
  readonly messageParams: Readonly<Record<string, string | number>>;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Confirm modal (portal) — μηνύει το γιατί (ύψος/άνοιγμα) + πόσες κολώνες/τι ύψος προκύπτει. */
function ConfirmModal({ t, messageParams, onConfirm, onCancel }: ConfirmModalProps): React.ReactElement | null {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('structuralOrganism.addIntermediateColumnsTitle')}</h2>
        <p className="dxf-modal-body">
          {t('structuralOrganism.addIntermediateColumnsMessage', messageParams)}
        </p>
        <div className="dxf-modal-actions">
          <button type="button" autoFocus className="dxf-modal-button dxf-modal-button-primary" onClick={onConfirm}>
            {t('structuralOrganism.addIntermediateColumnsConfirm')}
          </button>
          <button type="button" className="dxf-modal-button" onClick={onCancel}>
            {t('structuralOrganism.proactiveCancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function IntermediateColumnsAction({
  beam,
}: IntermediateColumnsActionProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const diagnostics = useEntityStructuralDiagnostics(beam.id);
  const levelManager = useLevels();
  const { execute } = useCommandHistory();
  const [open, setOpen] = useState(false);

  const impractical = diagnostics.find((d) => d.code === 'beamSpanImpractical');
  const count = Number(impractical?.messageParams?.columns ?? 0);

  const handleConfirm = useCallback((): void => {
    setOpen(false);
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const result = buildAddIntermediateColumnsCommand(beam, count, {
      getLevelScene: levelManager.getLevelScene,
      setLevelScene: levelManager.setLevelScene,
      levelId,
      sceneUnits: beam.params.sceneUnits ?? 'mm',
    });
    if (!result) return; // καμία στηρίζουσα κολώνα → graceful no-op (μηδέν σιωπηλό σφάλμα)
    execute(result.command);
    toast.success(t('structuralOrganism.addIntermediateColumnsDone', { count: result.columns.length }));
  }, [beam, count, levelManager, execute, t]);

  useEscapeHandler({
    id: 'add-intermediate-columns-confirm',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => open,
    handle: () => {
      setOpen(false);
      return true;
    },
  });

  if (!impractical || count <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded border border-[hsl(var(--text-warning))]/50 px-2 py-1 text-xs font-medium text-[hsl(var(--text-warning))] hover:bg-[hsl(var(--text-warning))]/10"
      >
        {t('structuralOrganism.addIntermediateColumnsAction')}
      </button>
      {open && impractical.messageParams && (
        <ConfirmModal
          t={t}
          messageParams={impractical.messageParams}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
