/**
 * ADR-911 Φ4-3β — **η προεπισκόπηση των ανοιγμάτων**: τι φωτίζεται στον καμβά για μία πρόταση.
 *
 * ΚΑΜΙΑ δική της γεωμετρία για ό,τι θα γραφτεί. Η ζώνη κάθε «πόρτας» / «παραθύρου» είναι το
 * `geometry.outline` της οντότητας που παράγει το `planOpeningWrite` — το ΙΔΙΟ σχέδιο που εκτελεί
 * ο `addOpeningsToScene`. Άρα «ό,τι φωτίστηκε είναι ό,τι γράφεται» ισχύει εκ κατασκευής, όχι
 * επειδή δύο υπολογισμοί έτυχε να συμφωνούν (άγκυρα Α-10 για ανοίγματα).
 *
 *   · `door` / `window`  — το περίγραμμα του ανοίγματος ΟΠΩΣ θα γραφτεί, πάνω στον τελικό ξενιστή.
 *   · `needs-decision`   — η λωρίδα του κενού (θέση × πάχος ξενιστή) όταν το σχέδιο τη δίνει·
 *                          αλλιώς οι ίδιες οι γραμμές του συμβόλου (`loose`).
 *   · `existing`         — το περίγραμμα του ανοίγματος που ήδη υπάρχει στη σκηνή.
 *   · ένοικοι            — γραμμές ΑΛΛΟΥ ρόλου μέσα σε κενό: ό,τι ο βοηθός δεν διαβάζει.
 *   · ανεξήγητες         — γραμμές του ρόλου «κούφωμα» που δεν εξηγεί κανένα στοιχείο.
 *
 * Αν το σχέδιο εγγραφής ΑΡΝΕΙΤΑΙ (όλα ή τίποτα), η άρνηση φαίνεται ΠΡΙΝ από την έγκριση: τα
 * «θα γραφτούν» πέφτουν στη λωρίδα τους και το `refusal` λέει γιατί.
 *
 * Όριο, δηλωμένο: φωτίζονται τα ΑΝΟΙΓΜΑΤΑ, όχι οι τοίχοι που ενώνονται / επεκτείνονται / γεννιούνται
 * για να τα φιλοξενήσουν. Το νέο υλικό τοίχου είναι το ίδιο το κενό λαμπά–λαμπά, δηλαδή η ζώνη.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./opening-write-plan.ts (το σχέδιο εγγραφής — η μόνη πηγή του «τι θα γραφτεί»)
 * @see ./assistant-preview.ts (ο αδελφός για τους τοίχους)
 */

import type { AnySceneEntity, Entity } from '../../types/entities';
import { isOpeningEntity, isWallEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { addPoints, scalePoint, subtractPoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { extractLineSegments } from '../walls/wall-in-region';
import type { WallEntity } from '../types/wall-types';
import type { UnexplainedSegment } from './assistant-preview';
import type { OpeningHostPlan } from './opening-host-plan';
import type {
  OpeningDecisionReason, OpeningProposal, OpeningProposalItem, OpeningProposalStatus,
} from './opening-proposal';
import { isOccupiedOpening, type OpeningReviewChoices } from './opening-review';
import { planOpeningWrite, type OpeningWriteRefusal } from './opening-write-plan';
import { leftNormal } from './wall-host-frame';

export interface OpeningPreviewZone {
  /** Το κλειδί του στοιχείου της πρότασης (`OpeningProposalItem.key`). */
  readonly key: string;
  readonly status: OpeningProposalStatus;
  /** Τα πολύγωνα (κόσμος) που ζωγραφίζονται. Κενό ⇒ το στοιχείο φαίνεται μόνο από τις γραμμές του. */
  readonly pieces: readonly (readonly Point2D[])[];
  /** Γιατί ρωτήθηκε ο άνθρωπος — παρόν και αφού απαντήσει. */
  readonly reason?: OpeningDecisionReason;
  /** Κρατά ζωγραφισμένες γραμμές άλλου ρόλου. */
  readonly occupied: boolean;
  /** Ο άνθρωπος είπε «δεν είναι κούφωμα». */
  readonly dismissed: boolean;
}

export interface OpeningPreview {
  readonly zones: readonly OpeningPreviewZone[];
  /** Γραμμές άλλου ρόλου ζωγραφισμένες μέσα σε κενό. */
  readonly occupants: readonly UnexplainedSegment[];
  /** Τα σύμβολα των «προς απόφαση» που δεν έχουν λωρίδα να φωτιστεί. */
  readonly loose: readonly UnexplainedSegment[];
  /** Γραμμές του ρόλου που δεν εξηγεί κανένα κούφωμα. */
  readonly unexplained: readonly UnexplainedSegment[];
  /** Γιατί το σχέδιο εγγραφής αρνείται — απόν όταν γράφεται ή όταν δεν υπάρχει τίποτα να γραφτεί. */
  readonly refusal?: OpeningWriteRefusal;
}

export interface OpeningPreviewInput {
  readonly proposal: OpeningProposal;
  /** Η σκηνή από την οποία βγήκε η πρόταση. */
  readonly entities: readonly Entity[];
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly choices: OpeningReviewChoices;
}

const ring = (vertices: readonly { readonly x: number; readonly y: number }[]): Point2D[] =>
  vertices.map((v) => ({ x: v.x, y: v.y }));

/** Το πάχος (μονάδες σκηνής) του τοίχου που θα φιλοξενήσει το στοιχείο, όσο το ξέρει το σχέδιο. */
function hostThickness(host: OpeningHostPlan, walls: ReadonlyMap<string, WallEntity>, scale: number): number | null {
  if (host.kind === 'new-piece') return host.thicknessMm * scale;
  const wall = walls.get(host.kind === 'bridge' ? host.wallIds[0] : host.wallId);
  return wall ? wall.params.thickness * scale : null;
}

/** Η λωρίδα του κενού: η θέση του ανοίγματος πάνω στον άξονα × το πάχος του ξενιστή. */
function spanBand(item: OpeningProposalItem, walls: ReadonlyMap<string, WallEntity>, scale: number): Point2D[][] {
  if (!item.span || !item.host) return [];
  const thickness = hostThickness(item.host, walls, scale);
  const along = subtractPoints(item.span.end, item.span.start);
  const length = Math.hypot(along.x, along.y);
  if (thickness === null || length <= 0) return [];
  const half = scalePoint(leftNormal(scalePoint(along, 1 / length)), thickness / 2);
  const { start, end } = item.span;
  return [[addPoints(start, half), addPoints(end, half), subtractPoints(end, half), subtractPoints(start, half)]];
}

function segmentsOf(ids: ReadonlySet<string>, entities: readonly Entity[]): UnexplainedSegment[] {
  if (ids.size === 0) return [];
  // Τα σύμβολα έχουν και τόξα (φύλλο πόρτας): δειγματίζονται από το ΙΔΙΟ SSoT με τις γραμμές.
  return extractLineSegments(entities.filter((e) => ids.has(e.id)), { tessellateCurves: true }).map(
    (s): UnexplainedSegment => ({ start: { x: s.start.x, y: s.start.y }, end: { x: s.end.x, y: s.end.y } }),
  );
}

interface Planned {
  /** Κλειδί στοιχείου → το περίγραμμα του ανοίγματος ΟΠΩΣ θα γραφτεί. */
  readonly outlines: ReadonlyMap<string, Point2D[]>;
  readonly refusal?: OpeningWriteRefusal;
}

/** Τρέχει το ΠΡΑΓΜΑΤΙΚΟ σχέδιο εγγραφής και κρατά το περίγραμμα κάθε ανοίγματος ανά στοιχείο. */
function planOutlines(input: OpeningPreviewInput): Planned {
  const writable = input.proposal.items.filter((i) => i.status === 'door' || i.status === 'window');
  if (writable.length === 0) return { outlines: new Map() };
  const planned = planOpeningWrite({
    entities: input.entities as readonly AnySceneEntity[],
    items: writable,
    layerId: input.levelId,
    sceneUnits: input.sceneUnits,
  });
  if (!planned.ok) return { outlines: new Map(), refusal: planned.refusal };
  // Σύμβαση του σχεδίου: `plan.openings` στη σειρά των εγγράψιμων στοιχείων της πρότασης.
  const outlines = new Map<string, Point2D[]>();
  planned.plan.openings.forEach((opening, i) => {
    const item = writable[i];
    if (item && opening.geometry) outlines.set(item.key, ring(opening.geometry.outline.vertices));
  });
  return { outlines };
}

/**
 * Η προεπισκόπηση μιας πρότασης ανοιγμάτων πάνω σε ΑΥΤΗ τη σκηνή. Η σκηνή πρέπει να είναι εκείνη
 * από την οποία βγήκε η πρόταση.
 */
export function buildOpeningPreview(input: OpeningPreviewInput): OpeningPreview {
  const { proposal, entities, choices } = input;
  const scale = mmToSceneUnits(input.sceneUnits);
  const walls = new Map(entities.filter(isWallEntity).map((w) => [w.id, w] as const));
  const existing = new Map(entities.filter(isOpeningEntity).map((o) => [o.id, o] as const));
  const planned = planOutlines(input);

  const looseIds = new Set<string>();
  const zones = proposal.items.map((item): OpeningPreviewZone => {
    const written = planned.outlines.get(item.key);
    const found = item.existingOpeningId ? existing.get(item.existingOpeningId)?.geometry?.outline.vertices : undefined;
    const pieces = written ? [written] : found ? [ring(found)] : spanBand(item, walls, scale);
    if (pieces.length === 0) item.sourceIds.forEach((id) => looseIds.add(id));
    return {
      key: item.key, status: item.status, pieces,
      occupied: isOccupiedOpening(item), dismissed: choices.get(item.key) === 'none',
      ...(item.reason ? { reason: item.reason } : {}),
    };
  });

  const occupantIds = new Set(proposal.items.flatMap((item) => item.occupantIds ?? []));
  return {
    zones,
    occupants: segmentsOf(occupantIds, entities),
    loose: segmentsOf(looseIds, entities),
    unexplained: segmentsOf(new Set(proposal.unexplainedIds), entities),
    ...(planned.refusal ? { refusal: planned.refusal } : {}),
  };
}

/**
 * Το αποτύπωμα αυτού που είδε ο άνθρωπος όταν ενέκρινε: η πρόταση ΚΑΙ ό,τι φωτίστηκε. Η πρόταση
 * μόνη δεν αρκεί — αν αλλάξει το πάχος ενός ξενιστή, τα στοιχεία μένουν ίδια αλλά το άνοιγμα που
 * θα γραφτεί όχι. Κανένα γεννημένο id δεν μπαίνει: τα ids ανοιγμάτων και ενωμένων τοίχων
 * ξαναγεννιούνται σε κάθε υπολογισμό και δεν είναι μέρος αυτού που εγκρίθηκε.
 */
export function openingReviewSignature(proposal: OpeningProposal, preview: OpeningPreview): string {
  return JSON.stringify([
    proposal.items,
    proposal.unexplainedIds,
    preview.zones.map((zone) => zone.pieces),
    preview.refusal ?? null,
  ]);
}
