/**
 * ADR-369 — Multi-building site placement transform (PURE SSoT).
 *
 * **Πρώτος καταναλωτής** των `Building.siteOrigin` + `rotation` (ADR-369 §9 Q2):
 * φέρνει ένα πολύγωνο εκφρασμένο στο **τοπικό scene frame** ενός κτιρίου μέσα στο
 * τοπικό frame **άλλου** κτιρίου, μέσω του κοινού **site frame** (Revit shared
 * coordinates / project base point). Ξεκλειδώνει cross-building γεωμετρία (ADR-422
 * L7.3 Slice E σκίαση ορίζοντα: ray-cast από τα παράθυρα του ενεργού κτιρίου προς
 * τις μάζες των γειτονικών κτιρίων). Καθαρή γεωμετρία — μηδέν scene/store/React.
 *
 * **Τοποθέτηση (ADR-369):** η τοπική γεωμετρία ενός κτιρίου περιστρέφεται κατά
 * `rotation` (deg, CCW, γύρω από το τοπικό origin) και η τοπική αρχή τοποθετείται
 * στο site στο `siteOrigin` (μέτρα):
 *
 *   site(m)   = rotate(local_m, pivot=0, rotation_src) + siteOrigin_src
 *   activeLoc = rotate(site − siteOrigin_act, pivot=0, −rotation_act) / sceneToM_act
 *
 * **Μονάδες:** οι τοπικές συντεταγμένες → μέτρα μέσω του `sceneToM` **κάθε** σκηνής
 * (διαφορετικά κτίρια μπορεί να διαφέρουν)· η έξοδος στις μονάδες της **ενεργής**
 * σκηνής (εκεί κάνει ray-cast ο caller). **Defaults `siteOrigin={0,0}` + `rotation=0`
 * ⇒ identity ⇒ zero-regression** (single-building / άστοχη τοποθέτηση).
 *
 * REUSE-not-FORK (N.0.2): η περιστροφή είναι η SSoT `rotatePoint` (ADR-188) — μηδέν
 * νέα trig math.
 *
 * @see ../../../utils/rotation-math (rotatePoint — SSoT περιστροφής)
 * @see ./solar-horizon-geometry (consumer — ray-cast ορίζοντα)
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9
 */

import { rotatePoint } from '../../../utils/rotation-math';
import type { Point2DLike } from './solar-overhang-geometry';

/** Σταθερό pivot περιστροφής = τοπικό origin του κτιρίου. */
const ORIGIN: Point2DLike = { x: 0, y: 0 };

/** Τοποθέτηση ενός κτιρίου στο site (ADR-369) + η κλίμακα της σκηνής του. */
export interface BuildingPlacement {
  /** METRES — XY offset της τοπικής αρχής στο site (`Building.siteOrigin`). Absent ⇒ {0,0}. */
  readonly siteOrigin?: { readonly x: number; readonly y: number };
  /** DEGREES (CCW) — προσανατολισμός κτιρίου στο site (`Building.rotation`). Absent ⇒ 0. */
  readonly rotationDeg?: number;
  /** Μέτρα ανά μονάδα της σκηνής **αυτού** του κτιρίου (`sceneUnitsToMeters`). */
  readonly sceneToM: number;
}

/** Τοπικό σημείο (scene units) → site frame (μέτρα): rotate γύρω από origin + siteOrigin. */
function localToSiteMetres(p: Point2DLike, placement: BuildingPlacement): Point2DLike {
  const m: Point2DLike = { x: p.x * placement.sceneToM, y: p.y * placement.sceneToM };
  const rotated = rotatePoint(m, ORIGIN, placement.rotationDeg ?? 0);
  const o = placement.siteOrigin;
  return { x: rotated.x + (o?.x ?? 0), y: rotated.y + (o?.y ?? 0) };
}

/** Site σημείο (μέτρα) → τοπικό frame ενεργού κτιρίου (scene units): un-place + un-rotate. */
function siteMetresToActiveLocal(siteP: Point2DLike, active: BuildingPlacement): Point2DLike {
  const o = active.siteOrigin;
  const rel: Point2DLike = { x: siteP.x - (o?.x ?? 0), y: siteP.y - (o?.y ?? 0) };
  const unrotated = rotatePoint(rel, ORIGIN, -(active.rotationDeg ?? 0));
  const scale = active.sceneToM > 0 ? active.sceneToM : 1;
  return { x: unrotated.x / scale, y: unrotated.y / scale };
}

/**
 * Μεταφέρει ένα σημείο από το τοπικό frame του `source` κτιρίου στο τοπικό frame του
 * `active` κτιρίου, μέσω του κοινού site frame. Pure, idempotent. Identity όταν τα δύο
 * κτίρια μοιράζονται placement (ή και τα δύο default) ⇒ zero-regression.
 */
export function transformPointToActiveFrame(
  p: Point2DLike,
  source: BuildingPlacement,
  active: BuildingPlacement,
): Point2DLike {
  return siteMetresToActiveLocal(localToSiteMetres(p, source), active);
}

/**
 * Μεταφέρει ένα κλειστό πολύγωνο XY από το τοπικό frame του `source` κτιρίου στο τοπικό
 * frame του `active` κτιρίου (per-vertex {@link transformPointToActiveFrame}). Διατηρεί
 * τη σειρά κορυφών (winding). Pure.
 */
export function transformPolygonToActiveFrame(
  polygon: readonly Point2DLike[],
  source: BuildingPlacement,
  active: BuildingPlacement,
): Point2DLike[] {
  return polygon.map((p) => transformPointToActiveFrame(p, source, active));
}
