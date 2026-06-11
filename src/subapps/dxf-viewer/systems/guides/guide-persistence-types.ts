'use client';

/**
 * ADR-441 Slice 1 — Grid (guides) Firestore persistence types + serialization.
 *
 * Ο κάναβος (ADR-189) persist-άρεται ως **1 document ανά όροφο** (όχι N entity docs):
 * `floorplan_grid_guides/{grd_*}` με embedded `guides[]` + `groups[]`. Scoped per-floor
 * μέσω του ADR-420 floor-scope SSoT (`buildBimScopeConstraints`).
 *
 * Serialization: το `Guide` είναι σχεδόν Firestore-safe — μόνο τα optional
 * `startPoint`/`endPoint`/`temporary` χρειάζονται προσοχή (Firestore απορρίπτει
 * `undefined`). Τα `temporary` guides (B35, auto-removed) ΔΕΝ persist-άρονται.
 *
 * @see ./guide-firestore-service.ts
 * @see ../../bim/persistence/bim-floor-scope.ts
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import type { Timestamp } from 'firebase/firestore';
import type { Point2D } from '../../rendering/types/Types';
import type { GridAxis, GridGuideStyle } from '../../ai-assistant/grid-types';
import type { Guide, GuideGroup } from './guide-types';

// ============================================================================
// SNAPSHOT TYPES (Firestore-safe — no undefined keys when serialized)
// ============================================================================

/** Persisted shape ενός guide. Optional fields ΑΠΟΥΣΙΑΖΟΥΝ (δεν είναι `undefined`). */
export interface GuideSnapshot {
  readonly id: string;
  readonly axis: GridAxis;
  readonly offset: number;
  readonly label: string | null;
  readonly style: GridGuideStyle | null;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly createdAt: string;
  readonly parentId: string | null;
  readonly groupId: string | null;
  readonly startPoint?: Point2D;
  readonly endPoint?: Point2D;
}

/** Canonical Firestore document — όλος ο κάναβος ενός ορόφου. */
export interface GridGuideDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly floorId?: string;
  readonly guides: readonly GuideSnapshot[];
  readonly groups: readonly GuideGroup[];
  /** Monotonic counter — informational (last-write-wins v1). */
  readonly version: number;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

// ============================================================================
// SERIALIZATION (pure)
// ============================================================================

/**
 * `Guide` → `GuideSnapshot` με conditional spread ώστε τα απόντα optional fields
 * να ΜΗΝ γίνονται `undefined` keys (Firestore reject). Επιστρέφει null για
 * temporary guides (δεν persist-άρονται).
 */
export function guideToSnapshot(g: Guide): GuideSnapshot | null {
  if (g.temporary) return null;
  return {
    id: g.id,
    axis: g.axis,
    offset: g.offset,
    label: g.label,
    style: g.style,
    visible: g.visible,
    locked: g.locked,
    createdAt: g.createdAt,
    parentId: g.parentId,
    groupId: g.groupId,
    ...(g.startPoint ? { startPoint: { x: g.startPoint.x, y: g.startPoint.y } } : {}),
    ...(g.endPoint ? { endPoint: { x: g.endPoint.x, y: g.endPoint.y } } : {}),
  };
}

/** Persistable, non-temporary guides → snapshots (filters temporary). */
export function guidesToSnapshots(guides: readonly Guide[]): readonly GuideSnapshot[] {
  const out: GuideSnapshot[] = [];
  for (const g of guides) {
    const snap = guideToSnapshot(g);
    if (snap) out.push(snap);
  }
  return out;
}

/** `GuideSnapshot` → runtime `Guide` (για `store.restoreGuide`). */
export function snapshotToGuide(s: GuideSnapshot): Guide {
  return {
    id: s.id,
    axis: s.axis,
    offset: s.offset,
    label: s.label,
    style: s.style,
    visible: s.visible,
    locked: s.locked,
    createdAt: s.createdAt,
    parentId: s.parentId,
    groupId: s.groupId,
    ...(s.startPoint ? { startPoint: { x: s.startPoint.x, y: s.startPoint.y } } : {}),
    ...(s.endPoint ? { endPoint: { x: s.endPoint.x, y: s.endPoint.y } } : {}),
  };
}
