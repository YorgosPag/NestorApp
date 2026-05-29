'use client';

/**
 * ADR-358 Phase 7b1 + Phase 6.1 follow-up (2026-05-17) — surfacing of
 * `StairValidationState.violationKeys` to the user. The contextual ribbon
 * tab already raises a red "!" badge when `hasCodeViolations`; this section
 * complements the badge with a readable list of the actual violations so
 * the user knows WHAT is wrong, not just THAT something is wrong.
 *
 * Industry pattern (Revit "Warnings" section in Properties Palette,
 * ArchiCAD warnings dialog, AutoCAD Audit messages): each violation is a
 * single line; clicking a future "Fix" affordance is deferred to Phase 9.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';
import { autoFixStairParams } from '../../../bim/stairs/stair-auto-fix';

export interface StairWarningsSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch?: DispatchStairParamPatch;
}

// ADR-358 Phase 9 — partition violation keys by severity. Hard errors
// (`tools.stair.validator.hardError.*` or explicit `hardErrors` array on
// the validation state) render red (stop); everything else renders orange
// (warning, non-blocking).
function isHardErrorKey(key: string): boolean {
  return key.startsWith('tools.stair.validator.hardError.');
}

function partitionViolations(
  allKeys: readonly string[],
  hardErrorsField: readonly string[] | undefined,
): { hard: readonly string[]; soft: readonly string[] } {
  if (hardErrorsField && hardErrorsField.length > 0) {
    const hardSet = new Set(hardErrorsField);
    return {
      hard: hardErrorsField,
      soft: allKeys.filter((k) => !hardSet.has(k)),
    };
  }
  const hard: string[] = [];
  const soft: string[] = [];
  for (const k of allKeys) (isHardErrorKey(k) ? hard : soft).push(k);
  return { hard, soft };
}

function ViolationList({
  keys,
  variant,
  titleKey,
  onAutoFix,
  autoFixLabel,
  t,
}: {
  keys: readonly string[];
  variant: 'hard' | 'soft';
  titleKey: string;
  onAutoFix?: () => void;
  autoFixLabel?: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}): React.ReactElement | null {
  if (keys.length === 0) return null;
  const wrap =
    variant === 'hard'
      ? 'flex flex-col gap-1.5 rounded border border-destructive/40 bg-destructive/20 p-2'
      : 'flex flex-col gap-1.5 rounded border border-[hsl(var(--text-warning))]/40 bg-[hsl(var(--bg-warning))]/20 p-2';
  const dot = variant === 'hard' ? 'text-destructive' : 'text-[hsl(var(--text-warning))]';
  const title = variant === 'hard' ? 'text-destructive-foreground' : 'text-foreground';
  const item = variant === 'hard' ? 'text-foreground' : 'text-foreground';
  const btn =
    variant === 'hard'
      ? 'rounded border border-destructive/60 bg-destructive/50 px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/70'
      : 'rounded border border-[hsl(var(--text-warning))]/60 bg-[hsl(var(--bg-warning))]/50 px-2 py-1 text-xs font-medium text-foreground hover:bg-[hsl(var(--bg-warning))]/70';
  return (
    <section role="alert" aria-label={t(titleKey)} className={wrap}>
      <header className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className={dot}>!</span>
          <h4 className={`text-xs font-semibold uppercase tracking-wide ${title}`}>
            {t(titleKey)}
          </h4>
        </span>
        {onAutoFix && autoFixLabel ? (
          <button type="button" onClick={onAutoFix} className={btn}>
            {autoFixLabel}
          </button>
        ) : null}
      </header>
      <ul className={`flex flex-col gap-1 text-xs ${item}`}>
        {keys.map((key) => {
          const ns = key.startsWith('tools.') ? 'tool-hints' : 'dxf-viewer-shell';
          return (
            <li key={key} className="leading-snug">
              {t(key, { ns, defaultValue: '' }) || key}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function StairWarningsSection({ stair, dispatchPatch }: StairWarningsSectionProps): React.ReactElement | null {
  const { t } = useTranslation(['dxf-viewer-shell', 'tool-hints']);
  const keys = stair.validation?.violationKeys ?? [];
  const { hard, soft } = partitionViolations(keys, stair.validation?.hardErrors);

  const onAutoFix = useCallback(() => {
    if (!dispatchPatch) return;
    const fixed = autoFixStairParams(stair.params);
    if (fixed === stair.params) return;
    dispatchPatch(stair, {
      rise: fixed.rise,
      tread: fixed.tread,
      width: fixed.width,
      stepCount: fixed.stepCount,
    });
  }, [stair, dispatchPatch]);

  if (keys.length === 0) return null;
  const autoFixLabel = dispatchPatch
    ? t('stairAdvancedPanel.sections.warnings.autoFix')
    : undefined;
  const autoFixHandler = dispatchPatch ? onAutoFix : undefined;

  return (
    <div className="flex flex-col gap-2">
      <ViolationList
        keys={hard}
        variant="hard"
        titleKey="stairAdvancedPanel.sections.warnings.errorsTitle"
        onAutoFix={autoFixHandler}
        autoFixLabel={autoFixLabel}
        t={t}
      />
      <ViolationList
        keys={soft}
        variant="soft"
        titleKey="stairAdvancedPanel.sections.warnings.title"
        onAutoFix={hard.length === 0 ? autoFixHandler : undefined}
        autoFixLabel={hard.length === 0 ? autoFixLabel : undefined}
        t={t}
      />
    </div>
  );
}
