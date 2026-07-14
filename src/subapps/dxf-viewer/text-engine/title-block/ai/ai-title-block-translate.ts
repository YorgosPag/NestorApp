/**
 * ADR-651 Φάση Κ (§8 #7) — **AI μετάφραση ετικετών** πινακίδας (server-only).
 *
 * ## Δεύτερη γραμμή άμυνας, ποτέ πρώτη
 *
 * Πρώτα μιλά το **ντετερμινιστικό λεξικό** (`localization/title-block-glossary.ts`, παραγμένο
 * από τα δίγλωσσα presets): δωρεάν, ακαριαίο, ίδιο αποτέλεσμα κάθε φορά. Εδώ φτάνουν **μόνο**
 * οι όροι που το λεξικό δεν ξέρει — τυπικά ετικέτες που έγραψε ο ίδιος ο μηχανικός σε
 * αποθηκευμένο ή AI πρότυπο («ΑΡΜΟΔΙΑ ΥΠΗΡΕΣΙΑ», «ΘΕΩΡΗΘΗΚΕ»).
 *
 * ## Ποτέ σιωπηλή μετάφραση
 *
 * Το αποτέλεσμα **δεν γράφεται πουθενά**: επιστρέφεται στον διάλογο, σημασμένο ως AI, και ο
 * χρήστης το εγκρίνει ή το διορθώνει (ίδιο μοτίβο με το AI changelog της Φάσης Η). Μια πινακίδα
 * κατατίθεται σε πολεοδομία — μηχανική μετάφραση χωρίς ανθρώπινο μάτι δεν επιτρέπεται.
 *
 * Μηδέν νέα υποδομή: ξαναχρησιμοποιεί το `runTitleBlockAi` της Φάσης Δ (provider SSoT +
 * `generateObject` + usage tracking + graceful `null`).
 */

import 'server-only';

import { z } from 'zod';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { runTitleBlockAi, type AiTitleBlockLocale } from './ai-title-block-generator';

/** Πόσους άγνωστους όρους δεχόμαστε σε μία κλήση (φραγή κακόβουλου payload). */
export const MAX_AI_TRANSLATE_TERMS = 40;

/** Μέγιστο μήκος ενός όρου — μια ετικέτα πινακίδας, όχι παράγραφος. */
export const MAX_AI_TERM_CHARS = 120;

export const aiTermTranslationSchema = z.object({
  translations: z
    .array(
      z.object({
        term: z.string().describe('The source label EXACTLY as it was given.'),
        translation: z.string().describe('The translated label, without a trailing colon.'),
      }),
    )
    .describe('One entry per requested term, in the same order.'),
});

export type AiTermTranslations = z.infer<typeof aiTermTranslationSchema>;

function buildSystemPrompt(from: AiTitleBlockLocale, to: AiTitleBlockLocale): string {
  const source = from === 'el' ? 'Greek (Ελληνικά)' : 'English';
  const target = to === 'el' ? 'Greek (Ελληνικά)' : 'English';
  return `You translate LABELS of an architectural drawing title block (πινακίδα σχεδίου) used on
Greek building-permit drawings (ΤΕΕ / πολεοδομία), from ${source} to ${target}.

These are short field captions, not prose. Use the ESTABLISHED technical term of the construction
industry (ISO 7200 / ΤΕΕ practice), not a literal word-for-word translation. Examples of the
register expected: "Έργο" → "Project", "Κλίμακα" → "Scale", "Α.Μ. ΤΕΕ" → "Licence No",
"Θεωρήθηκε" → "Approved", "Αρμόδια Υπηρεσία" → "Authority Having Jurisdiction".

RULES:
- Return EXACTLY one entry per requested term, echoing "term" verbatim so the caller can match it.
- Do NOT add or remove a trailing colon — return only the caption itself.
- Keep abbreviations that are proper nouns or registry codes (e.g. "ΤΕΕ", "ΑΜ") recognisable.
- If a term is a person/place/company name or already in ${target}, return it unchanged.
- Never invent extra fields. Never return prose or explanations.`;
}

/**
 * Άγνωστοι όροι → προτεινόμενες μεταφράσεις. Αποτυχία (χωρίς κλειδί, δίκτυο, LLM) ⇒ κενός
 * χάρτης: ο διάλογος δείχνει τους όρους **αμετάφραστους** και ο χρήστης τους γράφει μόνος του —
 * η μεταγλώττιση δεν μπλοκάρει ΠΟΤΕ από το AI (N.7.2 #4).
 */
export async function translateTitleBlockTerms(args: {
  readonly userId: string;
  readonly terms: readonly string[];
  readonly from: AiTitleBlockLocale;
  readonly to: AiTitleBlockLocale;
}): Promise<Readonly<Record<string, string>>> {
  const terms = args.terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0 && term.length <= MAX_AI_TERM_CHARS)
    .slice(0, MAX_AI_TRANSLATE_TERMS);

  if (terms.length === 0 || args.from === args.to) return {};

  const result = await runTitleBlockAi({
    userId: args.userId,
    model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
    system: buildSystemPrompt(args.from, args.to),
    schema: aiTermTranslationSchema,
    input: { prompt: `Translate these title-block labels:\n${terms.map((t) => `- ${t}`).join('\n')}` },
  });

  if (!result) return {};

  const requested = new Set(terms);
  const translations: Record<string, string> = {};
  for (const entry of result.translations) {
    // Το μοντέλο δεν δικαιούται να εφεύρει όρους που δεν ζητήθηκαν (ούτε να τους σβήσει).
    if (requested.has(entry.term) && entry.translation.trim()) {
      translations[entry.term] = entry.translation.trim();
    }
  }
  return translations;
}
