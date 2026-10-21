/**
 * BOQ line role — «μετράει αυτή η γραμμή στο σύνολο;» (ADR-917 Λ7)
 *
 * Ο ΕΝΑΣ ορισμός για ΚΑΘΕ αθροιστή BOQ (πυρήνας κόστους, σύνοψη κτιρίου, EVM, αναφορές, UI).
 * Γονέας ομάδας BIM έχει δύο αντίθετες σημασίες:
 *   - `summary` — τοίχος DNA: ο γονέας = εμβαδόν όλου του τοίχου, τα children = μία γραμμή ανά
 *     στρώση **μαζί με τον πυρήνα** ⇒ ο γονέας ΔΕΝ αθροίζεται όταν υπάρχουν children.
 *   - `work` — κολόνα/δοκός (ADR-449/712): ο γονέας = στατικός πυρήνας, τα children = σοβάς /
 *     κοντόστυλο ⇒ ο γονέας αθροίζεται μαζί τους.
 * Πρακτική Revit (Wall Schedule ≠ Material Takeoff) / Autodesk Build (ο γονέας = Σ subitems):
 * σύνοψη και φύλλα δεν αθροίζονται ποτέ μαζί.
 *
 * ⚠️ Η απόφαση είναι σε επίπεδο **συνόλου**, όχι γραμμής: σύνοψη μετρά μόνο όταν **δεν** έχει κανένα
 * παρόν child (π.χ. τα σβήσαν όλα) — αλλιώς ο τοίχος θα εξαφανιζόταν. Φίλτρα (κωδικός, φάση,
 * κτίριο) εφαρμόζονται **ΜΕΤΑ** τη διαμέριση, πάνω στο `countable`.
 *
 * Παλιά έγγραφα χωρίς `groupRole`: ο ρόλος **αποδεικνύεται** από τον builder που τα έγραψε — γονέα
 * ομάδας γράφει για `wall` ΜΟΝΟ ο τοίχος DNA, για `column`/`beam` ΜΟΝΟ ο πυρήνας με σοβά/κοντόστυλο.
 * Ό,τι δεν αποδεικνύεται ⇒ `unresolved`: μετρά (κανένα ποσό δεν κρύβεται) και δηλώνεται.
 *
 * @module services/measurements/boq-line-role
 * @see ADR-917 §2.4 Λ7 · ADR-363 §6.1 · ADR-449 · ADR-712
 */

import type { BOQItem, BoqGroupRole } from '@/types/boq';

/** Τα πεδία που αρκούν για την απόφαση — ο server aggregator δεν χρειάζεται όλο το `BOQItem` */
export type BoqRoleInput = Pick<BOQItem, 'id'>
  & Partial<Pick<BOQItem, 'isGroupParent' | 'groupRole' | 'parentBoqItemId' | 'sourceEntityType'>>;

/** Από πού βγήκε ο ρόλος: ρητό πεδίο · απόδειξη από τον builder · καμία απόδειξη */
type BoqGroupRoleBasis = 'explicit' | 'source-entity' | 'unresolved';

interface ResolvedBoqGroupRole {
  /** `null` ⇒ η γραμμή δεν είναι γονέας ομάδας */
  role: BoqGroupRole | null;
  basis: BoqGroupRoleBasis | null;
}

/** Γονέας-σύνοψη εκτός αθροίσματος — ορατός στο drill-down, όχι κρυμμένος */
export interface ExcludedBoqSummary<T extends BoqRoleInput> {
  item: T;
  /** Πόσα παρόντα children τον αντικαθιστούν στο άθροισμα */
  childCount: number;
}

interface BoqLinePartition<T extends BoqRoleInput> {
  /** Οι γραμμές που αθροίζονται — η ΜΟΝΗ είσοδος κάθε αθροιστή */
  countable: T[];
  excludedSummaries: ExcludedBoqSummary<T>[];
  /** Γονείς χωρίς αποδείξιμο ρόλο — μετρούν, αλλά η ασάφεια δηλώνεται */
  unresolvedGroupRoleCount: number;
}

/**
 * Ρόλος γονέα από τον builder (fallback για έγγραφα πριν το Λ7). Κλειστός πίνακας: νέος builder
 * γονέα γράφει πάντα `groupRole` ρητά (υποχρεωτική παράμετρος του `buildGroupParentBoqRow`).
 */
const ROLE_BY_SOURCE_ENTITY: Readonly<Partial<Record<NonNullable<BOQItem['sourceEntityType']>, BoqGroupRole>>> = {
  wall: 'summary',
  column: 'work',
  beam: 'work',
};

export function resolveBoqGroupRole(item: BoqRoleInput): ResolvedBoqGroupRole {
  if (item.isGroupParent !== true) return { role: null, basis: null };
  if (item.groupRole === 'summary' || item.groupRole === 'work') {
    return { role: item.groupRole, basis: 'explicit' };
  }
  const proven = item.sourceEntityType ? ROLE_BY_SOURCE_ENTITY[item.sourceEntityType] : undefined;
  if (proven) return { role: proven, basis: 'source-entity' };
  return { role: 'work', basis: 'unresolved' };
}

function countChildren(items: readonly BoqRoleInput[]): Map<string, number> {
  const childCount = new Map<string, number>();
  for (const item of items) {
    if (!item.parentBoqItemId) continue;
    childCount.set(item.parentBoqItemId, (childCount.get(item.parentBoqItemId) ?? 0) + 1);
  }
  return childCount;
}

/**
 * Διαμέριση ενός **πλήρους** συνόλου γραμμών σε «αθροίζονται» / «σύνοψη εκτός».
 * Idempotent· διατηρεί τη σειρά εισόδου.
 */
export function partitionCountableBoqLines<T extends BoqRoleInput>(items: readonly T[]): BoqLinePartition<T> {
  const childCount = countChildren(items);
  const countable: T[] = [];
  const excludedSummaries: ExcludedBoqSummary<T>[] = [];
  let unresolvedGroupRoleCount = 0;
  for (const item of items) {
    const { role, basis } = resolveBoqGroupRole(item);
    if (basis === 'unresolved') unresolvedGroupRoleCount += 1;
    const children = childCount.get(item.id) ?? 0;
    if (role === 'summary' && children > 0) {
      excludedSummaries.push({ item, childCount: children });
      continue;
    }
    countable.push(item);
  }
  return { countable, excludedSummaries, unresolvedGroupRoleCount };
}

/** Τα id των γονέων-σύνοψη εκτός αθροίσματος — για πίνακες που δείχνουν τη γραμμή αλλά δεν την αθροίζουν */
export function excludedSummaryIds(items: readonly BoqRoleInput[]): ReadonlySet<string> {
  return new Set(partitionCountableBoqLines(items).excludedSummaries.map(({ item }) => item.id));
}

/** Μόνο οι γραμμές που αθροίζονται — για αθροιστές που δεν δείχνουν drill-down */
export function countableBoqLines<T extends BoqRoleInput>(items: readonly T[]): T[] {
  return partitionCountableBoqLines(items).countable;
}

// ============================================================================
// Ε2 — the price of a summary is DERIVED from its layers, never typed
// ============================================================================

/** The price fields a summary parent does not own (its cost = Σ of its layers) */
export const BOQ_PRICE_FIELDS = ['materialUnitCost', 'laborUnitCost', 'equipmentUnitCost'] as const;

/** A summary parent (explicit or proven by its builder) — its price is locked, whatever its children (Ε2). */
export function isSummaryBoqLine(item: BoqRoleInput): boolean {
  return resolveBoqGroupRole(item).role === 'summary';
}

/**
 * Does this update try to SET a price on a summary? Writing the same value or 0 is allowed (the model's
 * sync and the cleanup of a legacy price) — exactly what the Firestore rule admits (Α34).
 */
export function writesDerivedPrice(
  current: BoqRoleInput & Partial<Record<(typeof BOQ_PRICE_FIELDS)[number], number>>,
  update: Partial<Record<(typeof BOQ_PRICE_FIELDS)[number], number | undefined>>,
): boolean {
  if (!isSummaryBoqLine(current)) return false;
  return BOQ_PRICE_FIELDS.some((field) => {
    const next = update[field];
    return next !== undefined && next !== 0 && next !== current[field];
  });
}

/** Refusal of {@link writesDerivedPrice} — named, so the screen can say why (never a generic failure). */
export class BoqDerivedPriceError extends Error {
  constructor(readonly boqItemId: string) {
    super(`BOQ item ${boqItemId} is a summary: its price is the sum of its layers`);
    this.name = 'BoqDerivedPriceError';
  }
}
