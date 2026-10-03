/**
 * @fileoverview **ΦΙΛΟΞΕΝΙΑ ΣΕ ΟΡΟΦΟ** — πώς ένα ακίνητο / θέση / αποθήκη «κάθεται» σε όροφο (ADR-903 §6).
 * @module lib/floor/hosted-floor
 *
 * 🔑 Πρότυπο των μεγάλων:
 * - **Revit** — το στοιχείο κρατά **μόνο** `LevelId`· ό,τι δείχνει για τη στάθμη παράγεται από το Level.
 * - **ArchiCAD** — Home Story: αλλάζει ο όροφος ⇒ το στοιχείο **ακολουθεί**.
 * - **idealista / RESO** — η αγγελία κρατά τον όροφο ως **αριθμό ή επώνυμη στάθμη** (δεν έχει join).
 *
 * Εμείς (Firestore, χωρίς join): **αυθεντία = `floorId`** + **παράγωγο αντίγραφο** `floor` (αριθμός) +
 * `floorKind` (είδος) που γράφει **ΜΟΝΟ ο server** από το έγγραφο ορόφου και κρατά συγχρονισμένο το
 * `floor-ref-cascade`. Χωρίς το είδος, θέση σε **πυλωτή** (αριθμός 0) θα έλεγε «Ισόγειο».
 *
 * Καθαρό (χωρίς Firestore) ⇒ το ίδιο module το διαβάζουν client, server, cascade και μετανάστευση.
 */

import { isFloorKind, type FloorKind } from '@/utils/floor-naming';
import { floorRefOf, parseLegacyFloor, type FloorRef } from './floor-ref';

/** Τα τρία πεδία της φιλοξενίας — το ίδιο σχήμα σε `Property` · `ParkingSpot` · `Storage`. */
export interface HostedFloorCopy {
  /** 🔑 Η αυθεντία (Revit `LevelId`). `null` = δεν φιλοξενείται (ανοιχτός χώρος / χωρίς κτίριο). */
  readonly floorId: string | null;
  /** Παράγωγο: ο αριθμός του ορόφου (`FloorDocument.number`). */
  readonly floor: number | null;
  /** Παράγωγο: το είδος του ορόφου (`FloorDocument.kind`) — `null` ⇒ συνάγεται από τον αριθμό. */
  readonly floorKind: FloorKind | null;
}

/** Τα πεδία φιλοξενίας στους τύπους οντοτήτων (προαιρετικά: παλιά έγγραφα πριν τη μετανάστευση). */
export interface HostedOnFloor {
  floorId?: string | null;
  floor?: number | null;
  floorKind?: FloorKind | null;
}

/** «Δεν φιλοξενείται» — τα τρία πεδία καθαρά μαζί, ποτέ ένα χωρίς τα άλλα. */
export const UNHOSTED: HostedFloorCopy = Object.freeze({ floorId: null, floor: null, floorKind: null });

/** Ό,τι χρειάζεται από το έγγραφο ορόφου για να παραχθεί το αντίγραφο. */
export interface HostFloorSource {
  readonly id: string;
  readonly number: number;
  readonly kind?: unknown;
}

/** Το αντίγραφο που **πρέπει** να έχει κάθε στοιχείο φιλοξενούμενο σε αυτόν τον όροφο. */
export function hostedCopyOf(floor: HostFloorSource): HostedFloorCopy {
  return {
    floorId: floor.id,
    floor: floor.number,
    floorKind: isFloorKind(floor.kind) ? floor.kind : null,
  };
}

/**
 * Το **σύνορο ανάγνωσης**: αποθηκευμένο έγγραφο → `FloorRef`.
 *
 * Αριθμός ⇒ `{ floor, floorKind }`. Κείμενο ⇒ παλιό έγγραφο πριν τη μετανάστευση («Υπόγειο -1»,
 * `basement-1`) ⇒ ο **ένας** parser. Άγνωστο ⇒ `null`, ποτέ σιωπηλό ισόγειο.
 */
export function hostedFloorRef(doc: { readonly floor?: unknown; readonly floorKind?: unknown }): FloorRef | null {
  if (typeof doc.floor === 'number') {
    return floorRefOf(doc.floor, isFloorKind(doc.floorKind) ? doc.floorKind : null);
  }
  return parseLegacyFloor(doc.floor);
}

/**
 * Ο **ένας αναγνώστης** για τους mappers εγγράφων (`firestore-mappers`): τα τρία πεδία κανονικοποιημένα.
 * Παλιό κείμενο («Υπόγειο -1») ⇒ αριθμός + είδος από τον parser· άγνωστο ⇒ `null`, όχι 0.
 */
export function readHostedFloor(data: Readonly<Record<string, unknown>>): HostedFloorCopy {
  const ref = hostedFloorRef(data);
  return {
    floorId: typeof data.floorId === 'string' && data.floorId !== '' ? data.floorId : null,
    floor: ref?.number ?? null,
    floorKind: ref?.kind ?? null,
  };
}

/** Ο αριθμός για ταξινόμηση/φίλτρο — από το ίδιο σύνορο (`null` ⇒ χωρίς όροφο). */
export function hostedFloorNumber(doc: { readonly floor?: unknown; readonly floorKind?: unknown }): number | null {
  return hostedFloorRef(doc)?.number ?? null;
}

/**
 * Το **ζεύγος** `floor` + `floorKind` για ό,τι **δεν** έχει `floorId` — δήλωση ιδιοκτήτη, δημόσια αγγελία
 * (ADR-900 §8 #2, 2β.2 · idealista/RESO: αριθμός + επώνυμη στάθμη, χωρίς join). Ποτέ είδος χωρίς αριθμό:
 * επώνυμη στάθμη παλιού κειμένου χωρίς αριθμό («Δώμα») δεν ταιριάζει σε εύρος ⇒ `{ null, null }`.
 */
export function floorPairOf(
  doc: { readonly floor?: unknown; readonly floorKind?: unknown },
): Pick<HostedFloorCopy, 'floor' | 'floorKind'> {
  const ref = hostedFloorRef(doc);
  if (ref === null || ref.number === null) return { floor: null, floorKind: null };
  return { floor: ref.number, floorKind: ref.kind };
}

const HOSTED_FIELDS = ['floorId', 'floor', 'floorKind'] as const;

/**
 * Η **απόκλιση** αποθηκευμένου ↔ αναμενόμενου: τα πεδία που πρέπει να γραφτούν, ή `null` όταν
 * συμφωνούν (🔑 ιδεμποτία — ο cascade, η μετανάστευση και ο ελεγκτής `--verify` ρωτούν το **ίδιο**).
 */
export function hostedCopyDrift(
  stored: Readonly<Record<string, unknown>>,
  expected: HostedFloorCopy,
): Partial<HostedFloorCopy> | null {
  const drift: Record<string, unknown> = {};
  for (const field of HOSTED_FIELDS) {
    if ((stored[field] ?? null) !== expected[field]) drift[field] = expected[field];
  }
  return Object.keys(drift).length > 0 ? (drift as Partial<HostedFloorCopy>) : null;
}

/** Τι ζητά ένα σώμα αιτήματος για τη φιλοξενία. */
export type HostedFloorIntent =
  | { readonly kind: 'keep' }
  | { readonly kind: 'clear' }
  | { readonly kind: 'resolve'; readonly floorId: string; readonly buildingId: string | null };

/**
 * Σώμα + αποθηκευμένο → πρόθεση.
 *
 * - `floorId` κείμενο ⇒ **επίλυση** στο κτίριο του σώματος (αν άλλαξε) ή στο αποθηκευμένο.
 * - `floorId: null` / `''` ⇒ **καθαρισμός** των τριών πεδίων.
 * - χωρίς `floorId`, αλλά **άλλο κτίριο** ⇒ καθαρισμός: ο όροφος ανήκε στο παλιό κτίριο
 *   (Revit: στοιχείο που φεύγει από το μοντέλο δεν κρατά Level του άλλου).
 * - αλλιώς ⇒ τίποτα.
 */
export function planHostedFloorIntent(
  body: Readonly<Record<string, unknown>>,
  existing: Readonly<Record<string, unknown>>,
): HostedFloorIntent {
  const existingBuildingId = textOrNull(existing.buildingId);
  const buildingId = body.buildingId !== undefined ? textOrNull(body.buildingId) : existingBuildingId;

  if (typeof body.floorId === 'string' && body.floorId.trim() !== '') {
    return { kind: 'resolve', floorId: body.floorId.trim(), buildingId };
  }
  if (body.floorId !== undefined) return { kind: 'clear' };
  if (body.buildingId !== undefined && buildingId !== existingBuildingId && existing.floorId) {
    return { kind: 'clear' };
  }
  return { kind: 'keep' };
}

/** Μη κενό κείμενο (trim) ή `null`. */
function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
