/**
 * @fileoverview **ΟΙ ΠΡΟΤΑΣΕΙΣ ΚΟΙΝΟΧΡΗΣΤΩΝ ΑΠΟ ΤΗ ΣΤΟΙΒΑ ΟΡΟΦΩΝ** (ADR-931 §6.2 · Β2) — ποιοι κοινόχρηστοι χώροι
 * **λείπουν**, με βάση ό,τι το κτίριο ήδη δηλώνει για τον εαυτό του. Καθαρό (πελάτης + server).
 * @related `utils/floor-naming.ts` (λεξιλόγιο στάθμης · `isAboveGround`/`isBuildingStorey`) ·
 *   `lib/objective-value/building-objective-value-facts.ts` (ο ανελκυστήρας) ·
 *   `app/api/buildings/building-common-space-suggestion-dismiss.ts` (ο γραφέας της απόρριψης)
 * @module lib/common-spaces/common-space-suggestions
 *
 * 🔑 **Πρόταση, ποτέ σιωπηλή δημιουργία** (Revit «Place Rooms Automatically» → ο άνθρωπος εγκρίνει): η αποδοχή ανοίγει
 *   τον διάλογο δημιουργίας **προσυμπληρωμένο**· τίποτα δεν γράφεται χωρίς «Αποθήκευση».
 * 🔑 **Κάθε πρόταση φέρει τον ΛΟΓΟ της** (ποιο γεγονός την γέννησε) — μόνο ντετερμινιστικοί κανόνες, καμία μαντεψιά.
 * 🔑 **Σταθερό κλειδί** `<κατηγορία>@<όροφος|building>`: ίδια ερώτηση ⇒ ίδιο κλειδί (πρότυπο `tour-space-proposals`),
 *   άρα η μόνιμη απόρριψη στο κτίριο (`dismissedCommonSpaceSuggestions`) την κρατά σβηστή σε κάθε άνοιγμα.
 * 🔑 **«Υπάρχει ήδη» ⇒ καμία πρόταση**: χώρος της ίδιας κατηγορίας στον ίδιο όροφο, ή χώρος που εκτείνεται σε όλο το
 *   κτίριο (χωρίς όροφο). Για πρόταση όλου του κτιρίου αρκεί οποιοσδήποτε χώρος της κατηγορίας.
 * ⚠️ Ανελκυστήρας **μόνο** από `objectiveValueFacts.hasElevator === true` — όχι το `Building.hasElevator` (δυαδικό φίλτρο
 *   που κανείς δεν γράφει)· `null` = «δεν δηλώθηκε» ⇒ καμία πρόταση.
 */

import { COMMON_SPACE_CATEGORIES, type CommonSpaceCategory } from '@/constants/common-space-categories';
import { floorRefOf, type FloorRef } from '@/lib/floor/floor-ref';
import { inferKindFromNumber, isAboveGround, isBuildingStorey, type FloorKind } from '@/utils/floor-naming';

/** Η στάθμη όπως τη χρειάζονται οι κανόνες — υποσύνολο του `FloorOption` (`useFloorsByBuilding`). */
export interface SuggestionFloor {
  readonly id: string;
  readonly number: number;
  /** Απόν = παλιό έγγραφο ⇒ συνάγεται από τον αριθμό (`inferKindFromNumber`). */
  readonly kind?: FloorKind;
}

/** Ζωντανός κοινόχρηστος του κτιρίου — μόνο ό,τι κρίνει το «υπάρχει ήδη». */
export interface ExistingCommonSpace {
  readonly category: CommonSpaceCategory;
  /** Απόν/`null` = εκτείνεται σε όλο το κτίριο. */
  readonly floorId?: string | null;
}

/** Ο λόγος της πρότασης — το γεγονός που την γέννησε (αποδίδεται από i18n `tab.suggestions.reasons.<code>`). */
export type CommonSpaceSuggestionReason =
  | { readonly code: 'pilotisFloor'; readonly floor: FloorRef }
  | { readonly code: 'roofFloor'; readonly floor: FloorRef }
  | { readonly code: 'stairPenthouse'; readonly floor: FloorRef }
  | { readonly code: 'storeysAboveGround'; readonly count: number }
  | { readonly code: 'elevatorDeclared' }
  | { readonly code: 'elevatorWithPenthouse'; readonly floor: FloorRef };

export interface CommonSpaceSuggestion {
  readonly key: string;
  readonly category: CommonSpaceCategory;
  /** `null` = εκτείνεται σε όλο το κτίριο. */
  readonly floorId: string | null;
  readonly reason: CommonSpaceSuggestionReason;
}

export interface CommonSpaceSuggestionInput {
  readonly floors: readonly SuggestionFloor[];
  /** `objectiveValueFacts.hasElevator` — `null` = δεν δηλώθηκε. */
  readonly hasElevator: boolean | null;
  readonly existing: readonly ExistingCommonSpace[];
  readonly dismissed: readonly string[];
}

/** Το σκέλος κλειδιού για πρόταση όλου του κτιρίου. */
const BUILDING_SCOPE = 'building';
const KEY_SEPARATOR = '@';

/** Ανώτατο πλήθος απορρίψεων ανά κτίριο — φράγμα στο μέγεθος του εγγράφου, ποτέ λίστα χωρίς όριο. */
export const MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS = 200;

/** Το πεδίο του κτιρίου — η ΜΙΑ δήλωση του ονόματος (γραφέας · τύπος · ιστορικό · πελάτης). */
export const DISMISSED_COMMON_SPACE_SUGGESTIONS_FIELD = 'dismissedCommonSpaceSuggestions';

/** Το κλειδί σώματος του `PATCH /api/buildings` για μία απόρριψη (ο κλάδος του server ρωτά «υπάρχει;»). */
export const DISMISS_COMMON_SPACE_SUGGESTION_BODY_KEY = 'dismissCommonSpaceSuggestion';

export function commonSpaceSuggestionKey(category: CommonSpaceCategory, floorId: string | null): string {
  return `${category}${KEY_SEPARATOR}${floorId ?? BUILDING_SCOPE}`;
}

/** Μορφή κλειδιού: γνωστή κατηγορία + μη κενό σκέλος χώρου χωρίς διαχωριστικό ή `/` (id εγγράφου Firestore). */
export function isCommonSpaceSuggestionKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 200) return false;
  const [category, scope, ...rest] = value.split(KEY_SEPARATOR);
  if (rest.length > 0 || scope === undefined || scope === '' || scope.includes('/')) return false;
  return (COMMON_SPACE_CATEGORIES as readonly string[]).includes(category);
}

/** Ό,τι είναι αποθηκευμένο (ή λείπει) → τα έγκυρα κλειδιά, χωρίς διπλότυπα. Άκυρο ⇒ αγνοείται, ποτέ ρίψη. */
export function readDismissedCommonSpaceSuggestions(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isCommonSpaceSuggestionKey))];
}

/** Η απόρριψη πάνω στη φρέσκια λίστα — ιδεμποτική (δεύτερη απόρριψη = ίδια λίστα). */
export function withDismissedCommonSpaceSuggestion(current: readonly string[], key: string): readonly string[] {
  return current.includes(key) ? current : [...current, key];
}

const kindOf = (floor: SuggestionFloor): FloorKind => floor.kind ?? inferKindFromNumber(floor.number);

/** Η στάθμη ως `FloorRef` για την ετικέτα του λόγου (ο ΕΝΑΣ μορφοποιητής `formatFloorRef`). */
const refOf = (floor: SuggestionFloor): FloorRef => floorRefOf(floor.number, kindOf(floor)) ?? { number: floor.number, kind: null };

/** Όροφοι πάνω από το έδαφος που μετρούν ως «Όροφοι: N» (χωρίς πυλωτή, δώμα, απόληξη, σοφίτα). */
function storeysAboveGround(floors: readonly SuggestionFloor[]): number {
  return floors.filter((floor) => isAboveGround(kindOf(floor)) && isBuildingStorey(kindOf(floor))).length;
}

type Candidate = Omit<CommonSpaceSuggestion, 'key'>;

/** Οι κανόνες στάθμης: πυλωτή → πυλωτή · δώμα → δώμα · απόληξη → κλιμακοστάσιο (+ μηχανοστάσιο με ανελκυστήρα). */
function floorCandidates(floor: SuggestionFloor, hasElevator: boolean): readonly Candidate[] {
  const floorRef = refOf(floor);
  switch (kindOf(floor)) {
    case 'pilotis':
      return [{ category: 'pilotis', floorId: floor.id, reason: { code: 'pilotisFloor', floor: floorRef } }];
    case 'roof':
      return [{ category: 'roof_terrace', floorId: floor.id, reason: { code: 'roofFloor', floor: floorRef } }];
    case 'stair-penthouse': {
      const stair: Candidate = { category: 'stairwell', floorId: null, reason: { code: 'stairPenthouse', floor: floorRef } };
      if (!hasElevator) return [stair];
      return [stair, { category: 'elevator_machine_room', floorId: floor.id, reason: { code: 'elevatorWithPenthouse', floor: floorRef } }];
    }
    default:
      return [];
  }
}

/** Οι κανόνες κτιρίου: > 1 όροφος πάνω από το έδαφος → κλιμακοστάσιο · δηλωμένος ανελκυστήρας → ανελκυστήρας. */
function buildingCandidates(floors: readonly SuggestionFloor[], hasElevator: boolean): readonly Candidate[] {
  const candidates: Candidate[] = [];
  const count = storeysAboveGround(floors);
  if (count > 1) candidates.push({ category: 'stairwell', floorId: null, reason: { code: 'storeysAboveGround', count } });
  if (hasElevator) candidates.push({ category: 'elevator', floorId: null, reason: { code: 'elevatorDeclared' } });
  return candidates;
}

/** «Υπάρχει ήδη»: ίδια κατηγορία στον ίδιο όροφο ή σε όλο το κτίριο· για πρόταση κτιρίου, οπουδήποτε. */
function alreadyExists(candidate: Candidate, existing: readonly ExistingCommonSpace[]): boolean {
  return existing.some((space) => space.category === candidate.category
    && (candidate.floorId === null || (space.floorId ?? null) === null || space.floorId === candidate.floorId));
}

/**
 * **Οι κοινόχρηστοι που λείπουν**, με σταθερή σειρά: πρώτα οι κανόνες στάθμης (με τη σειρά της στοίβας), μετά του
 * κτιρίου. Ίδιο κλειδί από δύο κανόνες ⇒ μένει ο **πρώτος** (η απόληξη είναι ισχυρότερη απόδειξη κλιμακοστασίου από το
 * πλήθος ορόφων). Χωρίς ορόφους ⇒ καμία πρόταση (δεν μαντεύουμε κτίριο που δεν περιγράφηκε).
 */
export function suggestMissingCommonSpaces(input: CommonSpaceSuggestionInput): readonly CommonSpaceSuggestion[] {
  const { floors, existing } = input;
  if (floors.length === 0) return [];
  const hasElevator = input.hasElevator === true;
  const ordered = [...floors].sort((a, b) => a.number - b.number);
  const candidates = [...ordered.flatMap((floor) => floorCandidates(floor, hasElevator)), ...buildingCandidates(ordered, hasElevator)];
  const dismissed = new Set(input.dismissed);
  const seen = new Set<string>();
  const suggestions: CommonSpaceSuggestion[] = [];
  for (const candidate of candidates) {
    const key = commonSpaceSuggestionKey(candidate.category, candidate.floorId);
    if (seen.has(key)) continue;
    seen.add(key);
    if (dismissed.has(key) || alreadyExists(candidate, existing)) continue;
    suggestions.push({ key, ...candidate });
  }
  return suggestions;
}
