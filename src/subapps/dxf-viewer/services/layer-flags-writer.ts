/**
 * layer-flags-writer — η **ΜΙΑ πόρτα** για κάθε μόνιμη αλλαγή ιδιότητας επιπέδου.
 *
 * ADR-719 §7.
 *
 * ## Το πρόβλημα που λύνει
 *
 * Οι ιδιότητες ενός layer ζούσαν σε δύο μέρη με **δύο ανεξάρτητα σύνολα γραφέων**:
 *
 *   - `SceneModel.layersById` — το **έγγραφο** (αποθηκεύεται· γράφει το panel «Επίπεδα DXF»)
 *   - `LayerStore` — η **runtime προβολή** (τη διαβάζει ο renderer· έγραφαν 16 άλλα σημεία)
 *
 * Το hydration αντιγράφει έγγραφο → προβολή σε κάθε αλλαγή σκηνής. Άρα ό,τι έγραφε μόνο
 * στην προβολή **σβηνόταν σιωπηλά**: κρύβεις layer από τον Layer Manager, σχεδιάζεις μια
 * γραμμή, το layer επανεμφανίζεται. Δεν ήταν race — ήταν ντετερμινιστική απώλεια.
 *
 * ## Το συμβόλαιο
 *
 * Κάθε **μόνιμη** αλλαγή περνά από εδώ και γράφει **και στα δύο, στο ίδιο tick**:
 *   1. έγγραφο, μέσω της auto-save-aware θύρας (`withActiveDocument`) → αποθηκεύεται·
 *   2. runtime προβολή (`upsertLayer`) → ο καμβάς ξαναζωγραφίζει αμέσως, χωρίς να περιμένει
 *      κύκλο React (retained-mode CAD συμπεριφορά).
 *
 * Το hydration που ακολουθεί γράφει τα ΙΔΙΑ αντικείμενα, οπότε ο φρουρός ιδεμποτικότητας
 * του `setLayers` (§3) κάνει bail — καμία επιπλέον ακύρωση bitmap, κανένας βρόχος.
 *
 * ## Τι ΔΕΝ ανήκει εδώ
 *
 * Οι **προσωρινές** καταστάσεις. Η απομόνωση (isolate/solo) είναι session state κατά το
 * ADR-358 §5.6.bis, και έτσι τη χειρίζονται και οι μεγάλοι παίκτες: Revit *Temporary*
 * Hide/Isolate (χάνεται στο κλείσιμο), Cinema 4D *Viewport* Solo Mode. Αυτές ζουν στο
 * `IsolateEffectsStore` και τις διαβάζει ο renderer ξεχωριστά — **ποτέ** δεν γράφονται ως
 * `frozen` πάνω στα μόνιμα flags, γιατί τότε θα αποθηκεύονταν στο αρχείο του χρήστη.
 * (Το AutoCAD `LAYISO` κάνει ακριβώς αυτό — και γι' αυτό χρειάζεται `LAYUNISO`. Δεν το
 * ακολουθούμε: το μοντέλο Revit/C4D είναι μη-καταστροφικό.)
 *
 * @module services/layer-flags-writer
 * @see systems/levels/active-document-gateway — η θύρα προς το ενεργό έγγραφο
 * @see systems/isolate/IsolateEffectsStore — το ΞΕΧΩΡΙΣΤΟ κανάλι των προσωρινών
 * @see docs/centralized-systems/reference/adrs/ADR-719
 */

import type { SceneLayer } from '../types/entities';
import { getLayer, upsertLayer } from '../stores/LayerStore';
import { withActiveDocument } from '../systems/levels/active-document-gateway';

/**
 * Τα πεδία που **ανήκουν στο έγγραφο** και επιτρέπεται να αλλάξουν από εδώ.
 *
 * Ρητή λίστα, όχι `Partial<SceneLayer>`: το `id` και το `name` είναι ταυτότητα (αλλάζουν
 * μόνο μέσω rename, που έχει δικό του guard ονομάτων — `guardLayerName`), και ένα
 * `Partial<SceneLayer>` θα άφηνε τη μετονομασία να γλιστρήσει από αυτή την πόρτα χωρίς
 * επικύρωση.
 */
export type PersistedLayerFlags = Partial<
  Pick<
    SceneLayer,
    'visible' | 'frozen' | 'locked' | 'color' | 'lineweight' | 'linetype' | 'transparency' | 'plottable'
  >
>;

/**
 * TRUE αν το `flags` δεν αλλάζει τίποτα στο `layer` — φρουρός ιδεμποτικότητας (N.7.2 #3).
 * Χωρίς αυτόν, ένα toggle που ξαναγράφει την ίδια τιμή θα πυροδοτούσε auto-save.
 */
function isNoOp(layer: SceneLayer, flags: PersistedLayerFlags): boolean {
  return (Object.keys(flags) as Array<keyof PersistedLayerFlags>).every(
    (key) => layer[key] === flags[key],
  );
}

/**
 * Εφαρμόζει μόνιμες ιδιότητες σε ΕΝΑ layer του ενεργού εγγράφου.
 *
 * @param layerId Σταθερό `lyr_*` id. (Όχι όνομα: το έγγραφο είναι id-keyed — ADR-358 §9E-6.)
 * @returns `true` αν γράφτηκε αλλαγή· `false` αν το layer δεν βρέθηκε, δεν υπάρχει ενεργό
 *   έγγραφο, ή οι τιμές ήταν ήδη οι ζητούμενες. Ο caller **οφείλει** να τιμήσει το `false`
 *   — σιωπηλή αποτυχία εδώ ήταν ακριβώς το αρχικό σύμπτωμα («το κουμπί δεν κάνει τίποτα»).
 */
export function setLayerFlags(layerId: string, flags: PersistedLayerFlags): boolean {
  let updated: SceneLayer | null = null;

  const wrote = withActiveDocument((scene) => {
    const current = scene.layersById[layerId];
    if (!current || isNoOp(current, flags)) return null;
    updated = { ...current, ...flags };
    return { ...scene, layersById: { ...scene.layersById, [layerId]: updated } };
  });

  if (!wrote || !updated) return false;

  // Runtime προβολή στο ίδιο tick — ο renderer δεν περιμένει κύκλο React.
  upsertLayer(updated);
  return true;
}

/**
 * Εφαρμόζει τις ΙΔΙΕΣ ιδιότητες σε πολλά layers με **μία** εγγραφή εγγράφου.
 *
 * Ξεχωριστή συνάρτηση, όχι βρόχος πάνω στο {@link setLayerFlags}: N επιμέρους εγγραφές θα
 * παρήγαγαν N σκηνές, N ειδοποιήσεις και N auto-save debounce επανεκκινήσεις για μία
 * ενέργεια χρήστη («κρύψε αυτή την ομάδα 27 layers»). Μία ατομική εγγραφή είναι και πιο
 * σωστή σημασιολογικά: ένα undo, ένα βήμα.
 *
 * @returns πόσα layers όντως άλλαξαν (0 ⇒ καμία εγγραφή).
 */
export function setLayerFlagsBatch(layerIds: ReadonlyArray<string>, flags: PersistedLayerFlags): number {
  const updates: SceneLayer[] = [];

  const wrote = withActiveDocument((scene) => {
    const nextById = { ...scene.layersById };
    for (const id of layerIds) {
      const current = scene.layersById[id];
      if (!current || isNoOp(current, flags)) continue;
      const next = { ...current, ...flags };
      nextById[id] = next;
      updates.push(next);
    }
    return updates.length === 0 ? null : { ...scene, layersById: nextById };
  });

  if (!wrote) return 0;
  for (const layer of updates) upsertLayer(layer);
  return updates.length;
}

/**
 * Εναλλαγή ενός boolean flag, διαβάζοντας την τρέχουσα τιμή **event-time** από τη runtime
 * προβολή (ADR-040: getter τη στιγμή του γεγονότος, όχι snapshot από render).
 *
 * Το `fallbackWhenUnset` λέει τι θεωρείται η τρέχουσα τιμή όταν το flag είναι `undefined` —
 * και είναι διαφορετικό ανά flag: `visible: undefined` σημαίνει **αναμμένο** (DXF: απουσία
 * δήλωσης = layer ON), ενώ `frozen: undefined` σημαίνει **μη παγωμένο**. Γι' αυτό είναι
 * ρητή παράμετρος αντί για σιωπηρό `!layer[flag]`, που ήταν το λάθος σε τρία σημεία
 * (πρώτο κλικ χωρίς αποτέλεσμα — βλ. §1).
 */
export function toggleLayerFlag(
  layerId: string,
  flag: 'visible' | 'frozen' | 'locked',
  fallbackWhenUnset: boolean,
): boolean {
  const layer = getLayer(layerId);
  if (!layer) return false;
  const current = layer[flag] ?? fallbackWhenUnset;
  return setLayerFlags(layerId, { [flag]: !current });
}
