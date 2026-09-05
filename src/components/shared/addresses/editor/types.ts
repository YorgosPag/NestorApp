/**
 * =============================================================================
 * ADDRESS EDITOR — Layer 3-5 Types (ADR-332 Phase 0)
 * =============================================================================
 *
 * SSoT for state machine, hooks, and presentational components of the
 * Enterprise Address Editor system.
 *
 * Re-exports `ResolvedAddressFields`, `GeocodingApiResponse`, etc. from
 * `@/lib/geocoding/geocoding-types` so consumers of the editor only need
 * to import from this single barrel.
 *
 * @module components/shared/addresses/editor/types
 * @see ADR-332 §3.2 Type contracts
 */

import type {
  GeocodingApiResponse,
  GeocodingFailureReason,
  ResolvedAddressFields,
  GeocodingReasoning,
} from '@/lib/geocoding/geocoding-types';

// Re-export geocoding-layer types so editor consumers import from one place.
export type {
  GeocodingApiResponse,
  GeocodingAlternative,
  GeocodingAttempt,
  GeocodingAttemptStatus,
  GeocodingAccuracy,
  GeocodingFailureReason,
  GeocodingOutcome,
  GeocodingProvider,
  GeocodingReasoning,
  GeocodingRequestBody,
  GeocodingServiceResult,
  GeocodingSource,
  GeocodingVariant,
  ReverseGeocodingResult,
  ResolvedAddressFields,
  FieldMatchKind,
  FieldMatchMap,
  ConfidenceBreakdown,
  AddressSourceType,
} from '@/lib/geocoding/geocoding-types';

// =============================================================================
// FIELD-LEVEL STATUS (Layer 5 — AddressFieldBadge)
// =============================================================================

/**
 * Per-field reconciliation status used by `<AddressFieldBadge>` next to each
 * address input. Discriminated union ensures the badge component can render
 * the right tooltip/icon without ambiguity.
 */
export type AddressFieldStatus =
  | { kind: 'match'; userValue: string; resolvedValue: string }
  | { kind: 'mismatch'; userValue: string; resolvedValue: string }
  | { kind: 'unknown'; userValue: string }
  | { kind: 'not-provided'; resolvedValue?: string }
  | { kind: 'pending' };

/** Conflict descriptor used by `<AddressReconciliationPanel>`. */
export interface AddressFieldConflict {
  field: keyof ResolvedAddressFields;
  userValue: string;
  resolvedValue: string;
}

// =============================================================================
// SOURCE & FRESHNESS (Layer 5 — AddressSourceLabel, AddressFreshnessIndicator)
// =============================================================================

// `AddressSourceType` SSoT lives in `@/lib/geocoding/geocoding-types` since
// Phase 8 — `src/types/project/addresses.ts` consumes it for the persisted
// `ProjectAddress.source` field. Re-exported above with the other geocoding
// types so editor consumers keep their single import path.

export type AddressFreshnessLevel =
  | 'never'
  | 'fresh'
  | 'recent'
  | 'aging'
  | 'stale';

export interface AddressFreshness {
  /** Unix ms timestamp of last successful geocoding/reverse-geocoding for this address; null = never verified. */
  verifiedAt: number | null;
  level: AddressFreshnessLevel;
  staleReason?: 'field-changed' | 'time-elapsed' | 'force-refresh-pending';
}

// =============================================================================
// ACTIVITY LOG (Layer 4 — useAddressActivity, Layer 5 — AddressActivityLog)
// =============================================================================

export type ActivityLevel = 'info' | 'success' | 'warn' | 'error';

export type ActivityCategory =
  | 'input'
  | 'request'
  | 'response'
  | 'conflict'
  | 'suggestion'
  | 'apply'
  | 'drag'
  | 'undo';

export interface GeocodingActivityEvent {
  /** ULID identifier — chronologically sortable. */
  id: string;
  /** Unix ms wall-clock timestamp. */
  timestamp: number;
  level: ActivityLevel;
  category: ActivityCategory;
  /** i18n key (e.g. `addresses.activity.requestStarted`). Never raw string. */
  i18nKey: string;
  i18nParams?: Record<string, string | number>;
}

export type ActivityVerbosity = 'basic' | 'detailed' | 'debug';

// =============================================================================
// SUGGESTIONS (Layer 4 — useAddressSuggestions, Layer 5 — AddressSuggestionsPanel)
// =============================================================================

export type SuggestionTrigger =
  | 'no-results-after-retry'
  | 'low-confidence'
  | 'multiple-candidates-similar'
  | 'partial-match-flag';

export interface SuggestionRanking {
  /** The candidate result. */
  candidate: GeocodingApiResponse;
  /** Original Nominatim rank (0 = top). */
  originalRank: number;
  /** Distance from current map center (meters) — null if no map context. */
  distanceFromCenterM: number | null;
  /** Combined ranking score (confidence + proximity weights). */
  rankScore: number;
}

// =============================================================================
// STATE MACHINE (Layer 3 — addressEditorMachine)
// =============================================================================

/**
 * Discriminated union of all possible editor phases.
 * Used by `addressEditorMachine` (Phase 1 deliverable).
 */
export type AddressEditorState =
  | { phase: 'idle' }
  | { phase: 'typing'; lastEditMs: number }
  | { phase: 'debouncing'; etaMs: number }
  | {
      phase: 'loading';
      attempt: number;
      totalAttempts: number;
      /** i18n key describing the current variant (e.g. `addresses.geocoding.attempts.osmStyle`). */
      variantI18nKey: string;
    }
  | {
      phase: 'success';
      result: GeocodingApiResponse;
      freshness: AddressFreshness;
    }
  | {
      phase: 'partial';
      result: GeocodingApiResponse;
      conflicts: AddressFieldConflict[];
      resolved: number;
      total: number;
    }
  | {
      phase: 'conflict';
      result: GeocodingApiResponse;
      conflicts: AddressFieldConflict[];
    }
  | {
      phase: 'suggestions';
      candidates: GeocodingApiResponse[];
      reason: SuggestionTrigger;
    }
  | {
      phase: 'stale';
      lastResult: GeocodingApiResponse;
      reason: 'field-changed';
    }
  | {
      /**
       * The provider answered, and the address simply is not in its data. This
       * is a *result*, not a fault — it was previously folded into `error`,
       * which made every typo and every fictional street read as a broken
       * geocoder.
       *
       * @see ADR-332 D11
       */
      phase: 'not-found';
      searchedAtMs: number;
    }
  | {
      phase: 'error';
      reason: GeocodingFailureReason;
      canRetry: boolean;
    };

export type AddressEditorPhase = AddressEditorState['phase'];

// =============================================================================
// EDITOR EVENTS (state machine inputs — Layer 3)
// =============================================================================

/**
 * Events that drive transitions in `addressEditorMachine`. Each event triggers
 * a transition function that returns the next `AddressEditorState`.
 */
export type AddressEditorErrorReason = Extract<AddressEditorState, { phase: 'error' }>['reason'];

export type AddressEditorEvent =
  | { type: 'FIELD_EDITED'; field: keyof ResolvedAddressFields; value: string; nowMs: number }
  | { type: 'DEBOUNCE_TICK'; nowMs: number }
  | { type: 'GEOCODE_STARTED'; attempt: number; totalAttempts: number; variantI18nKey: string }
  | { type: 'GEOCODE_SUCCESS'; result: GeocodingApiResponse; nowMs: number }
  /** Provider answered, address absent from its data. Not a fault — see ADR-332 D11. */
  | { type: 'GEOCODE_EMPTY'; nowMs: number }
  /** The call itself failed (timeout, rate limit, network, server). */
  | { type: 'GEOCODE_FAILED'; reason: AddressEditorErrorReason }
  | { type: 'CONFLICT_DETECTED'; conflicts: AddressFieldConflict[] }
  | { type: 'SUGGESTIONS_TRIGGERED'; candidates: GeocodingApiResponse[]; reason: SuggestionTrigger }
  | { type: 'STALE_FLAGGED' }
  | { type: 'CORRECTION_APPLIED'; nowMs: number }
  | { type: 'RESET' };

// =============================================================================
// UNDO/REDO (Layer 4 — useAddressUndo)
// =============================================================================

export type UndoOpKind =
  | 'field-correction'
  | 'bulk-correction'
  | 'suggestion-accepted'
  | 'drag-applied'
  | 'form-cleared';

export interface UndoEntry {
  id: string;          // ULID
  timestamp: number;   // unix ms
  kind: UndoOpKind;
  /** Snapshot to restore on undo. */
  before: ResolvedAddressFields;
  /** Snapshot resulting from the operation. */
  after: ResolvedAddressFields;
  /** i18n description for UI label. */
  i18nKey: string;
  i18nParams?: Record<string, string | number>;
}

// =============================================================================
// COORDINATOR PUBLIC API (Layer 6 — AddressEditor — defined here for Phase 5)
// =============================================================================

export type AddressEditorMode = 'edit' | 'view';

export type AddressEditorDomain =
  | 'contact'
  | 'project'
  | 'building'
  | 'procurement'
  | 'showcase'
  | 'frontage';

export interface AddressEditorFormOptions {
  showHierarchy?: boolean;
  showAddressType?: boolean;
  showBlockSide?: boolean;
  showCustomLabel?: boolean;
  /** When true, the internal flat-field grid is hidden. Pass AddressWithHierarchy (or equivalent) as children instead. */
  hideGrid?: boolean;
  /** When true (and hideGrid=true), renders neighborhood + region as supplementary text inputs below children. */
  showNeighborhoodRegion?: boolean;
}

export interface AddressEditorMapOptions {
  height?: 'small' | 'medium' | 'large' | 'full';
  showLocateMe?: boolean;
  initialZoom?: number;
}

/**
 * Ρυθμίσεις του πάνελ προτάσεων (ADR-332 D23).
 *
 * ⚠️ **Δεν μπήκε στο {@link AddressEditorMapOptions}** επίτηδες: εκείνο περιγράφει πώς
 * **ζωγραφίζεται** ένας χάρτης (ύψος, ζουμ) και δεν το διαβάζει κανείς. Η αφετηρία
 * εγγύτητας δεν είναι ρύθμιση χάρτη — είναι **είσοδος κατάταξης**, και ζει με τις
 * προτάσεις που κατατάσσει.
 */
/**
 * Ό,τι χρειάζεται ο έξω κόσμος για να **ζωγραφίσει** τον κατάλογο αλλού (ADR-332 **D26**).
 *
 * 🔑 **Η πράξη ταξιδεύει ΜΑΖΙ με τα δεδομένα, και αυτό είναι όλο το σχέδιο.** Η
 * εναλλακτική ήταν ο γονιός να κρατά `ref` προς τον συντάκτη και να καλεί
 * `selectSuggestion(rank)` — αλλά αυτή η οθόνη έχει **δύο** συντάκτες *(φόρμα προσθήκης
 * και φόρμα επεξεργασίας)* με **δύο** διαφορετικούς καταλόγους. Ένα `rank` που φτάνει σε
 * λάθος συντάκτη **βρίσκει** εκεί έναν δικό του υποψήφιο με τον ίδιο αριθμό και διαλέγει
 * **άλλη διεύθυνση**, σιωπηλά. Δεμένη έτσι, η αστοχία γίνεται **δομικά αδύνατη**: όποιος
 * έστειλε τις γραμμές, έστειλε και τον τρόπο να επιλεγούν.
 */
export interface SuggestionMapReport {
  /** Οι γραμμές που **ζωγραφίζονται τώρα** — κενός πίνακας όταν δεν υπάρχει κατάλογος. */
  readonly candidates: readonly SuggestionRanking[];
  /**
   * Διάλεξε τον υποψήφιο με αυτή την ταυτότητα (`originalRank`), **σαν να πατήθηκε η
   * γραμμή του**: ίδια καταχώρηση αναίρεσης, ίδιος χαρακτηρισμός πεδίων, ίδια τηλεμετρία.
   *
   * ⚠️ **Σταθερή ταυτότητα συνάρτησης** — δεν αλλάζει σε κάθε πληκτρολόγηση. Ο καλών
   * μπορεί να την αποθηκεύσει χωρίς να γίνει η αποθήκευση πηγή επανασχεδιάσεων.
   *
   * Άγνωστη ταυτότητα ⇒ **τίποτα**: ο κατάλογος μπορεί να άλλαξε κάτω από τον δείκτη, και
   * μια «κοντινή» επιλογή θα ήταν χειρότερη από καμία.
   */
  readonly select: (rank: number) => void;
  /** Η αφετηρία από την οποία μετρήθηκαν οι αποστάσεις — ό,τι δόθηκε στο `proximityAnchor`. */
  readonly proximityAnchor: { lat: number; lng: number } | null;
}

export interface AddressEditorSuggestionOptions {
  /**
   * Πού δουλεύει ο άνθρωπος. Οι υποψήφιοι κοντά σε αυτό ανεβαίνουν.
   *
   * Απών ⇒ η κατάταξη γίνεται **μόνο** με βεβαιότητα και δεν εμφανίζεται απόσταση.
   * Αυτό είναι σωστή συμπεριφορά, όχι υποβάθμιση: χωρίς αφετηρία, κάθε «κοντά» θα ήταν
   * μαντεψιά.
   */
  proximityAnchor?: { lat: number; lng: number };

  /**
   * Ό,τι **βλέπει ο άνθρωπος ως κατάλογο**, στη σειρά που το βλέπει — κενός πίνακας όταν
   * δεν υπάρχει κατάλογος (ADR-332 **D26**).
   *
   * 🔑 **Ο συντάκτης απαντά «τι δείχνω», ΟΧΙ «τι βρήκα».** Το πάνελ έχει δύο τρόπους
   * (`chooser` / `advisory`) και μόνο ο πρώτος ζωγραφίζει γραμμές· αν εδώ περνούσαν οι
   * ωμοί υποψήφιοι, ο χάρτης θα ζωγράφιζε πινέζες για κατάλογο **που δεν υπάρχει στην
   * οθόνη**. Η εναλλακτική — να ξαναβγάλει ο καλών το ίδιο συμπέρασμα — είναι ακριβώς η
   * «παράμετρος-κατηγόρημα που ο καλών μπορεί να ξεχάσει» (μάθημα D24/D25).
   *
   * ⚠️ **Δώσε σταθερή ταυτότητα συνάρτησης** *(`useCallback`, ή κατευθείαν τον setter
   * ενός `useState`)*. Μια νέα συνάρτηση σε κάθε render ξαναστήνει τον ακροατή — σωστό
   * αποτέλεσμα, περιττή δουλειά.
   *
   * ⛔ Στο **ξεμοντάρισμα** ο συντάκτης στέλνει **κενό πίνακα**. Χωρίς αυτό, το κλείσιμο
   * της φόρμας θα άφηνε τις πινέζες των προτάσεων στον χάρτη — προτάσεις για ερώτηση που
   * κανείς δεν ρωτά πια.
   */
  onCandidatesChange?: (report: SuggestionMapReport) => void;

  /**
   * Ο δεσμός **κατάλογος → έξω**: ποια γραμμή δείχνει τώρα ο άνθρωπος (ποντίκι **ή**
   * πληκτρολόγιο), ή `null` όταν καμία.
   *
   * 🔑 Η μορφή `(ταυτότητα | null)` είναι το precedent του `ListingCard.tsx` — **ένα**
   * ρήμα με δύο καταστάσεις, όχι `onEnter`/`onLeave` που μπορούν να αποσυγχρονιστούν.
   *
   * ⚠️ Ταξιδεύει το **`originalRank`**, ποτέ η θέση στη λίστα: η εγγύτητα ανακατατάσσει
   * τις γραμμές, και ένας δεσμός με δείκτη θέσης θα τόνιζε άλλη γραμμή από αυτή που
   * δείχνει ο δείκτης τη στιγμή που αλλάζει η κατάταξη.
   */
  onCandidateHighlight?: (rank: number | null) => void;

  /**
   * Ο δεσμός **έξω → κατάλογος**: ποια γραμμή είναι τονισμένη επειδή ο άνθρωπος δείχνει
   * την πινέζα της στον χάρτη.
   */
  highlightedCandidateRank?: number | null;
}

export interface AddressEditorActivityOptions {
  enabled?: boolean;
  verbosity?: ActivityVerbosity;
  collapsed?: boolean;
}

export interface AddressEditorTelemetryOptions {
  enabled?: boolean;
  contextEntityType?: string;
  contextEntityId?: string;
}

// =============================================================================
// REASONING re-export (convenience)
// =============================================================================

export type { GeocodingReasoning as AddressGeocodingReasoning };
