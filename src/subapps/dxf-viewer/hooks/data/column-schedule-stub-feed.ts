'use client';

/**
 * ADR-712 — «κοντόστυλο» θεμελίωσης για τον **πίνακα Επιμετρήσεων** (schedule feed).
 *
 * Ο δίδυμος του `column-boq-feed` για τη δεύτερη διαδρομή επιμέτρησης: το
 * `BimScheduleDialog` δεν περνά από το `BimToBoqBridge`, οπότε χωρίς αυτό ο πίνακας θα
 * έδειχνε άλλο νούμερο από το τιμολόγιο. Ίδιο σχήμα με το `applyFoundationGridNet`
 * (pre-pass πάνω στα ίδια `entities`, μηδέν mutation).
 *
 * **Γιατί lookup και ΟΧΙ αντικατάσταση της γεωμετρίας** (σε αντίθεση με το
 * `applyFoundationGridNet`): η στήλη «Όγκος» δείχνει ήδη τον όγκο **ανωδομής** — αυτό
 * ακριβώς πρέπει να συνεχίσει να δείχνει (είναι η ποσότητα του OIK-2.03). Το κοντόστυλο
 * είναι **επιπλέον** ποσότητα σε άλλο άρθρο, όχι διόρθωση της υπάρχουσας. Άρα η γεωμετρία
 * μένει άθικτη και οι δύο νέες στήλες έρχονται από `ScheduleLookups` — μηδέν regression
 * στη στήλη «Όγκος», μηδέν αλλαγή στο `ColumnGeometry`.
 *
 * @see column-continuity-boq-source.ts — ο κοινός cross-level χάρτης έδρασης
 * @see ../../bim/geometry/column-foundation-stub.ts — το σχήμα ποσοτήτων
 */

import type { Entity } from '../../types/entities';
import type { AnyBimEntity } from '../../bim/schedule/schedule-preset-mappers';
import {
  computeColumnFoundationStub,
  hasFoundationStub,
  type ColumnFoundationStubQuantities,
} from '../../bim/geometry/column-foundation-stub';
import { buildColumnBaseDropMap } from './column-continuity-boq-source';

const EMPTY_LOOKUP: ReadonlyMap<string, ColumnFoundationStubQuantities> = new Map();

/**
 * `Map<columnId, ColumnFoundationStubQuantities>` για κάθε κολώνα που εδράζεται σε πέδιλο.
 * Κολώνες χωρίς έδραση **απουσιάζουν** (όχι μηδενικές) → ο mapper δείχνει κενό κελί αντί
 * για παραπλανητικό 0.
 */
export function buildColumnFoundationStubLookup(
  entities: readonly AnyBimEntity[],
): ReadonlyMap<string, ColumnFoundationStubQuantities> {
  const drops = buildColumnBaseDropMap(entities as readonly Entity[]);
  if (drops.size === 0) return EMPTY_LOOKUP;

  const out = new Map<string, ColumnFoundationStubQuantities>();
  for (const entity of entities) {
    if (entity.type !== 'column') continue;
    const dropMm = drops.get(entity.id);
    if (dropMm === undefined) continue;
    const stub = computeColumnFoundationStub(entity.geometry.volume, entity.geometry.area, dropMm);
    if (hasFoundationStub(stub)) out.set(entity.id, stub);
  }
  return out.size > 0 ? out : EMPTY_LOOKUP;
}
