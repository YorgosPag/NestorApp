/**
 * **Το πρόχειρο μιας συνθήκης έκπτωσης** — καθαρό μοντέλο (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related server/catalog/discount-condition-writer.server.ts (ο γραφέας: οι ΙΔΙΟΙ έλεγχοι, εδώ πριν από την αποστολή) ·
 *   lib/pricing/discount-rule.ts (η ΜΙΑ μηχανή — και το παράδειγμα «100,00 € ⇒ …» περνά από αυτήν)
 * @module components/catalog/pricing/discount-condition-draft
 *
 * 🔑 **Η ίδια επικύρωση με τον γραφέα** (`validateDiscountCondition`) + το **σχέδιο διαδοχής** (`planConditionSupersession`:
 *    ποια οριοθετείται, ποια ασάφεια μένει) απέναντι σε κάθε άλλη ζωντανή συνθήκη — ένα γνωστό 422
 *    `discountConditionAmbiguous` δεν στέλνεται ποτέ.
 * 🔑 **Ισχύς σε ημέρες, όπως τη λέει ο άνθρωπος** (SAP VK11: «Valid to» **συμπεριληπτικά**): η φόρμα ρωτά την **τελευταία
 *    ημέρα** ισχύος· αποθηκεύεται το ημιανοιχτό `[από, έως)` της μηχανής, με «έως» = τα μεσάνυχτα της **επόμενης** ημέρας.
 *    Αλλιώς το «έως 30/11» θα έληγε στην **αρχή** της 30/11 — μία μέρα νωρίτερα από ό,τι υποσχέθηκε η οθόνη.
 * 🔑 **Το παράδειγμα είναι η μηχανή**: κάθε ενδιάμεσο ποσό = `applyDiscountSteps(μικτό, πρώτα i βήματα)` — η **μία**
 *    στρογγύλευση της μηχανής, όχι μια δεύτερη αριθμητική στην οθόνη που θα διαφωνούσε κατά ένα λεπτό.
 */

import { addDaysToDateKey, calendarDateOfDateKey, dateKeyOfPicker } from '@/lib/calendar/date-key';
import { localDateOf } from '@/lib/date-local';
import { majorFromMinor, minorFromMajor, type MinorAmount } from '@/lib/money/money';
import {
  applyDiscountSteps,
  discountCascade,
  isDiscountSteps,
  type BasisPoints,
  type DiscountCascadeStep,
  type DiscountRule,
  type DiscountRuleKind,
  type DiscountTier,
  type DiscountTierBasis,
} from '@/lib/pricing/discount-rule';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { planConditionSupersession, type SupersessionPlan } from '@/subapps/catalog/pricing/condition-supersession';
import { validateDiscountCondition } from '@/subapps/catalog/schema/validate-pricing';
import type { DiscountConditionDefinition, PriceAudience } from '@/subapps/catalog/types/price-list';
import type { DiscountConditionWire } from '@/subapps/catalog/types/pricing-views';
import { audiencePartyPresenceIssues } from './price-list-draft';

/** Το μικτό του ζωντανού παραδείγματος: 100,00 €. */
export const EXAMPLE_GROSS: MinorAmount = 10_000;

/** Από πού γεννιέται μια νέα συνθήκη — το κελί του πίνακα που πατήθηκε. */
export interface ConditionSeed {
  readonly discountGroupId: string | null;
  readonly audience: PriceAudience;
  /** «Νέα περίοδος» (Σ7): η αρχή της (`nextPeriodStart`)· `null` = από πάντα (νέα υποδοχή). */
  readonly validFrom: string | null;
}

export const DEFAULT_CONDITION_SEED: ConditionSeed = { discountGroupId: null, audience: { kind: 'anonymous' }, validFrom: null };

export function emptyConditionDraft(seed: ConditionSeed): DiscountConditionDefinition {
  return { discountGroupId: seed.discountGroupId, audience: seed.audience, validFrom: seed.validFrom, validUntil: null, rule: { kind: 'chain', steps: [] } };
}

/** Μόνο τα πεδία του ορισμού — ποτέ τα μεταδεδομένα της εγγραφής μέσα στο σώμα αιτήματος (ίδιο με τον γραφέα). */
export function conditionDefinitionOf(record: DiscountConditionWire): DiscountConditionDefinition {
  const { discountGroupId, audience, validFrom, validUntil, rule } = record;
  return { discountGroupId, audience, validFrom, validUntil, rule };
}

// ── Ισχύς σε ημέρες ──────────────────────────────────────────────────────────

/** Η αρχή (τοπικά μεσάνυχτα) μιας ημέρας `YYYY-MM-DD`, ως στιγμή ISO. */
const instantOfDay = (key: string | null): string | null => (key === null ? null : calendarDateOfDateKey(key)?.toISOString() ?? null);

/** «Ισχύει από» (επιλογέας) → αρχή της ημέρας. Κενό ⇒ `null` = από πάντα. */
export const validFromOfPicker = (date: Date | undefined): string | null => instantOfDay(dateKeyOfPicker(date));

export const pickerOfValidFrom = (validFrom: string | null): Date | undefined => (validFrom === null ? undefined : new Date(validFrom));

/** «Τελευταία ημέρα» (συμπεριληπτικά) → «έως» = αρχή της **επόμενης** ημέρας. Κενό ⇒ `null` = χωρίς λήξη. */
export function validUntilOfLastDay(date: Date | undefined): string | null {
  const key = dateKeyOfPicker(date);
  return key === null ? null : instantOfDay(addDaysToDateKey(key, 1));
}

/** «Έως» (ημιανοιχτό) → η τελευταία ημέρα που **ισχύει**: η ημέρα της τελευταίας στιγμής πριν από το όριο. */
export function pickerOfLastDay(validUntil: string | null): Date | undefined {
  if (validUntil === null) return undefined;
  const untilMs = Date.parse(validUntil);
  if (Number.isNaN(untilMs)) return undefined;
  return calendarDateOfDateKey(localDateOf(new Date(untilMs - 1))) ?? undefined;
}

// ── Κανόνας ──────────────────────────────────────────────────────────────────

/** Αλλαγή είδους κανόνα **χωρίς απώλεια**: η αλυσίδα γίνεται η πρώτη κλίμακα, η χαμηλότερη κλίμακα γίνεται η αλυσίδα. */
export function withRuleKind(rule: DiscountRule, kind: DiscountRuleKind): DiscountRule {
  if (rule.kind === kind) return rule;
  if (rule.kind === 'chain') return { kind: 'tiers', basis: 'quantity', tiers: [{ min: 0, steps: rule.steps }] };
  const lowest = [...rule.tiers].sort((a, b) => a.min - b.min)[0];
  return { kind: 'chain', steps: lowest?.steps ?? [] };
}

/** Τα κατώφλια σε **ποσό** είναι λεπτά, σε **ποσότητα** μονάδες: η αλλαγή βάσης μετατρέπει (10 τεμ. ↔ 10,00 €), δεν ξαναερμηνεύει. */
function convertMin(min: number, to: DiscountTierBasis): number {
  return to === 'amount' ? minorFromMajor(min) ?? Number.NaN : majorFromMinor(min);
}

export function withTierBasis(rule: Extract<DiscountRule, { kind: 'tiers' }>, basis: DiscountTierBasis): DiscountRule {
  if (rule.basis === basis) return rule;
  return { kind: 'tiers', basis, tiers: rule.tiers.map((tier) => ({ ...tier, min: convertMin(tier.min, basis) })) };
}

/** Η επόμενη κλίμακα: κατώφλι διπλάσιο του υψηλότερου (ή 10 τεμ. / 100,00 €), ίδια αλυσίδα — ο άνθρωπος τη διορθώνει. */
export function nextTier(rule: Extract<DiscountRule, { kind: 'tiers' }>): DiscountTier {
  const highest = rule.tiers.reduce<DiscountTier | null>((best, tier) => (best === null || tier.min > best.min ? tier : best), null);
  const start = rule.basis === 'amount' ? EXAMPLE_GROSS : 10;
  return { min: highest !== null && highest.min > 0 ? highest.min * 2 : start, steps: highest?.steps ?? [] };
}

// ── Ζωντανό παράδειγμα ───────────────────────────────────────────────────────

export interface ChainExample {
  readonly gross: MinorAmount;
  readonly steps: readonly DiscountCascadeStep[];
  readonly discount: MinorAmount;
  readonly net: MinorAmount;
}

/** Ο καταρράκτης μιας αλυσίδας πάνω στο `gross` — `null` αν κάποιο βήμα δεν διαβάζεται (το λέει η επικύρωση). */
export function chainExample(steps: readonly BasisPoints[], gross: MinorAmount = EXAMPLE_GROSS): ChainExample | null {
  if (!isDiscountSteps(steps)) return null;
  const total = applyDiscountSteps(gross, steps);
  return { gross, steps: discountCascade(gross, steps), discount: total.discount, net: total.net };
}

export interface TierExample {
  readonly min: number;
  readonly example: ChainExample | null;
}

/** Μία γραμμή παραδείγματος ανά κλίμακα, κατά αύξον κατώφλι (όπως τις διαλέγει η μηχανή, ανεξάρτητα από τη σειρά δήλωσης). */
export function tierExamples(rule: Extract<DiscountRule, { kind: 'tiers' }>, gross: MinorAmount = EXAMPLE_GROSS): readonly TierExample[] {
  return [...rule.tiers].sort((a, b) => a.min - b.min).map((tier) => ({ min: tier.min, example: chainExample(tier.steps, gross) }));
}

// ── Ευρήματα ─────────────────────────────────────────────────────────────────

export interface ConditionDraftContext {
  readonly discountGroupIds: ReadonlySet<string>;
  readonly customerGroupIds: ReadonlySet<string>;
  /** Όλες οι ζωντανές συνθήκες του χώρου — για την ασάφεια. */
  readonly conditions: readonly DiscountConditionWire[];
  /** Η αποθηκευμένη συνθήκη (`null` = νέα): δεν συγκρούεται με τον εαυτό της. */
  readonly selfId: string | null;
}

/** Σ7: τι θα κάνει η αποθήκευση στις **άλλες** συνθήκες — ποιες οριοθετεί, ποια ασάφεια μένει (το σχέδιο του γραφέα). */
export function conditionDraftPlan(draft: DiscountConditionDefinition, context: Pick<ConditionDraftContext, 'conditions' | 'selfId'>): SupersessionPlan {
  const others = context.conditions
    .filter((condition) => condition.id !== context.selfId && !condition.isDeleted)
    .map((condition) => ({ id: condition.id, definition: conditionDefinitionOf(condition) }));
  return planConditionSupersession(draft, others);
}

/** Τα ευρήματα του προχείρου — ό,τι θα έλεγε ο γραφέας, πριν από την αποστολή (η ασάφεια με το id της άλλης συνθήκης). */
export function conditionDraftIssues(draft: DiscountConditionDefinition, context: ConditionDraftContext): readonly CatalogIssue[] {
  return [
    ...validateDiscountCondition(draft, context),
    ...audiencePartyPresenceIssues(draft.audience),
    ...conditionDraftPlan(draft, context).issues,
  ];
}

// ── Νέα περίοδος ─────────────────────────────────────────────────────────────

/**
 * Σ7: πού αρχίζει μια **νέα περίοδος** της υποδοχής — **αύριο** (ποτέ αναδρομικά: ό,τι τιμολογήθηκε σήμερα μένει), ή
 * αργότερα αν το ζητούν οι περίοδοί της: μετά το **τελευταίο όριο** (συνέχεια χωρίς κενό) και τουλάχιστον την **επόμενη
 * ημέρα της πιο πρόσφατης έναρξης** — ίδια αρχή με υπάρχουσα = ασάφεια (καμία «προηγούμενη»), μεταγενέστερη = η ανοιχτή
 * τελευταία **οριοθετείται** με την αποθήκευση (`planConditionSupersession`). Ποτέ «από πάντα» (το εύρημα του Σ7).
 */
export function nextPeriodStart(periods: readonly Pick<DiscountConditionDefinition, 'validFrom' | 'validUntil'>[], nowMs: number): string | null {
  const dayAfter = (ms: number) => instantOfDay(addDaysToDateKey(localDateOf(new Date(ms)), 1));
  const bounds = periods.flatMap(({ validFrom, validUntil }) => [
    validUntil,
    validFrom === null ? null : dayAfter(Date.parse(validFrom)),
  ]);
  let start = dayAfter(nowMs);
  for (const bound of bounds) {
    if (start !== null && bound !== null && Date.parse(bound) > Date.parse(start)) start = bound;
  }
  return start;
}
