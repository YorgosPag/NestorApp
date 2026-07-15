/**
 * ADR-651 Φάση Μ — **AI structured-output schema (SSoT)** για τη δημιουργία **σετ φύλλων από
 * πρόθεση** (§8 #4). Το μοντέλο ΔΕΝ φτιάχνει φύλλα και ΔΕΝ αριθμεί: ερμηνεύει μια φυσική-γλώσσα
 * πρόθεση («σετ αδείας — όλοι οι όροφοι εκτός υπογείου, αρίθμηση από Α-1») και επιστρέφει **ποιοι
 * υπάρχοντες όροφοι** μπαίνουν στο σετ + (προαιρετικά) υπόδειξη αρίθμησης.
 *
 * Ίδιο μοτίβο με το `ai-title-block-schema.ts` (Φάση Δ): Zod schema → `generateObject` →
 * `ai-sheet-set-reconcile.ts` (validate/strip). Το AI **δεν εφευρίσκει γεωμετρία** — μόνο
 * **επιλέγει & οργανώνει** υπάρχουσες κατόψεις ορόφων (πρακτική Revit «sheet set from views»).
 *
 * Strict-mode σύμβαση (OpenAI structured outputs): όλα τα πεδία υποχρεωτικά· τα προαιρετικά
 * δηλώνονται `.nullable()` (ποτέ `.optional()`/`.default()` — δεν χαρτογραφούνται καθαρά σε
 * strict json_schema). Ο **ντετερμινισμός** της αρίθμησης ζει στο `sheet-numbering.ts`, όχι εδώ:
 * το AI δίνει μόνο πρόθεση (πρόθεμα/αρχικός αριθμός), τους αριθμούς τους παράγει το reconcile.
 */

import { z } from 'zod';

/**
 * Το structured output του μοντέλου για ένα σετ φύλλων.
 *
 * ⚠️ `selectedLevelIds`: το μοντέλο επιστρέφει **μόνο** ids από τη λίστα ορόφων που του δόθηκε.
 * Το `ai-sheet-set-reconcile.ts` πετά ό,τι δεν ανήκει στους πραγματικούς ορόφους (anti-hallucination),
 * ακριβώς όπως το `reconcileAiTitleBlock` πετά άγνωστα placeholder paths.
 */
export const aiSheetSetPlanSchema = z.object({
  /** Τα ids των ορόφων (από τη δοθείσα λίστα) που ταιριάζουν στην πρόθεση — άγνωστα πέφτουν. */
  selectedLevelIds: z.array(z.string()),
  /**
   * Υπόδειξη προθέματος αρίθμησης αν η πρόθεση το αναφέρει ρητά (π.χ. «Α» για «Α-1»), αλλιώς
   * `null` ⇒ το reconcile βάζει το πρόθεμα της γλώσσας (`sheetNumberPrefixForLocale`).
   */
  numberingPrefix: z.string().nullable(),
  /** Αρχικός αριθμός αν η πρόθεση τον αναφέρει (π.χ. «από το 5»), αλλιώς `null` ⇒ 1. */
  startNumber: z.number().nullable(),
  /** Βεβαιότητα ερμηνείας 0–1 (χαμηλή ⇒ ο χρήστης να ελέγξει προσεκτικά την επιλογή). */
  confidence: z.number().min(0).max(1),
  /** Σύντομη σημείωση του μοντέλου (τι κατάλαβε / τι υπέθεσε) — για το UI. */
  notes: z.string(),
});

export type AiSheetSetPlan = z.infer<typeof aiSheetSetPlanSchema>;
