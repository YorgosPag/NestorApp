/**
 * ADR-911 Φ4-2 — το ΣΧΕΔΙΟ ΕΓΓΡΑΦΗΣ ανοιγμάτων: τι ακριβώς θα γραφτεί στη σκηνή, υπολογισμένο
 * καθαρά, πριν αγγίξει κανείς τίποτα. Ό,τι επιστρέφει αυτή η συνάρτηση είναι ό,τι γράφει ο
 * `addOpeningsToScene` — τίποτα λιγότερο, τίποτα άλλο (Α-10: προεπισκόπηση ≡ εγγραφή).
 *
 * Βήματα:
 *   1. Τελικοί ξενιστές από τα σχέδια της πρότασης (`resolveOpeningHosts`): ενωμένοι τοίχοι,
 *      επεκτάσεις, νέα κομμάτια.
 *   2. Κατοχή χώρου (ADR-567) για κάθε ΝΕΟ τοίχο — πάνω στη σκηνή όπως θα είναι.
 *   3. ΕΝΑ πέρασμα ενώσεων για όλη τη σκηνή, με καθάρισμα πρώτα (`retrimWallEntities`): άκρο που
 *      μετακινήθηκε ή τοίχος που απορροφήθηκε δεν αφήνει μπαγιάτικη λοξοτομή σε κανέναν.
 *   4. Τα ΥΠΑΡΧΟΝΤΑ ανοίγματα των τοίχων που άλλαξαν ξαναβρίσκουν τη θέση τους από σημεία κόσμου.
 *   5. Τα ΝΕΑ ανοίγματα: offset από τα σημεία κόσμου της πρότασης πάνω στον ΤΕΛΙΚΟ ξενιστή, και
 *      οντότητα από το ίδιο SSoT με το εργαλείο του χεριού (`buildOpeningEntity`).
 *
 * Όλα ή τίποτα: ΟΠΟΙΑΔΗΠΟΤΕ αστοχία επιστρέφει ονομασμένη άρνηση και κανένα σχέδιο.
 */

import type { AnySceneEntity } from '../../types/entities';
import { isOpeningEntity, isWallEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { WallRetrimEntry } from '../../core/commands/entity-commands/RetrimWallsCommand';
import type { HostedOpeningIdsEntry } from '../../core/commands/entity-commands/opening-host-commands';
import { buildOpeningEntity } from '../../hooks/drawing/opening-completion';
import { projectPointToWallOffsetMm } from '../geometry/opening-geometry';
import { partitionByStructuralOverlap } from '../placement/structural-placement-overlap';
import { isWallHostedOpening, type OpeningEntity, type OpeningParams } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { retrimWallEntities } from '../walls/wall-retrim';
import { buildGapOpeningParams } from '../walls/wall-gap-opening';
import { rehostOpeningsOnto, type HostedOpeningRef } from '../walls/wall-merge';
import type { OpeningUpdate } from '../walls/wall-split';
import { wallTrimChanged } from '../walls/wall-trims';
import { resolveDoorSwing } from './door-swing';
import type { OpeningHostPlan, OpeningSpan } from './opening-host-plan';
import {
  resolveOpeningHosts, type OpeningHostContext, type OpeningHostRefusal, type ResolvedOpeningHosts,
} from './opening-host-runs';
import type { OpeningProposalItem } from './opening-proposal';

export type OpeningWriteRefusal = OpeningHostRefusal | 'nothing-to-write' | 'overlap' | 'invalid-opening';

export interface OpeningWritePlan {
  /** Τοίχοι που απορροφούνται σε ενωμένο. */
  readonly removedWalls: readonly WallEntity[];
  /** Ενωμένοι τοίχοι + νέα κομμάτια, ΟΠΩΣ θα γραφτούν: ψημένες ενώσεις, καθρέφτης ανοιγμάτων. */
  readonly addedWalls: readonly WallEntity[];
  /** Υπάρχοντες τοίχοι των οποίων άλλαξε ο άξονας (επέκταση) ή η ένωση. */
  readonly wallPatches: readonly WallRetrimEntry[];
  /** Ο καθρέφτης `hostedOpeningIds` των υπαρχόντων τοίχων που απέκτησαν άνοιγμα. */
  readonly mirrorPatches: readonly HostedOpeningIdsEntry[];
  /** Υπάρχοντα ανοίγματα που αλλάζουν ξενιστή ή θέση επειδή ο τοίχος τους ενώθηκε/επεκτάθηκε. */
  readonly rehosted: readonly OpeningUpdate[];
  /** Τα νέα ανοίγματα, στη σειρά των στοιχείων της πρότασης. */
  readonly openings: readonly OpeningEntity[];
}

export type OpeningWritePlanResult =
  | { readonly ok: true; readonly plan: OpeningWritePlan }
  | { readonly ok: false; readonly refusal: OpeningWriteRefusal };

export interface OpeningWriteInput extends OpeningHostContext {
  /** Η σκηνή ΟΠΩΣ ΕΙΝΑΙ τη στιγμή της εγγραφής. */
  readonly entities: readonly AnySceneEntity[];
  /** Η πρόταση· γράφονται ΜΟΝΟ τα «πόρτα» / «παράθυρο» — ποτέ «προς απόφαση», ποτέ «υπάρχει ήδη». */
  readonly items: readonly OpeningProposalItem[];
}

type WritableItem = OpeningProposalItem & {
  readonly status: 'door' | 'window';
  readonly host: OpeningHostPlan;
  readonly span: OpeningSpan;
  readonly widthMm: number;
};

/** Κάτω από αυτό, ένα υπάρχον άνοιγμα θεωρείται ότι ΔΕΝ μετακινήθηκε πάνω στον άξονα (mm). */
const OFFSET_UNCHANGED_EPS_MM = 1e-6;

const isWritable = (item: OpeningProposalItem): item is WritableItem =>
  (item.status === 'door' || item.status === 'window')
  && item.host !== undefined && item.span !== undefined && item.widthMm !== undefined;

const refuse = (refusal: OpeningWriteRefusal): OpeningWritePlanResult => ({ ok: false, refusal });

/**
 * Η σκηνή χωρίς τους τοίχους που απορροφήθηκαν και με τους επεκταμένους στη θέση τους (χωρίς
 * ενώσεις ακόμη). Οι ΝΕΟΙ τοίχοι δεν είναι εδώ — προστίθενται αφού περάσουν τον έλεγχο κατοχής.
 */
function sceneWithHosts(entities: readonly AnySceneEntity[], hosts: ResolvedOpeningHosts): AnySceneEntity[] {
  const removedIds = new Set(hosts.removed.map((w) => w.id));
  const reshapedById = new Map<string, AnySceneEntity>(hosts.reshaped.map((w) => [w.id, w] as const));
  return entities
    .filter((e) => !removedIds.has(e.id))
    .map((e) => reshapedById.get(e.id) ?? e);
}

function buildOpening(item: WritableItem, host: WallEntity, input: OpeningWriteInput): OpeningEntity | null {
  // Σημεία κόσμου → offset πάνω στον ΤΕΛΙΚΟ ξενιστή. Το χαμηλότερο είναι η αρχή του ανοίγματος:
  // η φορά του άξονα μπορεί να είναι αντίθετη από τη φορά μεντεσές → κλείστρο.
  const offsets = [item.span.start, item.span.end].map((p) => projectPointToWallOffsetMm(p, host));
  const gap = { gapMm: item.widthMm, openingOffsetFromMergedStart: Math.min(...offsets) };
  const params: OpeningParams = {
    // Το είδος είναι ό,τι ΘΑ γραφτεί (`status`), όχι ό,τι δείχνει το σχέδιο: κενό χωρίς σύμβολο ή
    // αραιό σύμβολο γίνεται κούφωμα με απόφαση ανθρώπου (Φ4-3α).
    ...buildGapOpeningParams(host.id, gap, item.status),
    ...(item.frameWidthMm !== undefined ? { frameWidth: item.frameWidthMm } : {}),
    ...(item.status === 'door' && item.swing ? resolveDoorSwing(host, item.span, item.swing) ?? {} : {}),
  };
  const built = buildOpeningEntity(params, host, input.layerId, input.sceneUnits);
  return built.ok ? built.entity : null;
}

/** Τα υπάρχοντα ανοίγματα των τοίχων που άλλαξαν — μόνο όσα ΟΝΤΩΣ αλλάζουν ξενιστή ή θέση. */
function rehostExisting(
  entities: readonly AnySceneEntity[],
  hosts: ResolvedOpeningHosts,
  wallById: ReadonlyMap<string, WallEntity>,
): OpeningUpdate[] {
  // Αυθεντία «ποιος φιλοξενεί τι» είναι το `opening.params.wallId`, όχι ο καθρέφτης του τοίχου.
  const hostedOpenings = entities.filter(isOpeningEntity).filter(isWallHostedOpening);
  return hosts.changed.flatMap(({ hostId, sources }) => {
    const target = wallById.get(hostId);
    if (!target) return [];
    const hosted: HostedOpeningRef[] = sources.flatMap((host) =>
      hostedOpenings.filter((o) => o.params.wallId === host.id).map((opening) => ({ host, opening })));
    return rehostOpeningsOnto(target, hosted).filter((u) =>
      u.nextParams.wallId !== u.previousParams.wallId
      || Math.abs(u.nextParams.offsetFromStart - u.previousParams.offsetFromStart) > OFFSET_UNCHANGED_EPS_MM);
  });
}

/** id ξενιστή → ids ανοιγμάτων που ΑΠΟΚΤΑ (νέα + όσα μεταφέρθηκαν πάνω του). */
function gainedOpeningIds(openings: readonly OpeningEntity[], rehosted: readonly OpeningUpdate[]): Map<string, string[]> {
  const gained = new Map<string, string[]>();
  const add = (wallId: string | undefined, openingId: string): void => {
    if (wallId) gained.set(wallId, [...(gained.get(wallId) ?? []), openingId]);
  };
  for (const u of rehosted) add(u.nextParams.wallId, u.openingId);
  for (const o of openings) add(o.params.wallId, o.id);
  return gained;
}

function assemblePlan(
  input: OpeningWriteInput,
  hosts: ResolvedOpeningHosts,
  wallById: ReadonlyMap<string, WallEntity>,
  openings: readonly OpeningEntity[],
  rehosted: readonly OpeningUpdate[],
): OpeningWritePlan {
  const gained = gainedOpeningIds(openings, rehosted);
  const removedIds = new Set(hosts.removed.map((w) => w.id));
  const reshapedIds = new Set(hosts.reshaped.map((w) => w.id));
  const wallPatches: WallRetrimEntry[] = [];
  const mirrorPatches: HostedOpeningIdsEntry[] = [];
  for (const prev of input.entities.filter(isWallEntity)) {
    const next = wallById.get(prev.id);
    if (removedIds.has(prev.id) || !next) continue;
    if (reshapedIds.has(prev.id) || wallTrimChanged(prev.params, next.params)) {
      wallPatches.push({ entityId: prev.id, prev: prev.params, next: next.params, kind: prev.kind });
    }
    const before = prev.hostedOpeningIds ?? [];
    const after = [...new Set([...before, ...(gained.get(prev.id) ?? [])])];
    if (after.length !== before.length) {
      mirrorPatches.push({ entityId: prev.id, prev: prev.hostedOpeningIds, next: after });
    }
  }
  const addedWalls = hosts.added.map((w) => ({ ...(wallById.get(w.id) ?? w), hostedOpeningIds: gained.get(w.id) ?? [] }));
  return { removedWalls: hosts.removed, addedWalls, wallPatches, mirrorPatches, rehosted, openings };
}

export function planOpeningWrite(input: OpeningWriteInput): OpeningWritePlanResult {
  const items = input.items.filter(isWritable);
  if (items.length === 0) return refuse('nothing-to-write');
  const walls = new Map(input.entities.filter(isWallEntity).map((w) => [w.id, w] as const));
  const hosts = resolveOpeningHosts(items, walls, input);
  if (typeof hosts === 'string') return refuse(hosts);

  // ADR-567 — κανένας ΝΕΟΣ τοίχος πάνω σε υπάρχουσα δομική· κριτής η σκηνή όπως ΘΑ είναι.
  const kept = sceneWithHosts(input.entities, hosts);
  if (partitionByStructuralOverlap(hosts.added, kept).blocked > 0) return refuse('overlap');

  const retrimmed = retrimWallEntities([...kept, ...hosts.added]);
  const wallById = new Map(retrimmed.filter(isWallEntity).map((w) => [w.id, w] as const));
  const openings: OpeningEntity[] = [];
  for (const item of items) {
    const host = wallById.get(hosts.hostIdByItemKey.get(item.key) ?? '');
    const opening = host ? buildOpening(item, host, input) : null;
    if (!opening) return refuse('invalid-opening');
    openings.push(opening);
  }
  return { ok: true, plan: assemblePlan(input, hosts, wallById, openings, rehostExisting(input.entities, hosts, wallById)) };
}
