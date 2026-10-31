import 'server-only';

/**
 * =============================================================================
 * ΥΠΟΔΟΧΕΣ ΑΣΑΦΕΙΑΣ ΤΙΜΟΛΟΓΗΣΗΣ — «ποια θα ίσχυε;» ως σύγκρουση συναλλαγής (ADR-923 §5.11 «3β»)
 * =============================================================================
 *
 * Η 3α απαγόρευσε την ασάφεια (ίδιο κοινό + ίδια ομάδα + επικαλυπτόμενη ισχύς) **στην αποθήκευση**. Ο έλεγχος
 * όμως με ερώτημα μέσα σε συναλλαγή **δεν** αρκεί: το Firestore κλειδώνει τα έγγραφα που **διάβασε**, όχι όσα
 * δεν έχουν γραφτεί ακόμα. Δύο ταυτόχρονες συνθήκες «χονδρέμπορος −50%» και «χονδρέμπορος −40%» θα περνούσαν και
 * οι δύο. Εδώ κάθε κλειδί ασάφειας έχει **ένα** έγγραφο με ντετερμινιστικό id: όποιος γράφει μέλος το διαβάζει,
 * άρα η δεύτερη συναλλαγή **ξανατρέχει** και βλέπει την πρώτη (ίδιο ιδίωμα με τις κρατήσεις `cuval`).
 *
 * 🔑 Η κρίση της επικάλυψης **δεν** γράφεται δεύτερη φορά: οι συνθήκες περνούν από το `findAmbiguousConditions`
 * της 3α (ο ίδιος κανόνας με τον πελάτη), μέσα από το σχέδιο διαδοχής (Σ7: η νέα περίοδος οριοθετεί την προηγούμενη)·
 * το κοινό λίστας δεν έχει ισχύ, άρα κάθε **άλλο** μέλος είναι ασάφεια.
 *
 * @module server/catalog/pricing-slots.server
 */

import { generateDeterministicCatalogPricingSlotId } from '@/services/enterprise-id.service';
import {
  planConditionSupersession,
  type ConditionDelimitation,
  type SupersessionPlan,
} from '@/subapps/catalog/pricing/condition-supersession';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { DiscountConditionDefinition } from '@/subapps/catalog/types/price-list';
import {
  pricingSlotRef,
  stagePricingSlot,
  type CatalogPricingSlotDoc,
  type CatalogPricingSlotMember,
  type CatalogTx,
} from './catalog-store.server';

/** Η υποδοχή όπως διαβάστηκε μέσα στη συναλλαγή (κενή αν δεν υπάρχει ακόμα). */
export type PricingSlot = Omit<CatalogPricingSlotDoc, 'updatedAt'>;

export async function readPricingSlot(scope: CatalogTx, slotKey: string): Promise<PricingSlot> {
  const id = generateDeterministicCatalogPricingSlotId(scope.ctx.companyId, slotKey);
  const data = (await scope.tx.get(pricingSlotRef(scope.db, id))).data() as CatalogPricingSlotDoc | undefined;
  const members = data && data.companyId === scope.ctx.companyId ? data.members : [];
  return { id, companyId: scope.ctx.companyId, slotKey, members };
}

const othersThan = (slot: PricingSlot, holderId: string): readonly CatalogPricingSlotMember[] =>
  slot.members.filter((member) => member.holderId !== holderId);

/**
 * Η συνθήκη απέναντι στις **άλλες** της υποδοχής της — το σχέδιο διαδοχής (Σ7): ποιες οριοθετούνται, ποια ασάφεια μένει
 * (ο κανόνας της 3α, μέσα από το `planConditionSupersession` — το ΙΔΙΟ που προεπισκοπεί ο πελάτης).
 */
export function conditionSlotPlan(slot: PricingSlot, holderId: string, candidate: DiscountConditionDefinition): SupersessionPlan {
  const others = othersThan(slot, holderId).map((member) => ({
    id: member.holderId,
    definition: { ...candidate, validFrom: member.validFrom, validUntil: member.validUntil },
  }));
  return planConditionSupersession(candidate, others);
}

/** Η υποδοχή με τα οριοθετημένα μέλη της — γράφεται **μία** φορά, μαζί με το μέλος της νέας συνθήκης. */
export function withDelimitedMembers(slot: PricingSlot, delimitations: readonly ConditionDelimitation[]): PricingSlot {
  const until = new Map(delimitations.map((delimitation) => [delimitation.id, delimitation.validUntil]));
  if (until.size === 0) return slot;
  return { ...slot, members: slot.members.map((member) => ({ ...member, validUntil: until.get(member.holderId) ?? member.validUntil })) };
}

/** Το κοινό λίστας δεν έχει ισχύ: **κάθε** άλλο μέλος είναι ασάφεια. */
export function audienceSlotIssues(slot: PricingSlot, holderId: string): readonly CatalogIssue[] {
  return othersThan(slot, holderId).map((member) => ({
    code: 'priceListAudienceAmbiguous' as const,
    path: 'audience',
    params: { priceListId: member.holderId },
  }));
}

/** Το μέλος μπαίνει (ή αντικαθιστά το παλιό του) — καμία διπλή εγγραφή του ίδιου κατόχου. */
export function stageSlotMember(scope: CatalogTx, slot: PricingSlot, member: CatalogPricingSlotMember): void {
  stagePricingSlot(scope, { ...slot, members: [...othersThan(slot, member.holderId), member] });
}

export function stageSlotRelease(scope: CatalogTx, slot: PricingSlot, holderId: string): void {
  stagePricingSlot(scope, { ...slot, members: othersThan(slot, holderId) });
}
