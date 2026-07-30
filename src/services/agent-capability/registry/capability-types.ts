/**
 * Capability Descriptor — το συμβόλαιο του στρώματος L2 (ADR-734 §5.1)
 *
 * Ένας ορισμός ανά δυνατότητα. Από αυτόν **παράγονται** τα schemas όλων των
 * adapters· κανένα adapter δεν συντηρεί δικό του ορισμό. Αυτό ξεπερνά και τη
 * Figma, που συντηρεί χωριστά Plugin API και MCP server (ADR-734 §5.2).
 *
 * @module services/agent-capability/registry/capability-types
 * @see ADR-734 §5.1, §5.3 (ονοματοδοσία), §5.4 (διακυβέρνηση)
 */

import type { VerifiableQuantityEnvelope } from '@/types/vqe';
import type { CapabilityError } from './capability-errors';
import type { JsonSchema } from './json-schema';
import type { CapabilityParamMap, ParsedArgs } from './parameter-spec';

// ============================================================================
// ΤΟΜΕΑΣ & ΟΝΟΜΑΤΟΔΟΣΙΑ
// ============================================================================

/**
 * Τομέας δυνατότητας — το πρόθεμα του ονόματος (ADR-734 §5.3). Το OpenAI
 * function calling δεν δέχεται τελείες στα ονόματα, οπότε το namespace γίνεται
 * με κάτω παύλα: `boq_get_summary`.
 */
export type CapabilityDomain = 'boq';

// ============================================================================
// ΠΛΑΙΣΙΟ ΕΚΤΕΛΕΣΗΣ
// ============================================================================

/**
 * Ό,τι ξέρει το **ταυτοποιημένο** στρώμα για τον καλούντα.
 *
 * ⚠️ Σκόπιμα **δεν** είναι το `AgenticContext` του OpenAI pipeline: το L2 δεν
 * επιτρέπεται να γνωρίζει adapter. Ο κάθε adapter (OpenAI / MCP / REST) χτίζει
 * αυτό το αντικείμενο από τη **δική του** πηγή ταυτότητας.
 *
 * ⚠️⚠️ Το `companyId` έρχεται **ΜΟΝΟ** από εδώ — ποτέ από τα ορίσματα του
 * εργαλείου. Ένας πράκτορας που μπορεί να δηλώσει `companyId` μπορεί να
 * διαβάσει άλλον πελάτη. Το registry **απορρίπτει κατά την κατασκευή** κάθε
 * δυνατότητα που δηλώνει παράμετρο `companyId` (ADR-734 §7, διόρθωση 2).
 */
export interface CapabilityContext {
  /** Tenant. Κενό ⇒ `UNAUTHENTICATED` πριν καν τρέξει ο handler. */
  readonly companyId: string;
  /** Διαχειριστής του tenant (ίδιο κριτήριο με τα financial tools). */
  readonly isAdmin: boolean;
  /** Ίχνος συσχέτισης για logs/analytics. */
  readonly requestId: string;
}

// ============================================================================
// ΔΙΑΚΥΒΕΡΝΗΣΗ — ΕΠΙΒΑΛΛΕΤΑΙ· ΥΠΟΔΕΙΞΕΙΣ — ΔΕΝ ΕΠΙΒΑΛΛΟΝΤΑΙ
// ============================================================================

/**
 * Πολιτική που ελέγχεται **server-side, πριν** τον handler (ADR-734 §5.4).
 * Αυτό είναι το όριο ασφαλείας. Τα `annotations` παρακάτω **δεν είναι**.
 */
export interface CapabilityPolicy {
  /** `read` = καμία εγγραφή. `write` = Φάση 4, σήμερα απορρίπτεται fail-closed. */
  readonly access: 'read' | 'write';
  /** `true` ⇒ απαιτείται `ctx.isAdmin`. */
  readonly requiresAdmin: boolean;
}

/**
 * Υποδείξεις MCP για UI/confirmations.
 *
 * ⚠️ **ΔΕΝ επιβάλλουν τίποτα.** Η επίσημη τεκμηρίωση MCP (Μάρ 2026):
 * «Annotations are not guaranteed to faithfully describe tool behavior» —
 * «An untrusted server can lie». Δηλώνονται για UX και **ποτέ** ως όριο
 * ασφαλείας (ADR-734 §3.2δ, §5.4).
 *
 * Ο Νέστωρ πάει ένα βήμα παραπέρα από το πρότυπο: ένα test δένει το
 * `readOnlyHint` με το `policy.access`, ώστε η υπόδειξη να **μην μπορεί** να
 * πει ψέματα για τη δική μας υλοποίηση — ακόμη κι αν το πρωτόκολλο το επιτρέπει.
 */
export interface CapabilityAnnotations {
  readonly readOnlyHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

// ============================================================================
// ΑΠΟΤΕΛΕΣΜΑ
// ============================================================================

/**
 * Ό,τι επιστρέφει μια δυνατότητα. Η επιτυχία είναι **πάντα** φάκελος VQE:
 * αριθμός χωρίς προέλευση δεν φεύγει ποτέ από το L2 (ADR-734 §6.1).
 */
export type CapabilityOutcome<V> =
  | { readonly ok: true; readonly envelope: VerifiableQuantityEnvelope<V> }
  | { readonly ok: false; readonly error: CapabilityError };

// ============================================================================
// Ο ΟΡΙΣΜΟΣ
// ============================================================================

/**
 * Ορισμός μιας δυνατότητας.
 *
 * Το `handler` δηλώνεται με **σύνταξη μεθόδου** σκόπιμα: έτσι είναι διμεταβλητό
 * και ένας ειδικός ορισμός (`CapabilityDescriptor<τα δικά μου params, BOQStats>`)
 * αποθηκεύεται στο registry ως `AnyCapability` χωρίς cast.
 */
export interface CapabilityDescriptor<
  M extends CapabilityParamMap = CapabilityParamMap,
  V = unknown,
> {
  /** `^[a-z][a-z0-9_]*$`, με πρόθεμα `${domain}_`. Επιβάλλεται στο registry. */
  readonly name: string;
  /** Τομέας — πρέπει να συμφωνεί με το πρόθεμα του ονόματος. */
  readonly domain: CapabilityDomain;
  /** Σύντομος τίτλος για UI καταλόγων (MCP `title`). Δεν τον βλέπει το μοντέλο. */
  readonly title: string;
  /**
   * Η περιγραφή που **διαβάζει το μοντέλο** για να αποφασίσει αν θα καλέσει.
   * Εδώ κρίνεται το 80% της ποιότητας (ADR-734 §3.2β): πες τι απαντά το
   * εργαλείο, πότε επιστρέφει `null`, και τι ΔΕΝ κάνει.
   */
  readonly description: string;
  /** Οι παράμετροι — μία δήλωση για schema + έλεγχο + τύπο (`parameter-spec`). */
  readonly params: M;
  /**
   * Το σχήμα του **ωφέλιμου φορτίου** (`envelope.value`). Ο φάκελος γύρω του
   * προστίθεται από το `capabilityOutputSchema()` — δεν τον γράφει κανένα
   * εργαλείο μόνο του.
   */
  readonly valueSchema: JsonSchema;
  /** Επιβαλλόμενη πολιτική. */
  readonly policy: CapabilityPolicy;
  /** Συμβουλευτικές υποδείξεις. Ποτέ όριο ασφαλείας. */
  readonly annotations: CapabilityAnnotations;
  /** Η υλοποίηση. Δέχεται **ελεγμένα** ορίσματα και ταυτοποιημένο context. */
  handler(args: ParsedArgs<M>, ctx: CapabilityContext): Promise<CapabilityOutcome<V>>;
}

/** Ο τύπος με τον οποίο το registry αποθηκεύει οποιαδήποτε δυνατότητα. */
export type AnyCapability = CapabilityDescriptor<CapabilityParamMap, unknown>;

/**
 * Δηλώνει δυνατότητα διατηρώντας τους κυριολεκτικούς τύπους των παραμέτρων και
 * επιστρέφοντας τον τύπο αποθήκευσης. Ο handler γράφεται **τυπωμένος**· η
 * απώλεια τύπου γίνεται μόνο στο σύνορο του καταλόγου.
 */
export function defineCapability<const M extends CapabilityParamMap, V>(
  descriptor: CapabilityDescriptor<M, V>,
): AnyCapability {
  return descriptor;
}
