/**
 * ADR-767 Δ7 — **ΤΙ τρέφει έναν δεμένο πίνακα**: διακριτή ένωση, ποτέ αδόμητο string.
 *
 * Καθαρό type module (μηδέν runtime), στο ίδιο στρώμα με το `table-row-link.ts`. Η αλυσίδα
 * εξαρτήσεων μένει αλυσίδα:
 *
 * ```
 *   schedule/types  →  table-source-ref  →  table
 *   (η γλώσσα των     (ΠΟΙΑ πηγή)          (το μοντέλο)
 *    δεδομένων)
 * ```
 *
 * ## 🔑 Γιατί ένωση με `kind` και όχι `sourceRef: string`
 * Το πεδίο δηλωνόταν ως `string` («αδιαφανές αναγνωριστικό») από τη Φ.Α. Αδιαφανές σημαίνει
 * ότι κάποιος θα έγραφε `'schedule:door?floor=FL01'` — και η **δεύτερη** πηγή θα γεννούσε
 * τον parser που θα το ξεδίπλωνε, δηλαδή μια δεύτερη γραμματική μέσα στο σύστημα, με τα
 * δικά της σφάλματα ανάλυσης και τη δική της σιωπηλή αστοχία σε παλιά δεδομένα. Με ένωση, η
 * δεύτερη πηγή προσθέτει **κλάδο**, όχι μηχανή.
 *
 * ## 🔴 Γιατί δηλώνονται ΚΑΙ ΟΙ ΠΕΝΤΕ κλάδοι ενώ υλοποιείται ΕΝΑΣ
 * Το Δ7 ορίζει δύο πράγματα που φαίνονται αντιφατικά: *«υλοποιείται **μία** καταχώρηση
 * resolver»* και *«το **σχήμα** καλύπτει **και τους τρεις** παραγωγούς από την πρώτη μέρα»*.
 * Δεν είναι αντίφαση — μιλούν για διαφορετικά πράγματα:
 *
 * - Το **σχήμα** πρέπει να μπορεί να **εκφράσει** ήδη το «schedule πορτών του ορόφου Χ»
 *   (δηλαδή να κουβαλά `ScheduleFilterCriteria`), αλλιώς η δεύτερη πηγή θα χρειαστεί νέο
 *   πεδίο ⇒ migration σε κάθε αποθηκευμένο πίνακα ⇒ ή, χειρότερα, ένα string με κωδικοποίηση.
 * - Ο **resolver** υλοποιείται ένας.
 *
 * Το κενό ανάμεσά τους **δεν σιωπά**: το μητρώο του `table-source-resolver.ts` είναι
 * `Record<TableSourceKind, …>`, οπότε ο μεταγλωττιστής απαιτεί καταχώρηση για **κάθε** κλάδο,
 * και οι μη-συνδεδεμένοι επιστρέφουν τη ρητή κατάσταση `'source-not-wired'`. Κανένας κλάδος
 * χωρίς καταναλωτή (ADR-767 §8 #7) — και καμία πηγή που «δεν κάνει τίποτα» χωρίς εξήγηση.
 *
 * ## Σειριοποίηση (Ανοιχτό §10.1)
 * Ταξιδεύει σε **JSON** (σκηνή → Firestore) μέσα στο `TableEntity.binding`, μαζί με τα
 * υπόλοιπα του `PersistedTableModel`. Απλά αντικείμενα και string literals ⇒ επιβιώνει
 * `JSON.stringify`/`parse` χωρίς μεταφραστή, και ο `AssertJsonSafe<TableEntity>` του
 * `json-safe-entity.ts` το επιβάλλει σε χρόνο μεταγλώττισης. Στο **DXF** δεν ταξιδεύει
 * καθόλου: η Φ.Γ αποδομεί τον πίνακα σε primitives (`export/core/table-to-primitives.ts`),
 * οπότε ο δεσμός είναι εξ ορισμού εκτός παραδοτέου — ακριβώς όπως το θέλει το Δ4.
 *
 * @module subapps/dxf-viewer/types/table-source-ref
 * @see bim/table/binding/table-source-resolver.ts — το ΕΞΑΝΤΛΗΤΙΚΟ μητρώο
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ7
 */

import type { ScheduleEntityType, ScheduleFilterCriteria } from '../bim/schedule/types';

/**
 * Ο πίνακας συντεταγμένων ΕΓΣΑ'87 — **η πρώτη και μοναδική συνδεδεμένη πηγή** (Δ7).
 *
 * Χωρίς παραμέτρους επίτηδες: ο παραγωγός (`buildCoordinateTable`) παίρνει *όλα* τα σημεία
 * της αποτύπωσης, και «όλα» δεν είναι επιλογή που χρειάζεται να αποθηκευτεί. Ένα φίλτρο εδώ
 * θα ήταν πεδίο χωρίς καταναλωτή.
 */
export interface TableSourceSurveyCoordinates {
  readonly kind: 'survey-coordinates';
}

/** Το «διάγραμμα εμβαδομέτρησης» — κορυφές οικοπέδου με πλευρές και μήκη. */
export interface TableSourceSurveyPlotBoundary {
  readonly kind: 'survey-plot-boundary';
}

/** Χωματουργικά: όγκοι εκσκαφής/επίχωσης του M6. */
export interface TableSourceSurveyVolumes {
  readonly kind: 'survey-volumes';
}

/** Ο έλεγχος ανοχών απέναντι στις δηλωμένες τιμές του τίτλου. */
export interface TableSourceSurveyTolerance {
  readonly kind: 'survey-tolerance';
}

/**
 * Πίνακας ποσοτήτων BIM — ο **μόνος** κλάδος με παραμέτρους, και γι' αυτό ο λόγος που η ένωση
 * σχεδιάζεται ολόκληρη σήμερα.
 *
 * Τα φίλτρα είναι το ΥΠΑΡΧΟΝ {@link ScheduleFilterCriteria} (ADR-363, πέντε συνθετοί άξονες με
 * λογικό ΚΑΙ), όχι δική τους γλώσσα ερωτημάτων — ίδια αρχή με το `TableRowLinkQuery`.
 */
export interface TableSourceBimSchedule {
  readonly kind: 'bim-schedule';
  readonly entityType: ScheduleEntityType;
  /** Απόν ⇒ κανένας περιορισμός. Το ίδιο νόημα που έχει ήδη κάθε άξονας του κριτηρίου. */
  readonly filters?: ScheduleFilterCriteria;
}

/** Τι παράγει τα δεδομένα ενός δεμένου πίνακα. */
export type TableSourceRef =
  | TableSourceSurveyCoordinates
  | TableSourceSurveyPlotBoundary
  | TableSourceSurveyVolumes
  | TableSourceSurveyTolerance
  | TableSourceBimSchedule;

/** Ο διακριτής της ένωσης — το κλειδί του εξαντλητικού μητρώου resolvers. */
export type TableSourceKind = TableSourceRef['kind'];
