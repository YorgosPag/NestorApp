/**
 * @fileoverview **Σε ποιο κτίριο επιτρέπεται να πάει ένας χώρος** (θέση · αποθήκη) — ADR-898 §21.6 Ε6.
 * @module lib/spaces/space-building-scope
 *
 * 🔑 Ο κανόνας, **μία φορά**: χώρος που ανήκει σε έργο μετακινείται **μόνο** σε κτίριο του ίδιου έργου. Χώρος **χωρίς**
 *   έργο (ασύνδετος) ανατίθεται ελεύθερα — εκείνη η πράξη είναι «ανάθεση», όχι «μετακίνηση».
 * 🔑 Δύο καταναλωτές, **ίδιο κατηγόρημα**: ο φρουρός του server (`space-building-project-guard`) αρνείται, ο επιλογέας
 *   της φόρμας (`useSpaceBuildingLink`) **δεν προσφέρει** ό,τι ο server θα αρνιόταν. Επιλογέας που φιλτράρει με άλλο
 *   κριτήριο από τον φρουρό = κουμπί που αποτυγχάνει πάντα.
 * ⚠️ Καθαρό αρχείο: καμία ανάγνωση, κανένα React. Το «έργο του χώρου» το λύνει ο καθένας με τα δικά του μέσα
 *   (ο server από τα έγγραφα, ο πελάτης από τη λίστα) — {@link resolveSpaceProjectId} για τον πελάτη.
 */

/** Ό,τι χρειάζεται ο κανόνας από ένα κτίριο. */
export interface ScopedBuilding {
  readonly id: string;
  readonly name: string;
  /** `null` = κτίριο χωρίς έργο. */
  readonly projectId: string | null;
}

/** Ό,τι χρειάζεται ο κανόνας από τον χώρο. */
export interface SpaceBuildingAnchor {
  readonly projectId?: string | null;
  readonly buildingId?: string | null;
}

/** Μία επιλογή του επιλογέα· `group` μόνο όταν η λίστα διασχίζει έργα. */
export interface SpaceBuildingOption {
  readonly id: string;
  readonly name: string;
  readonly group?: string;
}

export interface SpaceBuildingOptionsInput {
  readonly space: SpaceBuildingAnchor;
  readonly buildings: readonly ScopedBuilding[];
  /** Όνομα έργου ανά id — χρειάζεται μόνο για την ομαδοποίηση του ασύνδετου χώρου. */
  readonly projectNames: ReadonlyMap<string, string>;
  /** Ετικέτα της ομάδας «κτίρια χωρίς έργο» (μεταφρασμένη από τον καλούντα). */
  readonly noProjectGroup: string;
  readonly locale: string;
}

function textOf(raw: string | null | undefined): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

/** Ο ΚΑΝΟΝΑΣ. Χώρος χωρίς έργο ⇒ κάθε κτίριο· αλλιώς μόνο κτίριο του ΙΔΙΟΥ έργου (κτίριο χωρίς έργο ⇒ όχι). */
export function isBuildingInSpaceProject(spaceProjectId: string | null, buildingProjectId: string | null): boolean {
  const spaceProject = textOf(spaceProjectId);
  if (spaceProject === null) return true;
  return textOf(buildingProjectId) === spaceProject;
}

/** Το έργο του χώρου — δικό του, αλλιώς του κτιρίου του (ίδια σειρά με τον server). */
export function resolveSpaceProjectId(space: SpaceBuildingAnchor, buildings: readonly ScopedBuilding[]): string | null {
  const own = textOf(space.projectId);
  if (own !== null) return own;
  const buildingId = textOf(space.buildingId);
  if (buildingId === null) return null;
  return textOf(buildings.find((building) => building.id === buildingId)?.projectId);
}

/** Ασύνδετος χώρος: όλα τα κτίρια, με το έργο τους ως ομάδα — «Κτήριο Α» έξι φορές δεν είναι επιλογή. */
function groupedByProject(input: SpaceBuildingOptionsInput, byName: (a: string, b: string) => number): SpaceBuildingOption[] {
  const groupOf = (building: ScopedBuilding): string => {
    const projectId = textOf(building.projectId);
    return projectId === null ? input.noProjectGroup : input.projectNames.get(projectId) ?? projectId;
  };
  return input.buildings
    .map((building) => ({ id: building.id, name: building.name, group: groupOf(building) }))
    .sort((a, b) => {
      if (a.group !== b.group) {
        if (a.group === input.noProjectGroup) return 1;
        if (b.group === input.noProjectGroup) return -1;
        return byName(a.group, b.group);
      }
      return byName(a.name, b.name);
    });
}

/**
 * Οι επιλογές κτιρίου για έναν χώρο.
 * - χώρος **με** έργο ⇒ μόνο τα κτίρια του έργου (χωρίς ομάδες — το έργο είναι ένα και γνωστό)·
 * - χώρος **χωρίς** έργο ⇒ όλα, ομαδοποιημένα ανά έργο.
 *
 * Το **τρέχον** κτίριο μένει πάντα στη λίστα: αλλιώς ο επιλογέας θα έδειχνε «τίποτα» για χώρο που έχει κτίριο.
 */
export function buildingOptionsForSpace(input: SpaceBuildingOptionsInput): SpaceBuildingOption[] {
  const collator = new Intl.Collator(input.locale, { numeric: true, sensitivity: 'base' });
  const byName = (a: string, b: string): number => collator.compare(a, b);

  const spaceProjectId = resolveSpaceProjectId(input.space, input.buildings);
  if (spaceProjectId === null) return groupedByProject(input, byName);

  const currentBuildingId = textOf(input.space.buildingId);
  return input.buildings
    .filter((building) => building.id === currentBuildingId || isBuildingInSpaceProject(spaceProjectId, building.projectId))
    .map((building) => ({ id: building.id, name: building.name }))
    .sort((a, b) => byName(a.name, b.name));
}
