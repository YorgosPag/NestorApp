/**
 * ADR-449 §opening-bands — Ο σοβάς τοίχου **ΣΕΒΕΤΑΙ τα ανοίγματα** (κουφώματα).
 *
 * **Πρόβλημα (Giorgio 2026-07-17, screenshots):** με τον διακόπτη «Σοβάς» ενεργό ο σοβάς γινόταν
 * ενιαία αδιάσπαστη επιφάνεια και **σκέπαζε τα παράθυρα/πόρτες**. Αιτία: όταν ο τοίχος έγινε
 * `SilhouetteMember` (Slice X4), το `wallToSilhouetteMember` έπαιρνε το **πλήρες** footprint
 * (`wallFootprintPolygon`) — η αλυσίδα του σοβά **δεν δεχόταν openings πουθενά**. Δεν ήταν επιλογή,
 * ήταν παράλειψη: **κάθε άλλο** wall path τα σέβεται — ο πυρήνας (`computeWallOpeningPieces`) και το
 * θερμικό κέλυφος ETICS (ADR-396, «η μόνωση δεν σκεπάζει κουφώματα»). Ο σοβάς ήταν ο μόνος που όχι.
 *
 * **Λύση (μηδέν αλλαγή στη core engine):** ο `computeStructuralSilhouetteBands` σπάει ΗΔΗ το ύψος σε
 * z-bands από τα `zBotMm`/`zTopMm` **των members** (`bandBreakpoints`), και το δοκάρι παράγει ΗΔΗ
 * **πολλαπλά** members (ένα ανά ορατό κομμάτι, ADR-458 §diagonal-corner-seat). Άρα αρκεί ο τοίχος να
 * επιστρέφει **N members αντί για 1**: ένα ανά z-band, με το footprint **τρυπημένο** μόνο στα bands
 * που τέμνει άνοιγμα. Τα sill/header γίνονται z-breakpoints **αυτόματα**.
 *
 * **Οι λαμπάδες (παρειές ανοίγματος) βγαίνουν δωρεάν** (Giorgio: «τύλιξε τη λαμπάδα», Revit-grade):
 * μετά την αφαίρεση, οι jamb ακμές ανήκουν στο ring → ο `resolveStructuralFinishFaces` τους δίνει
 * faces όπως σε κάθε άλλη εκτεθειμένη ακμή. Μηδέν κώδικας γι' αυτές.
 *
 * **FULL SSoT reuse — μηδέν νέο math, μηδέν νέο boolean:**
 *   - `structuralRevealHeightRangeMm` (ADR-396) → z-range ανοίγματος· **ΤΟ ΙΔΙΟ** που ορίζει το κενό
 *     του πυρήνα ⇒ ο σοβάς κόβεται ακριβώς εκεί που λείπει μπετόν, εξ ορισμού.
 *   - `revealOutline ?? outline` → plan footprint· **ΤΟ ΙΔΙΟ** SSoT/precedence με τον πυρήνα
 *     (`wall-opening-pieces.ts`) ⇒ ίδιο κενό σε plan.
 *   - `computeMemberCutbackOutline` (ADR-458) → «outline μείον footprints → rings». Το ερώτημα είναι
 *     **ταυτόσημο** με το cutback (μόνο η σημασιολογία του cutter αλλάζει: άνοιγμα αντί για κολόνα),
 *     και φέρνει δωρεάν bbox-reject + `null`=identity fast-path + area-eps sliver-reject.
 *
 * Pure: μηδέν globals/React/THREE/scene. Το `wallId` filtering + visibility γίνονται στους callers
 * (εκεί ζει το ctx) — εδώ φτάνουν ήδη-φιλτραρισμένα τα ανοίγματα ΤΟΥ τοίχου.
 *
 * @see ./wall-finish-source.ts — ο μοναδικός consumer (`wallToSilhouetteMembers`)
 * @see ../geometry/wall-opening-pieces.ts — ο πυρήνας (ίδιο κενό, άλλη τεχνική: vertical split)
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §opening-bands
 */

import type { OpeningParams } from '../types/opening-types';
import { structuralRevealHeightRangeMm } from '../geometry/opening-geometry';
import { computeMemberCutbackOutline } from '../geometry/member-column-cutback';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import type { SilhouetteMember } from './structural-finish-silhouette';

/**
 * ADR-449 §opening-bands — minimal source interface ώστε η ΙΔΙΑ SSoT να τροφοδοτείται ΚΑΙ από το 3Δ
 * (`OpeningEntity`) ΚΑΙ από το 2Δ (`DxfOpening`) **χωρίς cast** — ίδιο pattern με τα
 * `SilhouetteColumnSource`/`SilhouetteBeamSource`.
 */
export interface SilhouetteOpeningSource {
  readonly params: Pick<OpeningParams, 'sillHeight' | 'height' | 'revealInsulation'>;
  readonly geometry?: {
    readonly outline?: { readonly vertices?: readonly { readonly x: number; readonly y: number }[] };
    /** ADR-396 — διευρυμένο outline όταν υπάρχει reveal μόνωση· υπερισχύει (mirror του πυρήνα). */
    readonly revealOutline?: { readonly vertices?: readonly { readonly x: number; readonly y: number }[] };
  };
}

/** Ελάχιστο ύψος ζώνης (mm) — φιλτράρει εκφυλισμένα z-breakpoints (mirror `structural-finish-silhouette`). */
const MIN_BAND_MM = 1e-3;

/** Ένα άνοιγμα ως cutter: plan footprint + το **building-relative** z-εύρος που τρυπά. */
interface OpeningCut {
  readonly footprint: readonly Pt2[];
  readonly zBotMm: number;
  readonly zTopMm: number;
}

/**
 * Άνοιγμα → cutter (building-relative z), ή `null` όταν δεν τρυπά τίποτα ορατό (εκφυλισμένο outline /
 * μηδενικό ή εκτός-τοίχου z-εύρος). Το `structuralRevealHeightRangeMm` δίνει **wall-base-relative** mm
 * → προσθέτουμε το `wallZBotMm` και clamp-άρουμε στο εύρος του τοίχου.
 */
function toOpeningCut(
  op: SilhouetteOpeningSource,
  wallZBotMm: number,
  wallZTopMm: number,
): OpeningCut | null {
  const verts = (op.geometry?.revealOutline ?? op.geometry?.outline)?.vertices;
  if (!verts || verts.length < 3) return null;
  const { bottomMm, topMm } = structuralRevealHeightRangeMm(op.params);
  const zBotMm = Math.max(wallZBotMm, wallZBotMm + bottomMm);
  const zTopMm = Math.min(wallZTopMm, wallZBotMm + topMm);
  if (zTopMm - zBotMm <= MIN_BAND_MM) return null;
  return { footprint: verts.map((v) => ({ x: v.x, y: v.y })), zBotMm, zTopMm };
}

/**
 * Το footprint ενός τοίχου + τα ανοίγματά του → `SilhouetteMember[]`: ένα member ανά z-band, με το
 * footprint τρυπημένο μόνο εκεί που περνά άνοιγμα.
 *
 * - **Χωρίς ανοίγματα** (ή κανένα ουσιαστικό) → `[{ footprint: full, ...zExtent }]` = **ακριβώς** η
 *   προηγούμενη συμπεριφορά (byte-for-byte, μηδέν regression).
 * - Band χωρίς ενεργό άνοιγμα (ποδιά κάτω από παράθυρο, πρέκι πάνω) → πλήρες footprint.
 * - Band με ενεργά ανοίγματα → **ένα member ανά ring** που απομένει (τα δύο jambs εκατέρωθεν· ένα
 *   άνοιγμα που φτάνει σε άκρο τοίχου → ένα). Ο τοίχος καταναλώθηκε ολόκληρος (`[]`, π.χ. άνοιγμα
 *   όσο όλο το μήκος) → **κανένα member** σε αυτό το band = σωστά μηδέν σοβάς.
 *
 * @param full     Πλήρες δομικό footprint τοίχου (canvas units) — `wallFootprintPolygon`.
 * @param zExtent  Κατακόρυφο εύρος τοίχου (building-relative mm), από τον adapter (attached-top resolved).
 * @param openings Τα ανοίγματα **αυτού** του τοίχου (ήδη φιλτραρισμένα ανά `wallId` + visibility).
 */
export function splitFootprintByOpeningBands(
  full: readonly Pt2[],
  zExtent: { readonly zBotMm: number; readonly zTopMm: number },
  openings: readonly SilhouetteOpeningSource[] | undefined,
): SilhouetteMember[] {
  const whole: SilhouetteMember[] = [{ footprint: full, zBotMm: zExtent.zBotMm, zTopMm: zExtent.zTopMm }];
  if (!openings?.length) return whole;

  const cuts: OpeningCut[] = [];
  for (const op of openings) {
    const c = toOpeningCut(op, zExtent.zBotMm, zExtent.zTopMm);
    if (c) cuts.push(c);
  }
  if (cuts.length === 0) return whole;

  // z-breakpoints: όρια τοίχου + κάθε sill/header. `Set` → τα τυπικά κοινά sill/header (900/2100)
  // συγχωνεύονται ⇒ λίγα bands ανεξαρτήτως πλήθους ανοιγμάτων.
  const zSet = new Set<number>([zExtent.zBotMm, zExtent.zTopMm]);
  for (const c of cuts) {
    zSet.add(c.zBotMm);
    zSet.add(c.zTopMm);
  }
  const breaks = [...zSet].sort((a, b) => a - b);

  const out: SilhouetteMember[] = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const zBotMm = breaks[i];
    const zTopMm = breaks[i + 1];
    if (zTopMm - zBotMm <= MIN_BAND_MM) continue;
    const mid = (zBotMm + zTopMm) / 2;
    const active = cuts.filter((c) => c.zBotMm <= mid && mid < c.zTopMm).map((c) => c.footprint);
    if (active.length === 0) {
      out.push({ footprint: full, zBotMm, zTopMm });
      continue;
    }
    const pieces = computeMemberCutbackOutline(full, active);
    // `null` = καμία ουσιαστική τομή (π.χ. άνοιγμα εκτός footprint) → πλήρες, αυτούσιο.
    if (pieces === null) {
      out.push({ footprint: full, zBotMm, zTopMm });
      continue;
    }
    for (const ring of pieces) out.push({ footprint: ring, zBotMm, zTopMm });
  }
  return out;
}
