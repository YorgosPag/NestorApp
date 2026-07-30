/**
 * Capability Parameter Spec — η ΜΙΑ δήλωση παραμέτρων (ADR-734 §5.2, στρώμα L2)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΝΤΙ ΓΙΑ ΩΜΟ JSON SCHEMA Ή ΓΙΑ ZOD
 * ─────────────────────────────────────────────────────────────────────────────
 * Η κλασική αστοχία ενός στρώματος εργαλείων είναι ότι το σχήμα που **βλέπει το
 * μοντέλο** και ο έλεγχος που **τρέχει στον handler** αποκλίνουν: το σχήμα λέει
 * `limit: number`, ο handler γράφει `Number(args.limit ?? 20)` και δέχεται
 * σιωπηλά ό,τι του δώσουν. Τότε το σχήμα είναι διακόσμηση.
 *
 * Εδώ η δήλωση είναι **μία**: από αυτήν παράγονται ΚΑΙ το JSON Schema
 * (`parameter-json-schema.ts`) ΚΑΙ ο έλεγχος εισόδου (`parameter-parse.ts`) ΚΑΙ
 * ο τύπος TypeScript του handler (`ParsedArgs`). Απόκλιση είναι **αδύνατη κατά
 * κατασκευή**, όχι θέμα πειθαρχίας.
 *
 * Γιατί όχι Zod (v3.24 υπάρχει ήδη στο έργο): θα χρειαζόταν μετατροπέας
 * Zod → JSON Schema. Ένας τέτοιος μετατροπέας είναι **απωλεστικός** — δέχεται
 * σχήματα που το strict mode του OpenAI δεν εκφράζει (unions, refinements,
 * defaults) και τα υποβαθμίζει σιωπηλά. Εδώ ό,τι δεν εκφράζεται σε strict mode
 * **δεν μπορεί καν να δηλωθεί**: το λεξιλόγιο είναι σκόπιμα κλειστό στο
 * υποσύνολο που τα τρία adapters (OpenAI / MCP / REST) υποστηρίζουν *όλα*.
 *
 * @module services/agent-capability/registry/parameter-spec
 * @see ADR-734 §5.1 (L2), §5.2 (γιατί registry)
 */

// ============================================================================
// ΠΡΟΔΙΑΓΡΑΦΗ ΜΙΑΣ ΠΑΡΑΜΕΤΡΟΥ
// ============================================================================

/** Κοινά πεδία κάθε παραμέτρου. */
export interface ParamSpecBase {
  /**
   * Περιγραφή **προς το μοντέλο**. Το 80% της ποιότητας ενός εργαλείου κρίνεται
   * εδώ (ADR-734 §3.2β) — γράψε τι σημαίνει η τιμή, όχι πώς λέγεται το πεδίο.
   */
  readonly description: string;
  /**
   * `true` ⇒ η παράμετρος μπορεί να λείπει. Στο JSON Schema εκφράζεται ως
   * **nullable** και ΟΧΙ ως απουσία από το `required`: το strict mode του OpenAI
   * απαιτεί *όλα* τα κλειδιά στο `required`.
   */
  readonly optional?: boolean;
}

/** Ελεύθερο κείμενο. Κόβεται (`trim`) πριν τον έλεγχο — βλ. `parameter-parse`. */
export interface StringParamSpec extends ParamSpecBase {
  readonly kind: 'string';
  /** Ανώτατο μήκος μετά το `trim`. Υπέρβαση ⇒ `INVALID_ARGUMENT`. */
  readonly maxLength?: number;
}

/** Αριθμός. Πάντα πεπερασμένος — `NaN`/`Infinity` απορρίπτονται. */
export interface NumberParamSpec extends ParamSpecBase {
  readonly kind: 'number';
  /** `true` ⇒ απαιτείται ακέραιος. */
  readonly integer?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface BooleanParamSpec extends ParamSpecBase {
  readonly kind: 'boolean';
}

/**
 * Κλειστό σύνολο τιμών. Οι τιμές πρέπει να προέρχονται από **runtime SSoT**
 * (π.χ. `BOQ_STATUS_LIFECYCLE_ORDER`), ποτέ από χειρόγραφη λίστα δίπλα στο
 * εργαλείο — αλλιώς το εργαλείο σαπίζει όταν το domain αποκτήσει νέα τιμή.
 */
export interface EnumParamSpec<V extends string = string> extends ParamSpecBase {
  readonly kind: 'enum';
  readonly values: readonly V[];
}

/** Πίνακας συμβολοσειρών (π.χ. ids). */
export interface StringArrayParamSpec extends ParamSpecBase {
  readonly kind: 'stringArray';
  readonly maxItems?: number;
}

/** Το πλήρες λεξιλόγιο παραμέτρων — σκόπιμα μικρό. */
export type CapabilityParamSpec =
  | StringParamSpec
  | NumberParamSpec
  | BooleanParamSpec
  | EnumParamSpec
  | StringArrayParamSpec;

/** Οι παράμετροι μιας δυνατότητας, με σειρά δήλωσης (ντετερμινιστική έξοδος). */
export type CapabilityParamMap = Readonly<Record<string, CapabilityParamSpec>>;

// ============================================================================
// ΤΥΠΟΣ ΤΩΝ ΕΛΕΓΜΕΝΩΝ ΟΡΙΣΜΑΤΩΝ — παράγεται από την ίδια δήλωση
// ============================================================================

/** Ο τύπος τιμής μιας παραμέτρου. */
export type ParamValue<P extends CapabilityParamSpec> =
  P extends EnumParamSpec<infer V> ? V :
  P extends StringParamSpec ? string :
  P extends NumberParamSpec ? number :
  P extends BooleanParamSpec ? boolean :
  P extends StringArrayParamSpec ? readonly string[] :
  never;

type OptionalParamKeys<M extends CapabilityParamMap> = {
  [K in keyof M]: M[K] extends { optional: true } ? K : never;
}[keyof M];

type RequiredParamKeys<M extends CapabilityParamMap> = Exclude<keyof M, OptionalParamKeys<M>>;

/**
 * Τα ορίσματα **μετά** τον έλεγχο, τυπωμένα από την προδιαγραφή.
 *
 * Ο handler δεν βλέπει ποτέ `Record<string, unknown>`: αν διαβάσει πεδίο που δεν
 * δήλωσε, ο compiler τον σταματά. Αυτό είναι το αντίστοιχο του Figma Code
 * Connect σε επίπεδο παραμέτρων (ADR-734 §3.2γ) — μηδέν μαντεψιά.
 */
export type ParsedArgs<M extends CapabilityParamMap> =
  { readonly [K in RequiredParamKeys<M>]: ParamValue<M[K]> } &
  { readonly [K in OptionalParamKeys<M>]?: ParamValue<M[K]> };

/**
 * Δηλώνει παραμέτρους διατηρώντας τους **κυριολεκτικούς** τύπους (`const`
 * type parameter, TS 5.0+). Χωρίς αυτό το `optional: true` πλαταίνει σε
 * `boolean` και ο `ParsedArgs` χάνει τη διάκριση υποχρεωτικού/προαιρετικού.
 */
export function defineParams<const M extends CapabilityParamMap>(params: M): M {
  return params;
}

/** Δυνατότητα χωρίς παραμέτρους — μία σταθερά, ώστε να μην γράφεται `{}` παντού. */
export const NO_PARAMS: CapabilityParamMap = {};
