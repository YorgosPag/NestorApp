'use client';

/**
 * ADR-650 §M10g — Ο ΕΝΑΣ ΙΔΙΟΚΤΗΤΗΣ της ερώτησης «το πλαίσιο άλλαξε — ποιος μετακινείται;»
 *
 * ── Το κενό που κλείνει ──────────────────────────────────────────────────────────────────
 * Μέχρι εδώ, στην αλλαγή γεωαναφοράς έτρεχε **μόνο** ο `regenerateTopoContours`: ξανάχτιζε
 * ό,τι ήξερε να παράγει (ισοϋψείς + footprint) και τα υπόλοιπα ψημένα προϊόντα — κάναβος,
 * ετικέτες, βορράς — έμεναν **σιωπηλά** στο παλιό σύστημα συντεταγμένων. Κανείς δεν ήταν
 * υπεύθυνος γι' αυτά, γιατί κανείς δεν ήξερε σε ποιο πλαίσιο ψήθηκαν (§M10g, σφραγίδα).
 *
 * ── Οι δύο κατηγορίες, και γιατί ΔΕΝ αντιμετωπίζονται το ίδιο ────────────────────────────
 *   • **Παράγωγα της πηγής** (ισοϋψείς, footprint) → **ξαναχτίζονται**. Δεν υπάρχει τίποτα
 *     του χρήστη μέσα τους· η αναγέννηση είναι ακριβώς σωστή και ήδη idempotent.
 *   • **Προϊόντα που ο χρήστης πειράζει** (κάναβος, ετικέτες, βορράς) → **μετακινούνται με
 *     delta rigid transform**. Η αναγέννηση εδώ θα ήταν **καταστροφική**: ο βορράς που ο
 *     χρήστης μετακίνησε στη γωνιά του φύλλου θα ξαναγεννιόταν στη θέση-άγκιστρο, δηλαδή η
 *     αλλαγή γεωαναφοράς θα **έσβηνε δουλειά**. Το Civil 3D κάνει ακριβώς delta-move όταν
 *     αλλάζει coordinate zone — και για τον ίδιο λόγο.
 *
 * ── Οι τρεις ιδιότητες (N.7.2) ──────────────────────────────────────────────────────────
 *   1. **Idempotent** — δουλεύει με *delta*, όχι με απόλυτη τιμή· ίδια σφραγίδα ⇒ no-op, και
 *      το ίδιο αντικείμενο σκηνής επιστρέφει (καμία εγγραφή, κανένα re-render).
 *   2. **Fail-closed** — ασφράγιστη ομάδα (legacy) ⇒ **δεν** μαντεύει πλαίσιο, **δεν** αγγίζει
 *      τίποτα, τη σημαδεύει. Το ίδιο για ομάδα που περιέχει τύπο τον οποίο ο SSoT της στροφής
 *      δεν καλύπτει: μερική μετακίνηση θα διέλυε τη γεωμετρία σιωπηλά.
 *   3. **ΕΝΑ lifecycle moment, ΜΙΑ εγγραφή** — rebuild + delta-move συντίθενται σε μία σκηνή
 *      και γράφονται μαζί (`system-reconcile`: μηδέν autosave, μηδέν undo entry).
 *
 * ── Μηδέν νέα μαθηματικά (N.18) ─────────────────────────────────────────────────────────
 * Το delta έρχεται από το `project-frame` (που με τη σειρά του συνθέτει τον πυρήνα του
 * `geo-transform`), και εφαρμόζεται με τα ΥΠΑΡΧΟΝΤΑ SSoT: `rotateEntity` (ADR-188) γύρω από
 * την αρχή + `translateEntityByAnchor` (ADR-349/397). Ούτε ένα `cos` δεν γράφεται εδώ.
 *
 * @see ../topo-baked-groups.ts — ποιες ομάδες υπάρχουν· πού ζει ο προσανατολισμός των glyphs
 * @see ./regenerate-topo.ts — το «ξαναχτίζεται» μισό (καθαρό `rebuildTopoDerivedScene`)
 * @see ../topo-frame-status-store.ts — πού σημαδεύεται το fail-closed εύρημα για το UI
 */

import type { SceneModel, AnySceneEntity } from '../../../types/scene';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { rotateEntity, ROTATE_SUPPORTED_TYPES } from '../../../utils/rotation-math';
import { translateEntityByAnchor } from '../../stretch/stretch-entity-transform';
import type { FrameDelta, ProjectFrameStamp } from '../../geo-referencing/project-frame';
import { frameDelta } from '../../geo-referencing/project-frame';
import { getActiveProjectFrame } from '../../geo-referencing/geo-reference-store';
import type { GlyphOrientation, TopoBakedGroup } from '../topo-baked-groups';
import { TOPO_BAKED_GROUPS, bakedGroupOfLayerName } from '../topo-baked-groups';
import type { TopoLevelBakedFrames } from '../topo-baked-frame-store';
import { getLevelBakedFrames, setLevelBakedFrames } from '../topo-baked-frame-store';
import { setTopoFrameStatus } from '../topo-frame-status-store';
import { rebuildTopoDerivedScene } from './regenerate-topo';

/** Το delta εκφράζεται ως «στροφή γύρω από την αρχή, μετά μετατόπιση» — αυτή είναι η αρχή. */
const FRAME_ROTATION_PIVOT: Point2D = { x: 0, y: 0 };

/**
 * Οι τύποι των οποίων το πεδίο `rotation` είναι **προσανατολισμός glyph** (χαρτί), όχι
 * γεωμετρία. Ένα `rectangle` έχει κι αυτό `rotation`, αλλά εκεί η στροφή ΕΙΝΑΙ το σχήμα —
 * γι' αυτό η λίστα είναι ρητή και στενή αντί για «όποιος έχει rotation».
 */
const GLYPH_ROTATION_TYPES: ReadonlySet<string> = new Set<string>(['text', 'mtext']);

const ROTATABLE_TYPES: ReadonlySet<string> = new Set<string>(ROTATE_SUPPORTED_TYPES);

export interface BakedFrameReconcileInput {
  readonly scene: SceneModel;
  /** Το πλαίσιο στο οποίο ΠΡΕΠΕΙ να κάθονται τα προϊόντα μετά το πέρασμα. */
  readonly currentFrame: ProjectFrameStamp;
  /** Οι σφραγίδες αυτού του επιπέδου. Απούσα ομάδα = ασφράγιστη (legacy). */
  readonly bakedFrames: TopoLevelBakedFrames;
}

export interface BakedFrameReconcileResult {
  /** Η νέα σκηνή — **η ίδια αναφορά** όταν καμία οντότητα δεν μετακινήθηκε. */
  readonly scene: SceneModel;
  /** Οι σφραγίδες μετά το πέρασμα (ενημερωμένες· άδειες ομάδες αποσύρονται). */
  readonly nextBakedFrames: TopoLevelBakedFrames;
  /** Πόσες οντότητες μετακινήθηκαν ανά ομάδα (μόνο για όσες όντως κουνήθηκαν). */
  readonly movedByGroup: Readonly<Partial<Record<TopoBakedGroup, number>>>;
  /** Ομάδες με ψημένες οντότητες αλλά **χωρίς σφραγίδα** — δεν αγγίχτηκαν (fail-closed). */
  readonly unstampedGroups: readonly TopoBakedGroup[];
  /** Ομάδες που περιέχουν τύπο τον οποίο ο SSoT της στροφής δεν καλύπτει — δεν αγγίχτηκαν. */
  readonly unsupportedGroups: readonly TopoBakedGroup[];
}

/**
 * PURE: μετακινεί τα ψημένα προϊόντα της σκηνής από τη σφραγίδα τους στο `currentFrame`.
 *
 * Δεν αγγίζει τίποτα εκτός των δηλωμένων layers, δεν διαβάζει store, δεν γράφει σκηνή.
 */
export function reconcileBakedFramesInScene(
  input: BakedFrameReconcileInput,
): BakedFrameReconcileResult {
  const { scene, currentFrame, bakedFrames } = input;
  const groupByLayerId = mapLayerIdsToGroups(scene);

  const movedByGroup: Partial<Record<TopoBakedGroup, number>> = {};
  const unstampedGroups: TopoBakedGroup[] = [];
  const unsupportedGroups: TopoBakedGroup[] = [];
  const nextFrames: Partial<Record<TopoBakedGroup, ProjectFrameStamp>> = {};

  // Μία μεταβλητή αντικατάστασης ανά οντότητα: χτίζεται μόνο αν κάτι όντως κουνηθεί.
  let nextEntities: AnySceneEntity[] | null = null;

  for (const spec of TOPO_BAKED_GROUPS) {
    const indices = entityIndicesOfGroup(scene, groupByLayerId, spec.group);
    const stamp = bakedFrames[spec.group] ?? null;

    // Άδεια ομάδα: η σφραγίδα δεν περιγράφει τίποτα πια — αποσύρεται (ο χρήστης τα έσβησε).
    if (indices.length === 0) continue;

    if (!stamp) {
      // Fail-closed: ψημένη γεωμετρία άγνωστου πλαισίου. ΔΕΝ μαντεύουμε — σημαδεύουμε.
      unstampedGroups.push(spec.group);
      continue;
    }

    const delta = frameDelta(stamp, currentFrame);
    if (!delta) {
      nextFrames[spec.group] = stamp; // ήδη στο τρέχον πλαίσιο (idempotent no-op)
      continue;
    }

    if (delta.rotationDeg !== 0 && !indices.every((i) => ROTATABLE_TYPES.has(scene.entities[i].type))) {
      // Fail-closed: μερική στροφή θα διέλυε τη γεωμετρία σιωπηλά. Η σφραγίδα μένει η παλιά,
      // ώστε το επόμενο πέρασμα (μετά από διόρθωση) να ξαναδοκιμάσει.
      unsupportedGroups.push(spec.group);
      nextFrames[spec.group] = stamp;
      continue;
    }

    nextEntities ??= [...scene.entities];
    for (const index of indices) {
      nextEntities[index] = moveEntityToFrame(nextEntities[index], delta, spec.glyphOrientation);
    }
    movedByGroup[spec.group] = indices.length;
    nextFrames[spec.group] = currentFrame;
  }

  return {
    scene: nextEntities ? { ...scene, entities: nextEntities } : scene,
    nextBakedFrames: nextFrames,
    movedByGroup,
    unstampedGroups,
    unsupportedGroups,
  };
}

/** layerId → ομάδα, μέσω του ΟΝΟΜΑΤΟΣ του layer (τα ids γεννιούνται εκ νέου ανά σκηνή). */
function mapLayerIdsToGroups(scene: SceneModel): ReadonlyMap<string, TopoBakedGroup> {
  const out = new Map<string, TopoBakedGroup>();
  for (const layer of Object.values(scene.layersById)) {
    const group = bakedGroupOfLayerName(layer.name);
    if (group) out.set(layer.id, group);
  }
  return out;
}

/** Οι θέσεις των οντοτήτων της ομάδας μέσα στον πίνακα `scene.entities` (θέση = z-order, ADR-661). */
function entityIndicesOfGroup(
  scene: SceneModel,
  groupByLayerId: ReadonlyMap<string, TopoBakedGroup>,
  group: TopoBakedGroup,
): number[] {
  const out: number[] = [];
  scene.entities.forEach((entity, index) => {
    if (entity.layerId !== undefined && groupByLayerId.get(entity.layerId) === group) out.push(index);
  });
  return out;
}

/**
 * Μία οντότητα, από το παλιό πλαίσιο στο νέο: **στροφή γύρω από την αρχή, μετά μετατόπιση**
 * — ακριβώς η μορφή στην οποία το `project-frame` παράγει το delta.
 *
 * Καθαρή μετατόπιση (η συνήθης περίπτωση: ο χρήστης ξανα-έδειξε το origin χωρίς να στρίψει)
 * παρακάμπτει εντελώς τη στροφή — μηδέν άγγιγμα σε πεδία γωνίας, μηδέν κόστος.
 */
function moveEntityToFrame(
  entity: AnySceneEntity,
  delta: FrameDelta,
  glyphOrientation: GlyphOrientation,
): AnySceneEntity {
  let next = entity;
  if (delta.rotationDeg !== 0) {
    const rotated = {
      ...next,
      ...rotateEntity(next as unknown as Entity, FRAME_ROTATION_PIVOT, delta.rotationDeg),
    } as AnySceneEntity;
    next = glyphOrientation === 'paper' ? withPaperGlyphRotation(entity, rotated) : rotated;
  }
  return {
    ...next,
    ...translateEntityByAnchor(next as unknown as Entity, delta.translationMm),
  } as AnySceneEntity;
}

/**
 * Επαναφέρει τον προσανατολισμό των glyphs σε ομάδα **του χαρτιού** (§M10f κανόνας 3).
 *
 * Η ΘΕΣΗ του κειμένου έχει ήδη στραφεί (είναι γεωμετρία)· η ΓΩΝΙΑ του όχι, γιατί τα glyphs
 * του υπομνήματος σχεδιάζονται οριζόντια στο χαρτί — ένα φρέσκο ψήσιμο θα τα ξανάγραφε
 * οριζόντια, οπότε ο reconciler που θα τα έστριβε θα απέκλινε από τον ίδιο του τον παραγωγό.
 */
function withPaperGlyphRotation(original: AnySceneEntity, rotated: AnySceneEntity): AnySceneEntity {
  if (!GLYPH_ROTATION_TYPES.has(rotated.type)) return rotated;
  const previous = (original as { rotation?: number }).rotation;
  if (previous === undefined) {
    const { rotation: _dropped, ...rest } = rotated as AnySceneEntity & { rotation?: number };
    return rest as AnySceneEntity;
  }
  return { ...rotated, rotation: previous } as AnySceneEntity;
}

export interface TopoFrameReconcileDeps {
  readonly getScene: (levelId: string) => SceneModel | null;
  /** Silent write (`system-reconcile`) — μηδέν autosave, μηδέν undo entry. */
  readonly commitScene: (scene: SceneModel) => void;
  readonly levelId: string;
}

export interface TopoFrameReconcileOutcome {
  /** Πόσες παράγωγες οντότητες (ισοϋψείς + footprint) ξαναχτίστηκαν. */
  readonly derivedCount: number;
  readonly movedByGroup: Readonly<Partial<Record<TopoBakedGroup, number>>>;
  readonly unstampedGroups: readonly TopoBakedGroup[];
  readonly unsupportedGroups: readonly TopoBakedGroup[];
}

/**
 * **Η ΜΙΑ στιγμή του κύκλου ζωής**: φόρτωση, αλλαγή επιπέδου ή αλλαγή γεωαναφοράς.
 *
 * Ξαναχτίζει τα παράγωγα, μετακινεί με delta τα ψημένα, γράφει **μία** σκηνή, ενημερώνει τις
 * σφραγίδες και σημαδεύει ό,τι έμεινε fail-closed για το UI. Αντικαθιστά τη σκέτη κλήση
 * `regenerateTopoContours` σε κάθε σημείο όπου το πλαίσιο μπορεί να έχει αλλάξει.
 */
export function reconcileTopoFrame(deps: TopoFrameReconcileDeps): TopoFrameReconcileOutcome {
  const scene = deps.getScene(deps.levelId);
  if (!scene) {
    return { derivedCount: 0, movedByGroup: {}, unstampedGroups: [], unsupportedGroups: [] };
  }

  const rebuilt = rebuildTopoDerivedScene(scene);
  const reconciled = reconcileBakedFramesInScene({
    scene: rebuilt.scene,
    currentFrame: getActiveProjectFrame(),
    bakedFrames: getLevelBakedFrames(deps.levelId),
  });

  deps.commitScene(reconciled.scene);
  setLevelBakedFrames(deps.levelId, reconciled.nextBakedFrames);
  setTopoFrameStatus(deps.levelId, {
    unstampedGroups: reconciled.unstampedGroups,
    unsupportedGroups: reconciled.unsupportedGroups,
  });

  return {
    derivedCount: rebuilt.count,
    movedByGroup: reconciled.movedByGroup,
    unstampedGroups: reconciled.unstampedGroups,
    unsupportedGroups: reconciled.unsupportedGroups,
  };
}
