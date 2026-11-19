/**
 * @fileoverview **Η ΔΕΥΤΕΡΗ ΒΑΘΜΙΔΑ** — το ΔΙΚΟ μας αρχείο OSM, διαβασμένο από τον διακομιστή (HTTP Range).
 * @related ADR-777 · SPEC-777A §13.4 · §13.5 · §14.4 (κανόνας 2) · ADR-891 · ./osm-building-source (ο συνθέτης)
 * @module lib/geo/osm/osm-archive
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Ο ΔΗΜΟΣΙΟΣ OVERPASS ΔΕΝ ΕΙΝΑΙ ΥΠΟΔΟΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ζωντανά 2026-11-19: «Διάλεξε κτίριο» ⇒ `/api/places/lookup` **503 ×2**. Το `overpass-api.de/api/status` έλεγε κατά λέξη
 * ότι είναι *«at capacity»* και ότι για αυτοματοποιημένη χρήση πρέπει να τρέξεις δικό σου διακομιστή. Το OSM Wiki το
 * ίδιο: εμπορική χρήση ⇒ δικός σου ή επί πληρωμή. Το 503 ήταν **δομικό**, όχι κακοτυχία.
 *
 * 🔑 **Ήδη φιλοξενούμε δικό μας αντίγραφο του OSM**: το αρχείο Protomaps της Ελλάδας (ADR-891) που ζωγραφίζει **κάθε**
 *    χάρτη. Η στρώση `buildings` του κρατά κάθε κτίριο με την ταυτότητα OSM του (`protomaps-osm-identity`, μετρημένο).
 *    Εδώ ο διακομιστής διαβάζει **το ίδιο** αρχείο — όχι αντίγραφο του αντιγράφου — με αιτήματα εύρους, όπως ο χάρτης.
 *
 * 🏆 **Γιατί καλύτερο από ό,τι κάνουν οι μεγάλοι**: η απάντηση είναι **ντετερμινιστική και ελέγξιμη**. Ο τόπος γράφει
 *    «OSM, build {@link OSM_ARCHIVE_BUILD}» (`OsmReference.snapshot`), άρα κάθε επαλήθευση **αναπαράγεται** αργότερα. Ο
 *    Overpass απαντά «ό,τι ισχύει τώρα» — χρήσιμο για **φρεσκάδα**, και γι' αυτό μένει τρίτη βαθμίδα, όχι πρώτη.
 *
 * ⚖️ **ODbL (§13.4)**: καμία νέα υποχρέωση — τα πλακίδια ήδη τα διανέμουμε δημόσια, και κάθε ανάγνωση αντιστοιχεί σε
 *    **μία** ανθρώπινη χειρονομία: ένα πλακίδιο + όσοι γείτονες χρειάζονται για **ένα** κτίριο. ⛔ Καμία σάρωση, καμία
 *    προθέρμανση, καμία μνήμη περιγραμμάτων. Η μόνη μνήμη είναι του `PMTiles` (κεφαλίδα + κατάλογος του αρχείου).
 *
 * 📏 **ΜΕΤΡΗΜΕΝΟ (2026-11-19, Θέρμη, πλακίδιο z15 18479/12338 — 354 θραύσματα, 37 ξεχειλίζουν)**:
 *    - εύρεση στο (40.5609, 23.0213) ⇒ way **980875811** σε **412 ms κρύο** (κεφαλίδα + κατάλογος + πλακίδιο)· το OSM API
 *      επιβεβαιώνει `building=yes`. Την ίδια ώρα **και τα δύο** endpoints του Overpass έληγαν σε timeout.
 *    - ραφή: way 978287779 — θραύσμα 4,9 m² ⇒ ραμμένο **266,0 m²** · Overpass **264,5 m²** (απόκλιση 0,6 % = κβάντιση).
 *    - 🔶 η γεωμετρία του z15 είναι **ελαφρά απλοποιημένη** (980875811: 5 κορυφές στο OSM ⇒ 4 στο πλακίδιο). Για ταυτότητα,
 *      περιεκτικότητα και εμφάνιση αρκεί· **δεν** είναι επιμετρητική γεωμετρία — και δεν αποθηκεύεται ούτως ή άλλως.
 *
 * ⚠️ **`absent` εδώ σημαίνει «όχι σε ΑΥΤΟ το build, ΚΟΝΤΑ στο σημείο»**, ποτέ «δεν υπάρχει στο OSM»: το κτίριο μπορεί να
 *    χαρτογραφήθηκε μετά το build. Γι' αυτό ο συνθέτης ρωτά τότε τον Overpass — η φρεσκάδα είναι **δική του** δουλειά.
 *
 * **Layering**: server-only — δίκτυο προς το δικό μας αρχείο. Καμία εξάρτηση από Firestore/React.
 */

import 'server-only';

import { PMTiles } from 'pmtiles';

import { createDeadline, type Deadline } from '@/lib/async-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { BASEMAP_ARCHIVE_BUILD, BASEMAP_BUNDLE_ORIGIN, BASEMAP_BUNDLE_PATHS } from '@/lib/maps/basemap-catalog';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoPoint } from '@/types/geo/coordinates';

import { assembleArchiveBuilding, fragmentContains, fragmentsById, type ArchiveBuilding } from './osm-archive-building';
import {
  archiveTileOf,
  decodeBuildingFragments,
  neighbourTilesFor,
  type ArchiveTileAddress,
  type BuildingFragment,
} from './osm-archive-tile';
import { tileFeatureIdOfOsmWay } from './protomaps-osm-identity';

const logger = createModuleLogger('osm-archive');

/** Το build του αρχείου που διαβάζεται — **το ίδιο** με τον χάρτη (ένα SSoT: `basemap-catalog`). */
export const OSM_ARCHIVE_BUILD = BASEMAP_ARCHIVE_BUILD;

/** Το αρχείο, από τον κατάλογο υποβάθρων — καμία δεύτερη διαδρομή (CHECK 3.95). */
const ARCHIVE_URL = `${BASEMAP_BUNDLE_ORIGIN}/${BASEMAP_BUNDLE_PATHS.archive}`;

/**
 * Πόσο περιμένουμε το αρχείο όταν ο καλών δεν δίνει προθεσμία. Είναι **δικός μας** διακομιστής στατικών αρχείων:
 * ένα πλακίδιο z15 έρχεται σε δεκάδες ms — 4 s σημαίνει ήδη «κάτι δεν πάει καλά», όχι «περίμενε κι άλλο».
 */
const DEFAULT_ARCHIVE_BUDGET_MS = 4_000;

/** Ένα στιγμιότυπο ανά διεργασία: κρατά κεφαλίδα + κατάλογο, ώστε κάθε πλακίδιο να είναι **ένα** αίτημα εύρους. */
let archive: PMTiles | null = null;
function archiveOf(): PMTiles {
  archive ??= new PMTiles(ARCHIVE_URL);
  return archive;
}

type Fetched<T> = { readonly kind: 'ok'; readonly value: T } | { readonly kind: 'unavailable' };

/** Τα θραύσματα ενός πλακιδίου· κενό πλακίδιο (θάλασσα) = κενή λίστα, **όχι** αστοχία. */
async function fragmentsOfTile(tile: ArchiveTileAddress, deadline: Deadline): Promise<Fetched<BuildingFragment[]>> {
  try {
    const response = await archiveOf().getZxy(tile.z, tile.x, tile.y, deadline.signal);
    const fragments = response === undefined ? [] : decodeBuildingFragments(new Uint8Array(response.data), tile);
    return { kind: 'ok', value: fragments };
  } catch (error) {
    logger.warn('Το αρχείο OSM δεν απάντησε', { data: { tile, error: getErrorMessage(error) } });
    return { kind: 'unavailable' };
  }
}

/** Το ζουμ του αρχείου, από την **κεφαλίδα του** — το αρχείο είναι η αυθεντία, όχι μια σταθερά εδώ. */
async function archiveZoom(): Promise<Fetched<number>> {
  try {
    return { kind: 'ok', value: (await archiveOf().getHeader()).maxZoom };
  } catch (error) {
    logger.warn('Η κεφαλίδα του αρχείου OSM δεν διαβάστηκε', { error: getErrorMessage(error) });
    return { kind: 'unavailable' };
  }
}

/**
 * **Τα κτίρια που ζητήθηκαν, ραμμένα**: το πλακίδιο του σημείου, μετά **μόνο** οι γείτονες προς τους οποίους ξεχειλίζουν.
 * @param select Ποια θραύσματα του κεντρικού πλακιδίου μας ενδιαφέρουν (περιέχουν το σημείο · έχουν αυτό το `id`).
 */
async function assembledAround(
  point: GeoPoint,
  deadline: Deadline,
  select: (fragment: BuildingFragment, z: number) => boolean,
): Promise<Fetched<ArchiveBuilding[]>> {
  const zoom = await archiveZoom();
  if (zoom.kind !== 'ok') return zoom;
  const z = zoom.value;
  const centre = archiveTileOf(point, z);
  const own = await fragmentsOfTile(centre, deadline);
  if (own.kind !== 'ok') return own;

  const chosen = own.value.filter((fragment) => select(fragment, z));
  const ids = new Set(chosen.map((fragment) => fragment.featureId));
  const neighbours = await Promise.all(neighbourTilesFor(centre, chosen).map((tile) => fragmentsOfTile(tile, deadline)));
  // 🔴 Ένας γείτονας που δεν απάντησε = κτίριο **μισό** ⇒ «δεν ξέρω», ποτέ το μισό ως το όλον.
  if (neighbours.some((result) => result.kind !== 'ok')) return { kind: 'unavailable' };

  const pieces = [...chosen, ...neighbours.flatMap((result) => (result.kind === 'ok' ? result.value : []))];
  const buildings = [...fragmentsById(pieces.filter((fragment) => ids.has(fragment.featureId))).values()]
    .map((group) => assembleArchiveBuilding(group, z))
    .filter((building): building is ArchiveBuilding => building !== null);
  return { kind: 'ok', value: buildings };
}

/** Εκτελεί με την προθεσμία του καλούντα, ή με δική μας που κλείνει στο τέλος. */
async function withDeadline<T>(deadline: Deadline | undefined, run: (deadline: Deadline) => Promise<T>): Promise<T> {
  if (deadline !== undefined) return run(deadline);
  const own = createDeadline(DEFAULT_ARCHIVE_BUDGET_MS);
  try {
    return await run(own);
  } finally {
    own.dispose();
  }
}

export type ArchiveBuildingPick =
  | { readonly kind: 'found'; readonly building: ArchiveBuilding & { readonly ref: NonNullable<ArchiveBuilding['ref']> } }
  | { readonly kind: 'none' }
  | { readonly kind: 'unavailable' };

/**
 * **Ποιο κτίριο του αρχείου περιέχει αυτό το σημείο;** — περιεκτικότητα, νικά το μικρότερο (§13.3, ίδιος κανόνας με το
 * `findOsmBuildingAt`). Κτίριο χωρίς μετρημένη ταυτότητα (`ref: null`) δεν μπορεί να γίνει αναφορά ⇒ παραλείπεται.
 */
export async function findArchiveBuildingAt(point: GeoPoint, deadline?: Deadline): Promise<ArchiveBuildingPick> {
  const result = await withDeadline(deadline, (d) =>
    assembledAround(point, d, (fragment, z) => fragmentContains(fragment, point, z)),
  );
  if (result.kind !== 'ok') return result;
  const winner = result.value
    .filter((building): building is ArchiveBuilding & { ref: NonNullable<ArchiveBuilding['ref']> } => building.ref !== null)
    .sort((a, b) => a.areaSqm - b.areaSqm)[0];
  return winner === undefined ? { kind: 'none' } : { kind: 'found', building: winner };
}

export type ArchiveBuildingVerdict =
  | { readonly kind: 'verified'; readonly building: ArchiveBuilding }
  /** Όχι σε **αυτό** το build, **κοντά** στο σημείο — ποτέ «δεν υπάρχει στο OSM» (δες την κεφαλίδα). */
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable' };

/**
 * **Υπάρχει αυτό το way ως κτίριο, κοντά σε αυτό το σημείο;**
 *
 * 🔴 Το `near` **μόνο εντοπίζει το πλακίδιο**. Ό,τι επιστρέφεται (σημείο, περίγραμμα) βγαίνει από τη **γεωμετρία του
 *    αρχείου** — ένα ψεύτικο `near` μπορεί μόνο να κάνει το κτίριο να **μη βρεθεί** (⇒ Overpass), ποτέ να μετακινήσει
 *    το σημείο που γράφεται (§14.4 κανόνας 2).
 */
export async function verifyArchiveBuilding(
  elementId: string,
  near: GeoPoint,
  deadline?: Deadline,
): Promise<ArchiveBuildingVerdict> {
  const featureId = tileFeatureIdOfOsmWay(elementId);
  if (featureId === null) return { kind: 'absent' };
  const result = await withDeadline(deadline, (d) =>
    assembledAround(near, d, (fragment) => fragment.featureId === featureId),
  );
  if (result.kind !== 'ok') return result;
  const building = result.value[0];
  return building === undefined ? { kind: 'absent' } : { kind: 'verified', building };
}
