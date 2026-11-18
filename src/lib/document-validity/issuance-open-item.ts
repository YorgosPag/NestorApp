/**
 * @fileoverview ADR-915 §45 Φ4 — **η ανάθεση έκδοσης ως εκκρεμότητα του γραφείου** (Procore «My Open Items»): ποιο έγγραφο ·
 *   ποιο ακίνητο · ποιος έχει την μπάλα · έως πότε · πόσο καθυστερεί. Μία προβολή του μητρώου, **ποτέ** εγγραφή στο `tasks`.
 * @related document-registry-view.ts (`issuanceOverdueDaysOf` — ο ίδιος δρόμος γραμμή → ανάθεση) ·
 *   issuance-delivery-due.ts (η βαθμίδα) · app/api/document-registry/open-items (η διαδρομή) ·
 *   services/calendar/CalendarEventService.ts (το ημερολόγιο, ADR-089)
 * @module lib/document-validity/issuance-open-item
 *
 * 🔑 **Α1 — μία πηγή, προβολές**: ο κάτοχος μένει το `IssuanceAssignmentRecord`. Η εκκρεμότητα **παράγεται** όσο η μπάλα
 *    δεν είναι `null`· έρχεται το έγγραφο ή ακυρώνεται η ανάθεση ⇒ απλώς παύει να παράγεται («κλείνει» μόνη της).
 * 🔑 Το ρολόι είναι της **απόκρισης** (`asOf`), ποτέ του πελάτη — ίδιο με το κελί και την καρτέλα «Καθυστερούν».
 *
 * **Layering**: leaf, καθαρή — πελάτης και διακομιστής.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';

import { registryRowKindOf, registryRowPartyOf, registryRowPropertyIdOf, type RegistryRow } from './document-registry';
import { blockingDayOf } from './document-registry-view';
import { needsIssuanceAssignment } from './document-next-step';
import { issuanceKeyOf, issuanceStateOf } from './issuance-assignment';
import { issuanceDeliveryStatusOf, type IssuanceLateness } from './issuance-delivery-due';
import { professionalReferenceOf } from './issuance-professional';
import type { RowIssuance } from './issuance-rows';
import type { BallInCourtParty, IssuanceStage } from './issuance-stage';

export interface IssuanceOpenItem {
  /** Σταθερό και μοναδικό (`issuance:<ακίνητο>:<είδος>`) — ίδιο σε κάθε ανάγνωση, ώστε η οθόνη να μη «χορεύει». */
  readonly id: string;
  /** Το κλειδί της ανάθεσης — και η τιμή του `?doc=` που ανοίγει το πάνελ της γραμμής (`registryRowOfDocParam`). */
  readonly key: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly propertyName: string | null;
  readonly professionalName: string | null;
  readonly stage: IssuanceStage;
  readonly ballInCourt: BallInCourtParty;
  /** Η προθεσμία παράδοσης — **μόνο** μετά την ανάθεση (`accepted`)· αλλιώς `null` (πριν δεν υπάρχει δέσμευση). */
  readonly dueOn: string | null;
  readonly lateness: IssuanceLateness;
  /** 🏆 Α4 — η παράδοση πέφτει μετά την ημέρα που τη χρειάζεται η υπογραφή. */
  readonly missesSigning: boolean;
}

/** Η απόκριση του `GET /api/document-registry/open-items`. `known: false` = οι αναθέσεις δεν διαβάστηκαν ⇒ κανένας ισχυρισμός. */
export interface IssuanceOpenItemsResponse {
  readonly asOf: string;
  readonly known: boolean;
  readonly items: readonly IssuanceOpenItem[];
}

export interface IssuanceOpenItemsInput {
  readonly rows: readonly RegistryRow[];
  readonly issuance: Readonly<Record<string, RowIssuance>>;
  readonly asOf: string;
  readonly propertyNameOf: (propertyId: string) => string | null;
  readonly contactNameOf: (contactId: string) => string | null;
}

/** Μία γραμμή → η εκκρεμότητα της ανάθεσής της, ή `null` (δεν ζητά ανάθεση · κλειστή · μπάλα πουθενά). */
function openItemOfRow(row: RegistryRow, input: IssuanceOpenItemsInput): IssuanceOpenItem | null {
  const propertyId = registryRowPropertyIdOf(row);
  const kind = registryRowKindOf(row);
  if (propertyId === null || registryRowPartyOf(row) !== null || !needsIssuanceAssignment(kind, row.state)) return null;
  const key = issuanceKeyOf(propertyId, kind);
  const entry = input.issuance[key];
  if (entry === undefined) return null;
  const state = issuanceStateOf(entry.record, entry.latestIssuedOn);
  if (state.kind !== 'open') return null;
  const delivery = issuanceDeliveryStatusOf(state.stage, state.record, input.asOf, blockingDayOf(row, input.asOf));
  return {
    id: `issuance:${key}`,
    key,
    propertyId,
    documentKind: kind,
    propertyName: input.propertyNameOf(propertyId),
    professionalName: input.contactNameOf(professionalReferenceOf(state.record.professional)),
    stage: state.stage,
    ballInCourt: state.ballInCourt,
    dueOn: delivery?.due?.dueOn ?? null,
    lateness: delivery?.lateness ?? { tier: 'no-due-date' },
    missesSigning: delivery?.missesSigning ?? false,
  };
}

/**
 * Οι ανοιχτές αναθέσεις του μητρώου ως εκκρεμότητες — **μία** ανά ανάθεση (πολλές γραμμές του ίδιου ακινήτου/είδους ⇒
 * μία), με προθεσμία πρώτα (η πιο κοντινή πρώτη) και χωρίς προθεσμία στο τέλος.
 */
export function issuanceOpenItemsOf(input: IssuanceOpenItemsInput): readonly IssuanceOpenItem[] {
  const byKey = new Map<string, IssuanceOpenItem>();
  for (const row of input.rows) {
    const item = openItemOfRow(row, input);
    if (item !== null && !byKey.has(item.key)) byKey.set(item.key, item);
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.dueOn === b.dueOn) return a.id.localeCompare(b.id);
    if (a.dueOn === null) return 1;
    if (b.dueOn === null) return -1;
    return a.dueOn.localeCompare(b.dueOn);
  });
}
