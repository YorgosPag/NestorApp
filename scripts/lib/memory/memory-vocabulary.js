#!/usr/bin/env node
/**
 * memory-vocabulary.js — ΤΟ ΛΕΞΙΛΟΓΙΟ: τι είναι διαχρονικό, τι λήγει.
 *
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ MODULE (SSoT): ζούσε μέσα στο `memory-distill.js`, δηλαδή ήταν
 * ορατό **μόνο** σε όποιον έτρεχε ρητά distill σε συγκεκριμένο αρχείο. Η μέτρηση
 * υγείας δεν το έβλεπε ποτέ → το επεισοδιακό χρέος ήταν **αόρατο**: 69 αρχεία
 * 4-10 KB γεμάτα «UNCOMMITTED / Slice 6b DONE / 34 jest» και κανένα όργανο δεν
 * τα μετρούσε. Ίδιο σχήμα με το «0 = κανείς δεν κοίταξε» (CLAUDE.md N.11/N.12).
 *
 * ΤΕΚΜΗΡΙΩΣΗ (βιβλιογραφία 2026):
 *  • Rate-distortion για μνήμη πράκτορα (arXiv 2605.10870) — «remember the DECISION,
 *    not the description»: κράτα ό,τι αλλάζει επιλογή δράσης, πέτα την αφήγηση.
 *  • AtomMem (arXiv 2606.19847) — atomicity = «κατανοητό ΧΩΡΙΣ εξωτερικό context».
 *    Το AtomMem-Flat κερδίζει **+76.6%** σε multi-hop με **ΛΙΓΟΤΕΡΑ** tokens
 *    (722K vs 827K): η συμπαγής ατομική μορφή νικά τη λεπτομερή διατήρηση.
 *  • Consolidation ≠ compaction (Hindsight/Vectorize) — το «summarize-then-drop»
 *    χάνει λεπτομέρεια οντοτήτων. Εμείς ΔΕΝ συμπυκνώνουμε: μετακινούμε το
 *    επεισοδιακό στο `archive/` (tier 2) και κρατάμε τον κανόνα. Τίποτα δεν χάνεται.
 *
 * ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ ΤΟ ΛΕΞΙΛΟΓΙΟ. Είναι ανιχνευτής: δείχνει πού να κοιτάξεις.
 * Την κρίση «τι είναι ο πυρήνας» τη βάζει άνθρωπος ή πράκτορας.
 */

'use strict';

/** Δείκτες διαχρονικότητας — το λεξιλόγιο με το οποίο γράφεται ένας κανόνας. */
const TIMELESS = [
  'ΜΑΘΗΜΑ', 'ΡΙΖΑ', 'ROOT CAUSE', 'ΕΥΡΗΜΑ', 'ΚΛΕΙΔΙ', 'ΠΑΓΙΔΑ', 'ΚΡΙΣΙΜΟ',
  'ΠΡΟΣΟΧΗ', 'ΑΠΟΦΑΣΗ', 'ΑΠΟΦΑΣΕΙΣ', 'LOCKED', 'SSoT', 'SSOT', 'ΚΑΝΟΝΑΣ',
  'ΠΟΤΕ', 'ΠΑΝΤΑ', 'ΜΗΝ ', 'ΑΠΑΓΟΡΕΥ', 'canonical', 'CANONICAL', 'ΔΙΟΡΘΩΣΗ',
  'ΓΙΑΤΙ', 'WHY', 'ΥΠΑΡΧΕΙ ΗΔΗ', 'ΘΥΜΗΣΟΥ', 'ΣΗΜΕΙΩΣΗ', 'ΠΡΕΠΕΙ',
];

/** Δείκτες κατάστασης εργασίας — λήγουν. Κερδίζουν μόνο αν ΔΕΝ υπάρχει δείκτης πάνω. */
const EPISODIC = [
  'DONE', 'browser-verify', 'browser verify', 'commit', 'UNCOMMITTED', 'jest',
  'pending', 'DEFER', 'DEPLOYED', 'tsc καθαρό', 'regression', 'Slice',
];

/**
 * Σημάδια ΗΜΕΡΟΛΟΓΙΟΥ — ισχυρότερα από μεμονωμένη λέξη: δηλώνουν ότι το αρχείο
 * αφηγείται πορεία αντί να δηλώνει κανόνα. Ένα «Φ2 FOLLOW-UP (UNCOMMITTED
 * 2026-06-22, 88 jest GREEN)» είναι στιγμιότυπο — και **ήδη μπαγιάτικο** τη στιγμή
 * που γράφεται. Ο κανόνας 3 του συμβολαίου το στέλνει ήδη σε ADR + git· απλώς
 * κανείς δεν το μετρούσε.
 */
const JOURNAL_MARKERS = [
  /\bUNCOMMITTED\b/,
  /\bΦ\d+\s|\bΦάση\s*\d+/,
  /\bSlice\s*\d+/,
  /\d+\s*jest\b|\bjest\s+GREEN\b/i,
  /\bchangelog\b/i,
  /\bDONE\b\s*\d{4}-\d{2}-\d{2}/,
];

const hasAny = (text, words) => words.some((w) => text.includes(w));

/**
 * Ποσοστό επεισοδιακών προτάσεων + πόσα σημάδια ημερολογίου.
 * Το ποσοστό μόνο του δεν αρκεί: ένα σύντομο memory με μία «commit» αναφορά δεν
 * είναι ημερολόγιο. Γι' αυτό το χρέος απαιτεί **ΚΑΙ** μέγεθος **ΚΑΙ** σημάδια.
 */
function scoreEpisodic(body) {
  const sentences = body
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.·;])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  if (sentences.length === 0) return { ratio: 0, episodic: 0, total: 0, markers: 0 };
  const episodic = sentences.filter(
    (s) => hasAny(s, EPISODIC) && !hasAny(s, TIMELESS),
  ).length;
  const markers = JOURNAL_MARKERS.filter((re) => re.test(body)).length;
  return {
    ratio: episodic / sentences.length,
    episodic,
    total: sentences.length,
    markers,
  };
}

/**
 * ΤΟ ΚΑΤΩΦΛΙ ΧΡΕΟΥΣ — γιατί αυτοί οι τρεις όροι μαζί:
 *  • bytes > 4096  : ο κανόνας 3 λέει «<1.5 KB, πάνω από 4 KB δεν είναι γεγονός,
 *                    είναι δοκίμιο». Κάτω από αυτό δεν αξίζει παρέμβαση.
 *  • markers ≥ 2   : ΔΥΟ ανεξάρτητα σημάδια ημερολογίου. Ένα μόνο του είναι θόρυβος
 *                    (κάθε memory μπορεί να αναφέρει ένα commit).
 * Δύο ανεξάρτητα κριτήρια αντί για ένα ευαίσθητο: κρατά τα false positives χαμηλά,
 * που είναι ο μόνος τρόπος να μη γίνει το ratchet διακοσμητικό.
 */
const DEBT_MIN_BYTES = 4096;
const DEBT_MIN_MARKERS = 2;

/**
 * Δύο αρχεία που ο ανιχνευτής ΠΡΕΠΕΙ να αγνοεί, αλλιώς μετρά τον εαυτό του:
 *  • το συμβόλαιο — **μιλά για** commits/jest/changelog ως τεκμηρίωση των gates.
 *    Αναφορά σε λέξη ≠ χρήση της λέξης· χωρίς την εξαίρεση, κάθε βελτίωση της
 *    τεκμηρίωσης θα μεγάλωνε το «χρέος» της.
 *  • ο δείκτης WIP — είναι **εξ ορισμού** ημερολόγιο, by design (κανόνας 3: WIP →
 *    HANDOFFS/, και αυτό είναι ο δείκτης προς τα εκεί). Να τον κυνηγά το gate
 *    σημαίνει να ζητά να πάψει να κάνει τη δουλειά του.
 */
const DEBT_EXEMPT = new Set([
  'reference_memory_health_contract',
  'project_active_handoff_state',
]);

const isEpisodicDebt = (bytes, score, slug) =>
  bytes > DEBT_MIN_BYTES && score.markers >= DEBT_MIN_MARKERS && !DEBT_EXEMPT.has(slug);

module.exports = {
  TIMELESS,
  EPISODIC,
  JOURNAL_MARKERS,
  hasAny,
  scoreEpisodic,
  isEpisodicDebt,
  DEBT_MIN_BYTES,
  DEBT_MIN_MARKERS,
};
