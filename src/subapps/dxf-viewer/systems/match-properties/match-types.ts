/**
 * ADR-581 — Universal Match/Transfer Properties Engine · Core types (SSoT).
 *
 * Καθολικός μηχανισμός «αντιγραφή παραμέτρων από μία οντότητα → επικόλληση σε
 * άλλες», για DXF ΚΑΙ BIM/MEP. Deterministic πυρήνας (πάντα ενεργός) — το AI
 * είναι προαιρετικό στρώμα από πάνω (feature-flag).
 *
 * Δύο κανάλια εγγραφής, μη εναλλάξιμα (βλ. ADR-581 §Backbone):
 *  - `scene`  → raw style fields του `BaseEntity` + BIM styleOverride/faceAppearance
 *               (γράφεται με `UpdateEntityCommand`).
 *  - `params` → BIM geometry/type params (params = SSoT, geometry derived· γράφεται
 *               με per-kind `Update{Kind}ParamsCommand`).
 *
 * Κάθε descriptor δηλώνει ρητά το `channel` του — ο applier δρομολογεί ανάλογα.
 *
 * Καθαρά data types — zero React/DOM.
 */

import type { SceneEntity } from '../../core/commands/interfaces';

/** Ομάδα για το checklist («τι να μεταφέρω») + για το preview grouping. */
export type MatchCategory = 'style' | 'geometry' | 'structural' | 'material' | 'identity';

/** Κανάλι εγγραφής — καθορίζει ποιο command θα γράψει το fragment. */
export type MatchWriteChannel = 'scene' | 'params';

/** Τύπος τιμής — καθορίζει coercion + cross-type συμβατότητα. */
export type MatchValueType = 'number' | 'string' | 'boolean' | 'enum' | 'color';

/** Μονάδα — καθορίζει αν δύο ρόλοι είναι μεταφέρσιμοι μεταξύ τους. */
export type MatchUnit = 'mm' | 'deg' | 'ratio' | 'aci' | 'none';

/**
 * Cross-type join key (σημασιολογικός ρόλος). Branded ώστε να μη μπερδεύεται με
 * απλό string. Η οντολογία ζει στο `semantic-roles.ts`.
 */
export type SemanticRole = string & { readonly __brand: 'SemanticRole' };

/**
 * Ατομική τιμή χρώματος — μεταφέρεται πάντα ΜΑΖΙ (mode+aci+trueColor+hex), ποτέ
 * μισό χρώμα. Τα πεδία είναι optional· ο applier γράφει μόνο τα ορισμένα (ποτέ
 * explicit `undefined` → Firestore reject).
 */
export interface ColorValue {
  readonly color?: string;
  readonly colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  readonly colorAci?: number;
  readonly colorTrueColor?: number | null;
}

/** Η μεταφέρσιμη τιμή που διαβάζεται από την πηγή. */
export type MatchableValue = number | string | boolean | ColorValue;

/** Ένα patch fragment με το κανάλι μέσω του οποίου πρέπει να γραφτεί. */
export interface MatchFragment {
  readonly channel: MatchWriteChannel;
  readonly patch: Readonly<Record<string, unknown>>;
}

/**
 * Περιγραφή μιας μεταφέρσιμης ιδιότητας ενός τύπου οντότητας.
 *
 * `read` → διαβάζει την τρέχουσα τιμή (για preview/σύγκριση/confidence).
 * `buildFragment` → φτιάχνει το έτοιμο-για-εγγραφή patch από μια (coerced) τιμή,
 * στο σωστό κανάλι/κλειδί ΤΟΥ target descriptor.
 */
export interface MatchablePropertyDescriptor {
  /** Σταθερό, μοναδικό μέσα στον τύπο οντότητας. */
  readonly key: string;
  /** Ο cross-type join key. */
  readonly role: SemanticRole;
  readonly category: MatchCategory;
  readonly unit: MatchUnit;
  readonly valueType: MatchValueType;
  readonly channel: MatchWriteChannel;
  /** `true` = derived readout (concreteVolume/steelWeight/…) → ΠΟΤΕ δεν μεταφέρεται. */
  readonly readOnly: boolean;
  readonly labelKey: string;
  /** Για valueType `enum` — επιτρεπτές τιμές (coercion απορρίπτει άγνωστες). */
  readonly enumValues?: readonly string[];
  /** Numeric clamp bounds (target-side). */
  readonly min?: number;
  readonly max?: number;
  read(entity: SceneEntity): MatchableValue | undefined;
  buildFragment(value: MatchableValue): MatchFragment;
}

/** Sentinel — coercion δεν κατάφερε συμβατή τιμή· ο applier παραλείπει το πεδίο. */
export const COERCE_SKIP = Symbol('match.coerce.skip');
export type CoerceResult = MatchableValue | typeof COERCE_SKIP;
