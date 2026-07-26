/**
 * Το κοντόστυλο ως «Τμήμα» (Revit **Part**) — ταυτότητα, όχι αποθηκευμένη οντότητα (ADR-715 §3).
 *
 * Το θαμμένο τμήμα της κολώνας ΔΕΝ είναι δικό του `BimEntity`: η κολώνα επιμηκύνεται προς τα
 * κάτω μέσα στο `columnToMesh` (`baseDropMm`, ADR-489 §6.1) — **ένα** mesh, **ένα** `bimId`.
 * Αυτό το module δίνει στη ζώνη **ταυτότητα οντότητας στο UI** (επιλογή, panel, readout,
 * γραμμή επιμέτρησης) χωρίς να γεννήσει δεύτερη οντότητα.
 *
 * ### Γιατί αυτό ΕΙΝΑΙ το μοντέλο Revit Parts (και όχι έκπτωση από αυτό)
 * Ένα Revit Part είναι **παράγωγο** αντικείμενο: αναγεννιέται όταν αλλάξει το αρχικό, το
 * αρχικό διατηρείται ακέραιο, και σβήνοντας ένα Part σβήνουν όλα. Δηλαδή τα Parts **δεν**
 * είναι ανεξάρτητες αποθηκευμένες οντότητες — είναι **παράγωγη ζώνη με ταυτότητα**. Άρα:
 *
 *   - **ΜΗΔΕΝ** νέο persisted entity, **ΜΗΔΕΝ** migration, καμία ρήξη ADR-489 §6.1 / ADR-712 §3.1.
 *   - Το μόνο που αποθηκεύεται είναι η **πρόθεση του χρήστη** → `ColumnParams.buriedWaterproofing`.
 *   - Το Τμήμα ξαναγεννιέται σε κάθε sync από τη γεωμετρία + τη στάθμη εδάφους. Αλλάζει το
 *     βάθος θεμελίωσης ή το τοπογραφικό → η επιλογή, το υλικό και τα m² ακολουθούν **μόνα τους**.
 *     Αυτό είναι το σημείο όπου ξεπερνάμε τους μεγάλους: στο Revit το `Divide Parts` είναι
 *     χειροκίνητο ανά στοιχείο και **τοπογραφική επιφάνεια δεν είναι έγκυρος διαιρέτης**.
 *
 * ### Γιατί ΔΕΝ υπάρχει «BuriedPartDescriptor» με γεωμετρία εδώ
 * Το σχέδιο προέβλεπε πλήρη descriptor (ζώνη + faceKeys + υλικό). Μετρημένο ανά καταναλωτή,
 * **κανείς δεν τη χρειάζεται**, και η κατασκευή της θα εισήγαγε δεύτερη πηγή αλήθειας:
 *
 *   - Το κλικ χρειάζεται μόνο «είναι θαμμένη όψη;» + το host id → {@link BuriedPartRef}.
 *   - Το highlight χρειάζεται τα `buried:i` — και τα διαβάζει από το **ίδιο το mesh**
 *     (`userData.faceKeyByMaterialIndex`), που είναι η ζωντανή αλήθεια· ένας ανεξάρτητος
 *     υπολογισμός θα μπορούσε να αποκλίνει από ό,τι όντως ζωγραφίστηκε.
 *   - Το panel δεν **μπορεί** να ξέρει τη ζώνη: το `baseDropMm` είναι DERIVED από τον στατικό
 *     graph και το ADR-489 §7 **απαγορεύει ρητά** τη μεταφορά του σε global store.
 *
 * Άρα το module μένει σκόπιμα λιτό: ταυτότητα + δύο pure ερωτήματα. Ό,τι θέλει γεωμετρία
 * ζει εκεί όπου υπάρχει γεωμετρία.
 *
 * Pure — zero React / THREE / Firestore.
 *
 * @see ../types/face-appearance-types — `isBuriedFaceKey` (ο διαχωριστής επιλογής)
 * @see ../geometry/column-exposure-zone — πού κόβεται η ζώνη (ADR-713)
 * @see ../finishes/buried-waterproofing — ο κατάλογος 8 τεχνικών + τα defaults
 * @see docs/centralized-systems/reference/adrs/ADR-715-buried-part-independent-selection-and-waterproofing-catalog.md
 */

import { isBuriedFaceKey } from '../types/face-appearance-types';
import { BURIED_WATERPROOFING_MATERIALS, resolveBuriedWaterproofing } from '../finishes/buried-waterproofing';
import type { ColumnEntity } from '../types/column-types';

/**
 * Το suffix του **παράγωγου** id του Τμήματος. Διπλή άνω-κάτω τελεία: δεν εμφανίζεται σε
 * enterprise ids (ADR-017 prefixes είναι `<prefix>_<ulid>`), οπότε ένα `partId` δεν μπορεί
 * ΠΟΤΕ να συγχυστεί με πραγματικό document id — και αντίστροφα, ένα `parseBuriedPartId` σε
 * σκέτο column id επιστρέφει `null` αντί να «καταπιεί» μέρος του.
 *
 * ⚠️ Το id είναι **UI-only**: κλειδί για React lists / aria / telemetry. **ΠΟΤΕ** δεν γράφεται
 * σε Firestore και **ΠΟΤΕ** δεν μπαίνει σε `SelectedEntitiesStore`/`Selection3DStore` — εκεί ζει
 * πάντα το host column id, ώστε κάθε υπάρχων καταναλωτής επιλογής να δει κανονική κολώνα.
 */
export const BURIED_PART_ID_SUFFIX = '::buried';

/** Το σταθερό παράγωγο id του Τμήματος μιας κολώνας. Ντετερμινιστικό — ίδιο σε κάθε sync. */
export function buriedPartId(hostColumnId: string): string {
  return `${hostColumnId}${BURIED_PART_ID_SUFFIX}`;
}

/** Το host column id ενός part id, ή `null` όταν το string δεν είναι part id. */
export function parseBuriedPartId(partId: string): string | null {
  if (!partId.endsWith(BURIED_PART_ID_SUFFIX)) return null;
  const host = partId.slice(0, -BURIED_PART_ID_SUFFIX.length);
  return host.length > 0 ? host : null;
}

/**
 * Αναφορά στο Τμήμα **μιας** κολώνας. Ένα πεδίο, επίτηδες: το κοντόστυλο είναι **ΟΛΗ** η
 * θαμμένη ζώνη (όλες οι περιμετρικές θαμμένες όψεις μαζί), όχι μία όψη — γι' αυτό δεν κρατά
 * `faceKey`/`index` όπως το `StairSubElementRef`. Η per-όψη διεύθυνση παραμένει δουλειά του
 * `PolygonMode3DStore` (cosmetic path, ADR-715 §3.1).
 */
export interface BuriedPartRef {
  readonly columnId: string;
}

/** Δομική ισότητα δύο refs (equality guard για leaves/subscriptions). */
export function isSameBuriedPart(a: BuriedPartRef | null, b: BuriedPartRef | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.columnId === b.columnId;
}

/** Στόχος highlight: ποιο solid + ποια όψη (δομικά ταυτόσημο με το `FaceTarget` του highlighter). */
export interface BuriedFaceTarget {
  readonly bimId: string;
  readonly faceKey: string;
}

/**
 * Οι στόχοι highlight του Τμήματος: **ΟΛΕΣ** οι θαμμένες όψεις του mesh, ζευγαρωμένες με το
 * host id. Είσοδος = το `faceKeyByMaterialIndex` του ζωντανού mesh, ώστε το φωτισμένο σχήμα
 * να είναι εξ ορισμού ό,τι ζωγραφίστηκε (καμία δεύτερη παραγωγή κλειδιών).
 *
 * Γιατί ΟΛΕΣ και όχι η χτυπημένη: ο μηχανικός επιλέγει «το κοντόστυλο», όχι «τη βόρεια παρειά
 * του κοντόστυλου». Φωτίζοντας μία πλευρά, η επιλογή θα διάβαζε σαν per-face pick — που είναι
 * ο **άλλος**, cosmetic δρόμος. Το σχήμα του φωτισμού είναι εδώ και το μήνυμα.
 */
export function buriedFaceTargets(
  hostColumnId: string,
  meshFaceKeys: readonly string[] | undefined,
): readonly BuriedFaceTarget[] {
  if (!hostColumnId || !meshFaceKeys) return [];
  return meshFaceKeys
    .filter((faceKey) => isBuriedFaceKey(faceKey))
    .map((faceKey) => ({ bimId: hostColumnId, faceKey }));
}

/**
 * ADR-715 §3.1 — **Η ΑΠΟΚΛΙΣΗ ΠΟΥ ΚΟΣΤΙΖΕΙ ΧΡΗΜΑΤΑ.** Οι θαμμένες όψεις που έχουν ρητό
 * per-face override **διαφορετικό** από το υλικό στεγάνωσης του Τμήματος.
 *
 * Υπάρχουν δύο δρόμοι βαφής και **δεν είναι ισότιμοι**:
 *
 *   | δρόμος | render | επιμέτρηση m² |
 *   |---|---|---|
 *   | Part-level (`params.buriedWaterproofing`) — **το SSoT** | ✅ | ✅ |
 *   | per-face (`faceAppearance['buried:i']`, «ΠΟΛΥΓΩΝΑ») — cosmetic | ✅ | ❌ |
 *
 * Ο μηχανικός μπορεί λοιπόν να **βλέπει** μεμβράνη και η επιμέτρηση να **χρεώνει** ασφαλτική
 * επάλειψη: σφάλμα **τιμής**, όχι εμφάνισης, και εντελώς σιωπηλό. Το Revit ζει με το ίδιο κενό
 * («Paint» πάνω από type material — τα schedules διαβάζουν το type). Εδώ το κάνουμε **ορατό**:
 * το UI δηλώνει ρητά πόσες όψεις αποκλίνουν, ώστε η απόκλιση να είναι **απόφαση** και όχι ατύχημα.
 *
 * Επιστρέφει τα κλειδιά των αποκλινουσών όψεων (σταθερή σειρά = σειρά του map). Κενό array =
 * καμία απόκλιση: είτε δεν υπάρχει per-face βαφή, είτε συμφωνεί με το Part-level υλικό.
 * Όψη βαμμένη με **σκέτο χρώμα** (`colorHex` χωρίς `materialId`) μετράει ΚΑΙ ΑΥΤΗ ως απόκλιση —
 * ένα ad-hoc χρώμα δεν λύνεται σε άρθρο ΑΤΟΕ, άρα δεν επιμετρείται ποτέ.
 */
export function resolveBuriedPaintDivergence(column: ColumnEntity): readonly string[] {
  const appearance = column.faceAppearance;
  if (!appearance) return [];
  const partMaterialId = resolveBuriedWaterproofing(column.params.buriedWaterproofing).materialId;
  const out: string[] = [];
  for (const [faceKey, face] of Object.entries(appearance)) {
    if (!isBuriedFaceKey(faceKey)) continue;
    // Κενό `{}` = «ρητά άβαφη» σήμα του ADR-713 §3.4 (κλειστή στεγάνωση) — ΟΧΙ απόκλιση:
    // δεν εκφράζει άλλο υλικό, μόνο «μη πέσεις στο base '*'».
    if (face.materialId === undefined && face.colorHex === undefined) continue;
    if (face.materialId === partMaterialId) continue;
    out.push(faceKey);
  }
  return out;
}

/**
 * True όταν το `materialId` είναι **γνήσιο υλικό στεγάνωσης** του καταλόγου (ADR-715 §5).
 *
 * Αυτό είναι το κριτήριο δρομολόγησης του swatch: διαλέγοντας ασφαλτικό/μεμβράνη ο μηχανικός
 * εκφράζει **πρόθεση στεγάνωσης** → γράφεται Part-level και η επιμέτρηση ακολουθεί. Διαλέγοντας
 * τούβλο/χρώμα εκφράζει **οπτικό override** → γράφεται per-face και δηλώνεται ως cosmetic.
 * Η διάκριση προκύπτει από την **ταυτότητα του υλικού**, όχι από κρυφό mode που πρέπει να
 * θυμάται ο χρήστης — εκεί ακριβώς είναι το κενό του Revit «Paint».
 */
export function isBuriedWaterproofingMaterial(materialId: string | undefined): boolean {
  return materialId !== undefined && BURIED_WATERPROOFING_MATERIALS.includes(materialId);
}
