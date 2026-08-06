/**
 * @related ADR-759 §4.1/§4.2 — Survey Record («Στοιχεία Τοπογραφικού»)
 *
 * WHAT THIS IS — and, more importantly, what it is NOT.
 *
 * A `SurveyRecord` is **an immutable statement**: "surveyor X declared these values,
 * about this plot, on this date, in this drawing". It is NOT the project's working
 * truth. `project.buildingCode` (ADR-186) answers *what currently applies*; this
 * answers *what the surveyor declared, and when*. ADR-759 §4.1.
 *
 * The distinction is not academic. A surveyor writes what was true **the day of the
 * survey**; Government Gazette decrees change. Merged into one record, a 2019 survey
 * would silently overwrite today's building terms. Split, that is impossible by
 * construction — the only path from here to `buildingCode` is an explicit,
 * per-field human decision (`FieldReconciliation`).
 *
 * This mirrors how Revit handles a linked survey model: the link stays a separate,
 * read-only file, and Copy/Monitor + Coordination Review move values across one
 * element at a time, with an explicit action recorded for each.
 *
 * 🔴 SHAPE RULE: this schema mirrors the **Α–Ι sections of the actual Greek survey
 * form** («ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ»), not a classification of our own
 * invention — so the engineer reads the card in the same order as the drawing.
 * ADR-759 §2β.2 has the measured section table.
 */

// ============================================================================
// PROVENANCE — every value knows where it came from
// ============================================================================

/**
 * Where a single value in this record came from.
 *
 * - `'survey'` : transcribed from the drawing by the reader (ADR-759 Φ4)
 * - `'user'`   : typed by the engineer
 *
 * ⚠️ In Φ2 the card is **manually filled** (ADR-759 §6), so every field is
 * legitimately `'user'`. `'survey'` only becomes reachable once the Φ4 reader
 * exists. Stamping `'survey'` in Φ2 — because the card happens to be *called*
 * "Survey Data" — would be the schema lying about its own origin.
 *
 * Deliberately mirrors `FieldProvenance` ('zone' | 'user') of ADR-186 rather than
 * inventing a second provenance mechanism (ADR-759 §4.2).
 */
export type SurveyFieldProvenance = 'survey' | 'user';

/**
 * A value that carries its own origin.
 *
 * Every field of a `SurveyRecord` is wrapped in this. That is the point: ADR-759 §5.3
 * — *"a field without provenance is a field where, in six months, nobody knows
 * whether a human or a file wrote it"*.
 *
 * Three properties, each earning its place:
 * - `value`     — `null` is a **real state**, not an absence. ADR-759 §4.2 rule 3:
 *                 `Παρέκκλιση` / `Σύστημα` / `ΟΡΟΦΟΙ` are *blank in the sample*
 *                 because the engineer does not have them yet. The field exists and
 *                 renders empty; the engineer must be able to see **what is missing**.
 * - `provenance`— who put it there.
 * - `rawText`   — the source text, verbatim, whenever a value was derived from one.
 *                 Nothing read is ever discarded (ADR-745 §8 rule 3). Parsing may be
 *                 wrong; the original never is.
 */
export interface Sourced<T> {
  readonly value: T | null;
  readonly provenance: SurveyFieldProvenance;
  /** Source text exactly as it appeared. Present when `provenance === 'survey'`. */
  readonly rawText?: string;
}

// ============================================================================
// GOVERNMENT GAZETTE (ΦΕΚ) — a property of an act, never a field of the plot
// ============================================================================

/**
 * How this gazette reference relates to the act it belongs to.
 *
 * 🔴 OPEN-ENDED **ON PURPOSE, AND NEVER INFERRED.** The G753 sample contains one
 * correction chain ("ΦΕΚ 2Δ/2005 as corrected by ΦΕΚ 2/τ.Δ/2006 **with** ΦΕΚ
 * 49τ.Δ/2006"). One sample is not a class (ADR-759 §Η). So the field exists, is
 * optional, and is only ever set when a human explicitly picks it — the Φ4 reader
 * must leave it `null` and let `rawText` carry the chain. Widening this union later
 * is additive; guessing wrong now is a data-correctness bug that reads as fact.
 */
export type GazetteRelation = 'original' | 'correction' | 'revision';

/**
 * A single ΦΕΚ (Government Gazette) reference.
 *
 * 🔴 ADR-759 §4.2 rule 1: **the gazette is not a field — it is a property of an act.**
 * G753 carries **seven distinct gazettes** (963Δ, 1220Δ, 2Δ, 49Δ, 115Δ, 633Δ, 2216Β),
 * each bound to a different act. A single `governmentGazette: string` on the record
 * would have erased six of the seven.
 *
 * `rawText` is **required**; the structured triple is optional. That ordering is the
 * whole design: a reference we cannot parse is still fully preserved and displayable,
 * and structure can be added later without a migration. The inverse — structure
 * required, text optional — silently loses everything that does not fit the pattern
 * of the one sample we have.
 */
export interface GazetteRef {
  /** The reference verbatim, e.g. `"ΦΕΚ 963Δ/25-09-1992"`. Never empty, never lost. */
  readonly rawText: string;
  /** Issue number, e.g. `"963"`. Null when unparsed or absent. */
  readonly number: string | null;
  /** Issue series, e.g. `"Δ"` / `"Β"`. Null when unparsed or absent. */
  readonly series: string | null;
  /** Publication date, ISO `YYYY-MM-DD`. Null when unparsed or absent. */
  readonly date: string | null;
  /** Only ever set by an explicit human choice. See {@link GazetteRelation}. */
  readonly relation?: GazetteRelation | null;
}

/**
 * An institutional act (decree, ministerial decision, urban plan) plus the gazettes
 * that published it. One act may carry several gazettes — that is the correction chain.
 */
export interface InstitutionalAct {
  /** Stable id within the record — lets the UI keep row identity across edits. */
  readonly id: string;
  /** The act itself, e.g. `"Π.Δ. 02-09-1992"` or `"ΔΠ/ΠΜ/28941/775/15.9.1993 Α.Ν.Θ."`. */
  readonly reference: Sourced<string>;
  /** Every gazette bound to this act, in document order. */
  readonly gazettes: readonly GazetteRef[];
  /** Free note — the part of the sentence that fits no field. */
  readonly note: Sourced<string>;
}

// ============================================================================
// SECTION Α — ΟΡΟΙ ΔΟΜΗΣΗΣ (building terms)
// ============================================================================

/**
 * Section Α of the survey form.
 *
 * 🔴 ADR-759 §4.2 rule 2: **ΣΔ is three numbers, not one.** G753 declares `0,8` base,
 * `+0,5` social-factor bonus, `= 1,3` total. A single `declaredSd: 1.3` keeps the
 * result and destroys the **reason** — and the social-factor component is precisely
 * what the engineer needs to see separately. Coverage behaves the same way: `50%`
 * standard, `60%` maximum.
 */
export interface SurveyBuildingTerms {
  /** ΤΟΜΕΑΣ — the arty-rate sector, e.g. `"Ι"`. */
  readonly sector: Sourced<string>;
  /** Plot boundary vertex labels as drawn, e.g. `["Α","Β","Γ","Δ","Α"]`. */
  readonly plotBoundaryLabels: Sourced<readonly string[]>;
  /** Ελάχιστο πρόσωπο (m). */
  readonly minFrontage: Sourced<number>;
  /** Ελάχιστο εμβαδόν (m²). */
  readonly minArea: Sourced<number>;
  /** Παρέκκλιση — blank in the G753 sample. Blank is data (see {@link Sourced}). */
  readonly deviation: Sourced<string>;
  /** Σύστημα δόμησης — blank in the G753 sample. */
  readonly buildingSystem: Sourced<string>;
  /** Κάλυψη % as normally allowed. */
  readonly declaredCoveragePct: Sourced<number>;
  /** Κάλυψη % maximum (e.g. raised by the social factor). */
  readonly maxCoveragePct: Sourced<number>;
  /** Μέγιστο ύψος — often textual (`"κατά ΝΟΚ"`), so not a number. */
  readonly declaredMaxHeight: Sourced<string>;
  /** Αριθμός ορόφων — blank in the G753 sample. */
  readonly declaredFloors: Sourced<number>;
  /** ΣΔ βασικός. */
  readonly declaredSd: Sourced<number>;
  /** ΣΔ προσαύξηση κοινωνικού συντελεστή. */
  readonly socialFactorSd: Sourced<number>;
  /** ΣΔ σύνολο. Stored, not derived — the drawing states it, and it may disagree. */
  readonly totalSd: Sourced<number>;
  /** Χρήση γης, e.g. `"Αμιγής Κατοικία"`. */
  readonly landUse: Sourced<string>;
  /** ΕΝΤΟΣ ΖΩΝΗΣ ΚΟΙΝΩΝΙΚΟΥ ΣΥΝΤΕΛΕΣΤΗ (ΖΚΣ). */
  readonly inSocialFactorZone: Sourced<boolean>;
}

/**
 * Section Α′ — the institutional acts behind section Α.
 * Split from {@link SurveyBuildingTerms} because these are **lists**, and lists of
 * acts are exactly what a flat field set cannot hold (§4.2 rule 1).
 */
export interface SurveyInstitutionalActs {
  /** Διάταγμα Ρυμοτομίας + αναθεωρήσεις. */
  readonly urbanPlanDecree: readonly InstitutionalAct[];
  /** Γ.Π.Σ. — Γενικό Πολεοδομικό Σχέδιο. */
  readonly generalUrbanPlan: readonly InstitutionalAct[];
  /** Τομείς αρτιοτήτων / πολεοδομικές ρυθμίσεις. */
  readonly zoningRegulations: readonly InstitutionalAct[];
}

// ============================================================================
// SECTION Β — ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ (settlement / implementation acts)
// ============================================================================

/**
 * Πράξη Εφαρμογής — the act whose number the title block abbreviates as `Π.Ε.`.
 *
 * 🔑 ADR-759 §2β.3: `Π.Ε.` has **three** meanings in the same drawing (Πράξη
 * Εφαρμογής / Πολεοδομική Ενότητα / Περιφερειακή Ενότητα). `Π.Ε. 39` is the
 * **implementation act** — the document says so three times — which is why
 * `number` lives here and not in any location field. Cross-checking the title-block
 * cell against this number is ADR-759 Φ5, not Φ2.
 */
export interface ImplementationAct {
  /** Act number, e.g. `"39"`. */
  readonly number: Sourced<string>;
  /** Approving decision, e.g. `"29/οικ/5078/ΠΕ/534/13-02-1996"`. */
  readonly decision: Sourced<string>;
  /** Τόμος. */
  readonly volume: Sourced<string>;
  /** Αύξων αριθμός. */
  readonly entry: Sourced<string>;
  /** Date of registration, ISO `YYYY-MM-DD`. */
  readonly date: Sourced<string>;
  /** Υποθηκοφυλακείο, e.g. `"Νεάπολης"`. */
  readonly registry: Sourced<string>;
  /** Πολεοδομικές Ενότητες, e.g. `["16","17"]` — genuinely plural in G753. */
  readonly urbanUnits: Sourced<readonly string[]>;
  /** Αρχικές ιδιοκτησίες, e.g. `["012431","012432"]`. */
  readonly originalProperties: Sourced<readonly string[]>;
}

/** Section Β of the survey form. */
export interface SurveySettlement {
  /** Πράξεις τακτοποίησης — often prose ("Δεν Υπάρχουν ούτε απαιτούνται"). */
  readonly settlementActs: Sourced<string>;
  readonly implementationAct: ImplementationAct;
}

// ============================================================================
// SECTIONS Θ / Ι — approvals and title deeds
// ============================================================================

/**
 * Section Θ — ΕΓΚΡΙΣΕΙΣ. Protocol numbers are blank in G753; blank is data.
 *
 * 🔴 `subject` AND `authority` ARE TWO DIFFERENT THINGS, and the measurement is what
 * settled it (ADR-759 §2β.7). The drawing writes both on one line:
 *
 * ```
 * ΒΕΒΑΙΩΣΗ ΥΨΟΜΕΤΡΩΝ : ⇥Αρ. Πρωτ.: ..................... Δήμου Κορδελιού - Ευόσμου
 * ```
 *
 * «ΒΕΒΑΙΩΣΗ ΥΨΟΜΕΤΡΩΝ» is **what is being approved**; the Δήμος is **who approves**.
 * This type originally carried only `authority`, documented with the example
 * `"ΑΡΧΑΙΟΛΟΓΙΑ"` — which is a *subject*, not an authority. Kept as one field, the card
 * would have stated that the approving authority is named "ΒΕΒΑΙΩΣΗ ΥΨΟΜΕΤΡΩΝ", and the
 * office that actually issues the document would have been dropped on the floor.
 */
export interface SurveyApproval {
  readonly id: string;
  /** Τι εγκρίνεται, e.g. `"ΑΡΧΑΙΟΛΟΓΙΑ"` — the row's identity on the printed form. */
  readonly subject: Sourced<string>;
  /** Εγκρίνουσα αρχή, e.g. `"Εφορεία Αρχαιοτήτων Πόλης Θεσσαλονίκης"`. */
  readonly authority: Sourced<string>;
  readonly protocolNumber: Sourced<string>;
  /** ISO `YYYY-MM-DD`. */
  readonly date: Sourced<string>;
}

/**
 * Section Ι — ΤΙΤΛΟΣ ΙΔΙΟΚΤΗΣΙΑΣ. G753 carries **three** deeds, which on its own
 * settles ADR-759 Q1: a project-level scalar could never have held them.
 */
export interface SurveyTitleDeed {
  readonly id: string;
  /** Αριθμός συμβολαίου, e.g. `"2946"`. */
  readonly number: Sourced<string>;
  /** ISO `YYYY-MM-DD`. */
  readonly date: Sourced<string>;
  /** Είδος πράξης, e.g. `"Κληρονομιάς"` / `"Γονικής Παροχής"` / `"Διανομής"`. */
  readonly kind: Sourced<string>;
  /** Notary **name as written in the drawing**. */
  readonly notaryName: Sourced<string>;
  /**
   * FK → `contacts` for the notary, when the engineer links one.
   * The name above is what the document says; this is who we think it is. Keeping
   * both is the same rule as ADR-745 §8: reading is not identification.
   */
  readonly notaryContactId: string | null;
  readonly volume: Sourced<string>;
  readonly entry: Sourced<string>;
  /** Υποθηκοφυλακείο. */
  readonly registry: Sourced<string>;
}

// ============================================================================
// RECONCILIATION — the survey↔buildingCode ledger (ADR-759 §4.1, Q5)
// ============================================================================

/** The `buildingCode` fields that a survey can also speak about. */
export type ReconcilableField = 'sd' | 'coveragePct' | 'maxHeight';

/**
 * What the engineer decided about a difference between this survey and `buildingCode`.
 *
 * - `'adopted'`   : the survey value was written into `buildingCode`
 * - `'kept-ours'` : the difference was reviewed and accepted as-is
 *
 * `'kept-ours'` is Revit's **"Accept difference"** in Coordination Review, and it is
 * not decoration. Without it, a difference the engineer has already judged correct
 * reappears as unresolved on every visit — and after the third visit they stop
 * reading the card at all. That is ADR-759 §5.8 (*noise trains the engineer to
 * approve without reading*) expressed in the UI instead of the reader.
 */
export type ReconciliationAction = 'adopted' | 'kept-ours';

/**
 * One recorded decision about one field.
 *
 * 🔑 `surveyValueAtDecision` is the load-bearing part. A decision is only valid
 * **against the value it was made about**. If the survey record is later edited and
 * that number changes, the stored decision no longer matches and the comparison
 * re-opens by itself. Without this field, `'kept-ours'` would silence the field
 * permanently — including for a value nobody ever looked at.
 */
export interface FieldReconciliation {
  readonly field: ReconcilableField;
  readonly action: ReconciliationAction;
  /** The survey value at the moment of the decision. `null` = survey had no value. */
  readonly surveyValueAtDecision: number | null;
  /** Contact/user id of whoever decided. */
  readonly decidedBy: string;
  /** ISO timestamp. */
  readonly decidedAt: string;
}

// ============================================================================
// THE RECORD
// ============================================================================

/**
 * One survey document, transcribed.
 *
 * Lives in its own top-level collection (`survey_records`), not inside `Project`:
 * it is an immutable dated statement against a mutable working document, it carries
 * genuinely unbounded lists, and a project acquires more than one over its life
 * (purchase survey → implementation survey). ADR-759 Q1.
 *
 * The **active** record for a project is named explicitly by
 * `project.activeSurveyRecordId` — never derived by sorting. Deriving it would mean
 * uploading an older survey silently changes which one is authoritative.
 */
export interface SurveyRecord {
  /** Enterprise id, `srv_*` prefix (N.6). Never `addDoc`. */
  readonly id: string;
  /** Tenant scope. Immutable after create (CHECK 3.35 + firestore.rules). */
  readonly companyId: string;
  /** Owning project. */
  readonly projectId: string;

  // --- what document this transcribes ---------------------------------------
  /** File name of the source drawing, e.g. `"G753_ergasia F.dxf"`. */
  readonly sourceFileName: string | null;
  /** FK → the CAD file, when the record was produced from one in-app (Φ4). */
  readonly sourceCadFileId: string | null;
  /** Date the survey was authored — **not** the date we typed it in. ISO `YYYY-MM-DD`. */
  readonly surveyDate: Sourced<string>;
  /** FK → `contacts` for the surveyor. */
  readonly surveyorContactId: string | null;

  // --- sections Α–Ι, in the order the drawing prints them --------------------
  /** Α. ΟΡΟΙ ΔΟΜΗΣΗΣ */
  readonly buildingTerms: SurveyBuildingTerms;
  /** Α′. Θεσμικές πράξεις */
  readonly institutionalActs: SurveyInstitutionalActs;
  /** Β. ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ */
  readonly settlement: SurveySettlement;
  /** Γ. ΑΡΤΙΟ & ΟΙΚΟΔΟΜΗΣΙΜΟ */
  readonly isBuildable: Sourced<boolean>;
  readonly buildabilityNote: Sourced<string>;
  /** Δ. ΚΑΘΟΡΙΣΜΟΣ ΡΥΜΟΤΟΜΙΑΣ */
  readonly roadPlanDefinition: Sourced<string>;
  /** Ε. ΕΚΤΟΣ ΑΝΑΣΤΟΛΗΣ */
  readonly suspensionStatus: Sourced<string>;
  /** ΣΤ. ΕΜΒΑΔΟΝ ΟΙΚΟΠΕΔΟΥ (m²) */
  readonly plotArea: Sourced<number>;
  /** Ζ. ΑΦΕΤΗΡΙΑ ΥΨΟΥΣ */
  readonly heightDatum: Sourced<string>;
  /** Η. ΠΑΡΑΤΗΡΗΣΕΙΣ */
  readonly remarks: readonly Sourced<string>[];
  /** Θ. ΕΓΚΡΙΣΕΙΣ */
  readonly approvals: readonly SurveyApproval[];
  /** Ι. ΤΙΤΛΟΙ ΙΔΙΟΚΤΗΣΙΑΣ */
  readonly titleDeeds: readonly SurveyTitleDeed[];

  // --- reconciliation against project.buildingCode ---------------------------
  /** Per-field decisions. Absent field = never reviewed. */
  readonly reconciliations: readonly FieldReconciliation[];

  // --- confirmation ----------------------------------------------------------
  /**
   * Who confirmed this record reflects the document.
   * 🔴 **Not optional in spirit** — ADR-745 §8 rule 1. `null` means *unconfirmed*,
   * and an unconfirmed record must never be treated as a source of truth by anything.
   */
  readonly confirmedBy: string | null;
  /** ISO timestamp of confirmation. */
  readonly confirmedAt: string | null;

  // --- audit -----------------------------------------------------------------
  readonly createdBy: string;
  /** ISO timestamp. */
  readonly createdAt: string;
  /** ISO timestamp. */
  readonly updatedAt: string;
}

// ============================================================================
// HELPERS — tiny, total, and the only place `Sourced` is constructed
// ============================================================================

/** An empty, user-owned value. The default state of every field on a new record. */
export function emptySourced<T>(): Sourced<T> {
  return { value: null, provenance: 'user' };
}

/** A value the engineer typed. */
export function userSourced<T>(value: T | null): Sourced<T> {
  return { value, provenance: 'user' };
}

/**
 * A value transcribed from a drawing. `rawText` is required here **by signature**,
 * not by convention — a read value without its source text cannot be audited later.
 */
export function surveySourced<T>(value: T | null, rawText: string): Sourced<T> {
  return { value, provenance: 'survey', rawText };
}

/**
 * Is the recorded decision for `field` still valid against the current survey value?
 *
 * Returns `false` when there is no decision, **or** when the survey value has changed
 * since the decision was made — which re-opens the comparison. See
 * {@link FieldReconciliation}.
 */
export function isReconciliationCurrent(
  reconciliations: readonly FieldReconciliation[],
  field: ReconcilableField,
  currentSurveyValue: number | null
): boolean {
  const decision = reconciliations.find((r) => r.field === field);
  if (!decision) return false;
  return decision.surveyValueAtDecision === currentSurveyValue;
}
