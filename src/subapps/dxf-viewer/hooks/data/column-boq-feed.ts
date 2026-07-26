/**
 * ADR-401 Phase F.2 — column profile-aware BOQ geometry feed (SSoT).
 *
 * Mirror του `wall-boq-feed.ts`. Μια `attached` κολώνα (κορυφή/βάση κολλά σε
 * δοκάρι/πλάκα) έχει **μεταβλητό ύψος** (per-corner lower/upper-envelope) → το
 * BOQ ύψος/όγκος πρέπει να βγαίνει από τα profiles, όχι από το flat
 * `params.height`. Χτίζει per-column host context από τα beams+slabs της σκηνής
 * (ίδιο plan space, reuse `buildWallHostInputs`/`makeColumnHostResolver`) και
 * αποτιμά τους resolvers SSoT. Μη-attached κολώνα → reuse του flat geometry.
 *
 * `floorElevationMm = 0`: το active level scene είναι floor-relative (datum
 * ορόφου = 0), ίδια σύμβαση με τον wall BOQ feed + το 2D section.
 */

import type { SceneModel } from '../../types/entities';
import { isBeamEntity, isSlabEntity } from '../../types/entities';
import type { ColumnEntity } from '../../bim/types/column-types';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import {
  resolveColumnTopProfile,
  resolveColumnBaseProfile,
  makeColumnHostResolver,
  type ColumnTopProfile,
  type ColumnBaseProfile,
} from '../../bim/geometry/column-vertical-profile';
import { buildWallHostInputs } from '../../bim/geometry/wall-host-plan-builder';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import type { BimEntityForBoq } from '../../bim/services/BimToBoqBridge';
import { computeColumnFinishContribution } from '../../bim/finishes/structural-finish-scene';
import {
  computeColumnFoundationStub,
  hasFoundationStub,
} from '../../bim/geometry/column-foundation-stub';
// ADR-713 — το όριο ΟΨΗΣ (στάθμη εδάφους) + η στεγάνωση της θαμμένης ζώνης.
import { resolveColumnExposureZones } from '../../bim/geometry/column-exposure-zone';
import { buriedWaterproofingBuckets } from '../../bim/finishes/buried-waterproofing-area';

/**
 * ADR-401 F.2 — top + base profiles για `attached` κολώνα (per-corner envelope
 * κάτω από δοκάρι/πλάκα ΚΑΙ πάνω σε θεμέλιο/δοκάρι). Footprint coverage στο ίδιο
 * plan space με τους hosts (`entity.geometry.footprint.vertices`). Κάθε προφίλ →
 * null όταν δεν είναι `attached`.
 */
function resolveAttachedColumnProfiles(
  entity: ColumnEntity,
  scene: SceneModel | null,
): { top: ColumnTopProfile | null; base: ColumnBaseProfile | null } {
  if (!scene) return { top: null, base: null };
  const topAttached = entity.params.topBinding === 'attached';
  const baseAttached = entity.params.baseBinding === 'attached';
  if (!topAttached && !baseAttached) return { top: null, base: null };

  const resolveHostInput = makeColumnHostResolver(
    buildWallHostInputs(scene.entities.filter(isBeamEntity), scene.entities.filter(isSlabEntity)),
  );
  const footprint = projectVerticesTo2D(entity.geometry.footprint.vertices);
  const ctx = { floorElevationMm: 0, resolveHostInput };
  const top = topAttached ? resolveColumnTopProfile(entity.params, footprint, ctx) : null;
  const base = baseAttached ? resolveColumnBaseProfile(entity.params, footprint, ctx) : null;
  return { top, base };
}

/**
 * Build το BOQ-feed entity μιας κολώνας με profile-aware geometry όταν είναι
 * `attached` (ύψος/όγκος από top − base)· αλλιώς reuse του (flat) geometry.
 * Mirror του `wallBoqEntity`.
 *
 * ADR-712 — `baseDropMap` (προαιρετικό, `Map<columnId, baseDropMm>` από το
 * `column-continuity-boq-source`): όταν η κολώνα εδράζεται σε πέδιλο, το τμήμα από την άνω
 * παρειά του πεδίλου ως τη nominal βάση της («κοντόστυλο») **χρεώνεται χωριστά** — ΝΕΤ ΟΙΚ
 * τιμολογεί θεμέλια ≠ ανωδομή. Το `geometry.volume` παραμένει ο όγκος **ανωδομής**
 * (OIK-2.03) και το κοντόστυλο ταξιδεύει ως `foundationStub` (→ child row OIK-2.07).
 * Χωρίς entry → identity fast-path, byte-for-byte η προηγούμενη επιμέτρηση.
 *
 * Το module μένει **pure** (μηδέν store read) — τον χάρτη τον χτίζει ο caller, ώστε να
 * είναι jest-clean και να μοιράζεται από τις δύο διαδρομές επιμέτρησης.
 */
export function columnBoqEntity(
  entity: ColumnEntity,
  scene: SceneModel | null,
  baseDropMap?: ReadonlyMap<string, number>,
  gradeMap?: ReadonlyMap<string, number>,
): BimEntityForBoq {
  const { top, base } = resolveAttachedColumnProfiles(entity, scene);
  const geometry = top !== null || base !== null
    ? computeColumnGeometry(entity.params, top ?? undefined, base ?? undefined)
    : entity.geometry;
  const baseDropMm = baseDropMap?.get(entity.id) ?? 0;

  // ADR-713 — το όριο ΟΨΗΣ (στάθμη τελειωμένου εδάφους), διακριτό από το όριο ΟΓΚΟΥ του
  // ADR-712. Η σκηνή είναι floor-relative (FFL = 0) → nominal βάση = σκέτο το `baseOffset`.
  const nominalBaseAbsMm = entity.params.baseOffset ?? 0;
  const exposure = resolveColumnExposureZones({
    nominalBaseAbsMm,
    topAbsMm: nominalBaseAbsMm + geometry.height,
    baseDropMm,
    gradeAbsMm: gradeMap?.get(entity.id),
  });

  // ADR-449/713 — ο σοβάς μετριέται στην ΕΚΤΕΘΕΙΜΕΝΗ ζώνη. Στο default (στάθμη στο FFL) το
  // `exposedHeightMm` ισούται με το `geometry.height` → **byte-for-byte** η προηγούμενη
  // επιμέτρηση επιχρισμάτων. Με ρητή στάθμη/τοπογραφικό, ο σοβάς κατεβαίνει ως το έδαφος.
  const finishGeometry = Math.abs(exposure.exposedHeightMm - geometry.height) > 1e-6
    ? { ...geometry, height: exposure.exposedHeightMm }
    : geometry;
  const plaster = computeColumnFinishContribution(entity, finishGeometry, scene);

  // ADR-713 — η ΘΑΜΜΕΝΗ ζώνη στεγανώνεται (m², δικό της άρθρο). Μπαίνει ως ακόμη ένα bucket
  // στο ΙΔΙΟ group-by-material contribution: το `structural-finish-boq` παράγει ήδη ένα child
  // row ανά distinct υλικό και λύνει το άρθρο από το `resolveMaterialAtoeMapping` — μηδέν
  // νέος BOQ μηχανισμός, μηδέν δεύτερη διαδρομή που θα μπορούσε να ξεσυγχρονιστεί.
  const waterproofing = buriedWaterproofingBuckets(
    entity, geometry.footprint.vertices, exposure.buriedHeightMm,
  );
  const byMaterial = [...(plaster?.byMaterial ?? []), ...waterproofing];
  const finishContribution = byMaterial.length > 0 ? { byMaterial } : undefined;

  // ADR-712 — gross/net split κατά IFC. **Αμετάβλητο από το ADR-713**: το όριο όγκου μένει
  // η άνω παρειά του πεδίλου, ό,τι κι αν κάνει η στάθμη εδάφους.
  const stub = computeColumnFoundationStub(geometry.volume, geometry.area, baseDropMm);
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>,
    geometry,
    ...(finishContribution ? { finishContribution } : {}),
    ...(hasFoundationStub(stub) ? { foundationStub: stub } : {}),
  };
}
