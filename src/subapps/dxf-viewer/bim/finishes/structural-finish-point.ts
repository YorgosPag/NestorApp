/**
 * ADR-449 — `toPt2`: {x,y} → `Pt2` converter (pure, dependency-free leaf).
 *
 * Εξάχθηκε από το `structural-finish-scene.ts` ώστε το `wall-footprint-union.ts` να το εισάγει
 * από εδώ αντί από το scene: έσπαγε την **κυκλική εξάρτηση** `structural-finish-scene` ⇄
 * `wall-footprint-union` (το scene re-export-άρει το `wallFootprintPolygon` ΑΠΟ το union, ενώ
 * το union εισήγαγε **value** `toPt2` ΑΠΟ το scene → circular value edge → «wallFootprintPolygon
 * is not defined» σε isolated module-load order). Τώρα ο κύκλος είναι μόνο type-only (erased).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B (Slice A)
 */

import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';

/** {x,y} → `Pt2` (shallow copy — αποσυνδέει από το πηγαίο αντικείμενο). */
export const toPt2 = (p: { x: number; y: number }): Pt2 => ({ x: p.x, y: p.y });
