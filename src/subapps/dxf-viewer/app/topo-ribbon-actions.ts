/**
 * ADR-662 Φάση 1 — Topography ribbon action runner.
 *
 * Pure dispatch table extracted from `TopoRibbonHost` (N.7.1 SRP). Maps each `topo.*`
 * ribbon action key to the ALREADY-EXISTING topo hook/store call — μηδέν νέα λογική, ο
 * runner είναι thin trigger. Mount-time hooks (generate/bake) + section-in-dialog opens
 * arrive via `deps`; global-store toggles/one-shots are module functions called directly.
 *
 * Related: dxf-special-actions.ts (emits `topo:ribbon-action`), TopoRibbonHost.tsx (mounts
 * the hooks, owns dialog state), ADR-662 §6.
 */

import type { TFunction } from 'i18next';
import type { UseTopoContours } from '../systems/topography/useTopoContours';
import type { UseTopoGrid } from '../systems/topography/useTopoGrid';
import type { UseNorthArrow } from '../systems/topography/useNorthArrow';
import type { UseTopoPointLabels } from '../systems/topography/useTopoPointLabels';
import { getContourConfig } from '../systems/topography/contour-config-store';
import { getGridDisplayOptions, setTopoGridVisible } from '../systems/topography/topo-grid-store';
import { getNorthArrowOptions, setNorthArrowVisible } from '../systems/topography/north-arrow-store';
import { getPointLabelOptions } from '../systems/topography/topo-point-label-store';
import { getPointCloud3DState, setPointCloud3DVisible, clearPointCloud3D } from '../systems/topography/pointcloud-3d-store';
import { runCutFill } from '../systems/topography/cut-fill-store';
import { setTerrain3DStyle, setTerrain3DVisible } from '../systems/topography/terrain-3d-store';
import { runTopoQa } from '../systems/topography/qa/run-topo-qa';
import { topoQaStore } from '../systems/topography/qa/topo-qa-store';
import { detectAutoBreaklines } from '../systems/topography/auto-breaklines';
import { autoBreaklineStore } from '../systems/topography/auto-breaklines/auto-breakline-store';

/** Everything the runner needs: the mount-time hooks, notifications, i18n, dialog opens. */
export interface TopoRibbonDeps {
  readonly contours: UseTopoContours;
  readonly grid: UseTopoGrid;
  readonly north: UseNorthArrow;
  readonly pointLabels: UseTopoPointLabels;
  readonly notify: { success: (msg: string) => void; error: (msg: string) => void };
  readonly t: TFunction;
  readonly openImport: () => void;
  readonly openGeoRef: () => void;
  readonly openDeliverables: () => void;
}

/** i18n key prefix for the topo ribbon toast messages (dxf-viewer-shell namespace). */
const N = 'ribbon.commands.topo.notify';

/** Outcome shape shared by generate/bake hooks — ok + count + optional reason. */
interface BakeOutcome { readonly ok: boolean; readonly entityCount: number; readonly reason?: string }

/** Reports a generate/bake outcome as a success/error toast (SSoT for the count messages). */
function notifyBake(r: BakeOutcome, okKey: string, deps: TopoRibbonDeps): void {
  if (r.ok) deps.notify.success(deps.t(`${N}.${okKey}`, { count: r.entityCount }));
  else deps.notify.error(deps.t(`${N}.failed`));
}

/**
 * Route one `topo.*` ribbon action to its ready call. Unknown keys no-op (defensive —
 * every key is declared in topography-tab.ts, but a stale key must never throw).
 */
export function runTopoRibbonAction(action: string, deps: TopoRibbonDeps): void {
  switch (action) {
    // ── Δεδομένα ──────────────────────────────────────────────────────────────
    case 'topo.import.open': return deps.openImport();
    case 'topo.cloud.toggle': return setPointCloud3DVisible(!getPointCloud3DState().visible);
    case 'topo.cloud.remove': return clearPointCloud3D();
    // ── Επιφάνεια ─────────────────────────────────────────────────────────────
    case 'topo.contours.generate': {
      const r = deps.contours.generate(getContourConfig());
      if (r.ok) deps.notify.success(deps.t(`${N}.contoursGenerated`, { count: r.contourCount, entities: r.entityCount }));
      else deps.notify.error(deps.t(`${N}.failed`));
      return;
    }
    case 'topo.autoBreakline.detect': {
      autoBreaklineStore.setReport(detectAutoBreaklines('existing'));
      deps.notify.success(deps.t(`${N}.autoBreaklineDone`));
      return;
    }
    // ── Γεωαναφορά ────────────────────────────────────────────────────────────
    case 'topo.geoRef.open': return deps.openGeoRef();
    // ── Παρουσίαση ────────────────────────────────────────────────────────────
    case 'topo.grid.toggle': return setTopoGridVisible(!getGridDisplayOptions().visible);
    case 'topo.grid.bake': return notifyBake(deps.grid.bake(), 'gridBaked', deps);
    case 'topo.north.toggle': return setNorthArrowVisible(!getNorthArrowOptions().visible);
    case 'topo.north.bake': {
      const r = deps.north.bake();
      // Idempotent singleton — «already-exists» is not an error, the arrow is already down.
      if (r.ok || r.reason === 'already-exists') deps.notify.success(deps.t(`${N}.northBaked`));
      else deps.notify.error(deps.t(`${N}.failed`));
      return;
    }
    case 'topo.pointLabels.generate': return notifyBake(deps.pointLabels.generate(getPointLabelOptions()), 'labelsGenerated', deps);
    // ── Ανάλυση ───────────────────────────────────────────────────────────────
    case 'topo.cutFill.compute': {
      const r = runCutFill();
      if (r.result) {
        setTerrain3DStyle('cutfill');
        setTerrain3DVisible(true);
        deps.notify.success(deps.t(`${N}.cutFillDone`));
      } else deps.notify.error(deps.t(`${N}.cutFillEmpty`));
      return;
    }
    case 'topo.qa.run': {
      topoQaStore.set(runTopoQa('existing'));
      deps.notify.success(deps.t(`${N}.qaDone`));
      return;
    }
    case 'topo.qa.clear': return topoQaStore.reset();
    // ── Παραδοτέα ─────────────────────────────────────────────────────────────
    case 'topo.deliverables.open': return deps.openDeliverables();
    default: return;
  }
}
