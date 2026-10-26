'use client';
/**
 * ADR-920 Β4.8 Β3.5 / Β3.6 — the conflicts half of «Ασυνέχειες επιφάνειας» (Civil 3D «Crossing Breaklines» vista):
 *   - OPEN conflicts: the QA report's own flags (`TopoQaFlagRow`); a click = Zoom To + lights the bent line + opens the
 *     Resolve form under it; «Resolve all» = one rule for every open breakline-vs-breakline conflict, ONE undo per surface;
 *   - RESOLVED: the engineer's decisions stay listed with the rule and the result — change or revert them (Civil 3D drops
 *     a resolved crossing from the vista and with it any trace of what was decided);
 *   - decisions that no longer APPLY (partner gone / point moved / lines now agree): named, droppable — never re-aimed.
 *
 * i18n via `t()` (N.11) · CSS module (N.3) · semantic `section/ul/li/button` (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { setFocusedBreakline, getBreaklineDisplayState } from '../../../systems/topography/topo-breakline-display-store';
import type {
  BreaklineConflictRow, BreaklineInventory, UnappliedResolutionRow,
} from '../../../systems/topography/topo-breakline-inventory';
import { BULK_CROSSING_RULES, bulkCrossingDecisions } from '../../../systems/topography/topo-breakline-crossing-preview';
import type { Breakline, TopoSurfaceId } from '../../../systems/topography/topo-types';
import { focusTopoReviewTarget, TOPO_REVIEW_FOCUS_PAD_MM } from '../../../systems/topography/topo-review-focus';
import { resolveTopoQaFlagWorld } from '../../../bim-3d/coordination/topo-qa-flag-world';
import { SetTopoBreaklinesCommand } from '../../../core/commands/entity-commands/SetTopoBreaklinesCommand';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { TopoBreaklineConflictResolve } from './TopoBreaklineConflictResolve';
import { TopoQaFlagRow } from './TopoQaFlagRow';
import styles from './TopographyPanel.module.css';

const NS = 'topography.breaklines';

type BulkRule = (typeof BULK_CROSSING_RULES)[number];

/** A breakline of a surface, by id — for the grade preview. */
export type BreaklinesOf = (surfaceId: TopoSurfaceId) => readonly Breakline[];

/** A conflict lights the BENT line and zooms to the spot where the two disagree. */
function focusConflict(conflict: BreaklineConflictRow): void {
  const preserveZoom = getBreaklineDisplayState().focusedId !== null;
  setFocusedBreakline(conflict.overruledBreaklineId);
  focusTopoReviewTarget(
    [conflict.flag.at], TOPO_REVIEW_FOCUS_PAD_MM.point,
    () => resolveTopoQaFlagWorld(conflict.flag, conflict.surfaceId), preserveZoom,
  );
}

function resolveAll(rows: readonly BreaklineConflictRow[], rule: BulkRule): void {
  for (const [surfaceId, decisions] of bulkCrossingDecisions(rows, rule)) {
    const command = SetTopoBreaklinesCommand.resolve(surfaceId, decisions);
    if (command) getGlobalCommandHistory().execute(command);
  }
}

function dropUnapplied(rows: readonly UnappliedResolutionRow[]): void {
  for (const surfaceId of new Set(rows.map((r) => r.surfaceId))) {
    const keys = rows.filter((r) => r.surfaceId === surfaceId).map((r) => r.key);
    const command = SetTopoBreaklinesCommand.unresolve(surfaceId, keys);
    if (command) getGlobalCommandHistory().execute(command);
  }
}

const conflictKey = (c: BreaklineConflictRow): string => `${c.surfaceId}:${c.flag.id}`;

interface ConflictItemsProps {
  readonly rows: readonly BreaklineConflictRow[];
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly breaklinesOf: BreaklinesOf;
  readonly resolved?: boolean;
}

/**
 * The list, then the Resolve form of the selected row UNDER it (Civil 3D vista: grid above, options below) — never
 * inside the height-capped, scrolling list, where Apply would scroll out of sight (seen live, 2026-10-26).
 */
function ConflictItems({ rows, selectedKey, onSelect, breaklinesOf, resolved = false }: ConflictItemsProps): React.JSX.Element {
  const selected = rows.find((c) => conflictKey(c) === selectedKey);
  const lines = selected ? breaklinesOf(selected.surfaceId) : [];
  return (
    <>
      <ul className={styles.qaList}>
        {rows.map((c) => (
          <li key={conflictKey(c)}>
            <TopoQaFlagRow
              flag={c.flag}
              selected={c === selected}
              onFocus={() => { onSelect(conflictKey(c)); focusConflict(c); }}
              focusHintKey={`${NS}.conflictFocusHint`}
              resolved={resolved}
            />
          </li>
        ))}
      </ul>
      {selected && (
        <TopoBreaklineConflictResolve
          key={conflictKey(selected)} row={selected} lineOf={(id) => lines.find((b) => b.id === id)}
        />
      )}
    </>
  );
}

function ResolveAllBar({ rows }: { readonly rows: readonly BreaklineConflictRow[] }): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-panels');
  const [rule, setRule] = React.useState<BulkRule>('higher');
  const count = [...bulkCrossingDecisions(rows, rule).values()].reduce((n, list) => n + list.length, 0);
  if (count < 2) return null;
  // A group, not a <p>: the SegmentedControl renders a <div>, which a paragraph may not contain (hydration error, seen live).
  return (
    <div className={styles.bkResolveRow} role="group">
      <SegmentedControl value={rule} onValueChange={setRule} aria-label={t(`${NS}.resolve.ruleLabel`)}>
        {BULK_CROSSING_RULES.map((r) => <SegmentedControlItem key={r} value={r}>{t(`${NS}.resolve.rule.${r}`)}</SegmentedControlItem>)}
      </SegmentedControl>
      <Button type="button" size="sm" onClick={() => resolveAll(rows, rule)}>{t(`${NS}.resolve.all`, { count })}</Button>
    </div>
  );
}

function UnappliedList({ rows }: { readonly rows: readonly UnappliedResolutionRow[] }): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  return (
    <section className={styles.field} aria-labelledby="topo-breakline-unapplied-title">
      <h4 id="topo-breakline-unapplied-title" className={styles.label}>{t(`${NS}.unappliedTitle`, { count: rows.length })}</h4>
      <p className={styles.subtitle}>{t(`${NS}.unappliedHint`)}</p>
      <ul className={styles.qaList}>
        {rows.map((r) => (
          <li key={`${r.surfaceId}:${r.key.ownerBreaklineId}:${r.key.withBreaklineId}:${r.key.x}:${r.key.y}`} className={styles.bkResolveRow}>
            <span className={styles.bkMeta}>{t(`${NS}.unappliedItem`, { owner: r.ownerLabel, with: r.withLabel })}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => dropUnapplied([r])}>{t(`${NS}.unappliedDrop`)}</Button>
          </li>
        ))}
      </ul>
      {rows.length > 1 && (
        <Button type="button" size="sm" variant="outline" onClick={() => dropUnapplied(rows)}>{t(`${NS}.unappliedDropAll`)}</Button>
      )}
    </section>
  );
}

interface ConflictListProps {
  readonly inventory: BreaklineInventory;
  readonly breaklinesOf: BreaklinesOf;
}

export function TopoBreaklineConflictList({ inventory, breaklinesOf }: ConflictListProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const shared = { selectedKey, onSelect: setSelectedKey, breaklinesOf };
  const { conflicts, resolved, unapplied } = inventory;
  return (
    <>
      {conflicts.length > 0 && (
        <section className={styles.field} aria-labelledby="topo-breakline-conflicts-title">
          <h4 id="topo-breakline-conflicts-title" className={styles.label}>{t(`${NS}.conflictsTitle`, { count: conflicts.length })}</h4>
          <ResolveAllBar rows={conflicts} />
          <ConflictItems rows={conflicts} {...shared} />
        </section>
      )}
      {resolved.length > 0 && (
        <section className={styles.field} aria-labelledby="topo-breakline-resolved-title">
          <h4 id="topo-breakline-resolved-title" className={styles.label}>{t(`${NS}.resolvedTitle`, { count: resolved.length })}</h4>
          <ConflictItems rows={resolved} {...shared} resolved />
        </section>
      )}
      {unapplied.length > 0 && <UnappliedList rows={unapplied} />}
    </>
  );
}
