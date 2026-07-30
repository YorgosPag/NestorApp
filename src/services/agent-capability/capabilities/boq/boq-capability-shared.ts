/**
 * Κοινά συστατικά των BOQ δυνατοτήτων — μία γραφή, επτά χρήσεις
 *
 * Επτά εργαλεία που φτιάχνουν τον φάκελό τους «όπως το προηγούμενο» είναι επτά
 * αντίγραφα που θα αποκλίνουν στην πρώτη αλλαγή. Ό,τι επαναλαμβάνεται ζει εδώ:
 * οι παράμετροι, η πολιτική, οι υποδείξεις, και η μοναδική διαδρομή
 * «φέρε item του **δικού μου** πελάτη → υπολόγισε → τύλιξε σε φάκελο».
 *
 * @module services/agent-capability/capabilities/boq/boq-capability-shared
 * @see ADR-734 §5.4, §6, §7
 */

import type { BOQItem } from '@/types/boq';
import { BOQ_SCOPE_VALUES, BOQ_STATUS_LIFECYCLE_ORDER } from '@/types/boq';
import type { IBOQReadService } from '@/services/measurements/boq-read-contract';
import type { ProvenanceActivity } from '@/types/vqe';
import { type BuildEnvelopeInput, buildEnvelope } from '../../vqe';
import type {
  CapabilityAnnotations,
  CapabilityContext,
  CapabilityOutcome,
  CapabilityPolicy,
} from '../../registry';
import { fetchOwnedBoqItem } from './boq-tenant-guard';

// ============================================================================
// ΕΞΑΡΤΗΣΕΙΣ
// ============================================================================

/**
 * Οι δυνατότητες εξαρτώνται από το **interface**, όχι από το singleton.
 *
 * Δεν είναι διακοσμητικό: το `boqService` χτίζεται πάνω στο **client** Firebase
 * SDK, ενώ ο agentic executor είναι `server-only` με admin SDK. Η Φάση 3 γεφύρωσε
 * τα δύο με το `BOQAdminReadService` — και χάρη στην ένεση εδώ, η σύνδεση ήταν
 * **μία γραμμή** αντί για επτά αλλαγμένους handlers. Παράλληλα τα tests τρέχουν
 * χωρίς Firestore.
 *
 * ⚠️ **`IBOQReadService`, όχι `IBOQService`** (ADR-734 §8.3). Και τα επτά
 * εργαλεία είναι μόνο ανάγνωσης· με ολόκληρο το service, το `deps.boq.delete(id)`
 * θα παρέμενε **συντακτικά διαθέσιμο** μέσα σε handler ανάγνωσης και η μόνη
 * άμυνα θα ήταν ότι κανείς δεν το έγραψε. Ο στενός τύπος το κάνει αδύνατο σε
 * χρόνο μεταγλώττισης — ίδια αρχή με το §5.4: η εγγύηση δεν ανατίθεται στην
 * πρόθεση του συγγραφέα.
 */
export interface BoqCapabilityDeps {
  readonly boq: IBOQReadService;
}

// ============================================================================
// ΠΟΛΙΤΙΚΗ & ΥΠΟΔΕΙΞΕΙΣ (ADR-734 §5.4)
// ============================================================================

/**
 * Και τα επτά εργαλεία είναι **μόνο ανάγνωσης** και **admin-only**.
 *
 * Το δεύτερο δεν είναι υπερβολή: το BOQ εκθέτει μοναδιαία κόστη υλικών,
 * εργασίας και εξοπλισμού — δηλαδή το περιθώριο κέρδους. Ίδιο κριτήριο με τα
 * financial tools του ADR-242 (`FinancialQueryHandler`: «admin-only»).
 */
export const BOQ_READ_POLICY: CapabilityPolicy = {
  access: 'read',
  requiresAdmin: true,
};

/**
 * Υποδείξεις MCP. **Δεν επιβάλλουν τίποτα** (ADR-734 §3.2δ) — η επιβολή είναι το
 * `BOQ_READ_POLICY` παραπάνω. Το registry απορρίπτει κατά την κατασκευή κάθε
 * ασυμφωνία μεταξύ των δύο, ώστε η υπόδειξη να μη μπορεί να πει ψέματα.
 */
export const BOQ_READ_ANNOTATIONS: CapabilityAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

// ============================================================================
// ΚΟΙΝΕΣ ΠΑΡΑΜΕΤΡΟΙ
// ============================================================================

/**
 * ⚠️ Δεν υπάρχει παράμετρος `companyId` — και δεν επιτρέπεται να υπάρξει. Ο
 * tenant έρχεται από το `CapabilityContext`· το registry ρίχνει κατά τη φόρτωση
 * αν κάποιος τη δηλώσει (ADR-734 §7, διόρθωση 2).
 */
export const BUILDING_ID_PARAM = {
  kind: 'string',
  description: 'Το id του κτιρίου (buildings.id) του οποίου ζητούνται οι επιμετρήσεις.',
  maxLength: 128,
} as const;

export const ITEM_ID_PARAM = {
  kind: 'string',
  description: 'Το id της γραμμής επιμέτρησης (boq_items.id).',
  maxLength: 128,
} as const;

export const CATEGORY_CODE_PARAM = {
  kind: 'string',
  description: 'Φίλτρο κατηγορίας ΑΤΟΕ, π.χ. "OIK-2" για σκυροδέματα. Παράλειψη ⇒ όλες οι κατηγορίες.',
  maxLength: 32,
  optional: true,
} as const;

export const STATUS_PARAM = {
  kind: 'enum',
  description: 'Φίλτρο κατάστασης έγκρισης. Παράλειψη ⇒ όλες οι καταστάσεις.',
  values: BOQ_STATUS_LIFECYCLE_ORDER,
  optional: true,
} as const;

export const SCOPE_PARAM = {
  kind: 'enum',
  description: 'Φίλτρο εύρους εφαρμογής (κτίριο / κοινόχρηστα / όροφος / ακίνητο / ακίνητα).',
  values: BOQ_SCOPE_VALUES,
  optional: true,
} as const;

export const SEARCH_TEXT_PARAM = {
  kind: 'string',
  description: 'Ελεύθερο κείμενο· ταιριάζει σε τίτλο, περιγραφή ή κωδικό κατηγορίας (case-insensitive).',
  maxLength: 200,
  optional: true,
} as const;

// ============================================================================
// ΚΑΤΑΣΚΕΥΗ ΑΠΟΤΕΛΕΣΜΑΤΟΣ
// ============================================================================

/** Τυλίγει τιμή σε φάκελο VQE και τη δηλώνει επιτυχία. Μία πόρτα για τα επτά. */
export function envelopeOutcome<V>(input: BuildEnvelopeInput<V>): CapabilityOutcome<V> {
  return { ok: true, envelope: buildEnvelope(input) };
}

/**
 * Η **μοναδική** διαδρομή των εργαλείων που δουλεύουν πάνω σε ένα item.
 *
 * Τρία από τα επτά (`boq_get_item`, `boq_get_variance`, `boq_get_baseline_drift`)
 * χρειάζονται ακριβώς την ίδια ακολουθία: έλεγχος ιδιοκτησίας → καθαρός
 * υπολογισμός → φάκελος. Γραμμένη μία φορά, δεν μπορεί ένα από τα τρία να
 * ξεχάσει τον έλεγχο (το κενό που περιγράφει το ADR-734 §7).
 */
export async function withOwnedItem<V>(
  deps: BoqCapabilityDeps,
  ctx: CapabilityContext,
  itemId: string,
  computedBy: ProvenanceActivity,
  compute: (item: BOQItem) => V,
): Promise<CapabilityOutcome<V>> {
  const owned = await fetchOwnedBoqItem(deps.boq, itemId, ctx.companyId, ctx.requestId);
  if (!owned.ok) return { ok: false, error: owned.error };

  return envelopeOutcome({
    value: compute(owned.item),
    sourceItems: [owned.item],
    computedBy,
    params: { companyId: ctx.companyId, itemId },
  });
}
