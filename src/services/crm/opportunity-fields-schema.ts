/**
 * @fileoverview **Το ΕΝΑ σχήμα των πεδίων ευκαιρίας** — κοινό για πόρτες και πελάτη (ADR-930 §3.10).
 * @module services/crm/opportunity-fields-schema
 *
 * `POST /api/opportunities` — `opportunityCreateBody` · `PATCH /api/opportunities/[id]` — `opportunityUpdateBody`.
 *
 * 🔑 **ΕΝΑ σχήμα**: τα ονόματα είναι του `Opportunity` (`types/crm.ts`) — αυτό που διαβάζουν πίνακας, αναφορές,
 *    ευρετήριο και ιστορικό. Ως 2026-11-06 ο server έγραφε `name`/`value`/`leadId` ⇒ ό,τι γεννούσε φαινόταν
 *    χωρίς τίτλο και χωρίς αξία. Το `satisfies` κάτω δένει κάθε κλειδί σε πεδίο του τύπου.
 * 🔑 **`strict`**: στάδιο (`STAGE_OWNED_FIELDS`), κάτοχος (`OWNER_OWNED_FIELDS`) και πεδία συστήματος
 *    (`companyId`, `createdBy`, `_v`…) **δεν υπάρχουν** εδώ ⇒ 400 από το σχήμα, όχι από χειρόγραφους `if`.
 * 🔑 **Σύγκρουση κατά ΠΕΔΙΟ**: η ενημέρωση φέρνει `expected` = ό,τι **είδε** ο άνθρωπος για τα πεδία που αλλάζει.
 *    Ο server απαντά 409 μόνο αν άλλαξε στο μεταξύ **ένα από αυτά** — όχι μια άσχετη αλλαγή (στάδιο, κάτοχος).
 * ⚠️ Το `interestedIn` (εμφωλευμένο) δεν είναι ακόμη εδώ: καμία οθόνη δεν το επεξεργάζεται και ο `propertyType`
 *    του δεν έχει κατάλογο-ρίζα. Μπαίνει μαζί με την πρώτη οθόνη που το γράφει.
 */

import { z } from 'zod';

import { OPPORTUNITY_SOURCES } from '@/config/crm/opportunity-sources';
import { OPPORTUNITY_STAGE_IDS, stageKind, type OpportunityStage } from '@/config/crm/opportunity-stages';
import type { Opportunity } from '@/types/crm';

/** Τα μόνα πεδία στιγμής του `Opportunity` (ADR-218) — ο ΕΝΑΣ κατάλογος για ανάγνωση (ISO) και σύγκριση. */
export const OPPORTUNITY_DATE_FIELDS = [
  'expectedCloseDate',
  'lastActivity',
  'nextActionDate',
  'wonDate',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof Opportunity)[];

const ISO_DATE_OR_DATETIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Ημερομηνία ISO ή `null` (= καθάρισμα). */
const isoDateOrNull = z.string().regex(ISO_DATE_OR_DATETIME).nullable();

/** Τα πεδία που αλλάζει ο άνθρωπος — ΟΧΙ στάδιο, κάτοχος ή συστήματος. */
const editableFieldShape = {
  title: z.string().trim().min(1).max(200),
  contactId: z.string().max(128),
  fullName: z.string().trim().max(200),
  email: z.string().trim().max(320),
  phone: z.string().trim().max(50),
  notes: z.string().max(5000),
  estimatedValue: z.number().min(0).max(999_999_999),
  probability: z.number().min(0).max(100),
  expectedCloseDate: isoDateOrNull,
  nextAction: z.string().trim().max(500),
  nextActionDate: isoDateOrNull,
  source: z.enum(OPPORTUNITY_SOURCES),
  campaign: z.string().trim().max(200),
  referredBy: z.string().max(128),
} satisfies Partial<Record<keyof Opportunity, z.ZodTypeAny>>;

export type OpportunityEditableField = keyof typeof editableFieldShape;

const EDITABLE_FIELD_TUPLE = Object.keys(editableFieldShape) as [OpportunityEditableField, ...OpportunityEditableField[]];

export const OPPORTUNITY_EDITABLE_FIELDS: readonly OpportunityEditableField[] = EDITABLE_FIELD_TUPLE;

const editableFields = z.object(editableFieldShape);

/** Μόνο **ανοιχτό** στάδιο στη δημιουργία: το κλείσιμο θέλει στοιχεία (αξία + ημερομηνία / λόγο) και έχει τη δική του πόρτα. */
const openStage = z.enum(OPPORTUNITY_STAGE_IDS).refine((stage: OpportunityStage) => stageKind(stage) === 'open', {
  message: 'A new opportunity starts in an open stage; closing goes through the stage door',
});

export const opportunityCreateBody = editableFields
  .partial()
  .extend({
    title: editableFieldShape.title,
    stage: openStage.optional(),
    /** Ο αρχικός κάτοχος· χωρίς αυτόν ⇒ ο δημιουργός. Άλλος ⇒ πρέπει να είναι ενεργό μέλος του χώρου. */
    assignedTo: z.string().min(1).max(128).optional(),
  })
  .strict();

export type OpportunityCreateBody = z.infer<typeof opportunityCreateBody>;

export const opportunityUpdateBody = z
  .object({
    changes: editableFields.partial().strict().refine((changes) => Object.keys(changes).length > 0, {
      message: 'Nothing to change',
    }),
    /** Ό,τι **είδε** ο άνθρωπος για κάθε πεδίο που αλλάζει· πεδίο που λείπει = το είδε κενό. */
    expected: z.record(z.enum(EDITABLE_FIELD_TUPLE), z.unknown()),
  })
  .strict();

export type OpportunityUpdateBody = z.infer<typeof opportunityUpdateBody>;
export type OpportunityFieldChanges = OpportunityUpdateBody['changes'];

/** Οι λεπτομέρειες του 409: **ποια** πεδία άλλαξαν στο μεταξύ, και από ποιον. */
export interface OpportunityFieldsConflict {
  readonly fields: readonly OpportunityEditableField[];
  readonly updatedBy: string | null;
}

/** Η απάντηση της δημιουργίας. */
export interface OpportunityCreateResponse {
  readonly id: string;
}

/** Η απάντηση της ενημέρωσης. */
export interface OpportunityUpdateResponse {
  readonly outcome: 'applied' | 'unchanged';
}

/** Κρατά μόνο τα επεξεργάσιμα πεδία ενός μερικού `Opportunity` — ό,τι άλλο δεν ταξιδεύει στην πόρτα. */
export function pickEditableFields(source: Readonly<Partial<Opportunity>>): Partial<Record<OpportunityEditableField, unknown>> {
  const picked: Partial<Record<OpportunityEditableField, unknown>> = {};
  for (const field of OPPORTUNITY_EDITABLE_FIELDS) {
    if (source[field] !== undefined) picked[field] = source[field];
  }
  return picked;
}
