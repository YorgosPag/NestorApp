/**
 * ADR-651 Φάση Μ — **AI generator (server-only)** για το σετ φύλλων από πρόθεση (§8 #4).
 *
 * ΔΕΝ φτιάχνει δεύτερο AI stack: επαναχρησιμοποιεί αυτούσιο το **generic** κέλυφος της Φάσης Δ
 * (`runTitleBlockAi` — provider SSoT + `generateObject` + usage tracking + graceful null). Εδώ ζει
 * ΜΟΝΟ το σχήμα (`aiSheetSetPlanSchema`) + το system prompt που περιγράφει στο μοντέλο τους
 * **υπάρχοντες** ορόφους και του ζητά να διαλέξει ποιοι μπαίνουν στο σετ.
 *
 * Graceful: κάθε αποτυχία (χωρίς κλειδί, δίκτυο, LLM) ⇒ `null` — ο καλών δεν αλλάζει επιλογή, ο
 * χρήστης συνεχίζει χειροκίνητα (N.7.2 #4). Το usage καταγράφεται στο ίδιο κανάλι
 * (`AI_TITLE_BLOCK_USAGE_CHANNEL`) — μηδέν νέο tracking.
 */

import 'server-only';

import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { runTitleBlockAi } from './ai-title-block-generator';
import { aiSheetSetPlanSchema, type AiSheetSetPlan } from './ai-sheet-set-schema';
import type { SheetSetPlanLevel } from './ai-sheet-set-reconcile';
import type { TitleBlockLocale } from '../title-block-presets';

/** Λογικό όριο ορόφων στο prompt (φραγή context· ένα έργο δεν έχει εκατοντάδες ορόφους-φύλλα). */
const MAX_LEVELS = 200;

/** Μία γραμμή ορόφου για το prompt: «id — όνομα (ετικέτα)», ώστε το AI να επιστρέφει σωστά ids. */
function levelLine(level: SheetSetPlanLevel): string {
  const label = level.label.trim();
  const suffix = label && label !== level.name ? ` (${label})` : '';
  return `- ${level.id} — ${level.name}${suffix}`;
}

/** System prompt: ο ρόλος «sheet-set planner» + η λίστα υπαρχόντων ορόφων + οι κανόνες επιλογής. */
function buildSystemPrompt(levels: readonly SheetSetPlanLevel[], locale: TitleBlockLocale): string {
  const lang = locale === 'el' ? 'Greek (Ελληνικά)' : 'English';
  const list = levels.slice(0, MAX_LEVELS).map(levelLine).join('\n');
  return `You plan a drawing SHEET SET for a Greek building project, like Revit's "Sheet Set from
Views" or ArchiCAD's Layout Book. Each existing building level (floor) is one printable floor-plan
sheet. You do NOT invent geometry, sections or elevations — you only SELECT and ORGANISE existing
floor-plan sheets that best match the user's intent.

EXISTING LEVELS (id — name), one sheet each:
${list}

RULES:
- Return "selectedLevelIds": ONLY ids copied verbatim from the list above. Never invent an id.
  Any id not in the list is dropped. Include every level the intent implies (e.g. "all floors" =
  all ids; "except basement" = all but the basement level).
- Do NOT reorder — the printing order follows the level order, not your order.
- "numberingPrefix": set it ONLY if the intent explicitly states a prefix (e.g. "Α-1" → "Α",
  "A-1" → "A"); otherwise null (the app applies the locale default).
- "startNumber": set it ONLY if the intent states a starting number (e.g. "from 5" → 5);
  otherwise null (defaults to 1).
- Write "notes" in ${lang}: one short sentence on what you selected and any assumption.
- Set "confidence" honestly (low when the intent is vague about which floors).`;
}

/** Το user instruction: η ακατέργαστη πρόθεση του χρήστη. */
const INTENT_INSTRUCTION = (intent: string): string =>
  `Plan the sheet set for this request: "${intent}". Select the matching level ids from the list.`;

/**
 * Φυσική γλώσσα + υπάρχοντες όροφοι → **raw** AI σχέδιο σετ (πριν το reconcile). Επαναχρησιμοποιεί
 * το generic `runTitleBlockAi`: μηδέν δεύτερο try/catch, μηδέν δεύτερο usage tracking/provider.
 */
export function generateSheetSetPlan(args: {
  readonly userId: string;
  readonly intent: string;
  readonly levels: readonly SheetSetPlanLevel[];
  readonly locale: TitleBlockLocale;
}): Promise<AiSheetSetPlan | null> {
  return runTitleBlockAi({
    userId: args.userId,
    model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
    system: buildSystemPrompt(args.levels, args.locale),
    schema: aiSheetSetPlanSchema,
    input: { prompt: INTENT_INSTRUCTION(args.intent) },
  });
}
