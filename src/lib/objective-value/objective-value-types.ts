/**
 * @fileoverview **Το συμβόλαιο της μηχανής αντικειμενικής αξίας** — είσοδοι ανά έντυπο, αποτέλεσμα με ανάλυση.
 * @related ADR-898 · `compute-objective-value.ts` (ο ΕΝΑΣ υπολογιστής) · `objective-value-tables.ts` (ο νόμος)
 * @module lib/objective-value/objective-value-types
 *
 * 🔑 **`null` = «δεν το ξέρω» — ποτέ «όχι»**. Η μηχανή ζητά **μόνο** ό,τι επηρεάζει το συγκεκριμένο ακίνητο: ο ΣΕ
 * δεν ζητείται σε Δ' όροφο (ίδιος συντελεστής σε όλα τα κλιμάκια), ο ανελκυστήρας δεν ζητείται σε Α' όροφο, ο ΣΑΟ
 * μόνο σε ημιτελές. Ό,τι λείπει και χρειάζεται επιστρέφεται στο `missing` — **καμία σιωπηλή μαντεψιά**.
 *
 * 🔑 **Οι σημαίες που ΜΕΙΩΝΟΥΝ** (συνιδιοκτησία, διατηρητέο, πέτρινοι τοίχοι…) έχουν προεπιλογή την **κανονική**
 * περίπτωση, όπως και στα ΦΥΑΑ της ΑΑΔΕ: αποδεικνύονται με έγγραφο, δεν τεκμαίρονται.
 */

// ============================================================================
// ΚΟΙΝΑ
// ============================================================================

/** Τρόπος κατασκευής (άρθ. 3 §10 · 6 §9 · 7 §9). */
export type ConstructionKind = 'frame' | 'masonry' | 'makeshift';

/** Ειδική κατάσταση (άρθ. 2 §21-22): το διατηρητέο **υπερισχύει** του απαλλοτριωτέου. */
export type LegalEncumbrance = 'none' | 'listed' | 'expropriated';

/**
 * Στάδιο αποπεράτωσης αποθήκης/θέσης στάθμευσης (άρθ. 6 §8 · 7 §8) — **χωρίς** θεμελίωση και δάπεδα (επαληθευμένο
 * στο κείμενο, ADR-898 Φ4). Η λίστα είναι η πηγή (υπολογιστής · `objective-value-stages.ts`), ο τύπος παράγεται.
 */
export const ANCILLARY_COMPLETIONS = ['complete', 'frame', 'masonry', 'plaster'] as const;
export type AncillaryCompletion = (typeof ANCILLARY_COMPLETIONS)[number];

interface ObjectiveValueCommonInput {
  /** Τιμή ζώνης €/τ.μ. (ADR-889 §10: από τη θέση, ή χειροκίνητα). */
  readonly zonePrice: number | null;
  /** Συντελεστής εμπορικότητας (≥ 1). Ζητείται μόνο όπου επηρεάζει. */
  readonly commercialityFactor?: number | null;
  /** Ακέραια έτη παλαιότητας κατά άρθ. 2 §20 — βλ. `legalAgeYears`. */
  readonly ageYears?: number | null;
  /** Ποσοστό κυριότητας που αποτιμάται, (0, 1]. Προεπιλογή 1. */
  readonly ownershipShare?: number;
  /** Ανήκει κατά πλήρη κυριότητα σε περισσότερα πρόσωπα (άρθ. 2 §25). */
  readonly coOwned?: boolean;
  readonly encumbrance?: LegalEncumbrance;
  /** Δαπάνη αποκατάστασης ζημιών σεισμού/πυρκαγιάς/πλημμύρας σε € (άρθ. 2 §23). */
  readonly damageRestorationCost?: number;
  readonly construction?: ConstructionKind;
  /** Στέγη από αμιαντοτσιμέντο ή λαμαρίνα (πρόσθετος συντελεστής). */
  readonly lightRoof?: boolean;
  /** Εξωτερικοί τοίχοι πάχους ≥ 0,50 μ. */
  readonly thickWalls?: boolean;
}

// ============================================================================
// ΕΝΤΥΠΟ 1 — ΚΑΤΟΙΚΙΑ / ΔΙΑΜΕΡΙΣΜΑ
// ============================================================================

/**
 * Άρθ. 3 §3: μία πρόσοψη · δύο+ ή σε πλατεία · δρόμος ≤ 6 μ. · μόνο σε ακάλυπτο / τυφλό οικόπεδο.
 * 🔑 **Η λίστα είναι η πηγή, ο τύπος παράγεται**: την απαριθμούν η φόρμα του υπολογιστή και τα όρια της αγγελίας
 * (`objective-value-bounds.ts`) — ένα χειρόγραφο `ResidenceFrontage[]` θα δεχόταν σιωπηλά υποσύνολο.
 */
export const RESIDENCE_FRONTAGES = ['single', 'multiple', 'narrow', 'rearOnly'] as const;
export type ResidenceFrontage = (typeof RESIDENCE_FRONTAGES)[number];

/** Άρθ. 3 §9 — η λίστα είναι η πηγή, ο τύπος παράγεται. */
export const RESIDENCE_COMPLETIONS = ['complete', 'foundation', 'frame', 'masonry', 'plaster', 'flooring'] as const;
export type ResidenceCompletion = (typeof RESIDENCE_COMPLETIONS)[number];

/**
 * Ένα επίπεδο της κατοικίας. **Όροφος**: `< 0` υπόγειο, `0` ισόγειο (και ημιυπόγειο, άρθ. 2 §6), `1` Α' (και
 * ημιώροφος, άρθ. 2 §8), …
 */
export interface ResidenceLevelInput {
  readonly floor: number | null;
  /** τ.μ. μαζί με τους εξωτερικούς τοίχους (άρθ. 2 §17). */
  readonly area: number | null;
}

export interface ResidenceInput extends ObjectiveValueCommonInput {
  readonly form: 'residence';
  /** Ένα ή περισσότερα επίπεδα με λειτουργική ενότητα (άρθ. 15 §1β): ενιαίος συντελεστής επιφάνειας. */
  readonly levels: readonly ResidenceLevelInput[];
  /** Η επιφάνεια περιλαμβάνει κοινόχρηστους (μικτή) ⇒ × 0,90. */
  readonly areaIncludesCommon?: boolean;
  readonly frontage: ResidenceFrontage | null;
  /** Οι προσαυξήσεις/μειώσεις πρόσοψης β, γ δεν ισχύουν σε οικισμούς που μνημονεύονται στους πίνακες. */
  readonly frontageExemptSettlement?: boolean;
  readonly hasCentralHeating: boolean | null;
  /** Ζητείται μόνο πάνω από τον Β' όροφο. */
  readonly hasElevator?: boolean | null;
  /**
   * Απούσα ⇒ πλήρως αποπερατωμένη (η κανονική περίπτωση του υπολογιστή). **`null` = «δεν το ξέρουμε»** ⇒
   * `missing: completion` — ο εργολάβος (ADR-898 Φ4) δεν τεκμαίρει ποτέ αποπεράτωση.
   */
  readonly completion?: ResidenceCompletion | null;
  /** ΣΑΟ — ζητείται μόνο σε ημιτελές. */
  readonly plotUtilisation?: number | null;
}

// ============================================================================
// ΕΝΤΥΠΑ 4 + 5 — ΑΠΟΘΗΚΗ / ΘΕΣΗ ΣΤΑΘΜΕΥΣΗΣ
// ============================================================================

/** Άρθ. 6 §4. Αποθήκη σε όροφο ή μετρημένη στον ΣΔ = χώρος κύριας χρήσης ⇒ έντυπο 1, όχι εδώ. */
export const STORAGE_POSITIONS = [
  'groundNotCounted',
  'basementStreetEntrance',
  'basementYardEntrance',
  'basementShopEntrance',
  'basementInternalEntrance',
] as const;
export type StoragePosition = (typeof STORAGE_POSITIONS)[number];

/**
 * Οι θέσεις αποθήκης **υπογείου** (άρθ. 6 §4 β-ε): «από πού μπαίνεις;» — η απάντηση που δίνει **μία φορά** το κτίριο
 * για όλες τις αποθήκες του υπογείου, με υπέρβαση ανά αποθήκη (ADR-898 §19).
 */
export const BASEMENT_STORAGE_POSITIONS = [
  'basementStreetEntrance',
  'basementYardEntrance',
  'basementShopEntrance',
  'basementInternalEntrance',
] as const satisfies readonly StoragePosition[];
export type BasementStoragePosition = (typeof BASEMENT_STORAGE_POSITIONS)[number];

export interface StorageInput extends ObjectiveValueCommonInput {
  readonly form: 'storage';
  readonly area: number | null;
  readonly position: StoragePosition | null;
  /** Όπως στην κατοικία: απούσα ⇒ πλήρης · `null` ⇒ `missing: completion`. */
  readonly completion?: AncillaryCompletion | null;
}

/** Άρθ. 7 §4. */
export const PARKING_POSITIONS = ['closedBasement', 'closedGround', 'closedUpper', 'yardOrRoof', 'pilotis'] as const;
export type ParkingPosition = (typeof PARKING_POSITIONS)[number];

export interface ParkingInput extends ObjectiveValueCommonInput {
  readonly form: 'parking';
  /** Αν ο τίτλος δεν τη γράφει ⇒ 20 τ.μ. (άρθ. 7 §5) — `null` σημαίνει ακριβώς αυτό. */
  readonly area: number | null;
  readonly position: ParkingPosition | null;
  /** Όπως στην κατοικία· ζητείται **μόνο** σε κλειστή θέση (άρθ. 7 §8). */
  readonly completion?: AncillaryCompletion | null;
}

export type ObjectiveValueInput = ResidenceInput | StorageInput | ParkingInput;
export type ObjectiveValueForm = ObjectiveValueInput['form'];
/** Τα έντυπα με τη σειρά της οθόνης — η ΜΙΑ λίστα (υπολογιστής · προσυμπλήρωση από αγγελία). */
export const OBJECTIVE_VALUE_FORMS = ['residence', 'storage', 'parking'] as const satisfies readonly ObjectiveValueForm[];

// ============================================================================
// ΑΠΟΤΕΛΕΣΜΑ
// ============================================================================

/** Τι λείπει — ονόματα πεδίων εισόδου (η οθόνη τα μεταφράζει, η μηχανή δεν έχει κείμενα). */
export type ObjectiveValueMissing =
  | 'zonePrice'
  | 'commercialityFactor'
  | 'ageYears'
  | 'area'
  | 'floor'
  | 'frontage'
  | 'hasCentralHeating'
  | 'hasElevator'
  | 'plotUtilisation'
  | 'position'
  /** Στάδιο αποπεράτωσης άγνωστο (ADR-898 Φ4: χωρίς φάση Gantt με ετικέτα ούτε δήλωση κτιρίου). */
  | 'completion';

/** Είσοδος που υπάρχει αλλά ο νόμος δεν την επιτρέπει. */
export type ObjectiveValueInvalid =
  | 'nonPositiveZonePrice'
  | 'commercialityBelowOne'
  | 'nonPositiveArea'
  | 'negativeAge'
  | 'ownershipShareOutOfRange'
  | 'foundationStageAboveGround'
  | 'noLevels';

/** Ένας εφαρμοσμένος συντελεστής, για την ανάλυση «γιατί βγήκε αυτό το ποσό». */
export interface AppliedFactor {
  readonly key:
    | 'area'
    | 'mixedArea'
    | 'thickWalls'
    | 'frontage'
    | 'floor'
    | 'age'
    | 'completion'
    | 'construction'
    | 'lightRoof'
    | 'centralHeating'
    | 'elevator'
    | 'encumbrance'
    | 'damage'
    | 'coOwnership'
    | 'position'
    | 'ownershipShare';
  readonly factor: number;
  /** Παραπομπή στον νόμο, π.χ. `ΠΟΛ.1149/1994 άρθ.3 §4`. */
  readonly ref: string;
  /** Για πολυώροφη κατοικία: σε ποιο επίπεδο (δείκτης στο `levels`). */
  readonly level?: number;
}

export type ObjectiveValueResult =
  | {
      readonly kind: 'computed';
      readonly form: ObjectiveValueForm;
      /** € με δύο δεκαδικά. */
      readonly value: number;
      readonly zonePrice: number;
      /** Η επιφάνεια που μπήκε στον υπολογισμό (για στάθμευση χωρίς τίτλο: 20). */
      readonly area: number;
      readonly factors: readonly AppliedFactor[];
    }
  | { readonly kind: 'needsInput'; readonly form: ObjectiveValueForm; readonly missing: readonly ObjectiveValueMissing[] }
  | {
      readonly kind: 'invalid';
      readonly form: ObjectiveValueForm;
      readonly problems: readonly ObjectiveValueInvalid[];
      /**
       * Ό,τι **επίσης** λείπει — ώστε η φόρμα να μην ξεχνά ερωτήσεις όσο ο άνθρωπος διορθώνει μια άκυρη τιμή
       * (ADR-898 Φ2: η μηχανή είναι η ΜΟΝΗ που ξέρει «τι μετρά», και το λέει σε κάθε κατάσταση).
       */
      readonly missing: readonly ObjectiveValueMissing[];
    };

/** Το υπολογισμένο αποτέλεσμα (ποσό + ανάλυση). */
export type ComputedObjectiveValue = Extract<ObjectiveValueResult, { kind: 'computed' }>;
/** Αποτέλεσμα που δεν έφτασε σε ποσό: λείπει κάτι ή κάτι δεν επιτρέπεται. */
export type PendingObjectiveValue = Exclude<ObjectiveValueResult, { kind: 'computed' }>;
