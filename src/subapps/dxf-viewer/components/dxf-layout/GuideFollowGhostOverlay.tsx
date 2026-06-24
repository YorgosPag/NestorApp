'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * GuideFollowGhostOverlay — ADR-441 Slice 3-perf (zero-lag associative follow).
 *
 * Όταν σύρεται ένας οδηγός κανάβου, οι hosted πεδιλοδοκοί πρέπει να ακολουθούν
 * **frame-for-frame**. Το committed React path (`useHostingReconciler` →
 * `setLevelScene` → re-render → bitmap rebuild) κοστίζει 1-3 frames → ορατό lag.
 * Αυτό το overlay ζωγραφίζει τους hosted strips **imperative σε αποκλειστικό
 * canvas** (zero React, μηδέν bitmap rebuild) στη **live** θέση τους, frame-synced
 * με τον οδηγό — όπως κάθε άλλο drag ghost (grip/move) της εφαρμογής.
 *
 * ADR-040 συμμόρφωση (mirror ProposalGhostOverlay):
 *   - Δικό του `<canvas>` (mount μόνο όσο σύρεται οδηγός) → τίποτα δεν το σβήνει.
 *   - Repaint trigger = **guide-store notify** (RAF-coalesced) για τις live κινήσεις
 *     οδηγού + `subscribeImmediateTransformFrame` για pan/zoom. Reads
 *     `getImmediateTransform()` στο draw-time (zero-lag).
 *   - Per-strip auto-handoff: το `deriveFollowGhostFootprints` (SSoT reconciler)
 *     επιστρέφει ΜΟΝΟ strips των οποίων τα committed params ≠ live-derived· μόλις ο
 *     reconciler κάνει commit στο release, συγκλίνουν → ghost άδειο → seamless,
 *     χωρίς flash (το linger κρατά το canvas mounted όσο προσγειώνεται το commit).
 *
 * @see ../../bim/hosting/guide-follow-ghost.ts — pure footprint derive (SSoT)
 * @see ../../systems/guides/guide-drag-store.ts — drag-state gate
 * @see ./ProposalGhostOverlay.tsx — the dedicated-canvas / transform-frame precedent
 */

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/scene';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import { isFoundationEntity } from '../../types/entities';
import { DXF_TIMING } from '../../config/dxf-timing';
import { hasGuideBindings } from '../../bim/hosting/guide-binding-types';
import { getHostingStrategy } from '../../bim/hosting/hosting-strategy';
import {
  deriveFollowGhostFootprints,
  type FollowGhostFootprint,
} from '../../bim/hosting/guide-follow-ghost';
import { deriveGridFollowGhostFootprints } from '../../bim/foundations/foundation-grid-ghost';
import { foundationGridSettingsStore } from '../../ui/ribbon/hooks/bridge/foundation-grid-settings-store';
import { gridStripSignature } from '../../bim/foundations/foundation-grid-segments';
import { resolveSceneUnits } from '../../utils/scene-units';
import type { GuideOffsetLookup } from '../../bim/hosting/derive-params-from-guides';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { getDraggingGuideId, subscribeGuideDrag } from '../../systems/guides/guide-drag-store';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../rendering/core/immediate-transform-frame';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { GHOST_DEFAULTS } from '../../rendering/ghost';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
}

export interface GuideFollowGhostOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly levelManager: LevelManagerLike;
}

/** ms να μείνει το ghost μετά το release, ώστε να προσγειωθεί το committed commit. */
const LINGER_MS = DXF_TIMING.gesture.LINGER; // ADR-516
const GHOST_FILL = 'rgba(74, 144, 217, 0.18)';

function devicePixelRatioSafe(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

/** Current X/Y offset ενός άξονα (XZ/διαγραμμένος → undefined). */
function makeOffsetLookup(): GuideOffsetLookup {
  const store = getGlobalGuideStore();
  return (id) => {
    const g = store.getGuideById(id);
    return g && g.axis !== 'XZ' ? g.offset : undefined;
  };
}

/**
 * ADR-441 Slice 7 — footprints προς ζωγράφισμα όσο σύρεται οδηγός. Αν υπάρχει
 * grid-managed εσχάρα → **live target** (split-aware: οι λωρίδες σπάνε στα νέα
 * σταυρόδρομα & οι γωνίες ευθυγραμμίζονται ζωντανά, ίδιο geometry με το commit). Τα
 * non-grid hosted (π.χ. πεδιλοδοκός από τοίχο με χειροκίνητα bindings) κρατούν το
 * coordinate-follow. Χωρίς εσχάρα → μόνο coordinate-follow (μηδέν auto-preview).
 */
function computeGhostFootprints(
  hosted: readonly FoundationEntity[],
  levelId: string,
  scene: SceneModel | null,
): FollowGhostFootprint[] {
  const lookup = makeOffsetLookup();
  const hasGrid = hosted.some((e) => gridStripSignature(e) !== null);
  if (!hasGrid) return deriveFollowGhostFootprints(hosted, lookup);
  const sceneUnits = scene ? resolveSceneUnits(scene) : 'mm';
  // ADR-441 — ίδιο περιμετρικό mode με το commit (draw-time getter· μηδέν subscription).
  const gridFootprints = deriveGridFollowGhostFootprints(
    getGlobalGuideStore(), {}, levelId, sceneUnits, foundationGridSettingsStore.get(),
  );
  const nonGrid = hosted.filter((e) => gridStripSignature(e) === null);
  return nonGrid.length > 0
    ? [...gridFootprints, ...deriveFollowGhostFootprints(nonGrid, lookup)]
    : gridFootprints;
}

/** Draw κάθε footprint ως μπλε ghost (faint fill + solid outline). */
function paintFootprints(
  ctx: CanvasRenderingContext2D,
  footprints: readonly FollowGhostFootprint[],
  transform: ViewTransform,
  vp: { width: number; height: number },
): void {
  ctx.save();
  ctx.fillStyle = GHOST_FILL;
  ctx.strokeStyle = GHOST_DEFAULTS.color;
  ctx.lineWidth = GHOST_DEFAULTS.lineWidth;
  for (const fp of footprints) {
    if (fp.vertices.length < 3) continue;
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen(fp.vertices[0], transform, vp);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < fp.vertices.length; i++) {
      const s = CoordinateTransforms.worldToScreen(fp.vertices[i], transform, vp);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function GuideFollowGhostOverlayInner({
  viewport,
  levelManager,
}: GuideFollowGhostOverlayProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const rafRef = useRef<number | null>(null);

  const repaint = useCallback(() => {
    rafRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = devicePixelRatioSafe();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vp = viewportRef.current;
    if (vp.width <= 0 || vp.height <= 0) return;
    const lm = levelManagerRef.current;
    const levelId = lm.currentLevelId;
    if (!levelId) return;
    const scene = lm.getLevelScene(levelId);
    const entities = scene?.entities ?? [];
    // ADR-441 Slice GEN/WALL/COL — grid-hosted = bindings + registered strategy.
    // Foundations κρατούν το εσχάρα-aware path· τοίχοι/κολώνες ακολουθούν live μέσω του
    // generic coordinate-follow (strategy.outline) — zero-lag κατά το guide-drag.
    const foundations = entities.filter(
      (e): e is FoundationEntity => isFoundationEntity(e) && hasGuideBindings(e),
    );
    const others = entities.filter(
      (e) => !isFoundationEntity(e) && hasGuideBindings(e) && getHostingStrategy(e.type) !== undefined,
    );
    if (foundations.length === 0 && others.length === 0) return;
    const footprints: FollowGhostFootprint[] = [
      ...computeGhostFootprints(foundations, levelId, scene),
      ...(others.length > 0 ? deriveFollowGhostFootprints(others, makeOffsetLookup()) : []),
    ];
    paintFootprints(ctx, footprints, getImmediateTransform(), vp);
  }, []);

  // RAF-coalesce repaints so multiple guide notifies per frame paint once.
  const schedule = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(repaint);
  }, [repaint]);

  // Live guide moves (high-freq) drive the repaint; pan/zoom via transform-frame.
  useEffect(() => {
    const offGuide = getGlobalGuideStore().subscribe(schedule);
    const offFrame = subscribeImmediateTransformFrame(
      'guide-follow-ghost',
      'Guide Follow Ghost',
      repaint,
    );
    return () => {
      offGuide();
      offFrame();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [schedule, repaint]);

  const dpr = devicePixelRatioSafe();
  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="guide-follow-ghost"
      width={Math.max(1, Math.round(viewport.width * dpr))}
      height={Math.max(1, Math.round(viewport.height * dpr))}
      className="pointer-events-none absolute inset-0 w-full h-full z-[14]"
      aria-hidden="true"
    />
  );
}

/**
 * Mount: gated on the imperative guide-drag store. Stays mounted `LINGER_MS` after
 * release so the committed reconciler commit lands before the ghost unmounts → no
 * flash. ADR-040 leaf: the only subscription is the low-freq drag-state store.
 */
export const GuideFollowGhostPreviewMount = React.memo(function GuideFollowGhostPreviewMount(
  props: GuideFollowGhostOverlayProps,
): React.ReactElement | null {
  const draggingId = useSyncExternalStore(subscribeGuideDrag, getDraggingGuideId, () => null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (draggingId !== null) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(false), LINGER_MS);
    return () => clearTimeout(t);
  }, [draggingId]);

  if (!visible) return null;
  return <GuideFollowGhostOverlayInner {...props} />;
});
