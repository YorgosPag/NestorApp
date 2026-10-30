/**
 * **Η διαδοχή περιόδων μιας συνθήκης** — η ΜΙΑ κρίση «η νέα περίοδος κλείνει την προηγούμενη, ή συγκρούεται;»
 * (ADR-923 §5.11 «3δ», Σ7 ζωντανής επαλήθευσης).
 * @related schema/validate-pricing.ts (`findAmbiguousConditions`: ο κανόνας της ασάφειας — εδώ μόνο ΤΙ γίνεται με αυτήν) ·
 *   server/catalog/discount-condition-writer.server.ts (εφαρμόζει το σχέδιο ΑΤΟΜΙΚΑ) ·
 *   components/catalog/pricing/condition-matrix.ts (το ΙΔΙΟ σχέδιο ως προεπισκόπηση, πριν από την αποθήκευση)
 * @module subapps/catalog/pricing/condition-supersession
 *
 * SAP VK11: νέα εγγραφή που αρχίζει **μέσα** σε προηγούμενη την **οριοθετεί** («cuts off», COND_API213) — η παλιά λήγει
 * εκεί που αρχίζει η νέα. Δύο σημεία όπου το SAP χάνει, κι εμείς όχι:
 * 🔑 **Ποτέ σιωπηλά**: το σχέδιο είναι καθαρή συνάρτηση, άρα ο πίνακας και οι περίοδοι το **δείχνουν** όσο γράφεις
 *    («θα λήξει 30/11»), και ο γραφέας εκτελεί το **ίδιο** σχέδιο μέσα στη συναλλαγή — η οθόνη δεν υπόσχεται κάτι άλλο.
 * 🔑 **Ποτέ απώλεια**: οριοθετείται μόνο η περίοδος που **αρχίζει νωρίτερα** και **δεν ξεπερνά** τη νέα. Περίοδος που
 *    χωράει ολόκληρη μέσα στη νέα (το SAP τη **σβήνει φυσικά**, KBA 2954021) ή προσφορά μέσα σε ανοιχτή περίοδο (θα
 *    ήθελε **σπάσιμο** σε δύο) μένουν **ασάφεια**: ο άνθρωπος αποφασίζει, η μηχανή δεν μαντεύει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, ίδιες σε πελάτη και διακομιστή.
 */

import type { CatalogIssue } from '../schema/catalog-issues';
import { conditionWindow, findAmbiguousConditions } from '../schema/validate-pricing';
import type { DiscountConditionDefinition } from '../types/price-list';

export interface ConditionPeer {
  readonly id: string;
  readonly definition: DiscountConditionDefinition;
}

/** Η αλλαγή που θα γίνει σε άλλη συνθήκη: λήγει (ημιανοιχτό «έως») εκεί που αρχίζει η νέα. */
export interface ConditionDelimitation {
  readonly id: string;
  readonly validUntil: string;
}

export interface SupersessionPlan {
  readonly delimitations: readonly ConditionDelimitation[];
  /** Ό,τι **δεν** λύνεται με οριοθέτηση — η ασάφεια της 3α, αμετάβλητη. */
  readonly issues: readonly CatalogIssue[];
}

const NO_PLAN: SupersessionPlan = { delimitations: [], issues: [] };

/** Η `other` αρχίζει **αυστηρά** νωρίτερα και **δεν** συνεχίζει μετά το τέλος της υποψήφιας ⇒ οριοθετείται χωρίς απώλεια. */
function isSupersededBy(candidate: DiscountConditionDefinition, other: DiscountConditionDefinition): boolean {
  const next = conditionWindow(candidate);
  const previous = conditionWindow(other);
  if (next === null || previous === null || next.fromMs === null) return false;
  const startsEarlier = previous.fromMs === null || previous.fromMs < next.fromMs;
  const endsWithin = next.untilMs === null || (previous.untilMs !== null && previous.untilMs <= next.untilMs);
  return startsEarlier && endsWithin;
}

/**
 * Το σχέδιο της υποψήφιας απέναντι στις άλλες: ποιες **οριοθετούνται** και ποια ασάφεια **μένει**. Μόνο όσες
 * συγκρούονται με τον κανόνα της 3α εξετάζονται — η οριοθέτηση είναι λύση **της** ασάφειας, όχι δεύτερος κανόνας.
 */
export function planConditionSupersession(candidate: DiscountConditionDefinition, others: readonly ConditionPeer[]): SupersessionPlan {
  if (candidate.validFrom === null) return { ...NO_PLAN, issues: findAmbiguousConditions(candidate, others) };
  const delimitations: ConditionDelimitation[] = [];
  const issues: CatalogIssue[] = [];
  for (const other of others) {
    const conflicts = findAmbiguousConditions(candidate, [other]);
    if (conflicts.length === 0) continue;
    if (isSupersededBy(candidate, other.definition)) delimitations.push({ id: other.id, validUntil: candidate.validFrom });
    else issues.push(...conflicts);
  }
  return { delimitations, issues };
}

/** Οι συνθήκες όπως θα είναι **μετά** το σχέδιο — για προεπισκόπηση (πίνακας) και για τα μέλη της υποδοχής (γραφέας). */
export function applyDelimitations<T extends ConditionPeer>(peers: readonly T[], delimitations: readonly ConditionDelimitation[]): T[] {
  if (delimitations.length === 0) return [...peers];
  const until = new Map(delimitations.map((delimitation) => [delimitation.id, delimitation.validUntil]));
  return peers.map((peer) => {
    const validUntil = until.get(peer.id);
    return validUntil === undefined ? peer : { ...peer, definition: { ...peer.definition, validUntil } };
  });
}
