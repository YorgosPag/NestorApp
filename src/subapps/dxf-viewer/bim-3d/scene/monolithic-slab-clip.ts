/**
 * ADR-534 §monolithic-cut — Render-time **top-clip** δοκαριών/κολόνων στο **soffit** της καλύπτουσας
 * πλάκας οροφής (μονολιθική πλακοδοκός / Revit «Join Geometry»).
 *
 * **Πρόβλημα:** η ενιαία πλάκα οροφής φτάνει στην εξωτερική παρειά και καλύπτει δοκάρια+κολόνες (σωστό —
 * η πλάκα είναι το θλιβόμενο πέλμα του T-beam). Αλλά στο 3D τα στερεά **επικαλύπτονται** στην πάνω ζώνη
 * (`beam top == slab top == 3000mm`) → **z-fighting** (τρεμοπαίζουν τα χρώματα).
 *
 * **Λύση (μόνο render):** το ορατό 3D στερεό δοκαριού/κολόνας **κόβεται στο κάτω πέλμα (soffit) της πλάκας**
 * = `levelElevation − thickness`. Η πλάκα καπακώνει καθαρά πάνω, κρέμεται το downstand κάτω, μηδέν z-fighting.
 * **Το δομικό ύψος ΜΕΝΕΙ** (T-beam· καμία αλλαγή σε `depth`/`topElevation`/persist).
 *
 * **FULL SSoT reuse:** `slabHostInput` (→ `undersideZmm = soffit`) + `hostUndersideAt` (point-in-slab → soffit)
 * — οι ΙΔΙΕΣ συναρτήσεις που κόβουν ΗΔΗ τις attached κολόνες στο `resolveColumnTopProfile`. Μηδέν νέο math.
 *
 * @see ../../bim/geometry/wall-host-plan-builder.ts — slabHostInput (HostFootprintInput SSoT)
 * @see ../../bim/geometry/host-footprint-eval.ts — hostUndersideAt (point-in-footprint → soffit)
 * @see ./BimSceneLayer.ts — consumer (syncBeams/syncColumns)
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md §monolithic-cut
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity } from '../../bim/types/slab-types';
import { slabHostInput, type HostFootprintInput } from '../../bim/geometry/wall-host-plan-builder';
import { hostUndersideAt, hostTopsideAt, HOST_Z_EPS } from '../../bim/geometry/host-footprint-eval';
import { polygon2DCentroid } from '../../bim/geometry/shared/polygon-utils';

/** Πλάκες **πάνω** από τον όροφο (καλύπτουν δοκάρια/κολόνες). `ground`/`foundation` (κάτω) εξαιρούνται. */
const ABOVE_SLAB_KINDS: ReadonlySet<string> = new Set(['ceiling', 'floor', 'roof']);

/** Host inputs (soffit Z + footprint) των πλακών που μπορούν να καλύψουν δομικά μέλη. Reuse `slabHostInput`. */
export function buildCeilingSlabHosts(slabs: readonly SlabEntity[]): HostFootprintInput[] {
  return slabs.filter((s) => ABOVE_SLAB_KINDS.has(s.params.kind)).map(slabHostInput);
}

/**
 * Effective **render top** (απόλυτο mm, ίδιο datum με `topElevation`/`levelElevation`) ενός δομικού μέλους:
 * `max(bottom, min(ownTop, soffit κάθε καλύπτουσας πλάκας))`. Sample points = centroid + κορυφές του
 * footprint· αν κάποιο πέφτει μέσα σε πλάκα, το μέλος κόβεται στο soffit της. Καμία κάλυψη → `ownTop` (no-op).
 *
 * **«Καλύπτουσα» = η ΑΝΩ παρειά της πλάκας είναι πάνω από τη βάση του μέλους** (`topside > bottom`).
 * Το `ABOVE_SLAB_KINDS` φιλτράρει *είδη* (`ground`/`foundation` έξω), ΟΧΙ *θέσεις*: η πλάκα-**δάπεδο**
 * (`kind:'floor'`) του ΙΔΙΟΥ ορόφου περνά το φίλτρο ειδών, το footprint της περιέχει την κολόνα που πατά
 * πάνω της, και το soffit της είναι **κάτω** από τη βάση της → χωρίς αυτόν τον έλεγχο κέρδιζε το `min()`
 * και το `max(bottom, …)` το ισοπέδωνε σε `bottom` → **ύψος 0 → αόρατη κολόνα** ανάμεσα σε 2 πλάκες
 * (οι pilotis επιβίωναν μόνο επειδή το `foundation` από κάτω τους είναι ήδη εξαιρεμένο).
 * Πλάκα που **περιβάλλει** το μέλος (χοντρή πλάκα, `topside > bottom > soffit`) παραμένει καλύπτουσα →
 * clip σε `bottom` = θαμμένο μέλος (Revit «Join Geometry»: η πλάκα νικά).
 *
 * @param footprint  Plan footprint του μέλους (scene units, ίδιο space με τα slab footprints).
 * @param ownTopZmm  Η nominal κορυφή του μέλους (absolute mm).
 * @param bottomZmm  Η κάτω παρειά (absolute mm) — clamp ώστε να μη γίνει αρνητικό ύψος.
 * @param hosts      Από `buildCeilingSlabHosts`.
 */
export function resolveMemberTopClipZmm(
  footprint: readonly Point2D[],
  ownTopZmm: number,
  bottomZmm: number,
  hosts: readonly HostFootprintInput[],
): number {
  if (hosts.length === 0 || footprint.length < 3) return ownTopZmm;
  const samples: Point2D[] = [polygon2DCentroid(footprint), ...footprint];
  let clip = ownTopZmm;
  for (const h of hosts) {
    for (const pt of samples) {
      const soffit = hostUndersideAt(h, pt);
      if (soffit === null || soffit >= clip) continue;
      // Πλάκα ολόκληρη κάτω από τη βάση (δάπεδο του ίδιου ορόφου) → στηρίζει, δεν καλύπτει.
      // `null` topside (host χωρίς άνω παρειά, π.χ. στέγη) → legacy: θεωρείται καλύπτουσα.
      const topside = hostTopsideAt(h, pt);
      if (topside !== null && topside <= bottomZmm + HOST_Z_EPS) continue;
      clip = soffit;
    }
  }
  return Math.max(bottomZmm, clip);
}
