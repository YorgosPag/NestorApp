/**
 * face-appearance-types — ADR-539 (Cinema 4D «Polygon Mode»: per-face appearance).
 *
 * SSoT για το «βάψιμο/ντύσιμο μεμονωμένης όψης» (Revit «Paint on face» / Cinema 4D
 * polygon material) ΟΛΩΝ των δομικών solids. Καθαρά cosmetic override: ζει στο
 * `BimEntity` base (δίπλα στο `styleOverride`), ΔΕΝ συμμετέχει στο geometry
 * derivation από τα `params` — άρα μηδέν διπλότυπα ανά kind, μηδέν επίδραση στο
 * derive της γεωμετρίας.
 *
 * Το `FaceKey` ακολουθεί το ντετερμινιστικό edge ordering του `buildFacedPrism`
 * (`bim-3d/converters/bim-three-faced-prism.ts`): materialIndex 0 = `bottom`,
 * 1 = `top`, 2+i = `side:i` όπου `i` = ακμή i του canonical outline.
 *
 * @see bim-3d/converters/bim-three-faced-prism.ts — face-key ↔ materialIndex SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

/**
 * Ντετερμινιστικό κλειδί όψης, κοινό για όλα τα solids.
 *   - `top` / `bottom` — οι δύο οριζόντιες παρειές (caps).
 *   - `side:${i}` — η i-οστή περιμετρική πλευρά (edge ordering του `buildFacedPrism`).
 *   - `buried:${i}` — ADR-713: το **θαμμένο** τμήμα της i-οστής περιμετρικής πλευράς, κάτω
 *     από τη στάθμη τελειωμένου εδάφους. Υπάρχει ΜΟΝΟ όταν το στοιχείο έχει θαμμένη ζώνη
 *     (κολώνα ισογείου εδρασμένη σε πέδιλο). Παίρνει στεγανωτική επάλειψη — **ΠΟΤΕ** την
 *     επένδυση όψης. Ξεχωριστό κλειδί (όχι δεύτερο `side:${i}`) γιατί οι καταναλωτές
 *     διευθυνσιοδοτούν όψεις **με το κλειδί**: το `faceGroupRange` κάνει `indexOf` (πρώτο
 *     match) και το export manifest γράφει `materialsByFace[key]` — διπλό κλειδί θα σήμαινε
 *     λάθος highlight και **σιωπηλή απώλεια υλικού** στο C4D round-trip (ADR-678).
 *   - `hole:${h}:${k}` — το k-οστό τοίχωμα του h-οστού ανοίγματος (slab opening, Φ2).
 *   - `sub:${i}:${string}` — per-«νερό» roof sub-solid (Φ3· δηλωμένο τώρα για σταθερό SSoT).
 *   - `slot:${materialName}` — ADR-686: material slot ΕΙΣΑΓΟΜΕΝΟΥ mesh (καρέκλα = μπράτσα/κάθισμα/
 *     πλάτη). Το imported δεν έχει `side:i` γεωμετρία· addressing by **όνομα υλικού** (dedup SSoT με
 *     `ImportedMeshParams.materialSlots` + το 2D `SlotSilhouette.materialName`). Το `'*'` (base) βάφει
 *     ΟΛΑ τα slots (ΣΩΜΑ). Ένα override concept, δύο resolvers (structural `side:i` ↔ imported `slot:`).
 */
export type FaceKey =
  | 'top'
  | 'bottom'
  | `side:${number}`
  | `buried:${number}`
  | `hole:${number}:${number}`
  | `sub:${number}:${string}`
  | `slot:${string}`;

/**
 * Η εμφάνιση μιας όψης: είτε υλικό από κατάλογο (`materialId`) είτε σκέτο χρώμα
 * (`colorHex`). Και τα δύο optional — άδειο = επιστροφή στο base material της entity.
 * `materialId` έχει προτεραιότητα στην επίλυση χρώματος (δες `resolveFaceMaterial`).
 */
export interface FaceAppearance {
  /** Catalog material id (π.χ. wall-covering `paint-red`). Optional. */
  readonly materialId?: string;
  /** CSS hex (π.χ. `#C0392B`) για σκέτο χρώμα. Optional. */
  readonly colorHex?: string;
}

/**
 * Reserved «base» κλειδί (Cinema 4D base material tag / Revit type material): η εμφάνιση
 * που ισχύει για **ΟΛΕΣ** τις όψεις του solid, ΕΚΤΟΣ όσων έχουν δικό τους per-face override.
 * «Βάψε όλο το στοιχείο» = θέσε `faceAppearance['*']`. Δεν είναι πραγματική όψη — δεν είναι
 * pickable (`faceGroupRange` το αγνοεί), δεν εμφανίζεται στις λαβές· consulted ΜΟΝΟ ως
 * fallback στο `resolveFaceMaterial`. Το `'*'` δεν συγκρούεται με κανένα `FaceKey`
 * (`top`/`bottom`/`side:i`/…) και είναι Firestore-safe.
 *
 * Cascade (όπως Revit «Paint» + type material / Cinema 4D material tags):
 *   resolve(face) = appearance[face]  ??  appearance['*']  ??  base entity material
 */
export const BASE_FACE_KEY = '*';

/**
 * ADR-686 — SSoT format του imported-mesh slot faceKey (`slot:${materialName}`). Κοινό για τον
 * 3D enhancer (γράφει το override), τον `raycastBimFace` (per-slot pick) και τον 2D renderer. Ένα
 * σημείο ορισμού ώστε τα τρία μονοπάτια να μη διαφωνήσουν ποτέ στο prefix.
 */
export function slotFaceKey(materialName: string): string {
  return `slot:${materialName}`;
}

/**
 * ADR-713/715 — SSoT prefix της **θαμμένης** υπο-όψης. Ξεχωριστή σταθερά (και όχι ωμό literal
 * σε κάθε call site) γιατί το prefix είναι πλέον **σημασιολογικό ερώτημα** και όχι μόνο μορφή:
 * πάνω του κρίνεται «κλικ = Κοντόστυλο ή κολώνα;» (ADR-715 §3). Τρεις παραγωγοί το έγραφαν
 * χειροκίνητα (`buriedFaceAppearance`, `buildFacedIndex`) και ένας νέος καταναλωτής θα το
 * διάβαζε — τέσσερα σημεία που θα μπορούσαν να αποκλίνουν σε ένα rename.
 */
const BURIED_FACE_KEY_PREFIX = 'buried:';

/**
 * Το `FaceKey` της θαμμένης υπο-όψης της i-οστής περιμετρικής πλευράς (ADR-713 §3.1).
 * Mirror του {@link slotFaceKey}: ΕΝΑ σημείο ορισμού, ώστε ο παραγωγός των material groups
 * (`buildFacedIndex`), ο παραγωγός του appearance (`buriedFaceAppearance`) και ο καταναλωτής
 * της επιλογής (ADR-715) να μη διαφωνήσουν ΠΟΤΕ στη μορφή του κλειδιού.
 */
export function buriedFaceKey(sideIndex: number): FaceKey {
  return `${BURIED_FACE_KEY_PREFIX}${sideIndex}` as FaceKey;
}

/**
 * True όταν το `faceKey` διευθύνει **θαμμένη** υπο-όψη — δηλαδή όταν το κλικ έπεσε στο
 * κοντόστυλο και ΟΧΙ στην ανωδομή (ADR-715: ο διαχωριστής επιλογής «Τμήμα vs κολώνα»).
 * Δέχεται `undefined` ώστε οι call sites να μη διπλασιάζουν null-checks πάνω από ένα
 * προαιρετικό `RaycastHit.faceKey`.
 */
export function isBuriedFaceKey(faceKey: string | undefined): boolean {
  return faceKey !== undefined && faceKey.startsWith(BURIED_FACE_KEY_PREFIX);
}

/**
 * Map όψη → εμφάνιση. Όψεις που λείπουν = κανένα override (πέφτουν στο `'*'` base, αλλιώς
 * legacy single-material render byte-for-byte). Κλειδί = `FaceKey` ή `BASE_FACE_KEY`
 * (string at runtime, Firestore-safe).
 */
export type FaceAppearanceMap = Readonly<Record<string, FaceAppearance>>;

/**
 * SSoT «βάψε ΟΛΟ το στοιχείο» ως πλήρες map (ADR-539). Επιστρέφει map που περιέχει **ΜΟΝΟ** το
 * base `'*'` — άρα, εφαρμοσμένο με replace semantics (`SetEntityFaceAppearanceMapCommand`),
 * καθαρίζει ταυτόχρονα κάθε προϋπάρχον per-face override. Αυτό κάνει το «βάψε όλο» πραγματικά
 * «όλο»: χωρίς αυτό, ένα merge-set του `'*'` άφηνε τα per-face overrides να κερδίζουν στον
 * cascade (`resolveFaceMaterial`: `appearance[face] ?? appearance['*']`) → μία όψη έμενε αβαφή.
 * `value = null` → `{}` (καθάρισε τα πάντα, επιστροφή σε base look — Revit «remove paint»).
 * Κοινό για το file-import (C4D per-object) και το ζωντανό «όλο το στοιχείο» του polygon panel.
 */
export function entireElementFaceMap(value: FaceAppearance | null): FaceAppearanceMap {
  return value ? { [BASE_FACE_KEY]: value } : {};
}
