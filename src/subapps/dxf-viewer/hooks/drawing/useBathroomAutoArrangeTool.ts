/**
 * ADR-638 Στάδιο 2b — Bathroom Auto-Arrange Tool React Hook (Revit «Place Space»
 * region-pick gesture).
 *
 * Hover→click gesture (ΟΧΙ instant-action): ο χρήστης ενεργοποιεί το εργαλείο, κάνει
 * hover πάνω σε κλειστό δωμάτιο (η περιοχή highlight-άρεται από το
 * `useBathroomAutoArrangeMouseMove`), και με κλικ τοποθετούνται αυτόματα τα είδη
 * υγιεινής σε ΕΚΕΙΝΟ το δωμάτιο. Το footprint πολύγωνο παράγεται από τον μικρότερο
 * κλειστό βρόχο τοίχων που περικλείει το σημείο — ΙΔΙΟ SSoT με το thermal-space tool.
 *
 * State machine: idle ⇄ awaiting (continuous — μετά από commit μένει ενεργό για τον
 * επόμενο χώρο).
 *
 * SSoT alignment (FULL reuse):
 *   - `pickRegionPerimeterAt` + `isPerimeterOversized` + `perimeterExtentMm` +
 *     `findOpenChainLineIdsNear` (perimeter-from-faces) — κοινό click/hover detection.
 *   - `arrangeBathroomForRoom` (run-bathroom-auto-arrange-flow) — solve + commit +
 *     notify SSoT. ZERO duplicate construction.
 *   - Active-tool string `'bathroom-auto-arrange'` — ο orchestrator (useSpecialTools)
 *     ενεργοποιεί μέσω `useToolLifecycle(activeTool === 'bathroom-auto-arrange', ...)`.
 *
 * ADR-462 — geometry unit = ΠΑΝΤΑ `'mm'` (canonical mm scene· βλ. arrangeBathroomForRoom).
 *
 * @see hooks/drawing/useThermalSpaceTool.ts — το click-in-region πρότυπο
 * @see docs/centralized-systems/reference/adrs/ADR-638-bathroom-auto-layout-generator.md
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../../../providers/NotificationProvider';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneAppendAccessor } from '../../bim/scene/append-entity-to-scene';
import { pickValidatedRegionForClick } from '../../bim/walls/pick-region-for-tool';
import type { SceneUnits } from '../../utils/scene-units';
import { clearRegionPerimeterPreview } from '../../systems/region-preview/RegionPerimeterPreviewStore';
import { arrangeBathroomForRoom } from '../../systems/bathroom-layout/run-bathroom-auto-arrange-flow';

/** ADR-462 — scene coordinates are canonical mm; the whole pipeline runs in `'mm'`. */
const GEOMETRY_UNITS: SceneUnits = 'mm';

// ─── State machine types ─────────────────────────────────────────────────────

export type BathroomAutoArrangeToolPhase = 'idle' | 'awaiting';

export interface BathroomAutoArrangeToolState {
  readonly phase: BathroomAutoArrangeToolPhase;
}

const INITIAL_STATE: BathroomAutoArrangeToolState = { phase: 'idle' };

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseBathroomAutoArrangeToolOptions {
  /** Returns the active scene entities (DXF + BIM) for region detection + door keep-clear. */
  readonly getSceneEntities?: () => readonly Entity[];
  /** Returns the scene-append accessor (level manager) for the undoable commit batch. */
  readonly getAccessor?: () => SceneAppendAccessor;
}

export interface UseBathroomAutoArrangeToolResult {
  readonly state: BathroomAutoArrangeToolState;
  activate(): void;
  deactivate(): void;
  /** Returns true αν το click τοποθέτησε είδη ή κατανάλωσε το event (warning). */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
  readonly isActive: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useBathroomAutoArrangeTool(
  options: UseBathroomAutoArrangeToolOptions = {},
): UseBathroomAutoArrangeToolResult {
  const { getSceneEntities, getAccessor } = options;
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();

  const [state, setState] = useState<BathroomAutoArrangeToolState>(INITIAL_STATE);
  const stateRef = useRef<BathroomAutoArrangeToolState>(state);
  stateRef.current = state;

  const activate = useCallback(() => {
    setState({ phase: 'awaiting' });
  }, []);

  const deactivate = useCallback(() => {
    // Καθάρισε το hover highlight αμέσως (belt-and-suspenders· το mousemove hook
    // ούτως ή άλλως το σβήνει στην επόμενη κίνηση εκτός εργαλείου).
    clearRegionPerimeterPreview();
    setState(INITIAL_STATE);
  }, []);

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      if (stateRef.current.phase !== 'awaiting') return false;

      const entities = getSceneEntities?.() ?? [];
      const accessor = getAccessor?.();
      if (!accessor) return false;

      // Κοινό SSoT με το hover + thermal-space: pick → open-loop diagnostics → oversized guard.
      const outcome = pickValidatedRegionForClick(point, entities, GEOMETRY_UNITS);
      if (outcome.status !== 'picked') return outcome.status === 'consumed';

      arrangeBathroomForRoom(accessor, outcome.perimeter.polygon, entities, { notifications, t });
      // Continuous — stay awaiting for the next room.
      return true;
    },
    [getSceneEntities, getAccessor, notifications, t],
  );

  const getStatusText = useCallback((): string => {
    return stateRef.current.phase === 'awaiting' ? 'tools.bathroomAutoArrange.statusPick' : '';
  }, []);

  return {
    state,
    activate,
    deactivate,
    onCanvasClick,
    getStatusText,
    isActive: state.phase !== 'idle',
  };
}
