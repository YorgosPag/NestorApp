/**
 * beam-ishape-geometry — swept steel I/H beam solid (ADR-363 Φ2).
 *
 * Σε αντίθεση με την κολώνα (όπου το προφίλ Ι είναι footprint που γίνεται extrude
 * ΚΑΤΑΚΟΡΥΦΑ), στο δοκάρι το προφίλ Ι είναι **κάθετη τομή** (b×h) που **σαρώνεται
 * οριζόντια κατά τον άξονα**. Χτίζεται το προφίλ στο section-frame (x=πλάτος
 * πέλματος u, y=ύψος v), γίνεται `ExtrudeGeometry` κατά μήκος (local +Z), και
 * μετασχηματίζεται με basis-matrix στον world.
 *
 * **Σύμβαση συντεταγμένων (ίδια με το box path του `beamToMesh`):**
 *   world X = plan x · world Z = −plan y · world Y = ύψος ∈ [0, h]
 * Έτσι το `applyBeamSlope` (shear world-Y βάσει plan-θέσης `{x:getX, y:−getZ}`)
 * ΚΑΙ το `mesh.position.y = topMm·MM_TO_M − h·MM_TO_M` μένουν **αμετάβλητα**.
 *
 * Μονάδες: stair-safe pattern (mm × MM_TO_M → μέτρα), ΟΧΙ το buggy fixture path.
 *
 * Scope Φ2: μόνο ευθύγραμμη σάρωση (straight/cantilever). `curved` ή degenerate
 * άξονας → επιστρέφει `null` ⇒ ο caller πέφτει πίσω στο box extrude.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import * as THREE from 'three';
import type { BeamEntity } from '../../bim/types/beam-types';
import { buildIShapeProfile } from '../../bim/geometry/shared/i-shape-profile';
import { sceneUnitsToMeters } from '../../utils/scene-units';

/** mm → world-metres (ίδιο factor με `BimToThreeConverter`). */
const MM_TO_M = 0.001;

/**
 * Build a swept I/H beam `BufferGeometry` σε world coords (Y-up, μέτρα).
 * Returns `null` όταν η σάρωση δεν υποστηρίζεται (curved kind ή εκφυλισμένος
 * άξονας) — ο caller κάνει fallback στο ίσιο box extrude.
 */
export function buildSweptIBeamGeometry(beam: BeamEntity): THREE.BufferGeometry | null {
  // Curved δοκάρι Ι → εκτός Φ2 (σάρωση κατά Bezier = follow-up). Box fallback.
  if (beam.kind === 'curved') return null;

  const pts = beam.geometry.axisPolyline.points;
  if (pts.length < 2) return null;
  // ADR-462 — axis vertices are CANVAS UNITS → world metres via sceneToM.
  const sceneToM = sceneUnitsToMeters(beam.params.sceneUnits ?? 'mm');
  const start = { x: pts[0].x * sceneToM, y: pts[0].y * sceneToM };
  const end = { x: pts[pts.length - 1].x * sceneToM, y: pts[pts.length - 1].y * sceneToM };
  const dxp = end.x - start.x;
  const dyp = end.y - start.y;
  const lenPlan = Math.hypot(dxp, dyp); // μέτρα (μετά το sceneToM scaling)
  if (lenPlan < 1e-9) return null;

  const hM = beam.params.depth * MM_TO_M;

  // 12-κορυφο προφίλ Ι στο section-frame: x = πλάτος πέλματος (u), y = ύψος (v),
  // κεντραρισμένο στο (0,0). scale = MM_TO_M ⇒ έξοδος σε μέτρα.
  const profile = buildIShapeProfile(beam.params.width, beam.params.depth, MM_TO_M, beam.params.ishape);
  const shape = new THREE.Shape();
  shape.moveTo(profile[0].x, profile[0].y);
  for (let i = 1; i < profile.length; i++) shape.lineTo(profile[i].x, profile[i].y);
  shape.closePath();

  // Σάρωση κατά τον άξονα (local +Z) κατά `lenPlan` μέτρα.
  const geo = new THREE.ExtrudeGeometry(shape, { depth: lenPlan, bevelEnabled: false });

  // Basis: local X(u)→world perpendicular, local Y(v)→world up, local Z→world axis dir.
  // plan→world: X=x, Z=−y. perp = (−dirY, dirX) στο plan.
  const ux = dxp / lenPlan;
  const uy = dyp / lenPlan;
  const dir = new THREE.Vector3(ux, 0, -uy);
  const up = new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3(-uy, 0, -ux); // (px,0,−py) με px=−uy, py=ux· perp×up=dir (δεξιόστροφο)
  const m = new THREE.Matrix4().makeBasis(perp, up, dir);
  // Origin (section center @ start, v=0) → world start point· +h/2 ώστε Y ∈ [0,h].
  m.setPosition(start.x, hM / 2, -start.y);
  geo.applyMatrix4(m);

  return geo;
}
