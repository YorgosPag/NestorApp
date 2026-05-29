'use client';

/**
 * ADR-358 Phase 8 — Stair Persistence section (G24 soft-lock surfacing,
 * hybrid auto-save + explicit save UI).
 *
 * Renders three pieces of state:
 *   1. Explicit "Αποθήκευση" button (DD-1 hybrid trigger) — calls `saveNow`.
 *      Disabled while saving or when nothing to save.
 *   2. Save status indicator (idle / saving / saved HH:mm / error) — coherent
 *      with Google Docs "Saved at HH:mm" UX convention.
 *   3. Soft-lock badge (G24) when the stair has `editingBy.userId !== self` —
 *      display-only, never blocks the user.
 */

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../bim/types/stair-types';
import type {
  StairSaveState,
  UseStairPersistenceResult,
} from '../../../bim/hooks/use-stair-persistence';

export interface StairPersistenceSectionProps {
  readonly stair: StairEntity;
  readonly currentUserId: string | null;
  readonly persistence: UseStairPersistenceResult;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function statusKey(state: StairSaveState): string {
  switch (state) {
    case 'saving':
      return 'stairAdvancedPanel.sections.persistence.saving';
    case 'saved':
      return 'stairAdvancedPanel.sections.persistence.savedAt';
    case 'error':
      return 'stairAdvancedPanel.sections.persistence.error';
    case 'idle':
    default:
      return 'stairAdvancedPanel.sections.persistence.idle';
  }
}

export function StairPersistenceSection({
  stair,
  currentUserId,
  persistence,
}: StairPersistenceSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { saveState, lastSavedAt, error, saveNow } = persistence;

  const lockedByOther = useMemo(() => {
    const lock = stair.editingBy;
    if (!lock) return false;
    return !!currentUserId && lock.userId !== currentUserId;
  }, [stair.editingBy, currentUserId]);

  const statusText = useMemo(() => {
    if (saveState === 'saved' && lastSavedAt) {
      return t('stairAdvancedPanel.sections.persistence.savedAt', {
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
      aria-label={t('stairAdvancedPanel.sections.persistence.title')}
      className="flex flex-col gap-2"
    >
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('stairAdvancedPanel.sections.persistence.title')}
        </h4>
        <button
          type="button"
          onClick={() => void saveNow()}
          disabled={saveState === 'saving'}
          className="rounded border border-[hsl(var(--text-success))] bg-[hsl(var(--status-success))] px-2 py-1 text-xs text-white hover:bg-[hsl(var(--status-success))]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('stairAdvancedPanel.sections.persistence.saveButton')}
        </button>
      </header>

      <p
        role="status"
        aria-live="polite"
        className={
          saveState === 'error'
            ? 'text-xs text-destructive'
            : saveState === 'saving'
              ? 'text-xs text-[hsl(var(--text-warning))]'
              : 'text-xs text-muted-foreground'
        }
      >
        {statusText}
      </p>

      {lockedByOther && (
        <p
          role="status"
          className="rounded border border-[hsl(var(--text-warning))]/40 bg-[hsl(var(--bg-warning))]/30 px-2 py-1 text-xs text-foreground"
        >
          {t('stairAdvancedPanel.sections.persistence.editingByOther')}
        </p>
      )}
    </section>
  );
}
