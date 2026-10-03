/**
 * @fileoverview **ΟΙ ΑΛΛΑΓΕΣ ΤΟΥ ΓΡΑΦΟΥ** — τοποθέτηση λήψης, αφαίρεση, βελάκι, αποσύνδεση: καθαρές συναρτήσεις που
 * παίρνουν τον γράφο και επιστρέφουν τον νέο, ή ονομασμένη άρνηση (ADR-884 Φ2β · §4.9).
 * @related `spatial-tour-graph.ts` (`checkTourGraph` · `removeTourNode` — τα αναλλοίωτα) · `server/spatial-tour/tour-graph-write.ts`
 *   (ο ΕΝΑΣ γραφέας: διαβάζει, καλεί αυτό, ελέγχει, γράφει σε συναλλαγή)
 * @module lib/spatial-tour/tour-graph-edit
 *
 * 🔑 **Ιδεμπότητο από κατασκευή, χωρίς κλειδί**: τοποθετείται **μόνο** ατοποθέτητη λήψη — η επανάληψη ενός «νέο σημείο»
 * βρίσκει τη λήψη ήδη τοποθετημένη και δεν γεννά δεύτερο κόμβο. Βελάκι/σύνδεση = upsert· αποσύνδεση ανύπαρκτου = ίδιος γράφος.
 * 🔑 **Όροφος χωρίς κάτοψη γεννιέται μόνος του** (Δ5 `none`, «ξεκινά αμέσως»): τοπικός όροφος που δεν υπάρχει προστίθεται με
 * ένα `active` `none`. Όροφος BIM (`floor`) **δεν** επινοείται — πρέπει να υπάρχει ήδη.
 * 🔑 **Κόμβος χωρίς λήψη φεύγει**: αφαίρεση της τελευταίας λήψης ενός κόμβου ⇒ `removeTourNode` (ποτέ ορφανός σύνδεσμος).
 */

import type {
  FloorPlanDeclarableSource, TourDeclaredAreaSource, TourShapeMode, TourSpaceSource,
} from '@/constants/spatial-tour-vocabulary';
import type { SpatialTour, TourCapture, TourLevel, TourLevelKey, TourLink, TourNode, TourRedactionRegion } from '@/types/spatial-tour';

import { levelKeyId, removeTourNode } from './spatial-tour-graph';
import { isCaptureViewable } from './tour-manifest-stop';
import { positionNode } from './tour-plan-edit';
import { normalizeTourRoom, sameTourRoom, type TourRoomInput } from './tour-room';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

export type TourPlacementTarget =
  | { readonly kind: 'node'; readonly nodeId: string }
  | {
      readonly kind: 'new-node';
      readonly levelKey: TourLevelKey;
      /** Σύνδεση με υπάρχον σημείο τη στιγμή της γέννησης (το «δίπλα στο…» των μεγάλων). */
      readonly linkFrom: string | null;
      /**
       * ADR-904 Κ9 — θέση στην κάτοψη τη στιγμή της γέννησης (μέτρα κάτοψης, όπως η εντολή `position`): η **αποδοχή** της πρότασης
       * του φωτογράφου σε **μία** συναλλαγή. Κρίνεται από τον **ίδιο** κριτή (`positionNode`). Απούσα ⇒ χωρίς θέση.
       */
      readonly position?: { readonly x: number; readonly y: number };
    };

/**
 * Μία αλλαγή του γράφου — ό,τι ζητά η οθόνη. Ζει **εδώ** (καθαρό), όχι στον γραφέα του διακομιστή: τον ρωτούν ο
 * γραφέας, το σχήμα zod της διαδρομής **και** η οθόνη τοποθέτησης (αισιόδοξη εφαρμογή · αναίρεση, §4.10).
 */
export type TourGraphCommand =
  | { readonly op: 'place'; readonly captureId: string; readonly target: TourPlacementTarget }
  | { readonly op: 'unplace'; readonly captureId: string }
  | { readonly op: 'link'; readonly fromNodeId: string; readonly toNodeId: string; readonly bearingRad: number | null }
  | { readonly op: 'unlink'; readonly fromNodeId: string; readonly toNodeId: string }
  /** Ο χώρος ενός σημείου (Φ2στ · §4.12) — `null` ⇒ ξανά «Σημείο N». */
  | { readonly op: 'name'; readonly nodeId: string; readonly room: TourRoomInput | null }
  // ── Η κάτοψη (Φ2στ-β · §4.13 — οι καθαρές ζουν στο `tour-plan-edit.ts`) ──
  /** Η κάτοψη ενός ορόφου από τα αρχεία του ακινήτου (Δ7.1) — `null` ⇒ χωρίς κάτοψη. Την εικόνα την ετοιμάζει ο διακομιστής. */
  | { readonly op: 'floorplan'; readonly levelKey: TourLevelKey; readonly plan: TourFloorPlanPick | null }
  /** Η κλίμακα της ενεργής κάτοψης (μέτρα ανά pixel εικόνας) — `null` ⇒ αβαθμονόμητη. */
  | { readonly op: 'calibrate'; readonly levelKey: TourLevelKey; readonly metresPerPixel: number | null }
  /** Η θέση ενός σημείου σε μέτρα κάτοψης (x ανατολή, y βορράς) — `null` ⇒ εκτός κάτοψης. */
  | { readonly op: 'position'; readonly nodeId: string; readonly point: { readonly x: number; readonly y: number } | null }
  /** Ο προσανατολισμός της λήψης ενός σημείου (heading κόσμου) — στρέφει **και** τα βελάκια του. */
  | { readonly op: 'orient'; readonly captureId: string; readonly headingRad: number }
  // ── Τα σχήματα των χώρων (Φ2στ-γ Γ3β · §4.14 — οι καθαρές ζουν στο `tour-space-edit.ts`) ──
  /**
   * **Έγκρινε** περίγραμμα χώρου. Το id το κόβει **ο πελάτης** (`tspc_…`, Γ3γ-2α — πρότυπο Figma/Linear, ταυτότητα «επιπέδου Β»
   * όπως `ownp`/`pdos`) και ο διακομιστής το ελέγχει· η **πρόθεση** είναι ρητή (`create` ≠ `replace`).
   */
  | { readonly op: 'space'; readonly levelKey: TourLevelKey; readonly spaceId: string; readonly mode: TourShapeMode; readonly space: TourSpaceDraft }
  | { readonly op: 'unspace'; readonly levelKey: TourLevelKey; readonly spaceId: string }
  /** Νοητή διαχωριστική γραμμή (Δ8.2) — id του πελάτη (`tsep_…`), ίδια σύμβαση πρόθεσης. */
  | { readonly op: 'separate'; readonly levelKey: TourLevelKey; readonly separationId: string; readonly mode: TourShapeMode; readonly a: TourPlanXY; readonly b: TourPlanXY }
  | { readonly op: 'unseparate'; readonly levelKey: TourLevelKey; readonly separationId: string }
  // ── Η ιδιωτικότητα μιας λήψης (Φ2ζ · §4.15 · Α8 — οι καθαρές ζουν στο `tour-redaction-edit.ts`) ──
  /**
   * **Θόλωσε** μια περιοχή της λήψης (Matterport Blur Brush) — id του πελάτη (`tred_…`), ίδια σύμβαση πρόθεσης με τους χώρους.
   * Αλλάζει τη **λήψη**, όχι τον γράφο: ο γραφέας την ξαναψήνει (τα πλακίδια της είναι αυτό που βλέπει ο επισκέπτης).
   */
  | { readonly op: 'redact'; readonly captureId: string; readonly redactionId: string; readonly mode: TourShapeMode; readonly region: TourRedactionRegion }
  | { readonly op: 'unredact'; readonly captureId: string; readonly redactionId: string }
  /**
   * **Δέσμη** αλλαγών θολώματος μιας λήψης (ζ3 — το «Apply» της Matterport): **ατομική** (μία άρνηση ⇒ καμία αλλαγή), **μία**
   * αλλαγή κλειδιού, **μία** επανα-ψήση — όσοι κύκλοι κι αν άλλαξαν στο πρόχειρο.
   */
  | { readonly op: 'redactions'; readonly captureId: string; readonly edits: readonly TourRedactionEdit[] };

/** Μία αλλαγή θολώματος μέσα σε δέσμη — τα `redact`/`unredact` χωρίς τη λήψη (η δέσμη την ορίζει μία φορά). */
export type TourRedactionEdit =
  | { readonly op: 'redact'; readonly redactionId: string; readonly mode: TourShapeMode; readonly region: TourRedactionRegion }
  | { readonly op: 'unredact'; readonly redactionId: string };

/**
 * **Δημιουργία ή αντικατάσταση** σχήματος (λεξιλόγιο `TOUR_SHAPE_MODES`): `create` σε id που υπάρχει με **ίδιο** περιεχόμενο =
 * ιδεμπότητη επανάληψη (`unchanged`), με άλλο = `*-exists`· `replace` σε id που λείπει = `*-absent`.
 */
export type { TourShapeMode };

/** Σημείο σε μέτρα κάτοψης, όπως το στέλνει η οθόνη. */
export type TourPlanXY = { readonly x: number; readonly y: number };

/**
 * Ό,τι εγκρίνει ο άνθρωπος για έναν χώρο — **χωρίς** «ποιος/πότε» (τα γράφει ο διακομιστής). Το δηλωμένο εμβαδόν ταξιδεύει
 * **πάντα** μαζί με το σχήμα: η οθόνη το ξαναστέλνει όπως ήταν, ώστε μια αλλαγή σχήματος να μην το σβήσει ποτέ (Δ8.4).
 */
export interface TourSpaceDraft {
  readonly points: readonly TourPlanXY[];
  readonly source: TourSpaceSource;
  readonly room: TourRoomInput | null;
  readonly declaredArea: { readonly areaM2: number; readonly source: TourDeclaredAreaSource } | null;
}

/** Ό,τι διαλέγει ο άνθρωπος για την κάτοψη ενός ορόφου: ποιο αρχείο του ακινήτου, και **ποιος** το σχεδίασε (δηλωμένο). */
export interface TourFloorPlanPick {
  readonly fileId: string;
  readonly source: FloorPlanDeclarableSource;
}

/**
 * Μία κάτοψη του ακινήτου που μπορεί να πάρει η περιήγηση — η απάντηση του `GET …/floorplans` (Φ2στ-β · §4.13). Την
 * παράγει ο ΕΝΑΣ κριτής (`server/spatial-tour/tour-plan-files.ts`), ο ίδιος που κρίνει την εντολή `floorplan`.
 */
export interface TourPlanCandidate {
  readonly fileId: string;
  readonly name: string;
  readonly previewUrl: string | null;
  /** Ο όροφος της κάτοψης όταν το ακίνητο είναι πολυεπίπεδο (ADR-236) — η οθόνη τον προτείνει πρώτο. */
  readonly levelFloorId: string | null;
}

/** Η απάντηση του `POST …/graph` — `revision` ≠ τοπική + 1 ⇒ κάποιος άλλος άλλαξε τον γράφο στο μεταξύ. */
export interface TourGraphEditResponse {
  readonly changed: boolean;
  readonly revision: number;
}

export type TourGraphEditRefusal =
  | 'node-absent' | 'level-absent' | 'capture-placed' | 'capture-unplaced' | 'capture-not-ready' | 'room-invalid'
  | 'plan-absent' | 'plan-uncalibrated' | 'position-outside-plan' | 'scale-invalid'
  | 'space-invalid' | 'space-outside-plan' | 'space-overlap' | 'space-absent' | 'space-exists' | 'area-invalid'
  | 'separation-invalid' | 'separation-absent' | 'separation-exists'
  | 'redaction-invalid' | 'redaction-absent' | 'redaction-exists' | 'redaction-limit';

export type TourGraphEditResult =
  | { readonly kind: 'edited'; readonly graph: Graph; readonly captureNodeId?: string | null }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: TourGraphEditRefusal };

const refused = (reason: TourGraphEditRefusal): TourGraphEditResult => ({ kind: 'refused', reason });
const hasNode = (graph: Graph, nodeId: string) => graph.nodes.some((node) => node.id === nodeId);

/** Ο τοπικός όροφος που λείπει, με κάτοψη `none` (Δ5) — ή `null` αν δεν χρειάζεται / δεν επιτρέπεται. */
function ensureLevel(levels: readonly TourLevel[], key: TourLevelKey): readonly TourLevel[] | null {
  if (levels.some((level) => levelKeyId(level.key) === levelKeyId(key))) return levels;
  if (key.kind !== 'local') return null;
  const none = { source: 'none', state: 'active', fileId: null, approvedBy: null, approvedAt: null } as const;
  return [...levels, { key, floorPlans: [none] }];
}

/** Βάλε (ή ξανάβαλε) έναν σύνδεσμο στον κόμβο `from` — ένας ανά στόχο. */
function withLink(node: TourNode, link: TourLink): TourNode {
  return { ...node, links: [...node.links.filter((l) => l.toNodeId !== link.toNodeId), link] };
}

function linkBoth(nodes: readonly TourNode[], a: string, b: string, bearingFromA: number | null): TourNode[] {
  return nodes.map((node) => {
    if (node.id === a) return withLink(node, { toNodeId: b, via: 'manual', bearingRad: bearingFromA });
    // Το αντίθετο άκρο κρατά το δικό του βελάκι αν το έχει — αλλιώς σύνδεσμος χωρίς κατεύθυνση.
    if (node.id === b) return withLink(node, node.links.find((l) => l.toNodeId === a) ?? { toNodeId: a, via: 'manual', bearingRad: null });
    return node;
  });
}

/** **Τοποθέτησε** μια ατοποθέτητη λήψη σε υπάρχον ή νέο σημείο. `newNodeId` = ο ήδη κομμένος id (N.6). */
export function placeCapture(
  graph: Graph,
  capture: Pick<TourCapture, 'nodeId' | 'tileset'>,
  target: TourPlacementTarget,
  newNodeId: string,
): TourGraphEditResult {
  if (capture.nodeId !== null) {
    // Ίδιος υπάρχων κόμβος = επανάληψη ⇒ τίποτα. Αλλιώς (και κάθε «νέο σημείο») ⇒ ήδη τοποθετημένη: η επανάληψη
    // ενός «νέο σημείο» ΔΕΝ γεννά δεύτερο κόμβο· η μετακίνηση είναι ρητή (αφαίρεση → τοποθέτηση).
    return target.kind === 'node' && target.nodeId === capture.nodeId ? { kind: 'unchanged' } : refused('capture-placed');
  }
  // 🔑 Τοποθετείται ΜΟΝΟ λήψη με πλακίδια (πρότυπο Matterport/Kuula, §4.10): ο κριτής του θεατή διαλέγει την πιο
  // πρόσφατη λήψη ανά κόμβο ΠΡΙΝ ρωτήσει ετοιμότητα ⇒ μια άψητη λήψη σε ορατό σημείο θα το ΕΚΡΥΒΕ. Κλείνει στη ρίζα.
  if (!isCaptureViewable(capture)) return refused('capture-not-ready');
  if (target.kind === 'node') {
    return hasNode(graph, target.nodeId) ? { kind: 'edited', graph, captureNodeId: target.nodeId } : refused('node-absent');
  }
  const levels = ensureLevel(graph.levels, target.levelKey);
  if (levels === null) return refused('level-absent');
  if (target.linkFrom !== null && !hasNode(graph, target.linkFrom)) return refused('node-absent');
  const node: TourNode = { id: newNodeId, levelKey: target.levelKey, position: null, links: [] };
  const nodes = target.linkFrom === null ? [...graph.nodes, node] : linkBoth([...graph.nodes, node], target.linkFrom, newNodeId, null);
  if (target.position === undefined) return { kind: 'edited', graph: { levels, nodes }, captureNodeId: newNodeId };
  // Ολόκληρη ή καθόλου: θέση που ο κριτής αρνείται ⇒ ούτε το σημείο γεννιέται (καμία μισή αποδοχή).
  const placed = positionNode({ levels, nodes }, newNodeId, target.position);
  return placed.kind === 'edited' ? { ...placed, captureNodeId: newNodeId } : placed;
}

/** **Βγάλε** μια λήψη από το σημείο της· αν ήταν η τελευταία του σημείου, φεύγει και το σημείο. */
export function unplaceCapture(
  graph: Graph,
  capture: { readonly nodeId: string | null },
  otherCapturesOnNode: number,
): TourGraphEditResult {
  if (capture.nodeId === null) return refused('capture-unplaced');
  const nodes = otherCapturesOnNode === 0 ? removeTourNode(graph.nodes, capture.nodeId) : graph.nodes;
  return { kind: 'edited', graph: { levels: graph.levels, nodes }, captureNodeId: null };
}

/** **Σύνδεσε** δύο σημεία (και τις δύο κατευθύνσεις) και βάλε το βελάκι του `from` — upsert. */
export function linkNodes(graph: Graph, from: string, to: string, bearingRad: number | null): TourGraphEditResult {
  if (!hasNode(graph, from) || !hasNode(graph, to) || from === to) return refused('node-absent');
  const current = graph.nodes.find((node) => node.id === from)?.links.find((l) => l.toNodeId === to);
  const reverse = graph.nodes.find((node) => node.id === to)?.links.some((l) => l.toNodeId === from);
  if (current?.bearingRad === bearingRad && current.via === 'manual' && reverse) return { kind: 'unchanged' };
  return { kind: 'edited', graph: { levels: graph.levels, nodes: linkBoth(graph.nodes, from, to, bearingRad) } };
}

/** **Αποσύνδεσε** δύο σημεία — και τις δύο κατευθύνσεις. Ανύπαρκτος σύνδεσμος ⇒ ίδιος γράφος. */
export function unlinkNodes(graph: Graph, a: string, b: string): TourGraphEditResult {
  const linked = graph.nodes.some((node) => (node.id === a && node.links.some((l) => l.toNodeId === b))
    || (node.id === b && node.links.some((l) => l.toNodeId === a)));
  if (!linked) return { kind: 'unchanged' };
  const nodes = graph.nodes.map((node) => {
    const other = node.id === a ? b : node.id === b ? a : null;
    return other === null ? node : { ...node, links: node.links.filter((l) => l.toNodeId !== other) };
  });
  return { kind: 'edited', graph: { levels: graph.levels, nodes } };
}

/**
 * **Όνομασε** ένα σημείο — ή σβήσε το όνομα (`null`). Ίδιος χώρος ⇒ `unchanged` (ιδεμποτία). Άκυρος χώρος (άγνωστος
 * τύπος · κανένας · πάνω από 3 · όνομα > 60) ⇒ `room-invalid`: η ίδια κανονικοποίηση με την ανάγνωση (`normalizeTourRoom`).
 */
export function nameNode(graph: Graph, nodeId: string, input: TourRoomInput | null): TourGraphEditResult {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return refused('node-absent');
  const room = input === null ? null : normalizeTourRoom(input);
  if (input !== null && room === null) return refused('room-invalid');
  if (sameTourRoom(node.room, room)) return { kind: 'unchanged' };
  const nodes = graph.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    const { room: _previous, ...rest } = n;
    return room === null ? rest : { ...rest, room };
  });
  return { kind: 'edited', graph: { levels: graph.levels, nodes } };
}
