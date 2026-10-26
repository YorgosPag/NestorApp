'use client';
/**
 * ADR-920 Β4.8 Β3.6 — Resolve ONE meeting point of two breaklines (Civil 3D «Crossing Breaklines» › Use Higher / Lower
 * / Average / Specify Level), opened under the conflict the engineer selected.
 *
 * Beyond the vista: the PREVIEW before Apply — the elevation the point gets, how far each line moves there, and the
 * grade change next to it with a warning above the QA threshold (`previewCrossing`, the resolver's own rule, so the
 * preview is the result). Apply and Revert are ONE undoable command each (`SetTopoBreaklinesCommand.resolve /
 * unresolve`) — no second door. Where a survey point kept its Z there is nothing to choose: the measurement wins
 * (ADR-720), and the panel says so instead of offering a control that could not work.
 *
 * i18n via `t()` (N.11) · CSS module (N.3) · semantic `form/label/output/button` (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import type { BreaklineCrossingRule } from '@/lib/terrain/terrain-types';
import { SetTopoBreaklinesCommand } from '../../../core/commands/entity-commands/SetTopoBreaklinesCommand';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import {
  crossingDecisionOf, isResolvable, previewCrossing, type CrossingChoice, type CrossingPreview,
} from '../../../systems/topography/topo-breakline-crossing-preview';
import type { BreaklineConflictRow } from '../../../systems/topography/topo-breakline-inventory';
import type { Breakline } from '../../../systems/topography/topo-types';
import { mmToMetreString } from '../../../systems/topography/qa/topo-qa-format';
import { realDistanceToModelMm } from '../../../utils/scene-units';
import { normalizeNumber } from '../../../systems/dynamic-input/utils/number';
import styles from './TopographyPanel.module.css';

const NS = 'topography.breaklines.resolve';
const RULES: readonly BreaklineCrossingRule[] = ['higher', 'lower', 'average', 'specify'];

const signedMetres = (mm: number): string => `${mm > 0 ? '+' : ''}${mmToMetreString(mm)}`;

/** The current choice, or `null` while «Specify» holds no finite number. */
function choiceOf(rule: BreaklineCrossingRule, specifyMetres: string): CrossingChoice | null {
  if (rule !== 'specify') return { rule };
  const metres = Number.parseFloat(normalizeNumber(specifyMetres));
  return Number.isFinite(metres) ? { rule, z: realDistanceToModelMm(metres, 'm') } : null;
}

function apply(row: BreaklineConflictRow, choice: CrossingChoice): void {
  const decision = crossingDecisionOf(row, choice);
  const command = decision ? SetTopoBreaklinesCommand.resolve(row.surfaceId, [decision]) : null;
  if (command) getGlobalCommandHistory().execute(command);
}

function revert(row: BreaklineConflictRow): void {
  const command = row.resolution ? SetTopoBreaklinesCommand.unresolve(row.surfaceId, [row.resolution.key]) : null;
  if (command) getGlobalCommandHistory().execute(command);
}

interface PreviewProps {
  readonly row: BreaklineConflictRow;
  readonly preview: CrossingPreview | null;
  readonly id: string;
}

function PreviewOutput({ row, preview, id }: PreviewProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  if (!preview) return <output id={id} className={styles.bkWarn}>{t(`${NS}.invalid`)}</output>;
  const { line, keptLine } = row.flag.messageParams;
  return (
    <output id={id} className={styles.bkPreview} aria-live="polite">
      <span>{t(`${NS}.preview`, {
        z: mmToMetreString(preview.z), keptLine, line,
        shiftKept: signedMetres(preview.shiftKept), shiftLine: signedMetres(preview.shiftOverruled),
      })}</span>
      {preview.gradeChange !== null && (
        <span className={preview.steep ? styles.bkWarn : undefined}>
          {t(preview.steep ? `${NS}.steep` : `${NS}.grade`, { grade: Math.round(preview.gradeChange * 100) })}
        </span>
      )}
    </output>
  );
}

interface SpecifyProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly id: string;
}

function SpecifyField({ value, onChange, id }: SpecifyProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  return (
    <p className={styles.bkResolveRow}>
      <label className={styles.label} htmlFor={id}>{t(`${NS}.specifyLabel`)}</label>
      <input
        id={id} className={styles.input} type="text" inputMode="decimal" autoComplete="off"
        value={value} onChange={(e) => onChange(e.target.value)}
      />
    </p>
  );
}

interface ResolveProps {
  readonly row: BreaklineConflictRow;
  /** A breakline of the row's surface, by id — for the grade preview. */
  readonly lineOf: (id: string) => Breakline | undefined;
}

export function TopoBreaklineConflictResolve({ row, lineOf }: ResolveProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const ids = React.useId();
  const [rule, setRule] = React.useState<BreaklineCrossingRule>(row.resolution?.rule ?? 'higher');
  const [specify, setSpecify] = React.useState(() => mmToMetreString(row.surfaceZ));
  if (!isResolvable(row)) return <p className={styles.status}>{t(`${NS}.surveyWins`)}</p>;

  const choice = choiceOf(rule, specify);
  const preview = choice ? previewCrossing(row, choice, lineOf) : null;
  const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (choice) apply(row, choice);
  };
  return (
    <form className={styles.bkResolve} onSubmit={onSubmit} aria-label={t(`${NS}.title`)}>
      <SegmentedControl value={rule} onValueChange={setRule} aria-label={t(`${NS}.ruleLabel`)}>
        {RULES.map((r) => <SegmentedControlItem key={r} value={r}>{t(`${NS}.rule.${r}`)}</SegmentedControlItem>)}
      </SegmentedControl>
      {rule === 'specify' && <SpecifyField value={specify} onChange={setSpecify} id={`${ids}-z`} />}
      <PreviewOutput row={row} preview={preview} id={`${ids}-preview`} />
      <p className={styles.bkResolveRow}>
        <Button type="submit" size="sm" disabled={!choice} aria-describedby={`${ids}-preview`}>{t(`${NS}.apply`)}</Button>
        {row.resolution && (
          <Button type="button" size="sm" variant="outline" onClick={() => revert(row)}>{t(`${NS}.revert`)}</Button>
        )}
      </p>
    </form>
  );
}
