/**
 * ADR-651 Φάση Η — **AI auto-changelog (server-only)**: «τι άλλαξε από την προηγούμενη έκδοση».
 *
 * Το διαφοροποιό χαρακτηριστικό του ADR (§8 #6): **κανένας ανταγωνιστής δεν το κάνει** — Revit/
 * Vectorworks/ArchiCAD κρατούν τον πίνακα αναθεωρήσεων, αλλά την περιγραφή τη γράφει πάντα ο
 * μηχανικός στο χέρι.
 *
 * Καταμερισμός εργασίας (το κλειδί της ακρίβειας):
 *  - **ο κώδικας** μετράει (`revision-diff.ts` — ντετερμινιστικά, ακριβώς),
 *  - **το AI** διατυπώνει (μόνο γλώσσα).
 * Έτσι δεν υπάρχει «το LLM μέτρησε λάθος τους τοίχους».
 *
 * Ίδιο μοτίβο με τη Φάση Δ (`ai-title-block-generator.ts`): `getOpenAIProvider()` (ADR-294
 * ratchet — ο ΜΟΝΟΣ ενεργός provider SSoT· ο `agentic-openai-client` είναι LEGACY/DISABLED) +
 * `generateObject` (Vercel AI SDK) + Zod + `recordUsage` (ADR-259A, ίδιο κανάλι
 * `dxf-title-block-ai`). **Καμία** τροποποίηση στο `src/services/ai-pipeline/` (N.10 δεν
 * ενεργοποιείται — μόνο κατανάλωση).
 *
 * **Graceful** (Απόφαση #9 / N.7.2 #4): κάθε αποτυχία ⇒ `null` ⇒ ο μηχανικός γράφει μόνος του
 * την περιγραφή. Η αναθεώρηση **ποτέ** δεν μπλοκάρεται επειδή το AI δεν απάντησε.
 */

import 'server-only';

import { generateObject } from 'ai';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { recordUsage } from '@/services/ai-pipeline/ai-usage.service';
import type { RevisionDiff, RevisionSheetChange } from '../revisions/revision.types';
import { AI_TITLE_BLOCK_USAGE_CHANNEL } from './ai-title-block-generator';
import { aiRevisionChangelogSchema, type AiRevisionChangelog } from './ai-revision-changelog-schema';

const logger = createModuleLogger('AiRevisionChangelog');

export type RevisionChangelogLocale = 'el' | 'en';

/** `{ wall: 3, door: 1 }` → `wall×3, door×1` (κενό ⇒ `—`). */
function formatCounts(counts: Readonly<Record<string, number>>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '—';
  return entries.map(([type, count]) => `${type}×${count}`).join(', ');
}

/** Ένα φύλλο του diff σε συμπαγή, μονοσήμαντη γραμμή για το prompt. */
function formatSheet(sheet: RevisionSheetChange): string {
  const flags = [sheet.isNew ? 'NEW SHEET' : null, sheet.coarse ? 'COARSE (in-place edits invisible)' : null]
    .filter(Boolean)
    .join(', ');
  return [
    `- Sheet "${sheet.title}"${flags ? ` [${flags}]` : ''}`,
    `    added:    ${formatCounts(sheet.added)}`,
    `    removed:  ${formatCounts(sheet.removed)}`,
    `    modified: ${formatCounts(sheet.modified)}`,
  ].join('\n');
}

/** Ο diff ως κείμενο — η ΜΟΝΗ πηγή αλήθειας που βλέπει το μοντέλο. */
export function formatDiffForPrompt(diff: RevisionDiff): string {
  if (diff.baseline) return 'BASELINE: this is the first recorded revision — there is no previous version.';

  const changed = diff.sheets.filter((sheet) => sheet.changed);
  const lines = changed.map(formatSheet);
  if (diff.removedSheets.length > 0) {
    lines.push(`- Sheets removed from the set: ${diff.removedSheets.join(', ')}`);
  }
  return lines.length > 0 ? lines.join('\n') : 'No differences detected between the two versions.';
}

function buildSystemPrompt(locale: RevisionChangelogLocale): string {
  const lang = locale === 'el' ? 'Greek (Ελληνικά)' : 'English';
  return `You write the revision description (περιγραφή αναθεώρησης) that goes into the revision
table of an architectural drawing set for a Greek building permit.

You are given a PRE-COMPUTED, EXACT diff between the previous issued revision and the current
state of the drawings. The counts are already correct — NEVER recount, NEVER invent, NEVER
extrapolate beyond what the diff states.

Write in ${lang}, in the professional register of a Greek engineer's revision table:
- "description": 1-2 sentences summarising WHAT CHANGED across the set. Concrete and factual
  (e.g. "Τροποποίηση κάτοψης ισογείου: προσθήκη 3 τοίχων και κατάργηση ενός ανοίγματος.").
- "highlights": one short line per affected sheet, naming the sheet.
- Entity type names are internal codes (wall, door, hatch, dimension…). Translate them to the
  professional term in ${lang} (τοίχος, πόρτα, διαγράμμιση, διαστασιολόγηση…).
- If a sheet is flagged COARSE, the diff could not see in-place edits: say so in "notes" and keep
  the description cautious ("ενδέχεται να υπάρχουν και επιμέρους τροποποιήσεις").
- If the diff is BASELINE, describe it as the initial issue (π.χ. "Αρχική έκδοση για κατάθεση.").
- If no differences are detected, say so plainly — do NOT fabricate changes.

Set "confidence" honestly. The engineer reviews and edits this text before it is recorded.`;
}

interface UsageLike {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/** Usage tracking στον υπάρχοντα SSoT (ADR-259A) — αποτυχία δεν σπάει τη ροή. */
async function trackUsage(userId: string, usage: UsageLike | undefined): Promise<void> {
  const prompt = usage?.inputTokens ?? 0;
  const completion = usage?.outputTokens ?? 0;
  await recordUsage(userId, AI_TITLE_BLOCK_USAGE_CHANNEL, {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: usage?.totalTokens ?? prompt + completion,
  });
}

/**
 * Diff → **πρόταση** περιγραφής αναθεώρησης. Ποτέ δεν γράφει στη βάση: επιστρέφει κείμενο που
 * ο χρήστης εγκρίνει/διορθώνει στον διάλογο.
 */
export async function suggestRevisionChangelog(args: {
  readonly userId: string;
  readonly diff: RevisionDiff;
  readonly locale: RevisionChangelogLocale;
}): Promise<AiRevisionChangelog | null> {
  try {
    const provider = getOpenAIProvider();
    const result = await generateObject({
      model: provider(AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL),
      schema: aiRevisionChangelogSchema,
      system: buildSystemPrompt(args.locale),
      prompt: `Diff between the previous issued revision and the current drawings:\n\n${formatDiffForPrompt(args.diff)}`,
      maxRetries: 2,
    });

    await trackUsage(args.userId, result.usage);
    return result.object;
  } catch (err) {
    logger.warn('AI revision changelog failed — falling back to manual description', {
      userId: args.userId,
      err,
    });
    return null;
  }
}
