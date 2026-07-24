'use client';

/**
 * use-bim3d-entity-clipboard — ADR-688. Αντιγραφή / Επικόλληση-στο-σημείο /
 * Διπλασιασμός ΟΝΤΟΤΗΤΑΣ μέσα στον 3D κάμβα (BIM / MEP / MESH / DXF).
 *
 * Window-capture keydown leaf, καθρέφτης του {@link usePolygonClipboardShortcuts}
 * (που κατέχει το ΔΙΑΦΟΡΕΤΙΚΟ clipboard εμφάνισης-όψης). Μηδέν React re-render —
 * όλα τα stores διαβάζονται με `getState()` στο event time (ADR-040 leaf).
 *
 * Reuse-only (N.0.2): δεν ξαναγράφεται clone/clipboard/coordinate math.
 *   - Ctrl+C → επανεκπέμπει `clipboard:copy-requested` → το ΗΔΗ-mounted
 *     {@link useEntityClipboard}.copySelection κάνει snapshot την universal επιλογή
 *     (που καθρεφτίζει την 3D επιλογή, ADR-402 bridge). Μηδέν διπλότυπο copy.
 *   - Ctrl+V → paste στο **3D pick point**: raycast κέρσορα → work-plane
 *     ({@link resolveWorkPlaneHit}) → delta από το κέντρο των snapshots →
 *     {@link buildEntityCloneCommand} (clone SSoT) → undoable execute → reselect.
 *   - Ctrl+D → διπλασιασμός ΤΡΕΧΟΥΣΑΣ επιλογής in-place με μικρό offset (Figma-style).
 *
 * Προτεραιότητα: το entity clipboard δρα ΜΟΝΟ όταν το Polygon Mode είναι ΑΝΕΝΕΡΓΟ
 * (σε Polygon Mode το Ctrl+C/V ανήκει στο face-appearance). Το 2D
 * `useDxfToolbarShortcuts` clipboard block είναι guarded-off στο 3D (ADR-688) ώστε
 * να μην γίνεται double-paste· ο hook επιπλέον κάνει `stopImmediatePropagation`.
 *
 * @see ./use-polygon-clipboard-shortcuts.ts — το πρότυπο leaf (face appearance)
 * @see ../../bim/transforms/build-entity-clone-command.ts — clone SSoT
 * @see ../placement/resolve-work-plane-hit.ts — pick-point machinery
 * @see docs/centralized-systems/reference/adrs/ADR-688-3d-canvas-entity-copy-paste.md
 */

import { useEffect, useRef, type RefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { EntityClipboardStore } from '../../systems/clipboard/EntityClipboardStore';
import { buildEntityCloneCommand } from '../../bim/transforms/build-entity-clone-command';
import {
  useSceneManagerAdapter,
  type SceneAdapterLevelManager,
} from '../../systems/entity-creation/useSceneManagerAdapter';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useCommandHistory } from '../../core/commands/useCommandHistory';
import { useUniversalSelectionStable } from '../../systems/selection/SelectionSystem';
import { resolveSceneUnits } from '../../utils/scene-units';
import { getEntityBounds } from '../../types/entities';
import type { Entity } from '../../types/entities';
import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { isTypingInFormField } from '../ui/is-typing-in-form-field';
import { resolveWorkPlaneHit } from '../placement/resolve-work-plane-hit';
import { planMmToScenePoint } from '../placement/world-to-scene-point';

/** Figma-style διπλασιασμός offset (plan mm) — ορατός σε κάθε scene unit μέσω `planMmToScenePoint`. */
const DUPLICATE_OFFSET_MM = 300;
/** Paste γίνεται στο active-floor plane (μηδέν ανύψωση work-plane). */
const PASTE_PLANE_OFFSET_MM = 0;

/** Stable fallback όταν δεν υπάρχει ενεργός όροφος — ο scene manager βγαίνει `null` → no-op. */
const NULL_LEVEL_MANAGER: SceneAdapterLevelManager = {
  currentLevelId: null,
  getLevelScene: () => null,
  setLevelScene: () => {},
};

export interface UseBim3DEntityClipboardParams {
  managerRef: RefObject<ThreeJsSceneManager | null>;
  canvasEl: HTMLCanvasElement | null;
}

/** AABB-κέντρο των οντοτήτων σε scene units· `null` όταν καμία δεν έχει έγκυρα bounds. */
function boundsCenter(entities: readonly SceneEntity[]): Point2D | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
  for (const e of entities) {
    const b = getEntityBounds(e as unknown as Entity);
    if (!Number.isFinite(b.minX) || !Number.isFinite(b.maxX)) continue;
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY); any = true;
  }
  return any ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } : null;
}

export function useBim3DEntityClipboard({
  managerRef,
  canvasEl,
}: UseBim3DEntityClipboardParams): void {
  const levels = useLevelsOptional();
  const getSceneManager = useSceneManagerAdapter(levels ?? NULL_LEVEL_MANAGER);
  const { execute } = useCommandHistory();
  const universal = useUniversalSelectionStable();

  // Τελευταία θέση κέρσορα πάνω από τον 3D κάμβα (event-time read για το pick-point paste).
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // ── Κοινά helpers (live reads, ADR-040) ──────────────────────────────────
    const currentScene = () => {
      const id = levels?.currentLevelId;
      return id ? levels?.getLevelScene(id) ?? null : null;
    };
    const currentUnits = () => {
      const scene = currentScene();
      return scene ? resolveSceneUnits(scene) : 'mm';
    };
    const offsetDelta = (): Point2D =>
      planMmToScenePoint({ x: DUPLICATE_OFFSET_MM, y: DUPLICATE_OFFSET_MM }, currentUnits());

    const commitClones = (sources: readonly SceneEntity[], delta: Point2D, sm: ISceneManager): boolean => {
      const result = buildEntityCloneCommand(sources, delta, sm);
      if (!result) return false;
      execute(result.command);
      universal.replaceEntitySelection(result.cloneIds);
      return true;
    };

    // ── Ctrl+V — paste στο 3D pick point (fallback: offset) ──────────────────
    const pasteAtPick = (sm: ISceneManager): boolean => {
      const snapshots = EntityClipboardStore.read();
      if (snapshots.length === 0) return false;
      const anchor = boundsCenter(snapshots);
      const mgr = managerRef.current;
      const pointer = lastPointer.current;
      let delta = offsetDelta();
      if (anchor && mgr && canvasEl && pointer) {
        const hit = resolveWorkPlaneHit(mgr, canvasEl, pointer.x, pointer.y, PASTE_PLANE_OFFSET_MM);
        if (hit) {
          const target = planMmToScenePoint(hit.planMm, currentUnits());
          delta = { x: target.x - anchor.x, y: target.y - anchor.y };
        }
      }
      return commitClones(snapshots, delta, sm);
    };

    // ── Ctrl+D — διπλασιασμός τρέχουσας επιλογής in-place με offset ───────────
    const duplicateSelection = (sm: ISceneManager): boolean => {
      const ids = new Set(universal.getSelectedEntityIds());
      if (ids.size === 0) return false;
      const scene = currentScene();
      const sources = (scene?.entities ?? []).filter((e) => ids.has(e.id)) as unknown as SceneEntity[];
      if (sources.length === 0) return false;
      return commitClones(sources, offsetDelta(), sm);
    };

    const onPointerMove = (e: PointerEvent): void => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      // Gating (προτεραιότητα): μόνο 3D, εκτός Polygon Mode, όχι σε πεδίο κειμένου.
      if (!selectIs3D(useViewMode3DStore.getState())) return;
      if (usePolygonMode3DStore.getState().active) return;
      if (isTypingInFormField(document.activeElement)) return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || event.shiftKey || event.altKey) return;
      const sm = getSceneManager();
      if (!sm) return;

      let handled = false;
      switch (event.key.toLowerCase()) {
        case 'c':
          // Reuse: το ΗΔΗ-mounted useEntityClipboard.copySelection κάνει το snapshot.
          EventBus.emit('clipboard:copy-requested', {});
          handled = true;
          break;
        case 'v':
          handled = pasteAtPick(sm);
          break;
        case 'd':
          handled = duplicateSelection(sm);
          break;
      }

      if (handled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    // Capture phase — claim πριν τους 2D listeners (mirror use3DShortcuts / polygon hook).
    window.addEventListener('keydown', onKeyDown, { capture: true });
    if (canvasEl) canvasEl.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      if (canvasEl) canvasEl.removeEventListener('pointermove', onPointerMove);
    };
  }, [levels, getSceneManager, execute, universal, managerRef, canvasEl]);
}
