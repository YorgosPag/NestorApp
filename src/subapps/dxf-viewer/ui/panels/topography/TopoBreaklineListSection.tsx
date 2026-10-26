'use client';
/**
 * ADR-920 Β4.8 Β3.5 — «Ασυνέχειες επιφάνειας»: the list of COMMITTED breaklines and of the conflicts between them.
 *
 * Civil 3D Prospector › Definition › Breaklines (count · item view · delete) + the «Crossing Breaklines» vista (pairs ·
 * Δz · Zoom To), built ONLY on what already exists — nothing here derives a second time:
 *   - rows + conflicts = `buildBreaklineInventory` over the definition and the ONE memoised build report;
 *   - a conflict row is the QA report's own flag (`TopoQaFlagRow`): same message, same severity, same #n;
 *   - Zoom To = the topo focus boundary (`focusTopoReviewTarget`, WORLD→DISPLAY) with the shared 3D line resolver;
 *   - Remove = `SetTopoBreaklinesCommand` through the global history (Ctrl+Z restores it);
 *   - the eye + «αυτήν κοιτάω» = `topo-breakline-display-store` (same as the ribbon toggle, the 2D overlay, the 3D layer).
 *
 * Beyond Prospector: Zoom To on a definition breakline (asked for on AUGI since 2008), the z-source in words AND as a
 * line pattern, link health when the source line is gone, and a conflict click that ALSO lights the bent line.
 * Closing the panel drops the focus — the highlight belongs to the review, not to the drawing.
 *
 * i18n via `t()` (N.11) · CSS module (N.3) · semantic `section/header/ul/li/button` (N.4).
 */

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { getTopoState, subscribeTopo } from '../../../systems/topography/TopoPointStore';
import {
  getBreaklineDisplayState, setBreaklinesVisible, setFocusedBreakline, subscribeBreaklineDisplay,
} from '../../../systems/topography/topo-breakline-display-store';
import {
  buildBreaklineInventory,
  type BreaklineConflictRow, type BreaklineInventoryRow, type BreaklineSurfaceInput,
} from '../../../systems/topography/topo-breakline-inventory';
import { getTopoBuildReport } from '../../../systems/topography/topo-surface';
import { TOPO_SURFACE_IDS, type TopoSurfaceId } from '../../../systems/topography/topo-types';
import { focusTopoReviewTarget, TOPO_REVIEW_FOCUS_PAD_MM } from '../../../systems/topography/topo-review-focus';
import { resolveTopoLineWorld } from '../../../bim-3d/coordination/auto-breakline-world';
import { resolveTopoQaFlagWorld } from '../../../bim-3d/coordination/topo-qa-flag-world';
import { SetTopoBreaklinesCommand } from '../../../core/commands/entity-commands/SetTopoBreaklinesCommand';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { useCurrentLevelScene } from '../../../systems/levels/useCurrentLevelScene';
import { TopoBreaklineRow } from './TopoBreaklineRow';
import { TopoQaFlagRow } from './TopoQaFlagRow';
import styles from './TopographyPanel.module.css';

const NS = 'topography.breaklines';
const NO_CONFLICTS: BreaklineSurfaceInput['conflicts'] = [];
const NO_ORIGIN: BreaklineSurfaceInput['origin'] = { x: 0, y: 0 };

/** Definition + the ONE memoised build report per surface (no build at all for a surface without breaklines). */
function surfaceInputs(state: ReturnType<typeof getTopoState>): Record<TopoSurfaceId, BreaklineSurfaceInput> {
  const entries = TOPO_SURFACE_IDS.map((id): [TopoSurfaceId, BreaklineSurfaceInput] => {
    const breaklines = state.surfaces[id].breaklines;
    if (breaklines.length === 0) return [id, { breaklines, conflicts: NO_CONFLICTS, origin: NO_ORIGIN }];
    const report = getTopoBuildReport(id);
    return [id, { breaklines, conflicts: report.breaklineConflicts, origin: report.surface.origin }];
  });
  return Object.fromEntries(entries) as Record<TopoSurfaceId, BreaklineSurfaceInput>;
}

/** First jump of this review frames the target; later ones keep the engineer's zoom (QA / auto-breakline rule). */
function focusBreakline(row: BreaklineInventoryRow): void {
  const preserveZoom = getBreaklineDisplayState().focusedId !== null;
  setFocusedBreakline(row.breakline.id);
  focusTopoReviewTarget(
    row.breakline.vertices, TOPO_REVIEW_FOCUS_PAD_MM.line,
    (worldCentre) => resolveTopoLineWorld(row.breakline, worldCentre), preserveZoom,
  );
}

/** A conflict lights the BENT line and zooms to the spot where the two disagree. */
function focusConflict(conflict: BreaklineConflictRow): void {
  const preserveZoom = getBreaklineDisplayState().focusedId !== null;
  setFocusedBreakline(conflict.overruledBreaklineId);
  focusTopoReviewTarget(
    [conflict.flag.at], TOPO_REVIEW_FOCUS_PAD_MM.point,
    () => resolveTopoQaFlagWorld(conflict.flag, conflict.surfaceId), preserveZoom,
  );
}

function removeBreakline(row: BreaklineInventoryRow): void {
  const command = SetTopoBreaklinesCommand.remove(row.surfaceId, [row.breakline.id]);
  if (command) getGlobalCommandHistory().execute(command);
  if (getBreaklineDisplayState().focusedId === row.breakline.id) setFocusedBreakline(null);
}

const conflictKey = (c: BreaklineConflictRow): string => `${c.surfaceId}:${c.flag.id}`;

function useBreaklineInventory() {
  const state = React.useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);
  const scene = useCurrentLevelScene();
  const sceneEntityIds = React.useMemo(
    () => (scene ? new Set(scene.entities.map((e) => e.id)) : null),
    [scene],
  );
  return React.useMemo(
    () => buildBreaklineInventory({ surfaces: surfaceInputs(state), sceneEntityIds }),
    [state, sceneEntityIds],
  );
}

interface HeaderProps {
  readonly count: number;
  readonly visible: boolean;
}

function ListHeader({ count, visible }: HeaderProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const toggleLabel = t(visible ? `${NS}.hide` : `${NS}.show`);
  return (
    <header className={styles.bkHeader}>
      <h3 className={styles.label}>{t(`${NS}.count`, { count })}</h3>
      <button
        type="button"
        className={styles.bkEye}
        onClick={() => setBreaklinesVisible(!visible)}
        aria-pressed={!visible}
        aria-label={toggleLabel}
      >
        {visible ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
        <span>{toggleLabel}</span>
      </button>
    </header>
  );
}

interface ConflictsProps {
  readonly conflicts: readonly BreaklineConflictRow[];
}

function ConflictList({ conflicts }: ConflictsProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  return (
    <section className={styles.field} aria-labelledby="topo-breakline-conflicts-title">
      <h4 id="topo-breakline-conflicts-title" className={styles.label}>
        {t(`${NS}.conflictsTitle`, { count: conflicts.length })}
      </h4>
      <ul className={styles.qaList}>
        {conflicts.map((c) => (
          <li key={conflictKey(c)}>
            <TopoQaFlagRow
              flag={c.flag}
              selected={conflictKey(c) === selectedKey}
              onFocus={() => { setSelectedKey(conflictKey(c)); focusConflict(c); }}
              focusHintKey={`${NS}.conflictFocusHint`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface RowsProps {
  readonly rows: readonly BreaklineInventoryRow[];
  readonly focusedId: string | null;
}

function BreaklineList({ rows, focusedId }: RowsProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const grouped = TOPO_SURFACE_IDS
    .map((id) => ({ id, rows: rows.filter((r) => r.surfaceId === id) }))
    .filter((g) => g.rows.length > 0);
  return (
    <>
      {grouped.map((group) => (
        <section key={group.id} className={styles.field} aria-label={t(`${NS}.surface.${group.id}`)}>
          {grouped.length > 1 && <h4 className={styles.label}>{t(`${NS}.surface.${group.id}`)}</h4>}
          <ul className={styles.qaList}>
            {group.rows.map((row) => (
              <TopoBreaklineRow
                key={row.breakline.id}
                row={row}
                focused={row.breakline.id === focusedId}
                onFocus={focusBreakline}
                onRemove={removeBreakline}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function TopoBreaklineListSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const inventory = useBreaklineInventory();
  const display = React.useSyncExternalStore(
    subscribeBreaklineDisplay, getBreaklineDisplayState, getBreaklineDisplayState,
  );
  // The highlight belongs to this review: closing the panel must not leave a line lit on the plan.
  React.useEffect(() => () => setFocusedBreakline(null), []);

  return (
    <section className={styles.field} data-testid="topo-breakline-list">
      <ListHeader count={inventory.rows.length} visible={display.visible} />
      <p className={styles.subtitle}>{t(`${NS}.hint`)}</p>
      {!display.visible && <p className={styles.status}>{t(`${NS}.hiddenNote`)}</p>}
      {inventory.rows.length === 0 && <p className={styles.status}>{t(`${NS}.empty`)}</p>}
      {inventory.conflicts.length > 0 && <ConflictList conflicts={inventory.conflicts} />}
      {inventory.rows.length > 0 && inventory.conflicts.length === 0 && (
        <p className={styles.status}>{t(`${NS}.conflictsNone`)}</p>
      )}
      {inventory.rows.length > 0 && <BreaklineList rows={inventory.rows} focusedId={display.focusedId} />}
    </section>
  );
}
