/**
 * @fileoverview Λεξιλόγιο αναγνώρισης του **σώματος** του σχεδίου — δεδομένα, όχι κείμενο UI.
 *
 * Οι συμβολοσειρές εδώ είναι ό,τι **γράφει ο τοπογράφος μέσα στο DXF**. Δεν εμφανίζονται σε
 * οθόνη και **δεν μεταφράζονται**: μεταφρασμένο λεξιλόγιο αναγνώρισης σημαίνει ότι το ίδιο
 * αρχείο διαβάζεται αλλιώς σε αγγλικό περιβάλλον (ADR-745 §8 κανόνας 7, N.11 εξαίρεση
 * δεδομένων). Ίδιο πρότυπο **προφίλ** με το `title-block-vocabulary.ts`: άλλο τοπογραφικό
 * γραφείο προστίθεται ως **δεδομένα**, χωρίς αλλαγή κώδικα.
 *
 * ## 🔴 Γιατί ΔΕΝ ξαναχρησιμοποιείται το `splitLocationValue`
 *
 * Ο τεμαχισμός του κελιού «ΘΕΣΗ» δουλεύει με **σημαδούρες που τερματίζουν η μία την άλλη**:
 * κάθε αναγνωρισμένη ετικέτα ανοίγει τμήμα που κλείνει στην επόμενη. Αυτό είναι σωστό για
 * πυκνό κείμενο πινακίδας («ΔΗΜΟΣ Χ - Δ.Ε. Ψ - Ο.Τ. Γ 753») και **καταστροφικό** για πρόζα:
 * στη «ΔΗΛΩΣΗ ΤΟΥ Ν.651/77» ανάμεσα στο `Ο.Τ.` και στην επόμενη σημαδούρα μεσολαβούν
 * **σαράντα λέξεις**, οπότε το `Project.buildingBlock` θα γραφόταν «Γ 753, των Πολεοδομικών
 * Ενοτήτων 16 και 17, της υπ' αριθμ. 39 Πράξης Εφαρμογής, της Δημοτικής…».
 *
 * ⇒ Στην πρόζα η τιμή είναι **φραγμένη** (μία λέξη, ένας αριθμός, μια λίστα ομοειδών), όχι
 * «ό,τι υπάρχει μέχρι την επόμενη σημαδούρα». Αυτή η διαφορά **είναι** το επιχείρημα της
 * §4.6 για δύο αναγνώστες με διαφορετική αξιοπιστία.
 *
 * ## 🔑 Ο κανόνας εντοπίζει, ΔΕΝ αναλύει
 *
 * Κάθε κανόνας παράγει **κομμάτι κειμένου**. Η μετατροπή σε τιμή ζει **μία** φορά, στο
 * `SURVEY_BINDING_SPECS[field].parse` — το ίδιο σημείο που την κάνει και για την πινακίδα.
 * Οι μονάδες (`μ.`, `τ.μ.`, `%`) χρησιμοποιούνται εδώ **μόνο ως επαλήθευση** ότι ο αριθμός
 * που βρέθηκε είναι το είδος μεγέθους που περιμένουμε — ποτέ ως μέρος της τιμής.
 *
 * @see ADR-759 §2β.2 — κάθε κανόνας εδώ είναι μετρημένος στο `G753_ergasia F.dxf`
 * @module config/document-body-vocabulary
 */

import type { DocumentBodyFieldKey, DocumentBodyKind } from '@/types/document-body-reading';

// ── Σχήματα ───────────────────────────────────────────────────────────────────

/**
 * Τι **μορφή** πρέπει να έχει η λέξη για να γίνει δεκτή.
 *
 * 🔴 **Ο έλεγχος σχήματος είναι που λύνει το «Π.Ε.»** (ADR-759 §2β.3 / handoff Ζ.1). Το ίδιο
 * ακρωνύμιο σημαίνει **Πράξη Εφαρμογής** όταν ακολουθεί αριθμός (`Π.Ε. 39`) και **Περιφερειακή
 * Ενότητα** όταν ακολουθεί όνομα (`Π.Ε. Θεσσαλονίκης`) — και τα δύο υπάρχουν στο **ίδιο**
 * αρχείο. Η απόφαση δεν βγαίνει από τη μορφή **του ακρωνυμίου** (που είναι το απαγορευμένο),
 * αλλά από το **τι ακολουθεί** — δηλαδή από συμφραζόμενο, που είναι ακριβώς αυτό που η §2β.3
 * ζητά και που **μόνο** η ανάγνωση του σώματος μπορούσε να δώσει.
 */
export type BodyTokenShape =
  /** Μόνο ψηφία (`39`, `106`, `012431`). */
  | 'digits'
  /**
   * **Ένα** γράμμα — οι κορυφές του οικοπέδου (`Α,Β,Γ,Δ,Α`).
   *
   * 🔴 Χωρίς αυτόν τον διαχωρισμό η λίστα ρουφά τη συνέχεια της πρότασης: στη «ΔΗΛΩΣΗ ΤΟΥ
   * Ν.651/77» το κείμενο συνεχίζει «…Α, **στο** Ο.Τ. **Γ** 753», και με σχήμα `letters` το
   * αποτέλεσμα ήταν «Α,Β,Γ,Δ,Α, στο Ο.Τ. Γ» — μετρημένο, όχι υποθετικό.
   */
  | 'letter'
  /** Μία ή περισσότερες λέξεις-γράμματα (`Θεσσαλονίκης`, `Νεάπολης`, `Ι`). */
  | 'letters'
  /** Ημερομηνία (`2-5-1996`, `30/7/2026`). */
  | 'date'
  /** Οτιδήποτε μη κενό (πρωτόκολλα τύπου `29/οικ/5078/ΠΕ/534/13-02-1996`). */
  | 'any';

/** Η μονάδα που **επαληθεύει** έναν αριθμό. Ποτέ δεν μπαίνει στην τιμή. */
export type BodyMeasureUnit = 'none' | 'metre' | 'squareMetre' | 'percent';

/**
 * Ποιος από τους αριθμούς του κειμένου.
 *
 * 🔑 **Η τριάδα του Συντελεστή Δόμησης δεν διαλέγεται με θέση — διαλέγεται με ΑΡΙΘΜΗΤΙΚΗ.**
 * Το πραγματικό κείμενο γράφει *«0,8 με κοινωνικό συντελεστή 0,8+0,5 = 1,3»*: τέσσερις
 * αριθμοί, με τον πρώτο να **επαναλαμβάνεται**. Ένας κανόνας θέσης («ο 1ος, ο 3ος, ο 4ος»)
 * θα έσπαγε στην πρώτη διαφορετική διατύπωση — και οι διατυπώσεις διαφέρουν ανά γραφείο.
 * Αντίθετα η σχέση **βασικός + κοινωνικός = σύνολο** είναι ο ίδιος ο ορισμός των τριών
 * μεγεθών, άρα διαλέγει σωστά ό,τι σειρά κι αν έχουν — και **αρνείται** όταν δεν κλείνει,
 * αντί να γράψει εύλογο λάθος (ADR-759 §2β.5: «ψέμα με σωστή μορφή»).
 */
export type BodyNumberSelect =
  | { readonly nth: number }
  | { readonly sum: 'addend-a' | 'addend-b' | 'total' };

// ── Κανόνες ───────────────────────────────────────────────────────────────────

/** Πού ψάχνει ο κανόνας. */
export type BodyMatch =
  /**
   * Ετικέτα στην **αρχή τμήματος** — τμήμα = ό,τι υπάρχει ανάμεσα σε δύο στηλοθέτες.
   *
   * Ο στηλοθέτης είναι η **στήλη** της τυπωμένης φόρμας: «Ελάχιστα όρια: ⇥ Πρόσωπο 20μ. ⇥
   * Εμβαδόν Ε=500 τ.μ.» είναι **τρία** πράγματα σε μία γραμμή, όχι ένα.
   */
  | { readonly at: 'segment-start'; readonly labels: readonly string[] }
  /** Η πρώτη μη κενή γραμμή **περιεχομένου** της ενότητας (πρόζα κάτω από επικεφαλίδα). */
  | { readonly at: 'section-prose' }
  /** Φράση **οπουδήποτε** μέσα σε γραμμή· η τιμή είναι φραγμένη από το `take`. */
  | { readonly at: 'lead-in'; readonly labels: readonly string[] }
  /**
   * Η **τελευταία** γραμμή του εγγράφου που τελειώνει σε ημερομηνία.
   *
   * Η γραμμή υπογραφής («Θεσσαλονίκη 30/7/2026») είναι σύμβαση κάθε ελληνικής υπεύθυνης
   * δήλωσης. Το «τελειώνει σε» δεν είναι σχολαστικισμός: το ίδιο έγγραφο περιέχει **άλλες
   * τέσσερις** ημερομηνίες (ΦΕΚ, αποφάσεις, μεταγραφές), καμία τους στο τέλος γραμμής.
   */
  | { readonly at: 'line-tail-date' };

/** Τι κρατά ο κανόνας από το σημείο που ταίριαξε. */
export type BodyTake =
  /** Ό,τι απομένει στο τμήμα, χωρίς αρχικά διαχωριστικά (`:`, `=`). */
  | { readonly as: 'rest' }
  /** Η πρώτη λέξη μετά την ετικέτα, **αν** έχει το δηλωμένο σχήμα· αλλιώς τίποτα. */
  | { readonly as: 'token'; readonly shape: BodyTokenShape }
  /** Αριθμός, επαληθευμένος από τη μονάδα του. */
  | { readonly as: 'number'; readonly unit: BodyMeasureUnit; readonly select: BodyNumberSelect }
  /** Συνεχόμενες λέξεις **ίδιου σχήματος** (τα ενδιάμεσα `,` `&` `και` δεν διακόπτουν). */
  | { readonly as: 'list'; readonly shape: BodyTokenShape }
  /** Η ίδια η φράση που ταίριαξε — για δηλώσεις όπου η **ύπαρξη** είναι η τιμή. */
  | { readonly as: 'phrase' };

export interface DocumentBodyRule {
  readonly key: DocumentBodyFieldKey;
  /** Σε ποια ενότητα ισχύει· απόν ⇒ σε ολόκληρο το έγγραφο (έγγραφα χωρίς ενότητες). */
  readonly section?: string;
  readonly match: BodyMatch;
  readonly take: BodyTake;
}

/** Μια ενότητα της τυπωμένης φόρμας. */
export interface DocumentBodySection {
  readonly id: string;
  /** Οι γραφές της επικεφαλίδας. Το υπόλοιπο **της ίδιας γραμμής** είναι ήδη περιεχόμενο. */
  readonly headings: readonly string[];
}

export interface DocumentBodyProfile {
  readonly kind: DocumentBodyKind;
  /**
   * Οι φράσεις που **αναγνωρίζουν** το έγγραφο, στις πρώτες του γραμμές.
   *
   * 🔴 **Η αναγνώριση γίνεται από ΤΟΝ ΤΙΤΛΟ, ποτέ από το layer — και αυτό είναι μετρημένο.**
   * Το layer `ΠΕΡΙΓΡΑΦΗ` του G753 έχει **79** κείμενα και **μόνο 2** είναι έγγραφα· τα άλλα 77
   * είναι διαστάσεις («5.00»), λεζάντες («κράσπεδο») και ονόματα οδών. Λίστα layers θα έμπαζε
   * θόρυβο, και **ο θόρυβος εκπαιδεύει τον μηχανικό να πατά Έγκριση χωρίς να διαβάζει** —
   * που ακυρώνει ολόκληρο το ADR-745 (§5 κανόνας 8). Ίδιο δόγμα με το `scanTitleBlockLayers`:
   * *δεν μαντεύουμε από το όνομα — ρωτάμε ποιο κείμενο παράγει έγγραφο όταν το διαβάσεις.*
   */
  readonly headings: readonly string[];
  /** Κενό ⇒ το έγγραφο είναι **μία** ανώνυμη ενότητα (δηλώσεις, σημειώσεις). */
  readonly sections: readonly DocumentBodySection[];
  /**
   * Ετικέτες που η φόρμα **τυπώνει** και που στο πραγματικό σχέδιο μένουν **κενές**.
   *
   * Δεν είναι πεδία: δεν έχουν τιμή να προτείνουν. Είναι **ορατή απουσία** (ADR-762 §5) —
   * ο μηχανικός πρέπει να δει ότι το σχέδιο **έχει** «Παρέκκλιση» και **δεν** τη συμπλήρωσε,
   * αντί να μη μάθει ποτέ ότι ρωτήθηκε. `null` είναι κατάσταση, όχι απουσία (handoff Ζ.4).
   */
  readonly emptyLabels: readonly string[];
  readonly rules: readonly DocumentBodyRule[];
}

// ── Το προφίλ του ελληνικού τοπογραφικού γραφείου ─────────────────────────────

/**
 * Οι κανόνες που μοιράζονται **και οι δύο** υπεύθυνες δηλώσεις του φύλλου.
 *
 * 🔑 Δεν είναι σύμπτωση: η δήλωση του μηχανικού (Ν.651/77) και του ιδιοκτήτη (Ν.4030/11)
 * περιγράφουν **το ίδιο ακίνητο με την ίδια τυποποιημένη φράση** («…το 01β οικόπεδο με
 * στοιχεία Α,Β,Γ,Δ,Α, στο Ο.Τ. Γ 753, των Πολεοδομικών Ενοτήτων 16 και 17 … Π.Ε.
 * Θεσσαλονίκης»). Γραμμένοι δύο φορές, θα απέκλιναν την ημέρα που διορθωθεί ο ένας — και
 * αυτό ακριβώς έπιασε ο token-based έλεγχος (N.18).
 */
const DECLARATION_COMMON_RULES: readonly DocumentBodyRule[] = [
  { key: 'plotBoundaryLabels', match: { at: 'lead-in', labels: ['με στοιχεία'] }, take: { as: 'list', shape: 'letter' } },
  { key: 'implementationActUrbanUnits', match: { at: 'lead-in', labels: ['Πολεοδομικών Ενοτήτων'] }, take: { as: 'list', shape: 'digits' } },
  // Σχήμα `letters` ⇒ ταιριάζει το «Π.Ε. Θεσσαλονίκης» και **ποτέ** το «Π.Ε. 39».
  { key: 'regionalUnit', match: { at: 'lead-in', labels: ['Π.Ε.'] }, take: { as: 'token', shape: 'letters' } },
];

/**
 * «ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ» — η τυποποιημένη φόρμα Α–Ι.
 *
 * ⚠️ Οι επικεφαλίδες γράφονται **όπως τις γράφει το αρχείο**, με τα λάθη του: το «Ζ.» λέει
 * «ΑΦΕΤΕΡΙΑΣ» (αντί «ΑΦΕΤΗΡΙΑΣ») και το «A ΟΡΟΙ ΔΟΜΗΣΗΣ» ξεκινά με **λατινικό A** χωρίς
 * τελεία. Και τα δύο είναι στο πραγματικό σχέδιο· η ορθογραφία μας δεν το διορθώνει. (Το
 * λατινικό `A` το εξουδετερώνει ο `normalizeForLabelMatch`, το «ΑΦΕΤΕΡΙΑΣ» **όχι** — γι' αυτό
 * δηλώνονται και οι δύο γραφές.)
 */
const PRIVATE_ENGINEER_SURVEY: DocumentBodyProfile = {
  kind: 'private-engineer-survey',
  headings: ['ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ'],
  sections: [
    { id: 'a', headings: ['A ΟΡΟΙ ΔΟΜΗΣΗΣ', 'Α. ΟΡΟΙ ΔΟΜΗΣΗΣ'] },
    { id: 'b', headings: ['Β. ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ'] },
    { id: 'c', headings: ['Γ. ΑΡΤΙΟ ΚΑΙ ΟΙΚΟΔΟΜΗΣΙΜΟ'] },
    { id: 'd', headings: ['Δ. ΛΕΠΤΟΜΕΡΗΣ ΚΑΘΟΡΙΣΜΟΣ ΡΥΜΟΤΟΜΙΑΣ'] },
    { id: 'e', headings: ['Ε. ΤΟ ΟΙΚΟΠΕΔΟ ΕΚΤΟΣ ΑΝΑΣΤΟΛΗΣ'] },
    { id: 'st', headings: ['ΣΤ. ΕΜΒΑΔΟΝ ΟΙΚΟΠΕΔΟΥ'] },
    { id: 'z', headings: ['Ζ. ΠΡΟΣΔΙΟΡΙΣΜΟΣ ΑΦΕΤΕΡΙΑΣ ΥΨΟΥΣ', 'Ζ. ΠΡΟΣΔΙΟΡΙΣΜΟΣ ΑΦΕΤΗΡΙΑΣ ΥΨΟΥΣ'] },
    { id: 'i', headings: ['Η. ΠΑΡΑΤΗΡΗΣΗ'] },
    { id: 'th', headings: ['Θ. ΕΓΚΡΙΣΕΙΣ'] },
    { id: 'io', headings: ['Ι. ΤΙΤΛΟΣ ΙΔΙΟΚΤΗΣΙΑΣ'] },
  ],
  emptyLabels: ['Παρέκλιση', 'Παρέκκλιση', 'Σύστημα', 'ΟΡΟΦΟΙ'],
  rules: [
    // ── Α. ΟΡΟΙ ΔΟΜΗΣΗΣ ──────────────────────────────────────────────────────
    { key: 'sector', section: 'a', match: { at: 'segment-start', labels: ['ΤΟΜΕΑΣ'] }, take: { as: 'token', shape: 'letters' } },
    { key: 'plotBoundaryLabels', section: 'a', match: { at: 'segment-start', labels: ['Όρια οικοπέδου'] }, take: { as: 'list', shape: 'letter' } },
    { key: 'minFrontage', section: 'a', match: { at: 'segment-start', labels: ['Πρόσωπο'] }, take: { as: 'number', unit: 'metre', select: { nth: 1 } } },
    { key: 'minArea', section: 'a', match: { at: 'segment-start', labels: ['Εμβαδόν'] }, take: { as: 'number', unit: 'squareMetre', select: { nth: 1 } } },
    // Δύο ποσοστά στο ίδιο τμήμα: «50%, 60% (μέγιστο … λόγω κοινωνικού συντελεστή)».
    { key: 'declaredCoveragePct', section: 'a', match: { at: 'segment-start', labels: ['Ποσοστό κάλυψης'] }, take: { as: 'number', unit: 'percent', select: { nth: 1 } } },
    { key: 'maxCoveragePct', section: 'a', match: { at: 'segment-start', labels: ['Ποσοστό κάλυψης'] }, take: { as: 'number', unit: 'percent', select: { nth: 2 } } },
    // Κείμενο, όχι αριθμός: το σχέδιο λέει «κατά ΝΟΚ» τόσο συχνά όσο και νούμερο.
    { key: 'declaredMaxHeight', section: 'a', match: { at: 'segment-start', labels: ['Ύψος'] }, take: { as: 'rest' } },
    { key: 'declaredSd', section: 'a', match: { at: 'segment-start', labels: ['Συντελεστής Δόμησης'] }, take: { as: 'number', unit: 'none', select: { sum: 'addend-a' } } },
    { key: 'socialFactorSd', section: 'a', match: { at: 'segment-start', labels: ['Συντελεστής Δόμησης'] }, take: { as: 'number', unit: 'none', select: { sum: 'addend-b' } } },
    { key: 'totalSd', section: 'a', match: { at: 'segment-start', labels: ['Συντελεστής Δόμησης'] }, take: { as: 'number', unit: 'none', select: { sum: 'total' } } },
    { key: 'landUse', section: 'a', match: { at: 'segment-start', labels: ['Χρήση Γης'] }, take: { as: 'rest' } },
    // Η **ύπαρξη** της δήλωσης είναι η τιμή. Η απουσία της ΔΕΝ σημαίνει «εκτός ζώνης»:
    // σχέδιο εκτός ΖΚΣ απλώς δεν το γράφει. Γι' αυτό ο κανόνας παράγει μόνο «ναι», ποτέ «όχι».
    { key: 'inSocialFactorZone', section: 'a', match: { at: 'segment-start', labels: ['ΕΝΤΟΣ ΖΩΝΗΣ ΚΟΙΝΩΝΙΚΟΥ ΣΥΝΤΕΛΕΣΤΗ'] }, take: { as: 'phrase' } },

    // ── Β. ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ ──────────────────────────────────────────────
    { key: 'settlementActs', section: 'b', match: { at: 'section-prose' }, take: { as: 'rest' } },
    { key: 'implementationActNumber', section: 'b', match: { at: 'lead-in', labels: ['ΠΡΑΞΗ ΕΦΑΡΜΟΓΗΣ'] }, take: { as: 'token', shape: 'digits' } },
    { key: 'implementationActDecision', section: 'b', match: { at: 'lead-in', labels: ['ΑΠΟΦ. ΝΟΜ.'] }, take: { as: 'token', shape: 'any' } },
    { key: 'implementationActVolume', section: 'b', match: { at: 'lead-in', labels: ['Τόμο'] }, take: { as: 'token', shape: 'digits' } },
    { key: 'implementationActEntry', section: 'b', match: { at: 'lead-in', labels: ['α.α.'] }, take: { as: 'token', shape: 'digits' } },
    { key: 'implementationActDate', section: 'b', match: { at: 'lead-in', labels: ['στις'] }, take: { as: 'token', shape: 'date' } },
    { key: 'implementationActRegistry', section: 'b', match: { at: 'lead-in', labels: ['Υποθ/κειο', 'Υποθ/κειου'] }, take: { as: 'token', shape: 'letters' } },
    { key: 'implementationActUrbanUnits', section: 'b', match: { at: 'lead-in', labels: ['Πολεοδομικές ενότητες', 'Πολεοδομικών Ενοτήτων'] }, take: { as: 'list', shape: 'digits' } },
    { key: 'implementationActOriginalProperties', section: 'b', match: { at: 'lead-in', labels: ['Αρχική Ιδιοκτησία'] }, take: { as: 'list', shape: 'digits' } },

    // ── Γ–Ζ ──────────────────────────────────────────────────────────────────
    { key: 'buildabilityNote', section: 'c', match: { at: 'section-prose' }, take: { as: 'rest' } },
    { key: 'roadPlanDefinition', section: 'd', match: { at: 'section-prose' }, take: { as: 'rest' } },
    // 🔴 Ο αριθμός βγαίνει από **αυτό** το κείμενο, ποτέ από τον `Pinakas-Syntetagmenon`:
    // εκείνος λέει 4092,13 τ.μ. σε **άλλο** σύστημα συντεταγμένων — άλλο τεμάχιο (§2β.5).
    { key: 'plotArea', section: 'st', match: { at: 'section-prose' }, take: { as: 'number', unit: 'squareMetre', select: { nth: 1 } } },
    { key: 'heightDatum', section: 'z', match: { at: 'section-prose' }, take: { as: 'rest' } },
  ],
};

/**
 * «ΔΗΛΩΣΗ ΤΟΥ Ν.651/77» — η υπεύθυνη δήλωση του μηχανικού.
 *
 * 🔑 **Αυτό είναι το έγγραφο της Φ5** (handoff §Δ.4). Δίνει τρία πράγματα που η πινακίδα δεν
 * έχει και που **αναβαθμίζουν δουλειά ήδη παραδομένη**: την ακριβή ημερομηνία («30/7/2026»
 * αντί «ΙΟΥΛΙΟΣ 2026», που έμενε `partial-value`), την **Πράξη Εφαρμογής ολογράφως** (άρα
 * χωρίς την επιφύλαξη `ambiguous-abbreviation` του «Π.Ε. 39»), και την **Περιφερειακή
 * Ενότητα** «Θεσσαλονίκης», που σήμερα δεν γράφεται ποτέ.
 */
const LAW_651_DECLARATION: DocumentBodyProfile = {
  kind: 'law651-declaration',
  headings: ['ΔΗΛΩΣΗ ΤΟΥ Ν.651/77'],
  sections: [],
  emptyLabels: [],
  rules: [
    ...DECLARATION_COMMON_RULES,
    { key: 'surveyDate', match: { at: 'line-tail-date' }, take: { as: 'token', shape: 'date' } },
    { key: 'plotArea', match: { at: 'lead-in', labels: ['κατά την καταμέτρηση'] }, take: { as: 'number', unit: 'squareMetre', select: { nth: 1 } } },
    // Ο αριθμός **ολογράφως**: «της υπ' αριθμ. 39 Πράξης Εφαρμογής» — καμία αμφισημία εδώ.
    { key: 'implementationActNumber', match: { at: 'lead-in', labels: ["υπ' αριθμ."] }, take: { as: 'token', shape: 'digits' } },
    { key: 'implementationActDecision', match: { at: 'lead-in', labels: ['Αρ. Πρωτ.'] }, take: { as: 'token', shape: 'any' } },
    { key: 'implementationActVolume', match: { at: 'lead-in', labels: ['Τόμο'] }, take: { as: 'token', shape: 'digits' } },
    { key: 'implementationActEntry', match: { at: 'lead-in', labels: ['α.α.'] }, take: { as: 'token', shape: 'digits' } },
    { key: 'implementationActDate', match: { at: 'lead-in', labels: ['στις'] }, take: { as: 'token', shape: 'date' } },
    { key: 'implementationActRegistry', match: { at: 'lead-in', labels: ['Υποθ/κειου', 'Υποθ/κειο'] }, take: { as: 'token', shape: 'letters' } },
  ],
};

/** «ΔΗΛΩΣΗ ΙΔΙΟΚΤΗΤΗ (Ν. 4030/11)» — τα όρια όπως τα υπέδειξε ο ιδιοκτήτης. */
const OWNER_DECLARATION: DocumentBodyProfile = {
  kind: 'owner-declaration',
  headings: ['ΔΗΛΩΣΗ ΙΔΙΟΚΤΗΤΗ'],
  sections: [],
  emptyLabels: [],
  rules: DECLARATION_COMMON_RULES,
};

/**
 * «ΕΜΒΑΔΟΝ ΓΕΩΤΕΜΑΧΙΟΥ» — η σημείωση δίπλα στο περίγραμμα.
 *
 * ⚠️ Γράφεται με **λατινικό E** στο πραγματικό αρχείο (`EΜΒΑΔΟΝ`). Το ξεπερνά ο
 * `normalizeGreekHomoglyphs` μέσα στον `normalizeForLabelMatch` — ίδια παγίδα με το
 * «ΣΥΝΤΑΞΗ» της πινακίδας (ADR-745 §2.3 Γ), σε άλλο σημείο του ίδιου σχεδίου.
 */
const PARCEL_AREA_NOTE: DocumentBodyProfile = {
  kind: 'parcel-area-note',
  headings: ['ΕΜΒΑΔΟΝ ΓΕΩΤΕΜΑΧΙΟΥ'],
  sections: [],
  emptyLabels: [],
  rules: [
    { key: 'plotArea', match: { at: 'section-prose' }, take: { as: 'number', unit: 'squareMetre', select: { nth: 1 } } },
  ],
};

/**
 * Τα έγγραφα που ξέρουμε να διαβάζουμε, **με σειρά προτεραιότητας μάρτυρα**.
 *
 * Η σειρά έχει ένα και μόνο νόημα: όταν δύο έγγραφα λένε **το ίδιο**, η γραμμή που βλέπει ο
 * άνθρωπος κρατά το κείμενο του **πρώτου** εδώ. Η φόρμα του μηχανικού προηγείται γιατί είναι
 * το έγγραφο που συντάσσεται **γι' αυτόν ακριβώς τον σκοπό**· οι δηλώσεις επαναλαμβάνουν.
 */
export const GREEK_SURVEYOR_BODY_PROFILES: readonly DocumentBodyProfile[] = [
  PRIVATE_ENGINEER_SURVEY,
  LAW_651_DECLARATION,
  PARCEL_AREA_NOTE,
  OWNER_DECLARATION,
];
