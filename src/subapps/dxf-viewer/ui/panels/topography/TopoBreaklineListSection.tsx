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
 * ADR-920 Β3.6 — the conflicts half (open · resolved · no-longer-applying, with Resolve) is `TopoBreaklineConflictList`.
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
  type BreaklineInventoryRow, type BreaklineSurfaceInput,
} from '../../../systems/topography/topo-breakline-inventory';
import { getTopoBuildReport } from '../../../systems/topography/topo-surface';
import { TOPO_SURFACE_IDS, type TopoSurfaceId } from '../../../systems/topography/topo-types';
import { focusTopoReviewTarget, TOPO_REVIEW_FOCUS_PAD_MM } from '../../../systems/topography/topo-review-focus';
import { resolveTopoLineWorld } from '../../../bim-3d/coordination/auto-breakline-world';
import { SetTopoBreaklinesCommand } from '../../../core/commands/entity-commands/SetTopoBreaklinesCommand';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { useCurrentLevelScene } from '../../../systems/levels/useCurrentLevelScene';
import { TopoBreaklineRow } from './TopoBreaklineRow';
import { TopoBreaklineConflictList, type BreaklinesOf } from './TopoBreaklineConflictList';
import styles from './TopographyPanel.module.css';

const NS = 'topography.breaklines';
const NO_CONFLICTS: BreaklineSurfaceInput['conflicts'] = [];
const NO_ORIGIN: BreaklineSurfaceInput['origin'] = { x: 0, y: 0 };
const NO_RESOLUTIONS: BreaklineSurfaceInput['unappliedResolutions'] = [];

/** Definition + the ONE memoised build report per surface (no build at all for a surface without breaklines). */
function surfaceInputs(state: ReturnType<typeof getTopoState>): Record<TopoSurfaceId, BreaklineSurfaceInput> {
  const entries = TOPO_SURFACE_IDS.map((id): [TopoSurfaceId, BreaklineSurfaceInput] => {
    const breaklines = state.surfaces[id].breaklines;
    if (breaklines.length === 0) return [id, { breaklines, conflicts: NO_CONFLICTS, origin: NO_ORIGIN, unappliedResolutions: NO_RESOLUTIONS }];
    const report = getTopoBuildReport(id);
    return [id, {
      breaklines,
      conflicts: report.breaklineConflicts,
      origin: report.surface.origin,
      unappliedResolutions: report.unappliedCrossingResolutions,
    }];
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

function removeBreakline(row: BreaklineInventoryRow): void {
  const command = SetTopoBreaklinesCommand.remove(row.surfaceId, [row.breakline.id]);
  if (command) getGlobalCommandHistory().execute(command);
  if (getBreaklineDisplayState().focusedId === row.breakline.id) setFocusedBreakline(null);
}

function useBreaklineInventory() {
  const state = React.useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);
  const scene = useCurrentLevelScene();
  const sceneEntityIds = React.useMemo(
    () => (scene ? new Set(scene.entities.map((e) => e.id)) : null),
    [scene],
  );
  const inventory = React.useMemo(
    () => buildBreaklineInventory({ surfaces: surfaceInputs(state), sceneEntityIds }),
    [state, sceneEntityIds],
  );
  const breaklinesOf = React.useCallback<BreaklinesOf>((id) => state.surfaces[id].breaklines, [state]);
  return { inventory, breaklinesOf };
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
  const { inventory, breaklinesOf } = useBreaklineInventory();
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
      <TopoBreaklineConflictList inventory={inventory} breaklinesOf={breaklinesOf} />
      {inventory.rows.length > 0 && inventory.conflicts.length === 0 && inventory.resolved.length === 0 && (
        <p className={styles.status}>{t(`${NS}.conflictsNone`)}</p>
      )}
      {inventory.rows.length > 0 && <BreaklineList rows={inventory.rows} focusedId={display.focusedId} />}
    </section>
  );
}
