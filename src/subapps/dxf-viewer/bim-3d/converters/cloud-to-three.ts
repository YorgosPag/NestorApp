/**
 * ADR-650 M8β/Β — `PointCloudPreview` → `THREE.BufferGeometry`. Το ΜΟΝΟ σημείο όπου το νέφος
 * περνά από το survey domain στη 3Δ σκηνή — ακριβώς όπως το `tin-to-three.ts` για το TIN.
 *
 * Pure: κανένα store, καμία σκηνή, κανένα entity (ίδιο συμβόλαιο με τον TIN converter, ώστε να
 * είναι μονάδα-ελέγξιμο και να μη σέρνει τους topo stores σε κάθε 3Δ test).
 *
 * Οι μετασχηματισμοί που συμβαίνουν εδώ, μία φορά:
 *   1. LOCAL → WORLD (μόνο οριζοντιογραφικά) — το `preview.positions` κουβαλά `(localX, localY,
 *      worldZ)` ανά σημείο, ΤΟ ΙΔΙΟ split που έχει και το `TinSurface` (x/y local, z ήδη world).
 *      Πρόσθεσε το `origin` ΜΟΝΟ στα x/y· το z ΠΟΤΕ.
 *   2. plan-mm → three-world (m, Y-up) — μέσω `writeDxfPlanToWorld`, της ΙΔΙΑΣ συνάρτησης που
 *      χρησιμοποιεί το TIN, τα grips, τα ghosts και τα snap markers. Δεν ξαναγράφεται εδώ: αν το
 *      έδαφος και το νέφος «κάθονταν» με δύο διαφορετικά μαθηματικά, θα έδειχναν δύο διαφορετικά
 *      σημεία για την ίδια αποτύπωση — και το σφάλμα θα φαινόταν μόνο σε geo-referenced ΕΓΣΑ'87.
 *
 * Μη-πεπερασμένα σημεία: το νέφος τα ΠΑΡΑΛΕΙΠΕΙ (δεν ακυρώνει το build, σε αντίθεση με το TIN).
 * Ένα NaN vertex δηλητηριάζει το bounding box → μαυρίζει ΟΛΗ την 3Δ σκηνή (ADR-537), αλλά σε ένα
 * νέφος 2M σημείων ένα κακό record από sensor/decoder δεν είναι λόγος να χαθεί το νέφος: το πετάς
 * και συνεχίζεις. Το TIN δεν έχει αυτή την πολυτέλεια — εκεί κάθε κορυφή ανήκει σε τρίγωνα.
 */

import * as THREE from 'three';
import type { PointCloudPreview } from '../../systems/topography/pointcloud/pointcloud-types';
import { PREVIEW_COLOR_FALLBACK } from '../../systems/topography/pointcloud/asprs-las-spec';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import { writeDxfPlanToWorld } from '../viewport/coordinate-transforms';

/**
 * Χτίσε τη γεωμετρία του νέφους, ή `null` όταν δεν υπάρχει τίποτα να ζωγραφιστεί (άδειο νέφος,
 * ή ένα όπου κάθε σημείο είναι μη-πεπερασμένο).
 *
 * Το χρώμα είναι ΠΑΝΤΑ per-vertex: όταν η πηγή δεν έφερε ταξινόμηση (`colors === null`), κάθε
 * σημείο παίρνει το `PREVIEW_COLOR_FALLBACK` (το ΙΔΙΟ γκρι που δίνει και το 2Δ preview του
 * wizard, SSoT `asprs-las-spec.ts`). Έτσι το layer έχει ΕΝΑ υλικό αντί για δύο παραλλαγές.
 */
export function cloudPreviewToBufferGeometry(
  preview: PointCloudPreview,
  projector?: WorldToDisplayProjector | null,
): THREE.BufferGeometry | null {
  if (preview.count === 0) return null;

  const positions = new Float32Array(preview.count * 3);
  const colors = new Float32Array(preview.count * 3);
  const kept = fillCloudBuffers(preview, positions, colors, projector ?? null);
  if (kept === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, kept * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, kept * 3), 3));
  return geometry;
}

/**
 * Γράψε τα πεπερασμένα σημεία του `preview` στους προ-διαστασιολογημένους buffers, συμπυκνωμένα.
 * Επιστρέφει πόσα σημεία επέζησαν (≤ `preview.count`).
 */
function fillCloudBuffers(
  preview: PointCloudPreview,
  positions: Float32Array,
  colors: Float32Array,
  projector: WorldToDisplayProjector | null,
): number {
  const { origin, colors: source } = preview;
  const project = projector && !projector.isIdentity ? projector : null; // fast path when unset/identity
  let kept = 0;

  for (let i = 0; i < preview.count; i++) {
    const base = i * 3;
    const worldXMm = preview.positions[base]! + origin.x; // CLOUD-LOCAL → ΕΓΣΑ WORLD (οριζοντιογραφικά)
    const worldYMm = preview.positions[base + 1]! + origin.y;
    const elevMm = preview.positions[base + 2]!; // ήδη WORLD Z — geo-ref είναι planar, ποτέ offset

    if (!Number.isFinite(worldXMm) || !Number.isFinite(worldYMm) || !Number.isFinite(elevMm)) {
      continue; // κακό record → το πετάς, δεν χάνεις το νέφος
    }

    const out = kept * 3;
    // ADR-650 M10b: ΕΓΣΑ WORLD → building-DISPLAY, ώστε το νέφος να κάθεται κάτω από το κτίριο (mirror 2D/TIN).
    const plan = project ? project.project(worldXMm, worldYMm) : null;
    writeDxfPlanToWorld(positions, out, plan ? plan.x : worldXMm, plan ? plan.y : worldYMm, elevMm);
    colors[out] = source ? source[base]! : PREVIEW_COLOR_FALLBACK[0];
    colors[out + 1] = source ? source[base + 1]! : PREVIEW_COLOR_FALLBACK[1];
    colors[out + 2] = source ? source[base + 2]! : PREVIEW_COLOR_FALLBACK[2];
    kept += 1;
  }
  return kept;
}
