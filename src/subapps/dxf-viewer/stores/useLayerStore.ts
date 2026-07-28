'use client';

/**
 * useLayerStore — τα React leaves πάνω στο {@link module:stores/LayerStore} SSoT.
 *
 * ADR-721 §5. Ο `LayerStore` είναι ο **runtime owner** των layer flags (ADR-382 §1.2): από
 * εκεί διαβάζουν ο 2Δ renderer (`isEntityLayerSkipped`), ο BIM visibility resolver, ο WebGL
 * line layer και η ακύρωση του bitmap cache. Μέχρι το ADR-721, τα panels ορατότητας
 * (`LayerItem` / `ColorGroupItem`) διάβαζαν τα ΙΔΙΑ flags από **άλλη** πηγή — το prop
 * `SceneModel.layersById` — οπότε UI και καμβάς μπορούσαν να διαφωνούν επ' αόριστον. Ακριβώς
 * αυτό μετρήθηκε ζωντανά: store `visible: true`, panel `visible: false`, εικονίδιο 👁̸.
 *
 * Εδώ ζουν τα leaves ώστε **ό,τι δείχνει το εικονίδιο να είναι ό,τι ζωγραφίζει ο καμβάς**,
 * εξ ορισμού και όχι κατά σύμπτωση.
 *
 * ## Ref-stability (η προϋπόθεση του `useSyncExternalStore`)
 *
 * React συγκρίνει το αποτέλεσμα του `getSnapshot` με `Object.is` σε κάθε render· νέο
 * αντικείμενο ανά κλήση ⇒ άπειρος βρόχος. Κάθε leaf εδώ επιστρέφει είτε **primitive**
 * (boolean / string union) είτε την **ίδια αναφορά** που κρατά το store Map — το οποίο
 * αλλάζει μόνο σε πραγματικό `upsertLayer`/`setLayers` (και τα δύο έχουν πλέον φρουρό
 * ιδεμποτικότητας, §3). Καμία `.map`/`.filter`/object-literal μέσα σε getSnapshot.
 *
 * ## Γιατί ξεχωριστό αρχείο από το `LayerStore.ts`
 *
 * Το `LayerStore` είναι zero-React micro-leaf (ADR-040) — το διαβάζουν renderers και
 * commands εκτός React. Ένα `import { useSyncExternalStore } from 'react'` μέσα του θα
 * έσερνε το React σε κάθε non-React consumer. Ίδιος διαχωρισμός με
 * `bim/visibility/visibility-resolver.ts` (pure) vs `bim-plan-visibility.ts` (store-reading).
 *
 * @module stores/useLayerStore
 * @see config/layer-visibility — τα κατηγορήματα που ερμηνεύουν τα flags
 * @see docs/centralized-systems/reference/adrs/ADR-721
 */

import { useCallback, useSyncExternalStore } from 'react';
import {
  subscribeLayerStore,
  getLayerStoreSnapshot,
  getLayer,
  type LayerStoreSnapshot,
} from './LayerStore';
import {
  isLayerOn,
  resolveLayerGroupOnState,
  type LayerGroupOnState,
} from '../config/layer-visibility';

/**
 * Ολόκληρο το snapshot του store (layers + currentLayerId + recent + version).
 *
 * SSoT για το τριπλό `useSyncExternalStore(subscribeLayerStore, getLayerStoreSnapshot,
 * getLayerStoreSnapshot)` που ήταν αντιγραμμένο σε `PropertiesPalette`,
 * `QuickPropertiesMiniPanel`, `useLayerManagerState`, `useCurrentLayerPickerState` (N.0.2).
 * Προτίμησε τα στενότερα leaves παρακάτω όταν χρειάζεσαι **ένα** layer — αυτό εδώ
 * ξανα-render-άρει σε ΚΑΘΕ αλλαγή οποιουδήποτε layer.
 */
export function useLayerStoreSnapshot(): LayerStoreSnapshot {
  return useSyncExternalStore(subscribeLayerStore, getLayerStoreSnapshot, getLayerStoreSnapshot);
}

// ADR-721 §9 — Το leaf `useSceneLayer(idOrName): SceneLayer | null` ΑΦΑΙΡΕΘΗΚΕ (CHECK 3.30).
//
// Γεννήθηκε ως «πλήρες API» χωρίς καταναλωτή. Ο διαχωρισμός του §5 είναι **ρητή απόφαση**, όχι
// παράλειψη: από τον runtime SSoT έρχονται τα **flags** (ο διακόπτης — `useIsLayerOn`), ενώ
// name/color/id παραμένουν **δεδομένα εγγράφου** και διαβάζονται από τη σκηνή (βλ. σχόλιο στο
// `LayerItem`). Ένα leaf που επιστρέφει ΟΛΟΚΛΗΡΟ το layer σβήνει αυτή τη γραμμή: ο επόμενος
// καταναλωτής θα τραβούσε από εδώ και το `color`, και θα ξαναγεννιόταν η διπλή πηγή αλήθειας
// που έκλεισε το ADR-721.
//
// Αν ΠΟΤΕ χρειαστεί επιπλέον flag αντιδραστικά (π.χ. `frozen`/`locked` σε εικονίδιο panel),
// πρόσθεσε **στενό** leaf με το όνομα του ερωτήματος (`useIsLayerFrozen`), όχι γενικό getter.

/**
 * «Είναι αναμμένος ο διακόπτης αυτού του layer;» — AutoCAD `LAYON` (βλ. {@link isLayerOn}).
 *
 * Boolean ⇒ το leaf ξανα-render-άρει **μόνο** όταν γυρίσει ο διακόπτης, ούτε καν όταν αλλάξει
 * χρώμα/πάχος του ίδιου layer. Αυτό θέλει ένα εικονίδιο ματιού.
 *
 * Άγνωστο layer ⇒ `true` (καμία δέσμευση· δεν εξαφανίζουμε UI για σπασμένο id).
 */
export function useIsLayerOn(idOrName: string | null | undefined): boolean {
  const getSnapshot = useCallback(
    (): boolean => (idOrName ? isLayerOn(getLayer(idOrName)) : true),
    [idOrName],
  );
  return useSyncExternalStore(subscribeLayerStore, getSnapshot, getSnapshot);
}

/**
 * Διαχωριστικό για το σταθερό κλειδί του {@link useLayerGroupOnState}.
 *
 * **Unit separator (U+001F), όχι κενό/κόμμα.** Τα ονόματα layer του DXF επιτρέπουν κενά,
 * κόμματα, τελείες και ελληνικά — πραγματικά δείγματα από το `47_ergasia.dxf`:
 * `Visible Elevation`, `Hatch_Κρυφό`, `Periferia_Kentrikis_Makedonias_20251125`. Ένα
 * `join(' ')` + `split(' ')` θα διέλυε το `Visible Elevation` σε δύο ανύπαρκτα layers →
 * `getLayer()` → `null` → «καμία δέσμευση» → ο ομαδικός διακόπτης θα έδειχνε σιωπηλά λάθος
 * κατάσταση. Ο U+001F δεν είναι έγκυρος χαρακτήρας ονόματος layer, και σε αντίθεση με το NUL
 * δεν κάνει το αρχείο να μοιάζει binary στο git/grep.
 */
const GROUP_KEY_SEP = '\u001F';

/**
 * Ομαδικός διακόπτης για header ομάδας: `'all'` | `'some'` | `'none'`.
 *
 * Το `keys` γίνεται join σε σταθερό κλειδί ώστε ο `useCallback` να μην ανανεώνεται όταν ο
 * caller περνά νέο array literal με ίδιο περιεχόμενο (η συνηθισμένη περίπτωση: τα
 * `layerNames` μιας ομάδας χρώματος παράγονται ανά render από ομαδοποίηση της σκηνής).
 */
export function useLayerGroupOnState(keys: ReadonlyArray<string>): LayerGroupOnState {
  const joined = keys.join(GROUP_KEY_SEP);
  const getSnapshot = useCallback((): LayerGroupOnState => {
    const list = joined.length === 0 ? [] : joined.split(GROUP_KEY_SEP);
    return resolveLayerGroupOnState(list.map((k) => getLayer(k)));
  }, [joined]);
  return useSyncExternalStore(subscribeLayerStore, getSnapshot, getSnapshot);
}
