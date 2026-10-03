/**
 * @fileoverview **Μετανάστευση + ελεγκτής απόκλισης** της φιλοξενίας σε όροφο (ADR-903 §6) — καθαρό.
 * @module lib/floor/plan-hosted-floor-backfill
 *
 * Ένα έγγραφο (ακίνητο · θέση · αποθήκη) + οι όροφοι της εταιρείας → τι πρέπει να γραφτεί.
 *
 * - Έχει `floorId` ⇒ το αντίγραφο ελέγχεται απέναντι στον όροφο (ίδια ερώτηση με το cascade:
 *   `hostedCopyDrift`). Αυτό είναι και ο **ελεγκτής απόκλισης**: το Revit δεν χρειάζεται, γιατί δεν
 *   έχει αντίγραφο· εμείς έχουμε, άρα το **μετράμε** αντί να το υποθέτουμε.
 * - Χωρίς `floorId` ⇒ παλιό κείμενο/αριθμός → ο **ένας** parser → όροφος του **ίδιου κτιρίου** με τον
 *   αριθμό (και το είδος, αν χρειάζεται για να ξεχωρίσει).
 *
 * 🔴 **Καμία μαντεψιά**: ό,τι δεν λύνεται **μονοσήμαντα** επιστρέφεται ως `unresolved` με λόγο —
 * αναφέρεται, **δεν γράφεται**. Ξένος όροφος (άλλο κτίριο/εταιρεία) ⇒ `unresolved`, ποτέ «διόρθωση».
 */

import { hostedCopyDrift, hostedCopyOf, hostedFloorRef, type HostedFloorCopy } from './hosted-floor';
import { isFloorKind, type FloorKind } from '@/utils/floor-naming';

/** Ό,τι χρειάζεται ο planner από κάθε όροφο. */
export interface FloorIndexEntry {
  readonly id: string;
  readonly buildingId: string;
  readonly companyId: string | null;
  readonly number: number;
  readonly kind: FloorKind | null;
}

/** Ευρετήριο ορόφων — χτίζεται **μία** φορά ανά τρέξιμο. */
export interface FloorIndex {
  readonly byId: ReadonlyMap<string, FloorIndexEntry>;
  readonly byBuilding: ReadonlyMap<string, readonly FloorIndexEntry[]>;
}

export type UnresolvedReason =
  | 'missing-floor'
  | 'foreign-floor'
  | 'no-building'
  | 'unparseable'
  | 'no-matching-floor'
  | 'ambiguous';

export type HostedFloorBackfill =
  | { readonly kind: 'noop' }
  | { readonly kind: 'write'; readonly fields: Partial<HostedFloorCopy>; readonly via: 'floorId' | 'legacy' }
  | { readonly kind: 'unresolved'; readonly reason: UnresolvedReason; readonly detail: string };

/** Από τα ωμά έγγραφα ορόφων στο ευρετήριο (άκυρα — χωρίς κτίριο ή αριθμό — παραλείπονται). */
export function buildFloorIndex(
  floors: ReadonlyArray<{ readonly id: string; readonly data: Readonly<Record<string, unknown>> }>,
): FloorIndex {
  const byId = new Map<string, FloorIndexEntry>();
  const byBuilding = new Map<string, FloorIndexEntry[]>();
  for (const { id, data } of floors) {
    if (typeof data.buildingId !== 'string' || typeof data.number !== 'number') continue;
    const entry: FloorIndexEntry = {
      id,
      buildingId: data.buildingId,
      companyId: typeof data.companyId === 'string' ? data.companyId : null,
      number: data.number,
      kind: isFloorKind(data.kind) ? data.kind : null,
    };
    byId.set(id, entry);
    byBuilding.set(entry.buildingId, [...(byBuilding.get(entry.buildingId) ?? []), entry]);
  }
  return { byId, byBuilding };
}

/** Το σχέδιο για ένα έγγραφο. */
export function planHostedFloorBackfill(
  doc: Readonly<Record<string, unknown>>,
  index: FloorIndex,
): HostedFloorBackfill {
  const hasFloorId = typeof doc.floorId === 'string' && doc.floorId !== '';
  // Κανένας όροφος δηλωμένος (θέση σε ανοιχτό χώρο, αυτόνομη μονάδα) ⇒ τίποτα να μεταναστεύσει.
  if (!hasFloorId && (doc.floor === undefined || doc.floor === null || doc.floor === '')) return { kind: 'noop' };
  const floor = hasFloorId
    ? hostOf(doc, index)
    : matchLegacy(doc, index);
  if ('reason' in floor) return { kind: 'unresolved', ...floor };

  const fields = hostedCopyDrift(doc, hostedCopyOf(floor.entry));
  if (!fields) return { kind: 'noop' };
  return { kind: 'write', fields, via: floor.via };
}

type Resolved = { readonly entry: FloorIndexEntry; readonly via: 'floorId' | 'legacy' };
type Refused = { readonly reason: UnresolvedReason; readonly detail: string };

function hostOf(doc: Readonly<Record<string, unknown>>, index: FloorIndex): Resolved | Refused {
  const entry = index.byId.get(doc.floorId as string);
  if (!entry) return { reason: 'missing-floor', detail: `floorId ${String(doc.floorId)}` };
  if (!sameTenant(doc, entry) || entry.buildingId !== doc.buildingId) {
    return { reason: 'foreign-floor', detail: `floor ${entry.id} ∈ building ${entry.buildingId}` };
  }
  return { entry, via: 'floorId' };
}

function matchLegacy(doc: Readonly<Record<string, unknown>>, index: FloorIndex): Resolved | Refused {
  const ref = hostedFloorRef(doc);
  if (!ref) return { reason: 'unparseable', detail: `floor ${JSON.stringify(doc.floor ?? null)}` };
  if (typeof doc.buildingId !== 'string' || doc.buildingId === '') {
    return { reason: 'no-building', detail: `floor ${JSON.stringify(doc.floor)}` };
  }
  const inBuilding = (index.byBuilding.get(doc.buildingId) ?? []).filter((f) => sameTenant(doc, f));
  const byNumber = ref.number === null ? inBuilding.filter((f) => f.kind === ref.kind) : inBuilding.filter((f) => f.number === ref.number);
  const candidates = byNumber.length > 1 && ref.kind !== null ? byNumber.filter((f) => f.kind === ref.kind) : byNumber;
  const detail = `floor ${JSON.stringify(doc.floor)} @ building ${doc.buildingId}`;
  if (candidates.length === 0) return { reason: 'no-matching-floor', detail };
  if (candidates.length > 1) return { reason: 'ambiguous', detail };
  return { entry: candidates[0], via: 'legacy' };
}

/** Ίδια εταιρεία — όπου και τα δύο τη δηλώνουν. Ο όροφος χωρίς εταιρεία δεν ανήκει σε κανέναν. */
function sameTenant(doc: Readonly<Record<string, unknown>>, floor: FloorIndexEntry): boolean {
  if (typeof doc.companyId !== 'string') return floor.companyId === null;
  return floor.companyId === doc.companyId;
}
