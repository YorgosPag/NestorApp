/**
 * ADR-651 Φάση Δ — **AI structured-output schema (SSoT)** για τη δημιουργία πινακίδας.
 *
 * Το vision/NL μοντέλο ΔΕΝ ζωγραφίζει και ΔΕΝ γράφει ελεύθερο κείμενο: γεμίζει αυτό το
 * **δομημένο σχήμα** (πεδία/γραμμές + αντιστοίχιση σε γνωστό placeholder path). Μετά το
 * `ai-title-block-reconcile.ts` το μετατρέπει σε έγκυρο `TextTemplate` (Απόφαση #5:
 * «ίδια διάταξη, αλλά καθαρή» — vector, όχι raster). Ίδιο μοτίβο με το `ai-query-translator`
 * (ADR-268): Zod schema → `generateObject` → validate/strip → domain object.
 *
 * ⚠️ Το AI **δεν** ορίζει γεωμετρία (κορνίζα/θέση/μέγεθος) — αυτά τα κατέχει το
 * `sheet-frame.ts` (ISO 5457) και το ενεργό preset· εδώ ζει ΜΟΝΟ το **περιεχόμενο**
 * (ποια πεδία, με ποια σειρά, δεμένα σε ποιο δεδομένο).
 *
 * Strict-mode σύμβαση (OpenAI structured outputs): όλα τα πεδία υποχρεωτικά· τα
 * προαιρετικά δηλώνονται `.nullable()` (ποτέ `.optional()`/`.default()` — δεν χαρτογραφούνται
 * καθαρά σε strict json_schema).
 */

import { z } from 'zod';

/** Έμφαση γραμμής → run style στο reconcile (`DEFAULT_RUN_STYLE` / `CAPTION_RUN_STYLE`). */
export const AI_TITLE_BLOCK_EMPHASIS = ['default', 'caption'] as const;

/** Μία γραμμή πεδίου της πινακίδας (π.χ. «Έργο: {{project.name}}»). */
const aiTitleBlockRowSchema = z.object({
  /** Η σταθερή ετικέτα (π.χ. «Έργο», «Α.Μ. ΤΕΕ») — ΧΩΡΙΣ την άνω-κάτω τελεία (την προσθέτει το reconcile). */
  label: z.string(),
  /**
   * Αντιστοίχιση σε γνωστό `PLACEHOLDER_REGISTRY` path (π.χ. `project.name`) ή `null` όταν
   * το πεδίο δεν αντιστοιχεί σε ζωντανό δεδομένο. Το reconcile πετά όσα δεν είναι γνωστά
   * (anti-hallucination) — ακριβώς όπως το `validateTranslatedQuery` του ADR-268.
   */
  placeholderPath: z.string().nullable(),
  /** Σταθερή τιμή όταν δεν υπάρχει placeholder (σπάνιο — π.χ. σταθερός τίτλος υπηρεσίας). */
  literalValue: z.string().nullable(),
  emphasis: z.enum(AI_TITLE_BLOCK_EMPHASIS),
});

export type AiTitleBlockRow = z.infer<typeof aiTitleBlockRowSchema>;

/**
 * Το πλήρες structured output του μοντέλου για μία πινακίδα.
 */
export const aiTitleBlockSchema = z.object({
  /** Γλώσσα ΠΕΡΙΕΧΟΜΕΝΟΥ πινακίδας (Απόφαση #8: ελληνικά default, κουμπί → αγγλικά). */
  locale: z.enum(['el', 'en']),
  /** Η επικεφαλίδα (επωνυμία γραφείου) — δεμένη σε placeholder ή σταθερό κείμενο, ή τίποτα. */
  heading: z.object({
    placeholderPath: z.string().nullable(),
    literalText: z.string().nullable(),
  }),
  /** Οι γραμμές πεδίων, με τη σειρά που τις «είδε» το AI (κρατά τη διάταξη). */
  rows: z.array(aiTitleBlockRowSchema),
  /** Έχει η πινακίδα κελί σφραγίδας/υπογραφής; (permit πρακτική — Απόφαση #6γ.) */
  withStampBox: z.boolean(),
  /** Βεβαιότητα ερμηνείας 0–1 (χαμηλή ⇒ ο χρήστης να ελέγξει προσεκτικά). */
  confidence: z.number().min(0).max(1),
  /** Σύντομη σημείωση του μοντέλου (τι κατάλαβε / τι υπέθεσε) — για το UI. */
  notes: z.string(),
});

export type AiTitleBlock = z.infer<typeof aiTitleBlockSchema>;

/** Σοβαρότητα AI compliance ευρήματος (προειδοποίηση, ΠΟΤΕ φραγή — Απόφαση #4). */
export const AI_COMPLIANCE_SEVERITY = ['info', 'warning'] as const;

/**
 * ADR-651 Φάση Δ (§8 #5) — AI **semantic** compliance schema. Επεκτείνει τον rule-based
 * έλεγχο της Φάσης Ε (πεδίο υπάρχει/κενό) με σημασιολογικά ευρήματα (π.χ. «η κλίμακα 1:500
 * δεν ταιριάζει σε κάτοψη άδειας», «λείπει ειδικότητα μελετητή για κατάθεση»).
 */
export const aiComplianceSchema = z.object({
  warnings: z.array(
    z.object({
      severity: z.enum(AI_COMPLIANCE_SEVERITY),
      /** Ανθρωπο-αναγνώσιμο μήνυμα στη ΓΛΩΣΣΑ της πινακίδας (το UI το δείχνει ως έχει). */
      message: z.string(),
      /** Σχετικό placeholder path αν υπάρχει (π.χ. `drawing.scale`), αλλιώς `null`. */
      relatedPath: z.string().nullable(),
    }),
  ),
});

export type AiComplianceResult = z.infer<typeof aiComplianceSchema>;
export type AiComplianceWarning = AiComplianceResult['warnings'][number];
