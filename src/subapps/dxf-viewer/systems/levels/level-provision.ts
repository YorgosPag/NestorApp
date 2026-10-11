/**
 * level-provision — ο ΕΝΑΣ δρόμος που γεννά επίπεδο για μια δέσμευση (ADR-914).
 *
 * ## Γιατί υπάρχει
 *
 * Δύο σημεία γεννούσαν επίπεδο ορόφου με το ίδιο σχήμα «δημιούργησε, μετά δέσε»:
 * `findOrCreateLevelForFloor` (`addLevel` + `linkLevelToFloor`) και `useFloorTabs.onSelectTab`
 * (`addLevel` + `updateLevelContext`). Δύο αντίγραφα, και στα δύο ένα παράθυρο όπου το επίπεδο
 * υπήρχε μισοδεμένο. Με το ADR-913 το παράθυρο έπαψε να είναι κοσμητικό: ο στόχος αποθήκευσης
 * ενός κενού επιπέδου **παράγεται από τη δέσμευσή του**, άρα επίπεδο που αυτο-επιλέγεται πριν
 * δεθεί ανοίγει στόχο στον χώρο της εταιρείας και, μετά το δεύτερο αίτημα, στο έργο — το ίδιο
 * αρχείο σε δύο paths.
 *
 * ## Η αρχή
 *
 * Η δέσμευση είναι **ένα πράγμα** ({@link LevelProvisionBinding}) και γράφεται σε **μία**
 * εγγραφή. Τα πεδία εμβέλειας περνούν πάντα από το `levelScopeFields` (ADR-845 Ο-19) — όροφος
 * και κτήριο μαζί ή καθόλου.
 *
 * Pure ως προς React/Firebase: ο γραφέας (`addLevel`) δίνεται ως όρισμα.
 *
 * @module subapps/dxf-viewer/systems/levels/level-provision
 * @see docs/centralized-systems/reference/adrs/ADR-914-open-create-entry.md
 */

import type { AddLevel, FloorplanType, Level, LevelBirthBinding } from './config';
import { levelScopeFields, resolveLevelScopeAssignment } from './level-building-scope';
import { levelsSharingNameScope } from './utils';

/** Ό,τι χρειάζεται ο provisioner από το σύστημα επιπέδων. */
export interface LevelProvisioner {
  readonly levels: readonly Level[];
  readonly addLevel: AddLevel;
  /**
   * ADR-914 §2.11 — τα επίπεδα όπως τα ξέρει ο **διακομιστής** στην εμβέλεια της δέσμευσης (το
   * κτήριό της, ή όλος ο μισθωτής). Η φορτωμένη λίστα μπορεί να είναι **στενεμένη** σε άλλο
   * κτήριο (`?bldg=`, ADR-845): τότε ούτε το «υπάρχει ήδη;» ούτε το «ποιο όνομα είναι ελεύθερο;»
   * απαντώνται από αυτήν — και ο διακομιστής απαντούσε 409 σε κάθε επανάληψη, με το ίδιο όνομα.
   * Απόν ⇒ η φορτωμένη λίστα είναι όλη η αλήθεια (in-memory, ή γραφέας που μένει στο ίδιο κτήριο).
   */
  readonly loadScopeLevels?: (buildingId: string | null) => Promise<readonly Level[]>;
  /** Το επίπεδο βρέθηκε στον διακομιστή, έξω από τη φορτωμένη λίστα — ο viewer το μαθαίνει. */
  readonly adoptLevel?: (level: Level) => void;
}

/** Σε τι δένεται το επίπεδο που ζητείται. Ένα σκέλος ανά είδος — καμία μισή δέσμευση. */
export type LevelProvisionBinding =
  | {
      readonly kind: 'storey';
      readonly floorId: string;
      readonly buildingId: string | null;
      readonly projectId?: string;
      readonly label: string;
      /**
       * `true` = γέννησε τον όροφο **χωρίς** `floorplanType`/`entityLabel`. Έτσι τον γεννούσαν
       * πάντα η εισαγωγή και το «όλοι οι όροφοι» (ο εισαγωγέας γράφει τον τύπο μόνος του
       * αμέσως μετά· το backfill ποτέ) — η συμπεριφορά τους δεν αλλάζει εδώ.
       */
      readonly untyped?: boolean;
    }
  /**
   * Κάτοψη **ακινήτου**. Ο όροφος είναι εκεί όπου βρίσκεται το ακίνητο (για πολυεπίπεδη μονάδα:
   * ο όροφος του συγκεκριμένου επιπέδου της) — κλειδί εμβέλειας των BIM οντοτήτων, όχι κάτοχος.
   */
  | {
      readonly kind: 'property';
      readonly propertyId: string;
      readonly floorId: string | null;
      readonly buildingId: string | null;
      readonly projectId?: string;
      readonly label: string;
    }
  | { readonly kind: 'building'; readonly buildingId: string; readonly projectId?: string; readonly label: string }
  | { readonly kind: 'project'; readonly projectId: string; readonly label: string }
  /** Αδέσμευτο πρόχειρο: ανήκει στον χώρο εργασίας, αριθμείται πάντα («Πρόχειρο 1», «Πρόχειρο 2»). */
  | { readonly kind: 'draft'; readonly label: string };

export interface ProvisionedLevel {
  /** `null` όταν η δημιουργία απέτυχε — το σφάλμα το έχει ήδη αναφέρει ο γραφέας. */
  readonly levelId: string | null;
  /** `false` = ο όροφος είχε ήδη επίπεδο και επαναχρησιμοποιήθηκε (ιδεμποτία). */
  readonly created: boolean;
  /** Το όνομα με το οποίο γεννήθηκε· `null` όταν δεν γεννήθηκε τίποτα. */
  readonly name: string | null;
}

const FLOORPLAN_TYPE_BY_KIND: Record<Exclude<LevelProvisionBinding['kind'], 'draft'>, FloorplanType> = {
  storey: 'floor',
  property: 'unit',
  building: 'building',
  project: 'project',
};

/**
 * Πρώτο ελεύθερο όνομα μέσα στην εμβέλεια μοναδικότητας του διακομιστή (ανά κτήριο, αλλιώς ανά
 * μισθωτή — `levelsSharingNameScope`). `numbered` ⇒ ξεκινά από «βάση 1» αντί για σκέτη «βάση».
 */
export function uniqueLevelName(
  base: string,
  levels: readonly Pick<Level, 'name' | 'buildingId'>[],
  buildingId?: string | null,
  numbered = false,
): string {
  const taken = new Set(levelsSharingNameScope(levels, buildingId).map((l) => l.name.toLowerCase()));
  if (!numbered && !taken.has(base.toLowerCase())) return base;
  for (let n = numbered ? 1 : 2; ; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * Είναι αυτό το επίπεδο **ο όροφος** `floorId`; Μια κάτοψη ακινήτου μοιράζεται τον `floorId`
 * του ορόφου της χωρίς να ΕΙΝΑΙ ο όροφος — όποιος ψάχνει «το επίπεδο του ορόφου» ρωτά εδώ.
 */
export function isStoreyLevelOf(level: Pick<Level, 'floorId' | 'propertyId'>, floorId: string): boolean {
  return level.floorId === floorId && !level.propertyId;
}

/** Το επίπεδο που υπάρχει ήδη για αυτή τη δέσμευση — μόνο όροφος και ακίνητο έχουν ταυτότητα. */
function findExistingLevel(levels: readonly Level[], binding: LevelProvisionBinding): Level | undefined {
  if (binding.kind === 'storey') return levels.find((l) => isStoreyLevelOf(l, binding.floorId));
  if (binding.kind === 'property') {
    return levels.find(
      (l) => l.propertyId === binding.propertyId && (l.floorId ?? null) === binding.floorId,
    );
  }
  return undefined;
}

/** Όροφος και κτήριο της δέσμευσης, όπως θα δοθούν στο `resolveLevelScopeAssignment`. */
function bindingScope(binding: LevelProvisionBinding): { floorId: string | null; buildingId: string | null } {
  const selection = {
    floorId: binding.kind === 'storey' || binding.kind === 'property' ? binding.floorId : null,
    buildingId: binding.kind === 'project' || binding.kind === 'draft' ? null : binding.buildingId,
  };
  return levelScopeFields(resolveLevelScopeAssignment(selection));
}

function bindingBirth(binding: LevelProvisionBinding, buildingId: string | null): LevelBirthBinding {
  if (binding.kind === 'draft') return {};
  const typed = !(binding.kind === 'storey' && binding.untyped);
  return {
    buildingId,
    projectId: binding.projectId,
    ...(binding.kind === 'property' ? { propertyId: binding.propertyId } : {}),
    ...(typed ? { floorplanType: FLOORPLAN_TYPE_BY_KIND[binding.kind], entityLabel: binding.label } : {}),
  };
}

function bindingName(binding: LevelProvisionBinding, levels: readonly Level[], buildingId: string | null): string {
  // Ο όροφος κρατά ΑΥΤΟΥΣΙΟ το όνομά του: είναι προβολή του ορόφου του κτηρίου (ADR-451) και η
  // μοναδικότητά του μέσα στο κτήριο είναι ήδη νόμος της στοίβας ορόφων (ADR-910).
  if (binding.kind === 'storey') return binding.label;
  return uniqueLevelName(binding.label, levels, buildingId, binding.kind === 'draft');
}

/**
 * Ό,τι ξέρει ο διακομιστής στην εμβέλεια της δέσμευσης και **λείπει** από τη φορτωμένη λίστα.
 * Αποτυχία ανάγνωσης ⇒ κενό: η δημιουργία προχωρά με ό,τι υπάρχει και ο διακομιστής μένει ο
 * τελικός κριτής (409).
 */
async function loadUnseenScopeLevels(
  provisioner: LevelProvisioner,
  buildingId: string | null,
): Promise<readonly Level[]> {
  if (!provisioner.loadScopeLevels) return [];
  try {
    const seen = new Set(provisioner.levels.map((l) => l.id));
    return (await provisioner.loadScopeLevels(buildingId)).filter((l) => !seen.has(l.id));
  } catch {
    return [];
  }
}

/**
 * Γεννά το επίπεδο της δέσμευσης — ή, για όροφο/ακίνητο που έχει ήδη επίπεδο, το επιστρέφει.
 * Ένα αίτημα δημιουργίας, καμία δεύτερη εγγραφή.
 */
export async function provisionLevelForBinding(
  provisioner: LevelProvisioner,
  binding: LevelProvisionBinding,
): Promise<ProvisionedLevel> {
  const existing = findExistingLevel(provisioner.levels, binding);
  if (existing) return { levelId: existing.id, created: false, name: existing.name };

  const scope = bindingScope(binding);
  const unseen = await loadUnseenScopeLevels(provisioner, scope.buildingId);
  const unseenExisting = findExistingLevel(unseen, binding);
  if (unseenExisting) {
    provisioner.adoptLevel?.(unseenExisting);
    return { levelId: unseenExisting.id, created: false, name: unseenExisting.name };
  }

  const name = bindingName(binding, [...provisioner.levels, ...unseen], scope.buildingId);
  const levelId = await provisioner.addLevel(
    name,
    false,
    scope.floorId ?? undefined,
    bindingBirth(binding, scope.buildingId),
  );
  return { levelId, created: levelId !== null, name: levelId ? name : null };
}
