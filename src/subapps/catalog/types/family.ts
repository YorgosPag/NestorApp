/**
 * =============================================================================
 * ΟΙΚΟΓΕΝΕΙΑ ΠΡΟΪΟΝΤΩΝ (Family) — ορισμός (ADR-923 §5.2 · §21)
 * =============================================================================
 *
 * Η οικογένεια λέει **τι σχήμα** έχει ένα είδος προϊόντος: ποιες ιδιότητες, ποιες
 * υποχρεωτικές ανά κανάλι, πώς σπάει σε παραλλαγές, πώς τυπώνεται ο πίνακάς του και ποιοι
 * κανόνες συνέπειας ισχύουν. **Ένα έγγραφο**, επικυρωμένο ολόκληρο — ατομικό, όπως ένα
 * αρχείο Figma: δεν υπάρχει στιγμή όπου οι άξονες δείχνουν σε ιδιότητα που αφαιρέθηκε.
 *
 * Η σειρά των ιδιοτήτων, των γραμμών του πίνακα και των κανόνων είναι η σειρά των
 * **πινάκων** (δηλωμένη σειρά σε ένα έγγραφο, `lib/ordering/declared-order` — όχι
 * fractional index).
 *
 * @module subapps/catalog/types/family
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type { CatalogChannel } from '../vocabulary/channels';

// ── Ιδιότητες της οικογένειας ────────────────────────────────────────────────

export interface FamilyAttributeBinding {
  readonly attributeId: string;
  /** Κανάλια όπου η τιμή είναι **υποχρεωτική** για πληρότητα (Akeneo attribute_requirements). */
  readonly requiredChannels: readonly CatalogChannel[];
}

// ── Παραλλαγές (Akeneo family variants · Revit type vs instance) ─────────────

/**
 * Ένα επίπεδο παραλλαγής: οι **άξονες** που το ορίζουν και οι ιδιότητες που **ζουν** σε
 * αυτό. Ό,τι δεν ανήκει σε κανένα επίπεδο είναι **κοινό** στο μοντέλο (περιγραφή, εικόνες).
 * Οι άξονες ζουν αυτόματα στο επίπεδό τους — δεν επαναλαμβάνονται στο `attributeIds`.
 */
export interface VariantLevel {
  readonly axisAttributeIds: readonly string[];
  readonly attributeIds: readonly string[];
}

export interface VariantScheme {
  readonly code: string;
  readonly labels: LocalizedText;
  /** 1 ή 2 επίπεδα (CATALOG_LIMITS.maxVariantLevels). */
  readonly levels: readonly VariantLevel[];
}

// ── Πίνακας καταλόγου (από τις μετρήσεις της Φάσης 0, §21) ──────────────────

/** Πώς συγχωνεύονται κελιά της γραμμής — **δηλωμένο**, ποτέ αυτόματο (§21.4.3). */
export const TABLE_ROW_MERGE_MODES = ['none', 'equalAdjacent', 'all'] as const;
export type TableRowMergeMode = (typeof TABLE_ROW_MERGE_MODES)[number];

/** Φίλτρο άξονα: «ΤΙΜΗ € BAC-1-CI» = τιμή μόνο όπου `type = BAC-1-CI`. */
export interface TableAxisFilter {
  readonly axisAttributeId: string;
  readonly optionCode: string;
}

export type FamilyTableRow =
  | { readonly kind: 'groupHeader'; readonly id: string; readonly labels: LocalizedText }
  | { readonly kind: 'axis'; readonly id: string; readonly axisAttributeId: string }
  | {
      readonly kind: 'attribute';
      readonly id: string;
      readonly attributeId: string;
      /** Ετικέτα γραμμής αν διαφέρει από της ιδιότητας (π.χ. «Ψυκτ. ισχύς H»). */
      readonly labelOverride: LocalizedText | null;
      /** Μονάδα προβολής στη γραμμή· `null` = η προεπιλεγμένη της ιδιότητας. */
      readonly displayUnitCode: string | null;
      readonly axisFilter: TableAxisFilter | null;
      readonly merge: TableRowMergeMode;
    };

export interface FamilyTableSpec {
  /** Το σχήμα παραλλαγών που δίνει τις **στήλες** του πίνακα. */
  readonly variantSchemeCode: string;
  readonly rows: readonly FamilyTableRow[];
}

// ── Κανόνες συνέπειας (Φάση 0 §21.3: πιάνουν κάθε μετατόπιση γραμμής της AI) ─

export const RULE_SEVERITIES = ['error', 'warning'] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

export const ORDER_DIRECTIONS = ['ascending', 'descending'] as const;
export type OrderDirection = (typeof ORDER_DIRECTIONS)[number];

export const COMPARE_OPERATORS = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'] as const;
export type CompareOperator = (typeof COMPARE_OPERATORS)[number];

export type CompareOperand =
  | { readonly kind: 'attribute'; readonly attributeId: string }
  | { readonly kind: 'constant'; readonly value: number; readonly unitCode: string | null };

interface RuleBase {
  readonly id: string;
  readonly severity: RuleSeverity;
}

export type ConsistencyRule =
  /** Μοναδική τιμή μέσα στην οικογένεια (π.χ. κωδικός είδους — ο διπλός 016-15-001). */
  | (RuleBase & { readonly kind: 'unique'; readonly attributeId: string })
  /** Διάταξη ανάμεσα σε ιδιότητες της **ίδιας** παραλλαγής (H ≥ M ≥ L). */
  | (RuleBase & {
      readonly kind: 'orderAcrossAttributes';
      readonly attributeIds: readonly string[];
      readonly direction: OrderDirection;
      readonly strict: boolean;
    })
  /** Μονοτονία κατά μήκος ενός άξονα (η ισχύς αυξάνει με το μέγεθος). */
  | (RuleBase & {
      readonly kind: 'monotonicAlongAxis';
      readonly attributeId: string;
      readonly axisAttributeId: string;
      readonly direction: OrderDirection;
      readonly strict: boolean;
    })
  /** Σύγκριση ιδιότητας με ιδιότητα ή σταθερά (π.χ. θερμική ≥ ψυκτική). */
  | (RuleBase & {
      readonly kind: 'compare';
      readonly leftAttributeId: string;
      readonly operator: CompareOperator;
      readonly right: CompareOperand;
    });

export type ConsistencyRuleKind = ConsistencyRule['kind'];

// ── Ο ορισμός ────────────────────────────────────────────────────────────────

export interface CatalogFamilyDefinition {
  readonly code: string;
  readonly labels: LocalizedText;
  readonly description: LocalizedText;
  /** Οι ιδιότητες της οικογένειας, με τη σειρά τους. */
  readonly attributes: readonly FamilyAttributeBinding[];
  /** Ιδιότητα που δίνει το όνομα του προϊόντος (Akeneo attribute_as_label). */
  readonly labelAttributeId: string | null;
  /** Ιδιότητα που δίνει την κύρια εικόνα (Akeneo attribute_as_image). */
  readonly imageAttributeId: string | null;
  readonly variantSchemes: readonly VariantScheme[];
  readonly tableSpec: FamilyTableSpec | null;
  readonly consistencyRules: readonly ConsistencyRule[];
}

/**
 * Η αποθηκευμένη μορφή προσθέτει το **παράγωγο** `attributeIds` (για `array-contains`:
 * «ποιες οικογένειες χρησιμοποιούν αυτή την ιδιότητα;»). Το γράφει **μόνο** ο γραφέας από
 * το `attributes` — ποτέ το σώμα αιτήματος, ώστε να μην αποκλίνει.
 */
export interface StoredCatalogFamilyDefinition extends CatalogFamilyDefinition {
  readonly attributeIds: readonly string[];
}

export function deriveFamilyAttributeIds(family: CatalogFamilyDefinition): string[] {
  return family.attributes.map((binding) => binding.attributeId);
}
