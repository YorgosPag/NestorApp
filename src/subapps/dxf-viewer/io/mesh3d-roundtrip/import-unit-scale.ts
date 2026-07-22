/**
 * import-unit-scale — ADR-683 §units: η **ρητή** μονάδα εισαγωγής ενός `.glb`/`.gltf`.
 *
 * **Το πρόβλημα:** το glTF ορίζει 1 unit = 1 μέτρο (Khronos spec — το units-field απορρίφθηκε
 * επίσημα, glTF issue #2425). Ένας exporter που γράφει σε ίντσες/χιλιοστά παράγει «λάθος» αρχείο:
 * μια καρέκλα 44 ιντσών φτάνει ως 44 «μέτρα» → τερατώδης, εκτός κάτοψης, **αόρατη**.
 *
 * **Η λύση των μεγάλων (Revit «Import Units», SketchUp mm/cm/in/ft/m dropdown, C4D scale multiplier):**
 * ο χρήστης **δηλώνει** τη μονάδα του αρχείου· ΠΟΤΕ silent bbox auto-rescale (ρητό anti-pattern — αποτυγχάνει
 * σε βίδες/πλοία/κτήρια). Default = μέτρα (η σύμβαση glTF), οπότε σωστά αρχεία δεν χρειάζονται καμία ενέργεια.
 *
 * `unitScaleFactor` = «πολλαπλασιαστής ώστε τιμή-διαβασμένη-ως-μέτρα → πραγματικά μέτρα». 44 (ίντσες
 * διαβασμένες ως μέτρα) × `unitScaleFactor('in')` = 44 × 0.0254 = 1.117 πραγματικά μέτρα.
 *
 * **Καμία διπλότυπη μηχανική:** ο πίνακας μετατροπής ΕΙΝΑΙ ήδη ο `sceneUnitsToMeters` (m→1, cm→0.01,
 * mm→0.001, in→0.0254, ft→0.3048). Αυτό το module τον **επαναχρησιμοποιεί** — δεν γράφει δεύτερο, που θα
 * απέκλινε σιωπηλά. Τα ονόματα μονάδων ζουν επίσης αλλού (`common:units.*`), όχι εδώ.
 *
 * @see ../../utils/scene-units — sceneUnitsToMeters (SSoT του πίνακα factor)
 * @see ./gltf-node-placement — καταναλωτής του `scaleWorldBoxByFactor` (placement)
 * @see ../../bim/entities/imported-mesh/build-imported-mesh-entity — καταναλωτής του factor (measurements)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §units
 */

import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';
import type { GltfNodeWorldBox } from './gltf-node-placement';

/** Οι μονάδες που προσφέρει το dialog εισαγωγής (καθρέφτης SketchUp/Revit). Custom = ελεύθερος factor. */
export const IMPORT_UNIT_OPTIONS: readonly SceneUnits[] = ['m', 'cm', 'mm', 'in', 'ft'];

/** Η επιλογή στο dropdown: μία γνωστή μονάδα ή «προσαρμοσμένος συντελεστής». */
export type ImportUnitSelection = SceneUnits | 'custom';

/** glTF standard = μέτρα (Khronos). Άρα η προεπιλογή αφήνει σωστά αρχεία ανέγγιχτα (factor 1). */
export const DEFAULT_IMPORT_UNIT: ImportUnitSelection = 'm';

/** Ουδέτερος factor: τιμή-ως-μέτρα μένει μέτρα. Καθρεφτίζει το `sceneUnitsToMeters('m')`. */
export const DEFAULT_UNIT_SCALE_FACTOR = 1;

/**
 * Ο πολλαπλασιαστής μιας γνωστής μονάδας — **delegation** στον `sceneUnitsToMeters`, ώστε ο ένας πίνακας
 * «τι αξίζει κάθε μονάδα σε μέτρα» να μη διπλασιαστεί. `valueAsMeters × unitScaleFactor(unit) = realMeters`.
 */
export function unitScaleFactor(unit: SceneUnits): number {
  return sceneUnitsToMeters(unit);
}

/**
 * Ο τελικός factor από την επιλογή του χρήστη. Για γνωστή μονάδα → ο πίνακας· για «custom» → η ωμή
 * τιμή που πληκτρολόγησε. Μη-πεπερασμένη ή μη-θετική custom τιμή → `DEFAULT_UNIT_SCALE_FACTOR` (ασφαλές
 * ουδέτερο· ένας μηδενικός/αρνητικός factor θα εκφύλιζε **κάθε** διάσταση κάτω από το `MIN_..._DIMENSION_MM`
 * και θα «κατάπινε» σιωπηλά την εισαγωγή).
 */
export function resolveUnitScaleFactor(
  selection: ImportUnitSelection,
  customFactor: number,
): number {
  if (selection !== 'custom') return unitScaleFactor(selection);
  return Number.isFinite(customFactor) && customFactor > 0 ? customFactor : DEFAULT_UNIT_SCALE_FACTOR;
}

/**
 * Κλιμακώνει ένα παγκόσμιο κουτί (διαβασμένο ως μέτρα) σε πραγματικά μέτρα. Καθαρή: κέντρο **και** `minY`
 * πολλαπλασιάζονται με τον ίδιο factor, ώστε θέση **και** έδρα να μετακινηθούν συνεπώς — αλλιώς ένα
 * αντικείμενο θα προσγειωνόταν σε λάθος υψόμετρο ως προς το ίδιο του το κέντρο.
 */
export function scaleWorldBoxByFactor(
  box: GltfNodeWorldBox,
  factor: number,
): GltfNodeWorldBox {
  return {
    centre: { x: box.centre.x * factor, y: box.centre.y * factor, z: box.centre.z * factor },
    minY: box.minY * factor,
  };
}
