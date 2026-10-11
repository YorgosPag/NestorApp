'use client';

/**
 * ADR-420 / ADR-399 — resolve the viewer Level that owns a wizard-selected floor.
 *
 * The «Εισαγωγή Κάτοψης» wizard lets the user pick company → project → building →
 * floor. Historically the import wrote into whatever level was *currently active*
 * (`currentLevelId`), so importing onto floor B while floor A's tab was active
 * dumped floor B's scene + context onto floor A. Revit-true behaviour: each
 * building storey (`floorId`) maps to its own Level; the import must target the
 * level bound to the selected floor — creating it if it doesn't exist yet.
 *
 * Stable key = `floorId` (IfcBuildingStorey), consistent with the BIM floor-scope
 * SSoT (see `bim/persistence/bim-floor-scope.ts`).
 */
import i18next from 'i18next';
import type { Level } from './config';
import { provisionLevelForBinding, type LevelProvisioner } from './level-provision';

/**
 * Ό,τι χρειάζεται η επίλυση ορόφου. ADR-914: είναι ο ίδιος ο {@link LevelProvisioner} — το
 * `linkLevelToFloor` έφυγε, γιατί όροφος και κτήριο γράφονται πλέον **στη γέννηση** (μία εγγραφή).
 */
export type LevelFloorResolver = LevelProvisioner;

/** Όνομα επιπέδου όταν ο όροφος δεν έδωσε ετικέτα — κλειδί, όχι κείμενο (N.11). */
const FLOOR_FALLBACK_NAME_KEY = 'dxf-viewer-panels:panels.levels.floorFallbackName';

export interface ResolveFloorLevelOptions {
  readonly floorId?: string;
  readonly buildingId?: string;
  readonly entityLabel?: string;
  readonly currentLevelId: string | null;
}

/**
 * Find the Level whose `floorId` matches the selected floor; create + link one
 * when absent. Returns the target level id (or `currentLevelId` for floor-less
 * imports — project/building-level canvases, which are not storeys).
 */
export async function findOrCreateLevelForFloor(
  resolver: LevelFloorResolver,
  opts: ResolveFloorLevelOptions,
): Promise<string | null> {
  // No floor selected (project/building-level import) → keep the active level.
  if (!opts.floorId) return opts.currentLevelId;

  // ADR-914 — ο ΕΝΑΣ provisioner: find-or-create, με όροφο + κτήριο σε ΜΙΑ εγγραφή.
  const { levelId } = await provisionLevelForBinding(resolver, {
    kind: 'storey',
    floorId: opts.floorId,
    buildingId: opts.buildingId ?? null,
    label: opts.entityLabel || i18next.t(FLOOR_FALLBACK_NAME_KEY) || FLOOR_FALLBACK_NAME_KEY,
    untyped: true,
  });
  return levelId;
}

/**
 * SSoT — **ποιο είναι το ενεργό κτήριο του viewer;**
 *
 * ## 🔴 Ο ισχυρισμός που καταρρέει (ADR-845 §7.15, Ο-32)
 *
 * Αυτή η συνάρτηση επέστρεφε το `buildingId` του **πρώτου** linked level, με
 * γραπτή αιτιολόγηση *«Κάθε linked Level φέρει το ίδιο `buildingId` (ADR-237,
 * link-time), οπότε ο πρώτος αρκεί»*. **Μετρήθηκε ψευδής**: στα 5 δεμένα ζωντανά
 * επίπεδα υπάρχουν **τρία διαφορετικά** κτήρια. Άρα οι δύο καταναλωτές — η
 * **σειρά** των επιπέδων (`LevelPanel`) και το **modal «Διαχείριση Ορόφων»**
 * (`DxfViewerDialogs`, ADR-468) — έπαιρναν τους ορόφους ενός **αυθαίρετου**
 * κτηρίου, ανεξαρτήτως του τι είχε ανοιχτό ο μηχανικός.
 *
 * ## Τρία σκαλιά, με φθίνουσα βεβαιότητα
 *
 * 1. **Ανοιχτό** — το κτήριο του επιπέδου που δουλεύει **αυτή τη στιγμή** ο
 *    μηχανικός. Ό,τι βλέπει είναι η ισχυρότερη δήλωση πρόθεσης που υπάρχει.
 * 2. **Δηλωμένο** — από τη διεύθυνση (`?bldg=`). Ίδιο ιδίωμα με το `?lvl=` του
 *    ADR-400 *(«the view lives in the URL as a shareable deep-link»)*: δίνει στο
 *    πολυ-κτηριακό ό,τι το Revit πετυχαίνει μόνο με **χωριστά αρχεία**.
 * 3. **Οποιοδήποτε** — legacy έσχατη λύση *(η παλιά συμπεριφορά)*, για δέντρα
 *    ενός κτηρίου και για επίπεδα χωρίς δεσμό.
 *
 * ⚠️ **Γιατί το ανοιχτό προηγείται του δηλωμένου** *(και όχι το αντίστροφο, που
 * ήταν η πρώτη γραφή)*: αν η διεύθυνση κέρδιζε πάντα, η εμβέλεια θα **κόλλαγε** —
 * ο μηχανικός θα άλλαζε σε επίπεδο άλλου κτηρίου και το «ενεργό κτήριο» θα έμενε
 * το παλιό, για πάντα. Η διεύθυνση είναι η φωνή του **bootstrap** *(τι να
 * φορτωθεί πριν υπάρξει ανοιχτό επίπεδο, και τι κουβαλά ένα μοιρασμένο link)*,
 * όχι βέτο πάνω στον άνθρωπο. Ο καλών **γράφει πίσω** τη λυμένη τιμή, ώστε η
 * διεύθυνση να **μαθαίνει** αντί να διατάζει.
 *
 * ⚠️ Το `currentLevelId` είναι **υποχρεωτικό** εσκεμμένα: όσο ήταν απόν, η σωστή
 * απάντηση εξαρτιόταν από το να θυμηθεί ο καλών να το δώσει — και **κανένας** από
 * τους δύο δεν το θυμόταν. Ένα υποχρεωτικό όρισμα δεν ξεχνιέται.
 *
 * ΟΧΙ μέσω `useProjectHierarchy().selectedBuilding` (τυπικά null στον viewer).
 */
export function resolveActiveBuildingId(
  levels: readonly Level[] | null | undefined,
  currentLevelId: string | null | undefined,
  declaredBuildingId: string | null | undefined,
): string | null {
  const active = currentLevelId ? levels?.find((l) => l.id === currentLevelId) : undefined;
  if (active?.buildingId) return active.buildingId;
  if (declaredBuildingId) return declaredBuildingId;
  return levels?.find((l) => l.buildingId)?.buildingId ?? null;
}

/**
 * **Τι θυμάται η διεύθυνση** (`?bldg=`) — το κτήριο του **ανοιχτού** επιπέδου, και τίποτα άλλο.
 *
 * ## Γιατί δεν είναι το {@link resolveActiveBuildingId} (ADR-914, μετρημένο 2026-10-11)
 *
 * Το τρίτο σκαλί εκείνης της συνάρτησης («οποιοδήποτε κτήριο») είναι έσχατη λύση για τους
 * **καταναλωτές** (σειρά επιπέδων, modal ορόφων). Γραμμένο στη **διεύθυνση**, γίνεται φίλτρο: το
 * επόμενο φόρτωμα ζητά μόνο τα επίπεδα εκείνου του κτηρίου. Με ανοιχτό ένα **πρόχειρο** (επίπεδο
 * χωρίς κτήριο) αυτό σήμαινε: F5 ⇒ η λίστα στενεύει σε κτήριο που ο άνθρωπος δεν κοιτούσε, το
 * πρόχειρο **εξαφανίζεται** από τη λίστα και ο viewer πέφτει σε άλλο επίπεδο. Το σχέδιο ήταν
 * αποθηκευμένο — απλώς αόρατο.
 *
 * - ανοιχτό επίπεδο **με** κτήριο ⇒ το κτήριό του·
 * - ανοιχτό επίπεδο **χωρίς** κτήριο ⇒ `null`: η διεύθυνση **ξεχνά** το κτήριο (καμία εμβέλεια)·
 * - κανένα ανοιχτό επίπεδο ακόμη (bootstrap) ⇒ `undefined`: καμία γνώμη, η διεύθυνση μένει ως έχει.
 */
export function resolveUrlBuildingId(
  levels: readonly Level[] | null | undefined,
  currentLevelId: string | null | undefined,
): string | null | undefined {
  const active = currentLevelId ? levels?.find((l) => l.id === currentLevelId) : undefined;
  if (!active) return undefined;
  return active.buildingId ?? null;
}

/**
 * SSoT — το **durable projectId** του viewer = το `projectId` του πρώτου level που το
 * φέρει. Κάθε linked Level παίρνει το ίδιο `projectId` από τον wizard (ADR-309), άρα ο
 * πρώτος αρκεί.
 *
 * 🛡️ ADR-650 M10 (Εύρημα #2) — ΓΙΑΤΙ υπάρχει: ειδικοί όροφοι όπως η **Θεμελίωση**
 * δημιουργούνται ΧΩΡΙΣ δικό τους `projectId` (δεν περνούν από τον import wizard). Έτσι
 * το `saveContext?.projectId ?? currentLevel?.projectId` έβγαινε `undefined` εκεί →
 * το SITE-scope topo persistence δεν instantiate-άρονταν → το survey ΔΕΝ σωζόταν στη
 * θεμελίωση (`hasScope:FALSE`). Το projectId ενός αδελφού ορόφου (π.χ. ισόγειο) είναι
 * **σταθερή, διαθέσιμη-από-το-load** πηγή: δίνει ίδιο scope σε ΚΑΘΕ όροφο και δεν κάνει
 * flip `null→value` (που προκαλούσε per-project reset). Mirror του
 * {@link resolveActiveBuildingId}.
 */
export function resolveActiveProjectId(levels: readonly Level[] | null | undefined): string | null {
  return levels?.find((l) => l.projectId)?.projectId ?? null;
}
