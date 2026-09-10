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
import type { Level } from './config';

export interface LevelFloorResolver {
  readonly levels: Level[];
  readonly addLevel: (name: string, setAsDefault?: boolean, floorId?: string) => Promise<string | null>;
  readonly linkLevelToFloor: (levelId: string, floorId: string | null, buildingId?: string | null) => Promise<void>;
}

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

  const existing = resolver.levels.find((l) => l.floorId === opts.floorId);
  if (existing) return existing.id;

  const newId = await resolver.addLevel(opts.entityLabel || 'Όροφος', false, opts.floorId);
  if (newId) {
    await resolver.linkLevelToFloor(newId, opts.floorId, opts.buildingId ?? null);
  }
  return newId;
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
