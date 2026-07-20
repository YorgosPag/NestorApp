/**
 * ADR-635 Φ C.17 — Layer identity reconciliation στο σύνορο εισαγωγής (pure SSoT).
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ: το `registerLayer` (`utils/dxf-scene-builder.ts`) καλεί `createSceneLayer`
 * ΧΩΡΙΣ `id`, οπότε ΚΑΘΕ import κόβει νέο τυχαίο `lyr_<UUID>` — ακόμα και για layer με
 * το ΙΔΙΟ όνομα. Τα per-entity-persisted entities (γραμμοσκιάσεις, και κάθε BIM service:
 * beam/column/floor-finish/electrical-panel) όμως αποθηκεύουν το `layerId` στο Firestore
 * και το επιστρέφουν ωμό. Στο re-import το `setLevelScene` αντικαθιστά τη σκηνή με νέα
 * ids, το `mergeDocsIntoScene` ξαναβάζει τα docs με τα ΠΑΛΙΑ → **ορφανά**: ζωγραφίζονται
 * (ο `dxf-entity-layer-skip.ts` κάνει fail-open) αλλά είναι απρόσιτα από ορατότητα,
 * πάγωμα, isolate, χρώμα και επιλογή-ανά-layer. Μετρημένο 2026-07-20: 2178 vs 2295
 * (= 117 γραμμοσκιάσεις). Ίδια αρρώστια με ADR-420 (volatile `floorplanId` → durable
 * `floorId`): αποθηκεύεται volatile id.
 *
 * Η ΛΥΣΗ — πρακτική των μεγάλων παικτών, δύο κανόνες που ΔΕΝ συγχέονται:
 *   1. **Ταυτότητα = opaque σταθερό id**, ΠΟΤΕ παράγωγο του ονόματος (Revit UniqueId,
 *      Figma node id, ArchiCAD attribute GUID, AutoCAD layer-record handle). Έτσι το
 *      `renameLayer()` κρατά το id σταθερό ενώ αλλάζει το όνομα — invariant που
 *      κλειδώνει το `services/__tests__/layer-rename-backref-integration.test.ts`.
 *   2. **Reconcile-by-name στο σύνορο εισαγωγής**: layer με ίδιο όνομα στον όροφο-στόχο
 *      → ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕ το υπάρχον id. Ακριβώς ό,τι κάνει το ArchiCAD Attribute
 *      Manager (merge by name), το AutoCAD XREF bind, το Revit link-reload.
 *
 * ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ BUILDER: το `DxfSceneBuilder.buildSceneWithDiagnostics` είναι
 * pure και τρέχει ΚΑΙ σε web worker (`workers/dxf-parser.worker.ts`) — δεν επιτρέπεται
 * store/levelManager access. Ένα post-pass στο import boundary καλύπτει ΚΑΙ το `.tek`
 * branch με ΜΙΑ υλοποίηση (N.18). Ίδιο μοτίβο «reconcile στο σύνορο» με το
 * `reconcileLoadedSceneBim` (`scene-bim-load-policy.ts`).
 *
 * ⚠️ ΓΝΩΣΤΟ ΟΡΙΟ (μην το «διορθώσεις» με hack): το reconcile βλέπει μόνο ό,τι του δώσει
 * ο caller από το `getLevelScene(targetLevelId)`. Αν ο όροφος-στόχος δεν φορτώθηκε ποτέ,
 * το scene είναι κενό → fast-path → νέα ids. Σωστό σήμερα (καθαρό re-import, καθόλου
 * legacy docs)· θα χρειαστεί προσοχή αν κάποτε επιτραπεί import σε αφόρτωτο όροφο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-635-autocad-dxf-import-entity-coverage.md
 * @see docs/centralized-systems/reference/adrs/ADR-358-layer-management-system.md
 * @see hooks/scene/useSceneState.ts — ο ΜΟΝΟΣ caller (commitImportedScene)
 */

import { dequal } from 'dequal';
import type { Entity, SceneLayer, SceneModel } from '../../types/entities';
import { isArrayEntity, isBlockEntity, isGroupEntity } from '../../types/entities';

export interface LayerIdentityReconcileResult {
  readonly scene: SceneModel;
  /** Incoming layers που πήραν πίσω το υπάρχον id (το πραγματικό «κέρδος»). */
  readonly reusedLayerIds: number;
  /** Existing layers που δεν υπήρχαν στο εισαγόμενο αρχείο και διατηρήθηκαν. */
  readonly carriedOverLayers: number;
  /** Πλήθος entities (top-level + nested) που άλλαξαν `layerId`. */
  readonly remappedEntities: number;
  /** Ονόματα incoming layers που δεν μπόρεσαν να διεκδικήσουν existing id (§Β). */
  readonly nameCollisions: ReadonlyArray<string>;
}

/**
 * Κλειδί ταυτότητας ονόματος layer. Case-INsensitive by design: ο ίδιος ο
 * `services/layer-name-validator.ts` ορίζει τα duplicates case-insensitively
 * (= AutoCAD). Case-sensitive match εδώ θα παρήγαγε layer που το ίδιο μας το
 * `guardLayerName` θεωρεί DUPLICATE — ασυνέπεια εντός SSoT.
 */
function identityKey(layer: SceneLayer): string {
  // ADR-635 Φ C.17 Βήμα 4 — το `sourceName` (αρχικό DXF όνομα, immutable) προηγείται
  // ώστε ένα μετονομασμένο layer να εξακολουθεί να ταιριάζει με το re-import του ίδιου
  // αρχείου. Αναλογία: AutoCAD XREF κρατά το source layer name.
  return (layer.sourceName ?? layer.name).trim().toLowerCase();
}

/**
 * Ποια πεδία κερδίζει ποιος όταν ένα incoming layer ταιριάξει με υπάρχον.
 *
 * **Η ταυτότητα και η ΚΑΤΑΣΤΑΣΗ ανήκουν στον χρήστη· η ΕΜΦΑΝΙΣΗ ανήκει στο αρχείο.**
 *
 * Το «incoming κερδίζει στο χρώμα» δεν είναι γούστο — είναι αναγκαστικό: ο builder
 * ΨΗΝΕΙ το BYLAYER χρώμα μέσα στο entity (`dxf-scene-builder.ts` resolveEntityLayerAndColor)
 * και ο renderer το διαβάζει από εκεί (`systems/properties/resolve-entity-color.ts`). Αν
 * κρατούσαμε το existing χρώμα του layer, το swatch στο πάνελ θα έλεγε κόκκινο ενώ η
 * γεωμετρία θα ζωγραφιζόταν μπλε — visual dual-authority.
 */
function mergeMatchedLayer(existing: SceneLayer, incoming: SceneLayer): SceneLayer {
  return {
    ...existing,
    // Εμφάνιση από το αρχείο:
    color: incoming.color,
    colorAci: incoming.colorAci,
    colorTrueColor: incoming.colorTrueColor,
    linetype: incoming.linetype,
    lineweight: incoming.lineweight,
    // Ταυτότητα + κατάσταση χρήστη (id/name/visible/frozen/locked/transparency/
    // plottable/source/createdAt/category/tags/description/vpOverrides) από το `...existing`.
    // Το `sourceName` διατηρείται από το existing· αν λείπει (σκηνή προ-Φ C.17) το
    // παίρνουμε από το incoming ώστε το ΕΠΟΜΕΝΟ re-import να ταιριάξει και μετά από rename.
    sourceName: existing.sourceName ?? incoming.sourceName,
  };
}

/**
 * Αναδρομικό remap του `layerId` σε ένα entity και στους nested containers του.
 *
 * ⚠️ ΤΡΕΙΣ containers κρατούν entities ΕΚΤΟΣ του live `scene.entities`, όλοι με δικό τους
 * `layerId`. Αν ξεχαστεί έστω ένας, φτιάχνουμε ΔΕΥΤΕΡΟ ορφανό-γεννήτορα:
 *   - `BlockEntity.entities`       (ADR-640 — DXF INSERT, αναδρομικά για nested blocks)
 *   - `ArrayEntity.hiddenSources`  (ADR-353 — deep-cloned sources, εκτός σκηνής)
 *   - `GroupEntity.members`        (ADR-575 — owned members, εκτός σκηνής)
 *
 * Structural sharing: entity που δεν άλλαξε επιστρέφεται με ΤΟ ΙΔΙΟ reference (κρίσιμο
 * για το WeakMap cache του `useDxfSceneConversion` και τα equality guards του ADR-040).
 */
function remapEntity(entity: Entity, idMap: ReadonlyMap<string, string>, stats: { count: number }): Entity {
  const current = (entity as { layerId?: string }).layerId;
  const nextLayerId = current ? idMap.get(current) : undefined;

  const children = readChildren(entity);
  const nextChildren = children
    ? children.map((child) => remapEntity(child, idMap, stats))
    : null;
  const childrenChanged = nextChildren !== null && children !== null
    && nextChildren.some((child, i) => child !== children[i]);

  if (!nextLayerId && !childrenChanged) return entity;
  if (nextLayerId) stats.count += 1;

  const next = { ...entity } as Entity & { layerId?: string };
  if (nextLayerId) next.layerId = nextLayerId;
  if (childrenChanged && nextChildren) writeChildren(next, nextChildren);
  return next;
}

/** Τα owned children ενός container entity, ή `null` αν δεν είναι container. */
function readChildren(entity: Entity): Entity[] | null {
  if (isBlockEntity(entity)) return entity.entities;
  if (isArrayEntity(entity)) return entity.hiddenSources;
  if (isGroupEntity(entity)) return entity.members;
  return null;
}

/** Γράφει τα remapped children πίσω στο σωστό πεδίο του container (mirror του readChildren). */
function writeChildren(entity: Entity, children: Entity[]): void {
  if (isBlockEntity(entity)) {
    (entity as { entities: Entity[] }).entities = children;
  } else if (isArrayEntity(entity)) {
    (entity as { hiddenSources: Entity[] }).hiddenSources = children;
  } else if (isGroupEntity(entity)) {
    (entity as { members: Entity[] }).members = children;
  }
}

/**
 * Ξαναδένει τα layer ids μιας εισαγόμενης σκηνής με αυτά που ήδη κατέχει ο όροφος-στόχος.
 *
 * Pure: το `incoming` δεν μεταλλάσσεται ΠΟΤΕ. Idempotent: δεύτερο πέρασμα με το ίδιο
 * `existingLayersById` επιστρέφει reference-equal αποτέλεσμα.
 *
 * @param incoming Η φρεσκο-χτισμένη σκηνή (DXF ή .tek), πριν το `setLevelScene`.
 * @param existingLayersById Τα layers που ΗΔΗ κατέχει ο όροφος-στόχος
 *   (`getLevelScene(targetLevelId)?.layersById`). Κενό/απόν ⇒ πρώτο import ⇒ no-op.
 */
export function reconcileSceneLayerIdentity(
  incoming: SceneModel,
  existingLayersById: Readonly<Record<string, SceneLayer>> | null | undefined,
): LayerIdentityReconcileResult {
  const existingLayers = existingLayersById ? Object.values(existingLayersById) : [];
  const noop: LayerIdentityReconcileResult = {
    scene: incoming,
    reusedLayerIds: 0,
    carriedOverLayers: 0,
    remappedEntities: 0,
    nameCollisions: [],
  };
  // §Η — πρώτο import: ίδιο reference, μηδέν allocation.
  if (existingLayers.length === 0) return noop;

  const existingByName = new Map<string, SceneLayer>();
  for (const layer of existingLayers) {
    const key = identityKey(layer);
    // First-claim wins: αν η ΥΠΑΡΧΟΥΣΑ σκηνή έχει ήδη duplicate ονόματα (δεν θα έπρεπε —
    // ο guardLayerName το εμποδίζει — αλλά μια χειρόγραφη/legacy σκηνή μπορεί), κρατάμε
    // το πρώτο ώστε το αποτέλεσμα να είναι ντετερμινιστικό.
    if (!existingByName.has(key)) existingByName.set(key, layer);
  }

  const nextLayersById: Record<string, SceneLayer> = {};
  const idMap = new Map<string, string>();
  const claimedExistingIds = new Set<string>();
  const nameCollisions: string[] = [];
  let reusedLayerIds = 0;
  /** Άλλαξε ΟΥΣΙΑΣΤΙΚΑ κάτι; Αν όχι, γυρνάμε το incoming ως έχει (idempotency). */
  let layersChanged = false;

  for (const incomingLayer of Object.values(incoming.layersById)) {
    const match = existingByName.get(identityKey(incomingLayer));

    // §Β INJECTIVITY — το `layersById` είναι keyed by id: αν δύο incoming layers έπαιρναν
    // το ΙΔΙΟ existing id, η δεύτερη εγγραφή θα ΕΣΒΗΝΕ σιωπηλά την πρώτη και θα χανόταν
    // ολόκληρο layer χωρίς κανένα error. Ένα existing id διεκδικείται από ΕΝΑ το πολύ
    // incoming layer· το δεύτερο κρατά το δικό του νέο id (και καταγράφεται).
    if (match && !claimedExistingIds.has(match.id)) {
      claimedExistingIds.add(match.id);
      const merged = mergeMatchedLayer(match, incomingLayer);
      nextLayersById[match.id] = merged;
      reusedLayerIds += 1;
      // Identity mapping (το layer ταιριάζει στον ΕΑΥΤΟ του — π.χ. δεύτερο reconcile της
      // ίδιας σκηνής) ΔΕΝ μπαίνει στο idMap: αλλιώς το `remapEntity` θα έφτιαχνε νέα
      // objects για entities που δεν άλλαξαν, ακυρώνοντας άσκοπα το WeakMap cache του
      // `useDxfSceneConversion` σε κάθε re-import (ADR-040).
      if (match.id !== incomingLayer.id) {
        idMap.set(incomingLayer.id, match.id);
        layersChanged = true;
      } else if (!dequal(merged, incomingLayer)) {
        layersChanged = true;
      }
      continue;
    }
    if (match) nameCollisions.push(incomingLayer.name);
    nextLayersById[incomingLayer.id] = incomingLayer;
  }

  // §Γ UNION — existing layer που ΔΕΝ υπάρχει στο εισαγόμενο αρχείο ΠΡΕΠΕΙ να επιβιώσει.
  // Αλλιώς τα per-entity BIM entities που επιστρέφουν από το `mergeDocsIntoScene` (ένας
  // τοίχος που ζωγράφισε ο χρήστης, στο layer «0» της προηγούμενης σκηνής) ορφανιάζουν
  // εκ νέου — το ίδιο bug από άλλη πόρτα. Είναι και η συμπεριφορά AutoCAD (XREF bind δεν
  // σβήνει layers του host) και ArchiCAD (Append δεν αφαιρεί attributes).
  let carriedOverLayers = 0;
  for (const layer of existingLayers) {
    if (claimedExistingIds.has(layer.id)) continue;
    if (nextLayersById[layer.id]) continue; // id ήδη πιασμένο από incoming — μη γράψεις πάνω
    nextLayersById[layer.id] = layer;
    carriedOverLayers += 1;
  }

  if (!layersChanged && carriedOverLayers === 0) return { ...noop, reusedLayerIds, nameCollisions };

  const stats = { count: 0 };
  const nextEntities = incoming.entities.map((e) => remapEntity(e, idMap, stats));
  const entitiesChanged = nextEntities.some((e, i) => e !== incoming.entities[i]);

  const scene: SceneModel = {
    ...incoming,
    layersById: nextLayersById,
    entities: entitiesChanged ? nextEntities : incoming.entities,
  };

  // §Β post-condition — κανένα layer δεν επιτρέπεται να εξαφανιστεί. Αν σπάσει, το
  // reconcile είναι λάθος και το ασφαλέστερο είναι να ΜΗΝ πειράξουμε τίποτα.
  if (Object.keys(scene.layersById).length < Object.keys(incoming.layersById).length) {
    return { ...noop, nameCollisions };
  }

  return {
    scene,
    reusedLayerIds,
    carriedOverLayers,
    remappedEntities: stats.count,
    nameCollisions,
  };
}
