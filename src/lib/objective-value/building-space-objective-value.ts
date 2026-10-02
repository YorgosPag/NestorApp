/**
 * @fileoverview **Η αντικειμενική αξία ενός χώρου του κτιρίου** — θέση στάθμευσης (έντυπο 5, άρθ. 7) και αποθήκη (έντυπο 4,
 * άρθ. 6), ως **δική του γραμμή** στον πίνακα του εργολάβου (ADR-898 §19 · Φ4γ).
 * @related `building-objective-value.ts` (η ΙΔΙΑ επικάλυψη κτιρίου: στάδιο · άδεια) · `objective-value-bounds.ts`
 *   (`PositionCandidates`: η στενεμένη απαρίθμηση) · `services/objective-value/building-space-objective-values.ts` (ο καλών)
 * @module lib/objective-value/building-space-objective-value
 *
 * 🔑 **Ιεραρχία θέσης: απάντηση του χώρου > γεγονός κτιρίου > ό,τι λένε ζώνη/όροφος > ανοιχτό** — η παράμετρος τύπου του
 *   Revit με υπέρβαση ανά αντίγραφο (απόφαση Giorgio «και τα δύο»). Ό,τι δεν κρίνεται ⇒ **εύρος** του νόμου πάνω στις
 *   θέσεις που μένουν δυνατές, ποτέ μαντεψιά.
 *
 * | Χώρος | Από τα δεδομένα | Θέση νόμου |
 * |---|---|---|
 * | αποθήκη | όροφος ≥ 1 | χώρος κύριας χρήσης ⇒ **εκτός** εντύπου 4 (άρθ. 6 §4α) |
 * | αποθήκη | ισόγειο | εκτός ΣΔ — **δηλωμένη** υπόθεση |
 * | αποθήκη | υπόγειο | είσοδος: χώρος > κτίριο > ανοιχτό στις 4 εισόδους υπογείου |
 * | θέση | πυλωτή · ανοιχτός/δώμα · υπόγειο | πυλωτή · ακάλυπτος/δώμα · κλειστή σε υπόγειο |
 * | θέση | σκεπαστή εξωτερική | ο νόμος δεν την ξέρει ⇒ **εύρος** ακάλυπτος ↔ πυλωτή |
 *
 * 🔑 **Γραμμική ζώνη μόνο όπου τη δίνει ο νόμος**: κλειστή ισόγεια θέση (άρθ. 7 §2) · αποθήκη ισόγεια ή υπόγεια με είσοδο
 *   από δρόμο (άρθ. 6 §2). Αλλού ⇒ μόνο η τιμή της ζώνης.
 * ⛔ Καθαρό: καμία I/O, κανένα κείμενο, κανένα αποθηκευμένο ποσό (ADR-889 §10.2).
 */

import type { BuildingSpaceKind } from '@/lib/building-spaces/building-space-membership';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import { isFiniteNumber } from '@/lib/type-guards';
import type { ParkingLocationZone } from '@/types/parking';

import {
  buildingUnitObjectiveValue,
  orderedInherited,
  type BuildingObjectiveValueContext,
  type BuildingUnitObjectiveValue,
} from './building-objective-value';
import type { BuildingFactQuestion } from './building-objective-value-questions';
import type { PositionCandidates } from './objective-value-bounds';
import { INITIAL_DRAFT, type ObjectiveValueDraft } from './objective-value-draft';
import type { ListingObjectiveValueAssumption, ListingObjectiveValueResolution } from './listing-objective-value';
import {
  BASEMENT_STORAGE_POSITIONS,
  PARKING_POSITIONS,
  STORAGE_POSITIONS,
  type ParkingPosition,
  type StoragePosition,
} from './objective-value-types';
import { declaredZonePriceCandidates } from './objective-value-zone';

/** Τα είδη χώρου — η πηγή είναι ο κανόνας «ποιοι χώροι είναι του κτιρίου» (ADR-898 §20)· εδώ μόνο ξαναεξάγονται. */
export { BUILDING_SPACE_KINDS, type BuildingSpaceKind } from '@/lib/building-spaces/building-space-membership';

/** Η θέση νόμου ενός χώρου (θέση στάθμευσης ή αποθήκη). */
export type SpaceLawPosition = ParkingPosition | StoragePosition;

/** Οι θέσεις του νόμου για ένα είδος χώρου — η ΜΙΑ λίστα για ανάγνωση, σχήμα γραφής και επιλογή της οθόνης. */
export const SPACE_LAW_POSITIONS: { readonly parking: readonly ParkingPosition[]; readonly storage: readonly StoragePosition[] } = {
  parking: PARKING_POSITIONS,
  storage: STORAGE_POSITIONS,
};

/** Το πεδίο του εγγράφου του χώρου όπου ζει η απάντηση του ανθρώπου — ένα όνομα για αναγνώστη και γραφέα. */
export const SPACE_OBJECTIVE_VALUE_POSITION_FIELD = 'objectiveValuePosition';

/** Αποθηκευμένη απάντηση → θέση του **ίδιου** είδους, ή `null` (άκυρη ⇒ «δεν απαντήθηκε», ποτέ ρίψη). */
export function readSpacePositionDeclaration(kind: BuildingSpaceKind, raw: unknown): SpaceLawPosition | null {
  return SPACE_LAW_POSITIONS[kind].find((position) => position === raw) ?? null;
}

/**
 * **Όροφος χώρου** — ελεύθερο κείμενο στο έγγραφο (ADR-145). Μόνο ακέραιος (`-1`, `0`, `2`) γίνεται όροφος· οτιδήποτε
 * άλλο (`pilotis`, «Υπόγειο») ⇒ `null`: άγνωστο, άρα ερώτηση — ποτέ ερμηνεία κειμένου.
 */
export function spaceFloorOf(raw: unknown): number | null {
  if (isFiniteNumber(raw)) return Number.isInteger(raw) ? raw : null;
  if (typeof raw !== 'string' || !/^[+-]?\d+$/.test(raw.trim())) return null;
  return Number.parseInt(raw.trim(), 10);
}

/** Ό,τι ξέρουμε για έναν χώρο — κανονικοποιημένο από τον καλούντα (καμία ωμή τιμή εγγράφου εδώ). */
export interface BuildingSpaceInput {
  readonly kind: BuildingSpaceKind;
  /** τ.μ. > 0 · `null` = δεν καταχωρίστηκε. */
  readonly area: number | null;
  readonly floor: number | null;
  /** Μόνο θέση στάθμευσης. */
  readonly locationZone: ParkingLocationZone | null;
  /** Η απάντηση του ανθρώπου για **αυτόν** τον χώρο. */
  readonly declaredPosition: SpaceLawPosition | null;
  /** Το πλήθος που δηλώνει η σύνδεση με μονάδα (`LinkedSpace.quantity`) · `null` = χωρίς σύνδεση. */
  readonly linkedQuantity: number | null;
}

/** Από πού ήρθε η θέση. */
export type SpacePositionSource = 'declared' | 'building' | 'zone' | 'floor';

export type SpacePosition =
  | { readonly kind: 'fixed'; readonly position: SpaceLawPosition; readonly source: SpacePositionSource }
  /** Ανοιχτή — `candidates` = ό,τι μένει δυνατό· `fact` = το γεγονός κτιρίου που την κλείνει (αν υπάρχει). */
  | { readonly kind: 'open'; readonly candidates: readonly SpaceLawPosition[]; readonly fact: BuildingFactQuestion | null }
  /** Αποθήκη σε όροφο: χώρος κύριας χρήσης (άρθ. 6 §4α) — έντυπο 1 ή 2, όχι 4. */
  | { readonly kind: 'mainUse' };

function storagePositionOf(space: BuildingSpaceInput, context: BuildingObjectiveValueContext): SpacePosition {
  if (space.declaredPosition !== null) return { kind: 'fixed', position: space.declaredPosition, source: 'declared' };
  const { floor } = space;
  if (floor === null) return { kind: 'open', candidates: STORAGE_POSITIONS, fact: null };
  if (floor > 0) return { kind: 'mainUse' };
  if (floor === 0) return { kind: 'fixed', position: 'groundNotCounted', source: 'floor' };
  const entrance = context.facts.basementStorageEntrance;
  if (entrance !== null) return { kind: 'fixed', position: entrance, source: 'building' };
  return { kind: 'open', candidates: BASEMENT_STORAGE_POSITIONS, fact: 'basementStorageEntrance' };
}

/** Ζώνη του χώρου → θέση νόμου · `covered_outdoor` δεν έχει αντίστοιχη ⇒ οι δύο ανοιχτές (απόφαση Giorgio, §19). */
const PARKING_POSITION_OF_ZONE: Readonly<Record<ParkingLocationZone, ParkingPosition | readonly ParkingPosition[]>> = {
  pilotis: 'pilotis',
  open_space: 'yardOrRoof',
  rooftop: 'yardOrRoof',
  underground: 'closedBasement',
  covered_outdoor: ['yardOrRoof', 'pilotis'],
};

function parkingPositionOf(space: BuildingSpaceInput): SpacePosition {
  if (space.declaredPosition !== null) return { kind: 'fixed', position: space.declaredPosition, source: 'declared' };
  if (space.locationZone !== null) {
    const mapped = PARKING_POSITION_OF_ZONE[space.locationZone];
    if (typeof mapped === 'string') return { kind: 'fixed', position: mapped, source: 'zone' };
    return { kind: 'open', candidates: mapped, fact: null };
  }
  // Θέση σε υπόγειο είναι κλειστή εξ ορισμού· σε ισόγειο/όροφο μπορεί να είναι κλειστή, πυλωτή ή ακάλυπτος.
  if (space.floor !== null && space.floor < 0) return { kind: 'fixed', position: 'closedBasement', source: 'floor' };
  return { kind: 'open', candidates: PARKING_POSITIONS, fact: null };
}

/** **Η θέση νόμου ενός χώρου** — με την ιεραρχία της κεφαλίδας. */
export function spacePositionOf(space: BuildingSpaceInput, context: BuildingObjectiveValueContext): SpacePosition {
  return space.kind === 'storage' ? storagePositionOf(space, context) : parkingPositionOf(space);
}

/** Θέσεις που **μπορεί** να πάρουν τιμή γραμμικής ζώνης (άρθ. 6 §2 · 7 §2). */
const LINEAR_ZONE_POSITIONS: ReadonlySet<SpaceLawPosition> = new Set<SpaceLawPosition>([
  'closedGround',
  'groundNotCounted',
  'basementStreetEntrance',
]);

function positionsOf(position: SpacePosition): readonly SpaceLawPosition[] {
  if (position.kind === 'fixed') return [position.position];
  return position.kind === 'open' ? position.candidates : [];
}

/** Οι τιμές ζώνης: όλες οι υποψήφιες μόνο όπου μια δυνατή θέση δέχεται γραμμική ζώνη· αλλιώς μόνο η ζώνη. */
function spaceZonePrices(verdict: ValueZoneVerdict, position: SpacePosition): readonly number[] {
  const linear = positionsOf(position).some((candidate) => LINEAR_ZONE_POSITIONS.has(candidate));
  return declaredZonePriceCandidates(verdict, linear ? null : { kind: 'none' });
}

function isParkingPosition(position: SpaceLawPosition): position is ParkingPosition {
  return SPACE_LAW_POSITIONS.parking.some((candidate) => candidate === position);
}

function isStoragePosition(position: SpaceLawPosition): position is StoragePosition {
  return SPACE_LAW_POSITIONS.storage.some((candidate) => candidate === position);
}

/** Η θέση στο πρόχειρο — ανοιχτή ⇒ `null`, και η απαρίθμηση στενεύει στις υποψήφιες. */
function draftOf(space: BuildingSpaceInput, position: SpacePosition): ObjectiveValueDraft {
  const fixed = position.kind === 'fixed' ? position.position : null;
  const base: ObjectiveValueDraft = { ...INITIAL_DRAFT, form: space.kind, levels: [{ floor: space.floor, area: space.area }], area: space.area };
  if (space.kind === 'parking') return { ...base, parkingPosition: fixed !== null && isParkingPosition(fixed) ? fixed : null };
  return { ...base, storagePosition: fixed !== null && isStoragePosition(fixed) ? fixed : null };
}

function candidatesOf(space: BuildingSpaceInput, position: SpacePosition): PositionCandidates {
  if (position.kind !== 'open') return {};
  return space.kind === 'parking'
    ? { parking: position.candidates.filter(isParkingPosition) }
    : { storage: position.candidates.filter(isStoragePosition) };
}

/** Οι δηλωμένες υποθέσεις του χώρου — η οθόνη τις λέει δίπλα στο ποσό. */
function spaceAssumptionsOf(space: BuildingSpaceInput, position: SpacePosition): readonly ListingObjectiveValueAssumption[] {
  const out: ListingObjectiveValueAssumption[] = [];
  if (space.kind === 'parking' && space.area === null) out.push({ kind: 'parkingDefaultArea' });
  if (position.kind === 'fixed' && position.source === 'floor' && position.position === 'groundNotCounted') out.push({ kind: 'storageNotCounted' });
  if (space.linkedQuantity !== null && space.linkedQuantity > 1) out.push({ kind: 'quantityDeclared', quantity: space.linkedQuantity });
  return out;
}

/** Η αποτίμηση ενός χώρου και η θέση του (η οθόνη τη χρειάζεται για την ερώτηση του χώρου). */
export interface BuildingSpaceObjectiveValue {
  readonly value: BuildingUnitObjectiveValue;
  readonly position: SpacePosition;
}

/**
 * **Η αντικειμενική αξία ενός χώρου στο κτίριο** — ίδια επικάλυψη κτιρίου με τις μονάδες (`buildingUnitObjectiveValue`:
 * στάδιο → αποπεράτωση, άδεια → παλαιότητα), με τη θέση της κεφαλίδας. `today` = ημερομηνία αποτίμησης (`YYYY-MM-DD`).
 */
export function buildingSpaceObjectiveValue(
  space: BuildingSpaceInput,
  context: BuildingObjectiveValueContext,
  verdict: ValueZoneVerdict,
  today: string,
): BuildingSpaceObjectiveValue {
  const position = spacePositionOf(space, context);
  if (position.kind === 'mainUse') return { value: { kind: 'unsupported', reason: 'mainUse' }, position };
  const zonePrices = spaceZonePrices(verdict, position);
  if (zonePrices.length === 0) return { value: { kind: 'no-zone' }, position };
  const resolution: ListingObjectiveValueResolution = {
    draft: draftOf(space, position),
    levelBasis: { kind: 'single' },
    used: [],
    approximatedFrom: null,
  };
  const basis = { kind: 'ready' as const, form: space.kind, resolution, zonePrices, positions: candidatesOf(space, position) };
  const value = buildingUnitObjectiveValue(basis, context, today);
  if (value.kind !== 'evaluated') return { value, position };
  const fromBuilding = position.kind === 'fixed' && position.source === 'building';
  return {
    value: {
      ...value,
      inherited: fromBuilding ? orderedInherited([...value.inherited, 'basementStorageEntrance']) : value.inherited,
      assumptions: [...value.assumptions, ...spaceAssumptionsOf(space, position)],
    },
    position,
  };
}
