'use client';

/**
 * ADR-363 Phase 1D — Wall Persistence section (G24 soft-lock surfacing).
 *
 * Mirror `StairPersistenceSection` (ADR-358 Phase 8). Three pieces of state:
 *   1. Explicit "Αποθήκευση τώρα" button → `saveNow()`.
 *   2. Save status (idle / saving / saved HH:mm / error).
 *   3. Soft-lock badge when `editingBy.userId !== self`.
 */

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { WallEntity } from '../../../bim/types/wall-types';
import type {
  WallSaveState,
  UseWallPersistenceResult,
} from '../../../hooks/data/useWallPersistence';

export interface WallPersistenceSectionProps {
  readonly wall: WallEntity;
  readonly currentUserId: string | null;
  readonly persistence: UseWallPersistenceResult;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function statusKey(state: WallSaveState): string {
  switch (state) {
    case 'saving':
      return 'wallAdvancedPanel.sections.persistence.saving';
    case 'saved':
      return 'wallAdvancedPanel.sections.persistence.savedAt';
    case 'error':
      return 'wallAdvancedPanel.sections.persistence.error';
    case 'idle':
    default:
      return 'wallAdvancedPanel.sections.persistence.idle';
  }
}

export function WallPersistenceSection({
  wall,
  currentUserId,
  persistence,
}: WallPersistenceSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { saveState, lastSavedAt, error, saveNow } = persistence;

  const lockedByOther = useMemo(() => {
    const lock = wall.editingBy;
    if (!lock) return false;
    return !!currentUserId && lock.userId !== currentUserId;
  }, [wall.editingBy, currentUserId]);

  const statusText = useMemo(() => {
    if (saveState === 'saved' && lastSavedAt) {
      return t('wallAdvancedPanel.sections.persistence.savedAt', {
        time: formatTime(lastSavedAt),
      });
    }
    if (saveState === 'error' && error) {
      return `${t(statusKey(saveState))}: ${error}`;
    }
    return t(statusKey(saveState));
  }, [saveState, lastSavedAt, error, t]);

  return (
    <section
      aria-label={t('wallAdvancedPanel.sections.persistence.title')}
      className="flex flex-col gap-2"
    >
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t('wallAdvancedPanel.sections.persistence.title')}
        </h4>
        <button
          type="button"
          onClick={() => void saveNow()}
          disabled={saveState === 'saving'}
          className="rounded border border-slate-600 bg-emerald-700 px-2 py-1 text-xs text-slate-100 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('wallAdvancedPanel.sections.persistence.saveButton')}
        </button>
      </header>

      <p
        role="status"
        aria-live="polite"
        className={
          saveState === 'error'
            ? 'text-xs text-rose-400'
            : saveState === 'saving'
              ? 'text-xs text-amber-400'
              : 'text-xs text-slate-400'
        }
      >
        {statusText}
      </p>

      {lockedByOther && (
        <p
          role="status"
          className="rounded border border-amber-600/40 bg-amber-900/30 px-2 py-1 text-xs text-amber-200"
        >
          {t('wallAdvancedPanel.sections.persistence.editingByOther')}
        </p>
      )}
    </section>
  );
}
