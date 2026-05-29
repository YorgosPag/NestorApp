'use client';

/**
 * ADR-358 Phase 7.5 — Stair Library Presets section (G26, Q32).
 *
 * UI choices (decisi 2026-05-17):
 *  - Mount: floating `StairAdvancedPanel` section (Option B — 5/5 industry vendors).
 *  - Save flow: inline rename (Option B — ArchiCAD/Vectorworks/BricsCAD pattern).
 *  - Apply behavior: full replace (Option A — 5/5 industry convergence).
 *
 * Three grouped lists (user / company / project). Inline save mode toggles
 * a name input + scope selector. Delete is owner-only at UI layer; rules
 * enforce authoritatively.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { StairPresetDoc, StairPresetScope } from '../../../bim/types/stair-types';
import { useStairPresets } from '../hooks/useStairPresets';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface StairPresetsSectionProps {
  readonly stair: StairEntity;
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
  readonly levelManager: LevelManagerLike;
}

const SCOPE_ORDER: readonly StairPresetScope[] = ['user', 'company', 'project'];

const SCOPE_LABEL_KEYS: Readonly<Record<StairPresetScope, string>> = {
  user: 'stairAdvancedPanel.sections.presets.scopeUser',
  company: 'stairAdvancedPanel.sections.presets.scopeCompany',
  project: 'stairAdvancedPanel.sections.presets.scopeProject',
};

export function StairPresetsSection({
  stair,
  companyId,
  userId,
  projectId,
  levelManager,
}: StairPresetsSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { presets, loading, error, savePreset, deletePreset, loadPreset } = useStairPresets({
    companyId,
    userId,
    projectId,
    levelManager,
  });

  const [saveMode, setSaveMode] = useState<boolean>(false);
  const [pendingName, setPendingName] = useState<string>('');
  const [pendingScope, setPendingScope] = useState<StairPresetScope>('user');

  const grouped = useMemo(() => {
    const buckets: Record<StairPresetScope, StairPresetDoc[]> = {
      user: [],
      company: [],
      project: [],
    };
    for (const p of presets) buckets[p.scope].push(p);
    return buckets;
  }, [presets]);

  const onSaveConfirm = useCallback(async () => {
    if (!pendingName.trim()) return;
    if (pendingScope === 'project' && !projectId) return;
    const { basePoint: _bp, direction: _dir, ...presetParams } = stair.params;
    await savePreset({
      name: pendingName.trim(),
      kind: stair.kind,
      scope: pendingScope,
      params: presetParams,
    }).catch(() => {
      /* error surfaced via hook state */
    });
    setSaveMode(false);
    setPendingName('');
    setPendingScope('user');
  }, [pendingName, pendingScope, stair, savePreset, projectId]);

  const onSaveCancel = useCallback(() => {
    setSaveMode(false);
    setPendingName('');
    setPendingScope('user');
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void onSaveConfirm();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onSaveCancel();
      }
    },
    [onSaveConfirm, onSaveCancel],
  );

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.presets.title')}
      className="flex flex-col gap-2"
    >
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('stairAdvancedPanel.sections.presets.title')}
        </h4>
        {!saveMode && (
          <button
            type="button"
            onClick={() => setSaveMode(true)}
            className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent"
          >
            {t('stairAdvancedPanel.sections.presets.save')}
          </button>
        )}
      </header>

      {saveMode && (
        <div className="flex flex-col gap-1 rounded border border-border bg-card/60 p-2">
          <input
            autoFocus
            type="text"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('stairAdvancedPanel.sections.presets.namePlaceholder')}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
          />
          <div className="flex items-center gap-2">
            <select
              value={pendingScope}
              onChange={(e) => setPendingScope(e.target.value as StairPresetScope)}
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              <option value="user">{t(SCOPE_LABEL_KEYS.user)}</option>
              <option value="company">{t(SCOPE_LABEL_KEYS.company)}</option>
              {projectId && (
                <option value="project">{t(SCOPE_LABEL_KEYS.project)}</option>
              )}
            </select>
            <button
              type="button"
              onClick={() => void onSaveConfirm()}
              disabled={!pendingName.trim()}
              className="rounded border border-[hsl(var(--text-success))] bg-[hsl(var(--bg-success))] px-2 py-1 text-xs text-white hover:bg-[hsl(var(--bg-success))]/90 disabled:opacity-50"
            >
              {t('stairAdvancedPanel.sections.presets.confirmSave')}
            </button>
            <button
              type="button"
              onClick={onSaveCancel}
              className="rounded border border-border bg-muted px-2 py-1 text-xs text-foreground hover:bg-accent"
            >
              {t('stairAdvancedPanel.sections.presets.cancel')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t(`stairAdvancedPanel.sections.presets.errors.${error}`, { defaultValue: '' }) || error}
        </p>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground">
          {t('stairAdvancedPanel.sections.presets.loading')}
        </p>
      )}

      {SCOPE_ORDER.map((scope) => {
        if (scope === 'project' && !projectId) return null;
        const items = grouped[scope];
        return (
          <div key={scope} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t(SCOPE_LABEL_KEYS[scope])}
            </p>
            {items.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                {t('stairAdvancedPanel.sections.presets.emptyScope')}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {items.map((preset) => {
                  const canDelete = preset.ownerId === userId;
                  return (
                    <li
                      key={preset.id}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-card/40 px-2 py-1"
                    >
                      <span className="truncate text-xs text-foreground">
                        {preset.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => loadPreset(stair, preset)}
                          className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground hover:bg-accent"
                        >
                          {t('stairAdvancedPanel.sections.presets.load')}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void deletePreset(preset.id)}
                            aria-label={t('stairAdvancedPanel.sections.presets.delete')}
                            className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-destructive hover:bg-destructive/20"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
