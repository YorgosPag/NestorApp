/**
 * ADR-422 — Γενικός βοηθός διαστασιολόγησης θερμαντικής εγκατάστασης (PURE SSoT).
 *
 * Υπολογίζει αν η εγκατεστημένη θερμική ισχύς (λέβητας / αντλία θερμότητας /
 * θερμοσίφωνας) επαρκεί για το απαιτούμενο φορτίο, λαμβάνοντας υπόψη ένα
 * pickup factor (περιθώριο δικτύου + αύξηση θερμοκρασίας εκκίνησης).
 *
 * Ο κώδικας είναι **εντελώς generic** — δεν γνωρίζει τύπο εξοπλισμού, μόνο
 * W-in vs W-out. Καταναλώνεται από το boiler sizing panel (ADR-422 L2) και
 * μελλοντικά από heat-pump / water-heater sizing.
 *
 * Idempotent · side-effect free · zero React/store/Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

// ─── Σταθερές (ΤΟΤΕΕ-reasonable defaults) ────────────────────────────────────

/**
 * 15 % pickup factor — καλύπτει:
 *   - ~10 % απώλειες δικτύου (σωλήνες / ETICS / βαλβίδες)
 *   - ~5 % θερμική αδράνεια / warm-up margin (EN 12831 §A.2)
 */
export const DEFAULT_PICKUP_FACTOR = 1.15;

/**
 * Αναλογία εγκατεστημένης / απαιτούμενης (με pickup) πάνω από την οποία
 * θεωρείται υπερδιαστασιολόγηση (oversized). 1.5 = +50 % πάνω από το φορτίο
 * με pickup → ο λέβητας κυκλοθυμεί (short-cycling) και υποβαθμίζεται η απόδοση.
 */
export const OVERSIZE_RATIO = 1.5;

// ─── Τύποι ───────────────────────────────────────────────────────────────────

/**
 * Αποτέλεσμα σύγκρισης εγκατεστημένης vs απαιτούμενης ισχύος.
 *   - `'ok'`         — εντός αποδεκτού εύρους [requiredWithMargin, ×OVERSIZE_RATIO]
 *   - `'undersized'` — εγκατεστημένη < requiredWithMargin (ανεπαρκής)
 *   - `'oversized'`  — εγκατεστημένη > requiredWithMargin × OVERSIZE_RATIO (υπερβολική)
 *   - `'unknown'`    — δεν έχει οριστεί εγκατεστημένη ισχύς ή φορτίο ≤ 0
 */
export type HeatingEquipmentSizingStatus = 'ok' | 'undersized' | 'oversized' | 'unknown';

/** Δεδομένα εισόδου για τον υπολογισμό. */
export interface HeatingEquipmentSizingInput {
  /** W — απαιτούμενο φορτίο (πριν το pickup factor). */
  readonly requiredLoadW: number;
  /**
   * W — εγκατεστημένη θερμική ισχύς (π.χ. `MepBoilerParams.thermalOutputW`).
   * `null` / `undefined` → status = `'unknown'`.
   */
  readonly installedW: number | null | undefined;
  /**
   * Pickup factor. Προαιρετικό — default {@link DEFAULT_PICKUP_FACTOR}.
   * Τιμές < 1 δεν έχουν φυσικό νόημα και αντιμετωπίζονται ως 1.
   */
  readonly pickupFactor?: number;
}

/** Αποτέλεσμα διαστασιολόγησης (pure — δεν μεταβάλλει την είσοδο). */
export interface HeatingEquipmentSizingResult {
  /** W — απαιτούμενο φορτίο × pickup factor (το πλαίσιο σύγκρισης). */
  readonly requiredWithMarginW: number;
  /** W — εγκατεστημένη ισχύς (null αν δεν δόθηκε). */
  readonly installedW: number | null;
  /** Αξιολόγηση καταλληλότητας. */
  readonly status: HeatingEquipmentSizingStatus;
  /**
   * installedW / requiredWithMarginW. `null` όταν status = `'unknown'`
   * (δεν υπάρχει εγκατεστημένη ισχύς ή φορτίο ≤ 0).
   */
  readonly ratio: number | null;
}

// ─── Κύρια συνάρτηση ──────────────────────────────────────────────────────────

/**
 * Υπολογίζει αν ο εξοπλισμός είναι κατάλληλα διαστασιολογημένος για το
 * δοσμένο θερμικό φορτίο.
 *
 * Λογική:
 * 1. `requiredWithMarginW = requiredLoadW × max(pickupFactor, 1)`
 * 2. Αν `installedW == null` ή `requiredLoadW ≤ 0` → `'unknown'`, ratio=null
 * 3. `ratio = installedW / requiredWithMarginW`
 * 4. `installedW < requiredWithMarginW`              → `'undersized'`
 *    `installedW > requiredWithMarginW × OVERSIZE_RATIO` → `'oversized'`
 *    αλλιώς                                          → `'ok'`
 *
 * Idempotent · side-effect free.
 */
export function computeHeatingEquipmentSizing(
  input: HeatingEquipmentSizingInput,
): HeatingEquipmentSizingResult {
  const effectivePickup = Math.max(input.pickupFactor ?? DEFAULT_PICKUP_FACTOR, 1);
  const requiredWithMarginW = input.requiredLoadW * effectivePickup;

  // Αδύνατος υπολογισμός: άγνωστη εγκατεστημένη ισχύς ή μηδενικό φορτίο.
  if (input.installedW == null || input.requiredLoadW <= 0) {
    return {
      requiredWithMarginW,
      installedW: input.installedW ?? null,
      status: 'unknown',
      ratio: null,
    };
  }

  const ratio = input.installedW / requiredWithMarginW;
  const status = resolveStatus(input.installedW, requiredWithMarginW);

  return {
    requiredWithMarginW,
    installedW: input.installedW,
    status,
    ratio,
  };
}

// ─── Εσωτερικός βοηθός ────────────────────────────────────────────────────────

/**
 * Καθορίζει το status από τη σύγκριση εγκατεστημένης vs απαιτούμενης-με-margin.
 * Εξάγεται ξεχωριστά για testability και ≤40-line τήρηση.
 */
function resolveStatus(
  installedW: number,
  requiredWithMarginW: number,
): HeatingEquipmentSizingStatus {
  if (installedW < requiredWithMarginW) return 'undersized';
  if (installedW > requiredWithMarginW * OVERSIZE_RATIO) return 'oversized';
  return 'ok';
}
