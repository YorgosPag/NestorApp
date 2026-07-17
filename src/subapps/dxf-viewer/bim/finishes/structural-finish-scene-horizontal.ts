/**
 * ADR-449 Slice 11 — Horizontal Structural Finish scene adapter.
 *
 * Γέφυρα ανάμεσα στον pure `structural-finish-horizontal` και τη σκηνή: συγκεντρώνει
 * τα **cover footprints** (πλάκες/δοκάρια από πάνω, τοίχοι από κάτω) στη σωστή στάθμη
 * z και παράγει τις εκτεθειμένες οριζόντιες όψεις σοβά ανά δομικό στοιχείο:
 *   - **Κολόνα**: top cap (z = κορυφή· κάλυψη = πλάκα/δοκάρι από πάνω) + base cap
 *     **μόνο** όταν `baseBinding === 'absolute'` (pilotis/στον αέρα· κάλυψη = πλάκα/
 *     πέδιλο από κάτω). `storey-floor`/`attached` βάση = κάθεται σε στάθμη/θεμέλιο → ΠΟΤΕ σοβάς.
 *   - **Δοκάρι**: top (κάλυψη = πλάκα από πάνω) + soffit (κάλυψη = τοίχος από κάτω).
 *
 * Coverage = **ΓΕΩΜΕΤΡΙΚΗ** (vertical span φτάνει το επίπεδο + plan overlap)· η αφαίρεση
 * γίνεται στον pure builder (`safeDifference`) → associative, partial-aware. z's είναι
 * **building-relative mm** (ίδια σύμβαση με τη silhouette· ο 3Δ builder προσθέτει
 * `buildingBaseElevationM`). Reuse: `wallFootprintPolygon` + attached-top wall resolution
 * (Slice 8b) → ένας τοίχος-στήριγμα έχει κορυφή = κάτω παρειά δοκαριού (= το soffit του).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { ColumnParams } from '../types/column-types';
import type { BeamParams } from '../types/beam-types';
import type { SlabParams } from '../types/slab-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { isFinishActive, createDefaultStructuralFinishSpec, type StructuralFinishSpec } from './structural-finish-types';
import {
  computeHorizontalFinishFace,
  mergeCoresToFinishedRings,
  type HorizontalFinishFace,
  type HorizontalFaceDirection,
} from './structural-finish-horizontal';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { wallFootprintPolygon, type WallFinishObstacle } from './structural-finish-scene';
import { wallIsFinishMember, wallFinishZExtent } from './wall-finish-source';
import { slabFinishZExtent, slabIsFinishMember } from './slab-finish-source';
import {
  bboxOf,
  coversAtPlane,
  beamZExtent,
  toPlanObstacle,
  coresOf,
  finishedObstacleOf,
  plasterEnvelope,
  dilatedCover,
  type ZExtent,
  type Bbox,
  type PlanObstacle,
} from './structural-finish-horizontal-obstacles';
import { beamFinishOutline, type BeamFinishOutlineSource, type ColumnVerticalExtentLookup } from './structural-finish-scene-silhouette';

const MM_TO_M = 0.001;
/** Ανοχή (mm) κατακόρυφης εγγύτητας στο επίπεδο μιας οριζόντιας όψης. */
const PLANE_TOL_MM = 1;

// ─── Minimal sources (BIM + Dxf entity· μηδέν cast) ─────────────────────────────

export interface HorizontalColumnSource {
  /** ADR-449 — id για lookup του pre-resolved (storey-aware) zExtent. Προαιρετικό: tests το παραλείπουν → legacy `params.height`. */
  readonly id?: string;
  readonly params: Pick<
    ColumnParams,
    'finish' | 'sceneUnits' | 'baseOffset' | 'height' | 'baseBinding' | 'envelopeFunction'
  >;
  readonly geometry?: { readonly footprint?: { readonly vertices?: readonly { x: number; y: number }[] } };
}

/**
 * N.0.2 boy-scout (2026-07-17): το `geometry` shape ήταν **αυτολεξεί διπλό** με το
 * {@link BeamFinishOutlineSource} — το ΙΔΙΟ primitive (`beamFinishOutline`) το διαβάζει ΚΑΙ εδώ
 * (merged top-cap) ΚΑΙ στον κάθετο silhouette. Τώρα το λέει ο τύπος (`extends`) αντί να το
 * επαναλαμβάνει — ίδια θεραπεία με το {@link SilhouetteBeamSource}.
 */
export interface HorizontalBeamSource extends BeamFinishOutlineSource {
  readonly params: Pick<
    BeamParams,
    'finish' | 'sceneUnits' | 'topElevation' | 'zOffset' | 'depth' | 'envelopeFunction' | 'startPoint' | 'endPoint'
  >;
}

export interface HorizontalSlabObstacle {
  /**
   * ADR-534 Φ5 Απόφαση Δ — id για self-exclusion ανά επίπεδο. Προαιρετικό: callers/tests που
   * περνούν την πλάκα **μόνο ως εμπόδιο** το παραλείπουν (δεν είναι ποτέ member → καμία
   * self-exclusion). **Απαραίτητο** για να γίνει η πλάκα finish-member (βλ. {@link slabObstacleMember}).
   */
  readonly id?: string;
  readonly params: Pick<SlabParams, 'outline' | 'levelElevation' | 'heightOffsetFromLevel' | 'thickness'> &
    // ADR-534 Φ5 — finish-member fields· optional ώστε ένα σκέτο εμπόδιο (χωρίς kind/finish) να
    // μένει έγκυρο (pure-obstacle role, byte-for-byte η προ-Φ5 συμπεριφορά).
    Partial<Pick<SlabParams, 'kind' | 'finish' | 'dna'>>;
}

/** Δοκάρι ως οριζόντιο εμπόδιο (πάνω από κολόνα). */
export interface HorizontalBeamObstacle {
  readonly id: string;
  readonly params: Pick<BeamParams, 'topElevation' | 'zOffset' | 'depth'>;
  readonly geometry?: { readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] } };
}

interface HorizontalFinishInput {
  readonly columns: readonly HorizontalColumnSource[];
  readonly beams: readonly HorizontalBeamSource[];
  readonly walls: readonly WallFinishObstacle[];
  readonly slabs: readonly HorizontalSlabObstacle[];
  /** Δοκάρια ως οριζόντια εμπόδια καπακιού κολόνας (συνήθως === beams). */
  readonly beamObstacles: readonly HorizontalBeamObstacle[];
  readonly floorElevationMm: number;
  /** ADR-449 — pre-resolved (storey-aware) zExtents κολώνας ανά id, ΙΔΙΑ SSoT με τον πυρήνα. */
  readonly columnExtents?: ColumnVerticalExtentLookup;
  /**
   * ADR-534 Φ3c-B3b (τοίχοι) — pre-resolved soffit top-clip ανά τοίχο (building-relative mm), ΙΔΙΟ
   * map με τον κάθετο silhouette. Μετακινεί το **επίπεδο** του top-cap από το nominal top στο soffit
   * → το καπάκι κάθεται πάνω στον κομμένο σοβά αντί να αιωρείται μέσα/πάνω από την πλάκα. Absent →
   * πλήρες ύψος (byte-for-byte).
   */
  readonly wallTopClipById?: ReadonlyMap<string, number>;
}

/**
 * N.0.2 boy-scout (2026-07-17) — SSoT κλίμακας μιας δομικής ομάδας: `sceneUnits` με fallback σε
 * τοίχο (ADR-449 X4/E: όροφος με ΜΟΝΟ τοίχους· mirror X3.1 silhouette fix) → scale + unitToMeters.
 * Ήταν αυτολεξεί διπλό σε `computeStructuralHorizontalFinishFaces` + `computeMergedStructuralTopCap`.
 */
function finishUnitsOf(input: HorizontalFinishInput): { s: number; unitToMeters: number } {
  const sceneUnits =
    input.columns[0]?.params.sceneUnits ?? input.beams[0]?.params.sceneUnits ?? input.walls[0]?.params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(sceneUnits);
  return { s, unitToMeters: (1 / s) * MM_TO_M };
}

/**
 * N.0.2 boy-scout (2026-07-17) — SSoT των εμποδίων **γνήσιας κάλυψης άνωθεν**: πλάκες + δοκάρια ως
 * `PlanObstacle[]` (footprint + z-span). Ήταν αυτολεξεί διπλό στις δύο δημόσιες συναρτήσεις του
 * module. Εκφυλισμένο outline δοκαριού → παραλείπεται.
 */
function buildCoverObstacles(input: HorizontalFinishInput): { slabObs: PlanObstacle[]; beamObs: PlanObstacle[] } {
  // ADR-534 Φ5 — τα slab obstacles φέρουν `id` ώστε ένα finish-member slab να εξαιρείται από
  // τα δικά του εμπόδια (self-exclusion ανά επίπεδο, Απόφαση Δ).
  const slabObs = input.slabs.map((sl) => ({
    ...toPlanObstacle(sl.params.outline.vertices, slabFinishZExtent(sl.params)),
    ...(sl.id !== undefined ? { id: sl.id } : {}),
  }));
  const beamObs = input.beamObstacles
    .map((b) => (coresOf(b.geometry?.outline?.vertices) ? toPlanObstacle(b.geometry!.outline!.vertices!, beamZExtent(b.params)) : null))
    .filter((o): o is PlanObstacle => o !== null);
  return { slabObs, beamObs };
}

/**
 * ADR-534 Φ5 — «η πλάκα-εμπόδιο είναι finish-member;» adapter. Απαιτεί id (για self-exclusion)
 * + kind (για το gate). Γεφυρώνει το optional shape του {@link HorizontalSlabObstacle} με το
 * αυστηρό {@link slabIsFinishMember} χωρίς να αδυνατίζει τον τύπο του predicate.
 */
function slabObstacleMember(sl: HorizontalSlabObstacle): boolean {
  if (sl.id === undefined || sl.params.kind === undefined) return false;
  return slabIsFinishMember({ params: { kind: sl.params.kind, finish: sl.params.finish, dna: sl.params.dna } });
}

/** envelopeFunction → classification (exterior μόνο όταν ρητά εξωτερική όψη). */
function classifyHorizontal(envelopeFunction: string | undefined): 'interior' | 'exterior' {
  return envelopeFunction === 'exterior' ? 'exterior' : 'interior';
}

/** Εκτεθειμένες οριζόντιες όψεις, χωρισμένες ανά τύπο (για σωστό 3Δ tag/edges). */
export interface StructuralHorizontalFinishFaces {
  readonly columnFaces: readonly HorizontalFinishFace[];
  readonly beamFaces: readonly HorizontalFinishFace[];
  /** ADR-449 Slice X4/E — top-cap **ελεύθερης κορυφής** τοίχου (χωρίς πλάκα/δοκάρι από πάνω). */
  readonly wallFaces: readonly HorizontalFinishFace[];
  /**
   * ADR-534 Φ5 — **soffit** (κάτω παρειά, `down`) των finish-member πλακών. Η κάτω παρειά είναι
   * η οροφή του από-κάτω χώρου → η κύρια εκτεθειμένη επιφάνεια σοβά της πλάκας. Η **πάνω** παρειά
   * (`up`) πάει στο ενιαίο {@link computeMergedStructuralTopCap} (mirror τοίχου/κολόνας/δοκαριού).
   */
  readonly slabFaces: readonly HorizontalFinishFace[];
}

/**
 * SSoT: δομικά μέλη + γείτονες → εκτεθειμένες ΟΡΙΖΟΝΤΙΕΣ όψεις σοβά (κολόνα top/base,
 * δοκάρι top/soffit), building-relative z, χωρισμένες ανά τύπο. Κενά arrays όταν τίποτα εκτεθειμένο.
 *
 * Κάθε όψη χτίζεται στο **finished outline** του μέλους: offset προς τα έξω ΜΟΝΟ στις
 * εκτεθειμένες ακμές (ίδια γεωμετρία με τον κάθετο σοβά). Οι **δομικοί γείτονες** (κολόνα↔
 * δοκάρι) περνούν ως **plaster-envelope obstacles** στον resolver (interval-based κοπή ακμής)
 * → ο σοβάς σταματά flush στο πρόσωπο του σοβά του γείτονα **ΧΩΡΙΣ boolean difference** (που
 * παρήγαγε διαγώνιες slivers στις flush/coincident συμβολές). Boolean (`safeDifference`) μένει
 * ΜΟΝΟ για **γνήσια** οριζόντια κάλυψη (πλάκα από πάνω / τοίχος από κάτω — πραγματικό overlap).
 */
export function computeStructuralHorizontalFinishFaces(input: HorizontalFinishInput): StructuralHorizontalFinishFaces {
  const { columns, beams, walls, beamObstacles, floorElevationMm, columnExtents, wallTopClipById } = input;
  const { s, unitToMeters } = finishUnitsOf(input);
  const tol = PLANE_TOL_MM;

  const wallFps = walls.map((w) => wallFootprintPolygon(w));
  const columnCores = columns.map((c) => coresOf(c.geometry?.footprint?.vertices));
  const beamCores = beams.map((b) => coresOf(b.geometry?.outline?.vertices));
  // Plaster envelopes (dilated cores) — lateral obstacles ώστε ο resolver να κόβει την ακμή
  // στο πρόσωπο του σοβά του γείτονα (interval-based, μηδέν sliver).
  const columnEnvelopes = columns
    .map((c, i) => plasterEnvelope(columnCores[i], c.params.finish, s))
    .filter((e): e is Pt2[] => e !== null && e.length >= 3);
  const beamEnvelopes = beams
    .map((b, j) => plasterEnvelope(beamCores[j], b.params.finish, s))
    .filter((e): e is Pt2[] => e !== null && e.length >= 3);

  // z-εμπόδια ΓΝΗΣΙΑΣ κάλυψης. Τοίχοι: attached-top → resolved top = κάτω παρειά δοκαριού (Slice 8b).
  const beamUndersideById = new Map<string, number>();
  for (const b of beamObstacles) beamUndersideById.set(b.id, beamZExtent(b.params).zBotMm);
  // ADR-534 Φ3c-B3b — **ΧΩΡΙΣ** top-clip (σκόπιμα): εδώ ο τοίχος είναι το **δομικό σώμα** που
  // καλύπτει το soffit ενός δοκαριού από κάτω· το clip αφορά ΜΟΝΟ τον σοβά (render-only).
  const wallObs = walls.map((w) => toPlanObstacle(wallFootprintPolygon(w), wallFinishZExtent(w, beamUndersideById, floorElevationMm)));
  // ADR-449 Slice X4/E — τα δοκάρια είναι ΚΑΙ οριζόντια εμπόδια κάλυψης της κορυφής τοίχου (δοκάρι
  // από πάνω → η κορυφή καλύπτεται → κανένα top-cap). Ίδιο SSoT με το merged cap.
  const { slabObs, beamObs } = buildCoverObstacles(input);

  // Finished outline: lateral obstacles = plaster envelopes του ΑΛΛΟΥ δομικού τύπου + τοίχοι.
  const columnFinished = columns.map((c, i) =>
    finishedObstacleOf(columnCores[i], [...beamEnvelopes, ...wallFps], c.params.finish, s, columnZExtent(c, floorElevationMm, columnExtents)),
  );
  const beamFinished = beams.map((b, j) =>
    finishedObstacleOf(beamCores[j], [...columnEnvelopes, ...wallFps], b.params.finish, s, beamZExtent(b.params)),
  );

  // ADR-449 Slice X4/E — finished outlines τοίχων-finish-members (core + σοβάς skin), lateral
  // obstacles = δομικοί γείτονες (κολόνα/δοκάρι envelopes) ώστε το top-cap να σταματά flush.
  // ADR-534 Φ3c-B3b — το top-cap του ΙΔΙΟΥ του τοίχου = σοβάς → **ΜΕ** clip (το επίπεδο πέφτει στο soffit).
  const wallFinished = walls.map((w, i) =>
    wallIsFinishMember(w)
      ? finishedObstacleOf(
          coresOf(wallFps[i]),
          [...columnEnvelopes, ...beamEnvelopes],
          w.params.finish,
          s,
          wallFinishZExtent(w, beamUndersideById, floorElevationMm, wallTopClipById?.get(w.id)),
        )
      : null,
  );

  const columnFaces: HorizontalFinishFace[] = [];
  const beamFaces: HorizontalFinishFace[] = [];
  const wallFaces: HorizontalFinishFace[] = [];
  const slabFaces: HorizontalFinishFace[] = [];
  columns.forEach((c, i) => {
    const fin = columnFinished[i];
    if (fin) collectColumnFaces(c, fin, slabObs, unitToMeters, tol, columnFaces);
  });
  beams.forEach((b, j) => {
    const fin = beamFinished[j];
    if (fin) collectBeamFaces(b, fin, slabObs, wallObs, unitToMeters, tol, beamFaces);
  });
  walls.forEach((w, i) => {
    const fin = wallFinished[i];
    if (fin) collectWallFaces(w, fin, [...slabObs, ...beamObs], unitToMeters, tol, wallFaces);
  });
  // ADR-534 Φ5 — soffit (`down`) των finish-member πλακών. Κάλυψη από κάτω = τοίχοι/δοκάρια/άλλες
  // πλάκες που φτάνουν το soffit-plane (associative επαφές) ΕΞΑΙΡΟΥΜΕΝΗΣ της ίδιας (Απόφαση Δ).
  const slabSoffitCovers = [...wallObs, ...beamObs, ...slabObs];
  input.slabs.forEach((sl) => {
    if (!slabObstacleMember(sl)) return;
    collectSlabSoffitFace(sl, slabSoffitCovers, unitToMeters, tol, slabFaces);
  });
  return { columnFaces, beamFaces, wallFaces, slabFaces };
}

/**
 * ADR-449 §top-cap-coincidence (Giorgio 2026-07-01) — ΕΝΙΑΙΟ πάνω-καπάκι σοβά (`up`) όλης της
 * δομικής ομάδας από **union των ΠΥΡΗΝΩΝ + μία διαστολή** (mirror του κάθετου silhouette), ώστε
 * η ραφή τοίχου↔κολόνας↔δοκαριού στη συμβολή να ΜΗΝ είναι δοντωτή. Αντικαθιστά (για το render)
 * τα per-member `up` καπάκια των `computeStructuralHorizontalFinishFaces` (που offset-άρουν ανά
 * μέλος → ασυνεπείς γωνίες). Τα `down` καπάκια (soffit/βάση) μένουν per-member (καμία junction).
 *
 * Ένα face ανά (top-plane × disjoint κομμάτι). Γνήσια κάλυψη άνωθεν (πλάκα/δοκάρι) αφαιρείται
 * μέσω `computeHorizontalFinishFace` (associative). `classification:'interior'` — ενιαίο σοβά
 * κέλυφος (mirror silhouette). Κενό όταν κανένα μέλος με ενεργό σοβά.
 */
export function computeMergedStructuralTopCap(input: HorizontalFinishInput): HorizontalFinishFace[] {
  const { columns, beams, walls, floorElevationMm, columnExtents, wallTopClipById } = input;
  const spec = createDefaultStructuralFinishSpec();
  if (!isFinishActive(spec)) return [];
  const { s, unitToMeters } = finishUnitsOf(input);

  // Δομικά μέλη με ενεργό σοβά + το top-plane z τους (building-relative mm).
  const members: { core: Pt2[]; zTopMm: number }[] = [];
  // ADR-449/493 — footprints των finish-κολόνων· το δοκάρι που πλαισιώνεται στην παρειά τους
  // επεκτείνεται ΜΕΣΑ τους (μόνο για το union) ώστε το καπάκι να συγχωνευτεί σε ΕΝΑ (mirror silhouette).
  const columnFootprints: Pt2[][] = [];
  for (const c of columns) {
    const core = coresOf(c.geometry?.footprint?.vertices);
    if (core && isFinishActive(c.params.finish)) {
      members.push({ core, zTopMm: columnZExtent(c, floorElevationMm, columnExtents).zTopMm });
      columnFootprints.push(core);
    }
  }
  for (const b of beams) {
    if (!isFinishActive(b.params.finish)) continue;
    // ΟΡΑΤΟ ΣΩΜΑ δοκαριού (deep seat-fill + cutback + sliver-reject) → ένα core ανά κομμάτι· ίδιο
    // top-plane. ΙΔΙΟ SSoT `beamFinishOutline` με τον κάθετο silhouette (τυλίγει τη μύτη miter, μηδέν
    // poke στην εγκοπή). Καμία τομή → [raw] (μηδέν regression)· θαμμένο → [] (κανένα core).
    const zTopMm = beamZExtent(b.params).zTopMm;
    for (const ring of beamFinishOutline(b, columnFootprints)) {
      const core = coresOf(ring);
      if (core) members.push({ core, zTopMm });
    }
  }
  const emptyUnderside = new Map<string, number>();
  for (const w of walls) {
    if (!wallIsFinishMember(w)) continue;
    const core = coresOf(wallFootprintPolygon(w));
    // ADR-534 Φ3c-B3b — ΜΕ clip: το επίπεδο του ενιαίου καπακιού πέφτει στο soffit της καλύπτουσας
    // πλάκας, ώστε να κάθεται πάνω στον κομμένο κάθετο σοβά (ΕΝΑ z και για τα δύο). Χωρίς αυτό, ο
    // σοβάς κοβόταν στα 2800 και το καπάκι έμενε στα 3000 = οι «λεπτές λωρίδες» πάνω στην πλάκα.
    if (core) members.push({ core, zTopMm: wallFinishZExtent(w, emptyUnderside, floorElevationMm, wallTopClipById?.get(w.id)).zTopMm });
  }
  // ADR-534 Φ7 (Giorgio C4D 234109 «hup δεν χρειάζεται»): η **πάνω** όψη ΠΛΑΚΑΣ **ΔΕΝ** σοβατίζεται
  // — είναι δάπεδο (παίρνει δάπεδο/screed) ή δώμα/επόμενος όροφος (μόνωση), ΠΟΤΕ structural plaster.
  // Model-verified (proj_5a495bad): το `hup` ήταν αποκλειστικά οι πάνω όψεις δαπέδου (z=0) + οροφής
  // (z=3000)· οι τοίχοι καλύπτονται πλήρως από την ομώνυμη-περίμετρο πλάκα → σωστά σβήνουν. Έτσι οι
  // πλάκες συνεισφέρουν ΜΟΝΟ το soffit τους (`down` → `hslab`, η οροφή). Το Φ5 (slab-up στο merged
  // cap) αναιρείται σκόπιμα. Εκτεθειμένες κορυφές τοίχων/κολόνων/δοκαριών (parapet/pilotis) μένουν.
  if (members.length === 0) return [];

  // Covers ΓΝΗΣΙΑΣ κάλυψης άνωθεν (πλάκες/δοκάρια): κρύβουν το καπάκι όπου φτάνουν το επίπεδο.
  // ADR-534 Φ7b — το cap χτίζεται στο **finished** (διεσταλμένο) outline· διαστέλλουμε τους covers
  // κατά το ίδιο πάχος ώστε να καταπίνουν το περιμετρικό plaster frame (το «hup»). Βλ. dilatedCover.
  const { slabObs, beamObs } = buildCoverObstacles(input);
  const capMargin = spec.thickness * s;
  const slabCovers = slabObs.map((o) => dilatedCover(o, capMargin));
  const beamCovers = beamObs.map((o) => dilatedCover(o, capMargin));

  // Ομαδοποίηση ανά top-plane (μέλη ίδιου z ενώνονται σε ΕΝΑ ενιαίο silhouette).
  const byPlane = new Map<number, Pt2[][]>();
  const planeOf = new Map<number, number>();
  for (const m of members) {
    const key = Math.round(m.zTopMm * 1e3);
    const g = byPlane.get(key);
    if (g) g.push(m.core);
    else { byPlane.set(key, [m.core]); planeOf.set(key, m.zTopMm); }
  }

  const faces: HorizontalFinishFace[] = [];
  for (const [key, cores] of byPlane) {
    const planeZmm = planeOf.get(key) ?? 0;
    // ADR-449/493 — up-cap covers: πλάκες όπως πριν (top-στο-plane = γνήσια κάλυψη άνωθεν), αλλά
    // τα ΔΟΚΑΡΙΑ ΜΟΝΟ όταν εκτείνονται ΑΥΣΤΗΡΑ πάνω από το plane. Ένα δοκάρι με κορυφή ΣΤΟ ΙΔΙΟ
    // plane ΕΙΝΑΙ το ίδιο μέλος αυτού του καπακιού → δεν καλύπτει τον εαυτό του (αλλιώς αφαιρούσε
    // το footprint του → τρύπα «κανένα ενιαίο καπάκι πάνω στο δοκάρι», Giorgio 2026-07-02 screenshot
    // 100928). Δοκάρι ΠΑΝΩ από χαμηλότερη κολόνα (top-plane > cap) καλύπτει κανονικά (μηδέν regression).
    const beamCoversAbove = beamCovers.filter((o) => o.zTopMm > planeZmm + PLANE_TOL_MM);
    const covers = [...slabCovers, ...beamCoversAbove];
    for (const ring of mergeCoresToFinishedRings(cores, spec.thickness, s)) {
      const face = computeHorizontalFinishFace({
        coreFootprint: ring,
        coverFootprints: coversAtPlane(covers, planeZmm, bboxOf(ring), PLANE_TOL_MM),
        zMm: planeZmm, direction: 'up', spec, classification: 'interior', unitToMeters,
      });
      if (face) faces.push(face);
    }
  }
  return faces;
}

/**
 * Κατακόρυφη έκταση κολόνας (building-relative mm). ADR-449: pre-resolved extent
 * (ΙΔΙΑ SSoT με τον πυρήνα, storey-aware) όταν δίνεται· αλλιώς legacy `params.height`.
 */
function columnZExtent(c: HorizontalColumnSource, floorElevationMm: number, extents?: ColumnVerticalExtentLookup): ZExtent {
  const resolved = c.id ? extents?.get(c.id) : undefined;
  if (resolved) return resolved;
  const zBotMm = floorElevationMm + (c.params.baseOffset ?? 0);
  return { zBotMm, zTopMm: zBotMm + c.params.height };
}

/**
 * ADR-449 Slice 11 — **SSoT** emission ΜΙΑΣ οριζόντιας όψης σοβά σε επίπεδο `planeZmm`:
 * cover-subtracted (`coversAtPlane` + `computeHorizontalFinishFace`) → push αν εκτεθειμένη.
 * ΕΝΑ σημείο για όλα τα caps/soffits (κολόνα top/base, δοκάρι top/soffit, τοίχος top) — μηδέν
 * επανάληψη του `computeHorizontalFinishFace({...}) + if push` boilerplate ανά τύπο μέλους.
 */
function pushHorizontalCap(
  out: HorizontalFinishFace[],
  fin: PlanObstacle,
  covers: readonly PlanObstacle[],
  planeZmm: number,
  direction: HorizontalFaceDirection,
  spec: StructuralFinishSpec,
  classification: 'interior' | 'exterior',
  unitToMeters: number,
  tol: number,
): void {
  const face = computeHorizontalFinishFace({
    coreFootprint: fin.footprint,
    coverFootprints: coversAtPlane(covers, planeZmm, fin.bbox, tol),
    zMm: planeZmm, direction, spec, classification, unitToMeters,
  });
  if (face) out.push(face);
}

/** Top cap (πάντα candidate) + base cap (μόνο absolute base) μιας κολόνας. */
function collectColumnFaces(
  c: HorizontalColumnSource,
  fin: PlanObstacle,
  covers: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = c.params.finish;
  if (!isFinishActive(spec)) return;
  const cls = classifyHorizontal(c.params.envelopeFunction);
  pushHorizontalCap(out, fin, covers, fin.zTopMm, 'up', spec, cls, unitToMeters, tol);
  // Βάση: σοβατίζεται ΜΟΝΟ στον αέρα (pilotis = baseBinding 'absolute'). Κάλυψη = πλάκα/πέδιλο κάτω.
  if (c.params.baseBinding === 'absolute') {
    pushHorizontalCap(out, fin, covers, fin.zBotMm, 'down', spec, cls, unitToMeters, tol);
  }
}

/** Top (κάλυψη = πλάκα πάνω) + soffit (κάλυψη = τοίχος κάτω) ενός δοκαριού. */
function collectBeamFaces(
  b: HorizontalBeamSource,
  fin: PlanObstacle,
  slabCovers: readonly PlanObstacle[],
  wallCovers: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = b.params.finish;
  if (!isFinishActive(spec)) return;
  const cls = classifyHorizontal(b.params.envelopeFunction);
  pushHorizontalCap(out, fin, slabCovers, fin.zTopMm, 'up', spec, cls, unitToMeters, tol);
  pushHorizontalCap(out, fin, wallCovers, fin.zBotMm, 'down', spec, cls, unitToMeters, tol);
}

/**
 * ADR-449 Slice X4/E — top-cap **ελεύθερης κορυφής** τοίχου (Giorgio: ελεύθερος τοίχος →
 * σοβάς ΚΑΙ στην πάνω πλευρά). Κάλυψη = πλάκα/δοκάρι από πάνω → ο geometric resolver αφαιρεί
 * το καλυμμένο κομμάτι· πλήρως καλυμμένος → κανένα cap. Μόνο `up` (η βάση κάθεται σε στάθμη).
 */
function collectWallFaces(
  w: WallFinishObstacle,
  fin: PlanObstacle,
  covers: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = w.params.finish;
  if (!isFinishActive(spec)) return;
  const cls = classifyHorizontal(w.params.envelopeFunction);
  pushHorizontalCap(out, fin, covers, fin.zTopMm, 'up', spec, cls, unitToMeters, tol);
}

/**
 * ADR-534 Φ5 — soffit (`down`) μιας finish-member πλάκας: η κάτω παρειά (οροφή του από-κάτω
 * χώρου). Core = **ωμό** footprint της πλάκας (το περιμετρικό skin είναι Φ4, deferred → μηδέν
 * outward offset εδώ, ώστε το soffit να μην αιωρείται πέρα από την ακμή χωρίς περιμετρικό σοβά
 * να το υποδεχθεί). Κάλυψη = δομικά από κάτω που φτάνουν το soffit-plane, **ΕΞΑΙΡΟΥΜΕΝΗΣ της
 * ίδιας** (Απόφαση Δ: η πλάκα καλύπτει span-wise το δικό της soffit → θα έσβηνε τον εαυτό της).
 * Μόνο `down` — η κορυφή πάει στο ενιαίο merged top-cap.
 */
function collectSlabSoffitFace(
  sl: HorizontalSlabObstacle,
  covers: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = sl.params.finish;
  if (!isFinishActive(spec)) return;
  const fin = toPlanObstacle(sl.params.outline.vertices, slabFinishZExtent(sl.params));
  const selfCovers = covers.filter((o) => o.id !== sl.id);
  pushHorizontalCap(out, fin, selfCovers, fin.zBotMm, 'down', spec, 'interior', unitToMeters, tol);
}
