/**
 * @fileoverview Η έξοδος του Λ1 (ADR-745 §6.1) — **επανεξαγωγή** του προαγμένου συμβολαίου.
 *
 * Οι τύποι **ζούσαν εδώ** μέχρι τη Φ3β. Προήχθησαν στο `@/types/title-block-reading` γιατί τους
 * χρειάζεται ο Λ2, που ζει **έξω** από το subapp (το SSoT ταιριάσματος επαφών είναι
 * `'server-only'` + Admin SDK): το `src/subapps/dxf-viewer/**` εξαιρείται από το root
 * `tsconfig.json`, άρα ένα συμβόλαιο ορισμένο εδώ και διαβασμένο εκεί θα ήταν **τυφλό στον
 * έλεγχο τύπων**. Ίδιος λόγος και ίδιο πρότυπο με τη Φ2 (`title-block-vocabulary.ts`).
 *
 * Επανεξάγονται αυτούσια ώστε οι καταναλωτές του αναγνώστη να μη γνωρίζουν τη μετακόμιση.
 *
 * @see ADR-745 §6.4 — προαγωγή SSoT αντί τυφλής εισαγωγής
 */

export type {
  TitleBlockField,
  TitleBlockMatchKind,
  TitleBlockPerson,
  TitleBlockReading,
  TitleBlockSourceCell,
  TitleBlockUnmatchedLabel,
} from '@/types/title-block-reading';
