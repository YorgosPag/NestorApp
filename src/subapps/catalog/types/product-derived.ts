/**
 * =============================================================================
 * ΤΑ ΠΑΡΑΓΩΓΑ ΜΟΝΤΕΛΩΝ ΚΑΙ ΠΡΟΪΟΝΤΩΝ — ό,τι γράφει ΜΟΝΟ ο γραφέας (ADR-923 §5.10 Δ7 · Δ8 · Δ11)
 * =============================================================================
 *
 * Κάθε πεδίο εδώ **υπολογίζεται** από τον ορισμό + το σχήμα, από **μία** καθαρή συνάρτηση
 * (`derived/holder-derived.ts`), και ζει κάτω από **ένα** κλειδί (`derived`) ώστε:
 *   - το σώμα αιτήματος να μην μπορεί ποτέ να το στείλει (ο ορισμός δεν το έχει)·
 *   - η μηχανή να το γράφει χωρίς αναθεώρηση και χωρίς ίχνος (`stageDerived`, Θωράκιση 1)·
 *   - το ιστορικό να μην το βλέπει (δεν είναι αλλαγή ανθρώπου).
 *
 * 🔑 **Δύο ομάδες παραγώγων**:
 *   1. **του ίδιου του φορέα** (`CatalogHolderDerived`) — από τις **δικές** του τιμές: ποιες ιδιότητες/γλώσσες/μέσα
 *      χρησιμοποιεί (για τα «σε χρήση;» του σχήματος, Θωράκιση 2–3), τα κλειδιά κρατήσεων, οι τυποποιημένες τιμές·
 *   2. **της αλυσίδας** — από τις **συγχωνευμένες** τιμές (SKU: πληρότητα, facets, ετικέτα) ή από **όλους** τους
 *      απογόνους (ρίζα: ευρετήριο απογόνων, περίληψη «5/7», ευρήματα κανόνων).
 *
 * @module subapps/catalog/types/product-derived
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { CompletenessMatrix, CompletenessSummaryCell } from '../completeness/compute-completeness';
import type { ConsistencyViolation } from '../rules/evaluate-consistency';
import type { CatalogIssue } from '../schema/catalog-issues';
import type { CatalogChannel } from '../vocabulary/channels';
import type { CatalogProductDefinition, CatalogProductModelDefinition, CatalogValueHolderKind } from './product';

/** Τα παράγωγα από τις **δικές** τιμές ενός φορέα (μοντέλο, υπο-μοντέλο ή SKU). */
export interface CatalogHolderDerived {
  /** Ιδιότητες με τιμή **ή** λόγο απουσίας σε αυτόν τον φορέα — «χρησιμοποιεί κάποιος αυτή την ιδιότητα;». */
  readonly valueAttributeIds: readonly string[];
  /** Γλώσσες με τιμή σε αυτόν τον φορέα — «χρησιμοποιεί κάποιος αυτή τη γλώσσα;» (ρυθμίσεις, Δ6). */
  readonly valueLocales: readonly HumanLanguage[];
  /** Μέσα που αναφέρει αυτός ο φορέας — το «πού χρησιμοποιείται» είναι **αντίστροφο** (Δ9). */
  readonly assetIds: readonly string[];
  /** id ιδιότητας `unique` → κλειδί κράτησης (`uniqueValueKey`) — τι απελευθερώνεται σε αλλαγή/διαγραφή. */
  readonly uniqueKeys: Readonly<Record<string, string>>;
  /** id ιδιότητας → τιμή σε **μονάδα-πρότυπο** (`standardAmountOf`) — ταξινόμηση/εύρος (Δ4 `amountStandard`). */
  readonly standardAmounts: Readonly<Record<string, number>>;
  /** Προειδοποιήσεις που **δεν** μπλοκάρουν (π.χ. «ο κωδικός μοιάζει με υπάρχοντα», UTS #39). */
  readonly warnings: readonly CatalogIssue[];
}

/** Τα παράγωγα ενός SKU (ή απλού προϊόντος) — πάνω στις **συγχωνευμένες** τιμές. */
export interface CatalogProductDerived extends CatalogHolderDerived {
  /** Η ρίζα της αλυσίδας (`null` = απλό προϊόν). */
  readonly rootModelId: string | null;
  /** Η ετικέτα από την ιδιότητα-ετικέτα της οικογένειας (Akeneo attribute_as_label) — λίστες και ιστορικό. */
  readonly label: string | null;
  /** Η τιμή της πρώτης ιδιότητας `unique` της οικογένειας (κωδικός προμηθευτή) — λίστα, άλμα σε κωδικό (Β2). */
  readonly identifier: string | null;
  /**
   * Κλειδί ταξινόμησης της λίστας (`catalogSortKey` της ετικέτας, αλλιώς του αναγνωριστικού): χωρίς τόνους, caseless,
   * φυσική σειρά αριθμών. ⚠️ Το `orderBy` της Firestore **αποκλείει** έγγραφα χωρίς το πεδίο ⇒ πάντα γραμμένο (`''`).
   */
  readonly sortKey: string;
  /** Κλειδιά φίλτρων: `attr=option` · `attr:true|false` (Δ11). */
  readonly facetKeys: readonly string[];
  readonly completeness: CompletenessMatrix;
  /** Το αποτύπωμα εισόδων της πληρότητας — η μπαγιατίλα **αποδεικνύεται** στην ανάγνωση (Δ7). */
  readonly completenessHash: string;
  /** Τα πλήρη ζεύγη `κανάλι:γλώσσα` (Δ11). */
  readonly completeChannels: readonly string[];
}

/** Μία γραμμή του ευρετηρίου απογόνων της ρίζας. */
export interface CatalogDescendantEntry {
  readonly kind: CatalogValueHolderKind;
  /** Ο άμεσος γονέας (η ρίζα ή υπο-μοντέλο). */
  readonly parentId: string;
  /** Το κλειδί συνδυασμού αξόνων **του επιπέδου του** — μοναδικό ανάμεσα στα αδέλφια (Θωράκιση 5). */
  readonly axisKey: string | null;
  /** Μόνο για SKU: τα πλήρη ζεύγη και τα facets του — από αυτά παράγεται η περίληψη της ρίζας. */
  readonly completeChannels: readonly string[];
  readonly facetKeys: readonly string[];
}

export type CatalogCompletenessSummary = Readonly<
  Record<CatalogChannel, Readonly<Partial<Record<HumanLanguage, CompletenessSummaryCell>>>>
>;

/** Τα παράγωγα ενός μοντέλου. Τα πεδία της αλυσίδας γεμίζουν **μόνο** στη ρίζα· στο υπο-μοντέλο είναι κενά. */
export interface CatalogProductModelDerived extends CatalogHolderDerived {
  readonly rootModelId: string | null;
  /** Η ετικέτα **του επιπέδου του** (ιδιότητα-ετικέτα, αν ανήκει σε αυτό ή σε πρόγονο) — αλλιώς `null` (η λίστα δείχνει κωδικό). */
  readonly label: string | null;
  /** `catalogSortKey` της ετικέτας, αλλιώς του κωδικού — η ίδια σειρά με τα απλά SKU στο ενιαίο πλέγμα. */
  readonly sortKey: string;
  /**
   * Το ευρετήριο **όλων** των απογόνων (υπο-μοντέλα + SKU), ≤ 200 (`CATALOG_LIMITS.maxDescendantsPerModel`).
   * 🔑 Κάθε εγγραφή απογόνου **ξαναγράφει** τη ρίζα ⇒ όλες οι εγγραφές μιας οικογένειας παραλλαγών
   * **σειριοποιούνται** πάνω σε ένα έγγραφο, χωρίς ερώτημα μέσα στη συναλλαγή (τυφλό σημείο του CHECK 3.91).
   */
  readonly descendants: Readonly<Record<string, CatalogDescendantEntry>>;
  /** «Πλήρεις 5/7» ανά κανάλι × γλώσσα (Akeneo product model grid). */
  readonly summary: CatalogCompletenessSummary | null;
  /** Ένωση των facets της ρίζας και όλων των SKU — η λίστα μοντέλων φιλτράρει εδώ. */
  readonly facetKeys: readonly string[];
  /** Ευρήματα κανόνων συνέπειας που **δεν** μπλοκάρουν (προειδοποιήσεις + παλιά, ανέγγιχτα σφάλματα — Δ8). */
  readonly findings: readonly ConsistencyViolation[];
}

export type StoredCatalogProductModelDefinition = CatalogProductModelDefinition & { readonly derived: CatalogProductModelDerived };
export type StoredCatalogProductDefinition = CatalogProductDefinition & { readonly derived: CatalogProductDerived };
