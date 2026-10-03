/**
 * @fileoverview **Η ΠΡΟΤΑΣΗ ΘΕΣΗΣ ΜΙΑΣ ΛΗΨΗΣ** — ο **ένας** αναγνώστης της, για τη δήλωση του πελάτη **και** το αποθηκευμένο
 * έγγραφο (ADR-904 Κ8 · Α8).
 * @related `types/spatial-tour.ts` (`TourCapturePlacementHint`) · `tour-room.ts` (`normalizeTourRoom` — η ΜΙΑ κανονικοποίηση
 *   χώρου) · `server/spatial-tour/tour-capture-finalize.ts` (`readCaptureDeclaration`) · `spatial-tour-from-document.ts`
 * @module lib/spatial-tour/tour-capture-placement-hint
 *
 * 🔑 **Ένας αναγνώστης, δύο σύνορα**: ό,τι δέχεται η ολοκλήρωση ανεβάσματος το ξαναδιαβάζει **ίδιο** το σύνορο του εγγράφου —
 * καμία δήλωση που γράφεται και μετά «δεν καταλαβαίνουμε».
 * 🔴 **Άκυρη πρόταση ≠ απούσα**: `undefined` ⇒ ο καλών απορρίπτει (δήλωση `declaration-invalid` · έγγραφο `null`). Ποτέ σιωπηλό
 *   πέταγμα — θα έχανε ό,τι είπε ο άνθρωπος στεκόμενος εκεί.
 * 🔑 **Ο όροφος ΔΕΝ κρίνεται απέναντι στην περιήγηση στην ανάγνωση**: μπορεί να άλλαξε ανάμεσα σε λίστα και ανέβασμα. Το «υπάρχει
 *   ακόμη;» το απαντά **τη στιγμή της προβολής** το {@link placementHintLevel} — υπάρχει · νέος · εκτός περιήγησης, ρητά.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { TOUR_HINT_POINT_MAX_PX, TOUR_HINT_RADIUS_MAX_PX } from '@/constants/spatial-tour-vocabulary';
import { text } from '@/lib/agency/showcase-read-primitives';
import type { PixelPoint } from '@/lib/geometry/scale-calibration';
import { isFiniteNumber, isRecord } from '@/lib/type-guards';
import type { TourCaptureHintPoint, TourCapturePlacementHint, TourLevel, TourLevelKey } from '@/types/spatial-tour';

import { levelKeyId, tourLevelChoices, type TourLevelChoice } from './spatial-tour-graph';
import { activeFloorPlan, calibratedPlan, imagePixelToPlan, isOnPlan, type CalibratedPlan } from './tour-plan-frame';
import { normalizeTourRoom } from './tour-room';
import type { TourViewerLevel } from './viewer/tour-viewer-graph';

/** **Κλειδί ορόφου, ή `null`** — `floor` με σταθερό `floorId` (ADR-903) · `local` με ακέραια σειρά. */
export function readTourLevelKey(raw: unknown): TourLevelKey | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'floor') {
    const floorId = text(raw.floorId);
    return floorId === null ? null : { kind: 'floor', floorId };
  }
  if (raw.kind === 'local' && Number.isInteger(raw.ordinal)) return { kind: 'local', ordinal: raw.ordinal as number };
  return null;
}

/** Ο χώρος της πρότασης — `null` απών · `undefined` άκυρος. */
function readRoomHint(raw: unknown): TourCapturePlacementHint['room'] | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw) || !Array.isArray(raw.types)) return undefined;
  const room = normalizeTourRoom({ types: raw.types, label: raw.label ?? null });
  return room === null ? undefined : { types: room.types, label: room.label };
}

const isPixel = (value: unknown): value is number => isFiniteNumber(value) && value >= 0 && value <= TOUR_HINT_POINT_MAX_PX;

/** Το σημείο της πρότασης (Κ9) — `null` απόν · `undefined` άκυρο. Το «πάνω στην κάτοψη;» κρίνεται στην **προβολή**. */
function readHintPoint(raw: unknown): TourCaptureHintPoint | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const planContentHash = text(raw.planContentHash);
  if (planContentHash === null || !isPixel(raw.x) || !isPixel(raw.y)) return undefined;
  const radius = raw.radiusPx;
  if (radius !== undefined && !(isFiniteNumber(radius) && radius > 0 && radius <= TOUR_HINT_RADIUS_MAX_PX)) return undefined;
  return { planContentHash, x: raw.x, y: raw.y, ...(radius === undefined ? {} : { radiusPx: radius }) };
}

/**
 * **Η πρόταση θέσης.** `null` ⇒ δεν δηλώθηκε (απούσα, ή κενή `{}` — τίποτα να προταθεί) · `undefined` ⇒ υπάρχει αλλά **δεν
 * διαβάζεται** (ίδια σύμβαση με τη θέση και τον χώρο του σημείου). Σημείο **χωρίς** όροφο = άκυρο: δεν έχει κάτοψη.
 */
export function readCapturePlacementHint(raw: unknown): TourCapturePlacementHint | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const level = raw.level === undefined || raw.level === null ? null : readTourLevelKey(raw.level) ?? undefined;
  const room = readRoomHint(raw.room);
  const point = readHintPoint(raw.point);
  if (level === undefined || room === undefined || point === undefined) return undefined;
  if (point !== null && level === null) return undefined;
  if (level === null && room === null) return null;
  return { ...(level === null ? {} : { level }), ...(room === null ? {} : { room }), ...(point === null ? {} : { point }) };
}

/**
 * **Ένας όροφος για τη λήψη** (Κ9): επιλογή ορόφου + η κάτοψη πάνω στην οποία πατά ο φωτογράφος — **μόνο** βαθμονομημένη
 * (`calibratedPlan`): σε αβαθμονόμητη σημείο δεν τοποθετείται ούτε στον γραφέα.
 */
export interface CaptureLevelChoice extends TourLevelChoice {
  readonly calibratedPlan: CalibratedPlan | null;
}

/** **Οι όροφοι για τη λήψη** — η ΜΙΑ προβολή για εισερχόμενα και κινητό (Κ7 · Κ8 · Κ9), πάνω στο `tourLevelChoices`. */
export function captureLevelChoices(levels: readonly Pick<TourLevel, 'key' | 'floorPlans'>[]): CaptureLevelChoice[] {
  const choices = tourLevelChoices(levels);
  return levels.map((level, index) => ({ ...choices[index], calibratedPlan: calibratedPlan(activeFloorPlan(level)) }));
}

/**
 * **Οι ίδιοι όροφοι από το μανιφέστο του επεξεργαστή** — η φόρμα τοποθέτησης έχει `TourViewerLevel` (ενεργή κάτοψη + κλίμακα), όχι
 * την ιστορία κατόψεων. Ίδιος κανόνας: κάτοψη **μόνο** με εικόνα **και** κλίμακα.
 */
export function captureLevelsOfViewer(levels: readonly TourViewerLevel[]): CaptureLevelChoice[] {
  return levels.map(({ key, ordinal, label, plan }) => ({
    key, ordinal, label,
    calibratedPlan: plan == null || plan.metresPerPixel === null ? null : { image: plan.image, metresPerPixel: plan.metresPerPixel },
  }));
}

/** Ο προτεινόμενος όροφος απέναντι στους ορόφους της περιήγησης **τώρα** — τρεις απαντήσεις, καμία σιωπηλή διόρθωση. */
export type PlacementHintLevel<L extends TourLevelChoice = TourLevelChoice> =
  | { readonly kind: 'known'; readonly level: L }
  /** Τοπικός όροφος που δεν υπάρχει ακόμη — ο φωτογράφος πρότεινε **νέο** (πρότυπο Matterport Capture: όροφος στη λήψη). */
  | { readonly kind: 'new'; readonly ordinal: number }
  /** Όροφος BIM που **δεν** είναι πια στην περιήγηση — ποτέ δεν επινοείται τοπικός στη θέση του. */
  | { readonly kind: 'gone' };

export function placementHintLevel<L extends TourLevelChoice>(key: TourLevelKey, levels: readonly L[]): PlacementHintLevel<L> {
  const id = levelKeyId(key);
  const level = levels.find((choice) => levelKeyId(choice.key) === id);
  if (level !== undefined) return { kind: 'known', level };
  return key.kind === 'local' ? { kind: 'new', ordinal: key.ordinal } : { kind: 'gone' };
}

/** Το προτεινόμενο σημείο απέναντι στην κάτοψη του ορόφου **τώρα** — καμία σιωπηλή μεταφορά σε άλλη κάτοψη (Κ9). */
export type PlacementHintPoint =
  | {
      readonly kind: 'on-plan';
      readonly level: CaptureLevelChoice;
      readonly plan: CalibratedPlan;
      readonly pixel: PixelPoint;
      readonly radiusPx: number | null;
    }
  /** Ο όροφος έχει άλλη (ή καμία βαθμονομημένη) κάτοψη από εκείνη που είδε ο φωτογράφος. */
  | { readonly kind: 'plan-changed' }
  /** Ίδια κάτοψη, αλλά το σημείο πέφτει έξω της (πειραγμένος πελάτης ή σφάλμα) — δεν προτείνεται. */
  | { readonly kind: 'outside-plan' }
  /** Ο όροφος δεν υπάρχει (ακόμη ή πια) — το λέει ήδη το {@link placementHintLevel}. */
  | { readonly kind: 'level-unknown' };

export function placementHintPoint(hint: TourCapturePlacementHint, levels: readonly CaptureLevelChoice[]): PlacementHintPoint | null {
  const { point, level: key } = hint;
  if (point === undefined || key === undefined) return null;
  const at = placementHintLevel(key, levels);
  if (at.kind !== 'known') return { kind: 'level-unknown' };
  const plan = at.level.calibratedPlan;
  if (plan === null || plan.image.contentHash !== point.planContentHash) return { kind: 'plan-changed' };
  const pixel = { x: point.x, y: point.y };
  if (!isOnPlan(imagePixelToPlan(pixel, plan.metresPerPixel), plan)) return { kind: 'outside-plan' };
  return { kind: 'on-plan', level: at.level, plan, pixel, radiusPx: point.radiusPx ?? null };
}
