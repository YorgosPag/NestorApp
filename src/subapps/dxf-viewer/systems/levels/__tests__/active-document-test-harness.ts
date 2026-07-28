/**
 * active-document-test-harness — στήνει ένα ΠΛΗΡΕΣ ενεργό έγγραφο για jest.
 *
 * ADR-719 §9. Μετά το ADR-719, κάθε μόνιμη αλλαγή ιδιότητας layer περνά από τη
 * `layer-flags-writer`, που γράφει **και** στο έγγραφο **και** στη runtime προβολή, και
 * είναι **fail-closed**: χωρίς ενεργό έγγραφο δεν γράφει τίποτα και επιστρέφει `false`.
 *
 * Αυτό έσπασε τέσσερα test suites — και **σωστά**: έστηναν μόνο τον `LayerStore` με
 * `setLayers([...])` και μετά περίμεναν ότι μια εντολή θα άλλαζε flags. Δηλαδή έλεγχαν
 * ακριβώς τη μισή αρχιτεκτονική που παρήγαγε το bug: «η προβολή άλλαξε» χωρίς να ρωτούν
 * ποτέ «και το έγγραφο;». Ένα test που περνά με runtime-only γραφή δεν θα έπιανε ποτέ την
 * απώλεια στο επόμενο hydration.
 *
 * Ο harness στήνει τον πλήρη βρόχο, οπότε τα ίδια tests πλέον αποδεικνύουν **και τα δύο**
 * σκέλη. Χρησιμοποίησε το {@link expectPersisted} για να το κάνεις ρητό εκεί που μετράει.
 *
 * @module systems/levels/__tests__/active-document-test-harness
 * @see services/layer-flags-writer
 */

import type { SceneLayer } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import { SceneStore } from '../../scene/SceneStore';
import { setLayers, getLayer, __resetLayerStoreForTesting } from '../../../stores/LayerStore';
import { registerActiveDocument, __resetActiveDocumentForTesting } from '../active-document-gateway';

/** Σταθερό level id για tests — αυθαίρετο αλλά ρητό, ώστε τα assertions να το ονομάζουν. */
export const TEST_LEVEL_ID = 'lvl_test_active_document';

function buildScene(layers: ReadonlyArray<SceneLayer>): SceneModel {
  const layersById: Record<string, SceneLayer> = {};
  for (const layer of layers) layersById[layer.id ?? layer.name] = layer;
  return {
    entities: [],
    layersById,
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    units: 'mm',
  } as SceneModel;
}

/**
 * Στήνει έγγραφο + runtime προβολή με τα ίδια layers και καταχωρεί τη θύρα.
 *
 * Ο writer γράφει κατευθείαν στο `SceneStore` (χωρίς auto-save — δεν υπάρχει Firestore σε
 * jest), που είναι ακριβώς το στρώμα που διαβάζει η θύρα πίσω.
 */
export function setupActiveDocument(layers: ReadonlyArray<SceneLayer>): void {
  __resetLayerStoreForTesting();
  __resetActiveDocumentForTesting();
  SceneStore._resetForTests();

  SceneStore.setLevelScene(TEST_LEVEL_ID, buildScene(layers));
  setLayers(layers);
  registerActiveDocument(TEST_LEVEL_ID, (levelId, scene) => {
    SceneStore.setLevelScene(levelId, scene);
  });
}

/** Καθαρισμός — κάλεσέ το σε `afterEach` ώστε τα suites να μένουν απομονωμένα. */
export function teardownActiveDocument(): void {
  __resetActiveDocumentForTesting();
  SceneStore._resetForTests();
  __resetLayerStoreForTesting();
}

/** Το layer όπως ζει στο **έγγραφο** (όχι στην προβολή). */
export function getPersistedLayer(layerId: string): SceneLayer | undefined {
  return SceneStore.getLevelScene(TEST_LEVEL_ID)?.layersById[layerId];
}

/**
 * Επιβεβαιώνει ότι έγγραφο **και** προβολή συμφωνούν για ένα flag.
 *
 * Αυτό είναι το assertion που έλειπε: το παλιό `expect(getLayer(id)?.frozen).toBe(true)`
 * ρωτούσε μόνο την προβολή, άρα περνούσε και με runtime-only γραφή — δηλαδή με τη
 * συμπεριφορά που έχανε την αλλαγή στο επόμενο hydration.
 */
export function expectPersisted<K extends keyof SceneLayer>(
  layerId: string,
  key: K,
  expected: SceneLayer[K],
): void {
  expect(getPersistedLayer(layerId)?.[key]).toBe(expected);
  expect(getLayer(layerId)?.[key]).toBe(expected);
}
