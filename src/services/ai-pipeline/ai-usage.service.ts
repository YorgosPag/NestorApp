/**
 * =============================================================================
 * AI USAGE SERVICE — ADR-259A: Token Tracking + Daily Cap + Cost Protection
 * =============================================================================
 *
 * Tracks OpenAI token usage per user per month, enforces daily message caps
 * for customers, and calculates estimated costs.
 *
 * Firestore document structure:
 *   ai_usage/{aiu_channel_userId_YYYY-MM}
 *   One document per user per channel per month — atomic updates via FieldValue.increment()
 *
 * @module services/ai-pipeline/ai-usage
 * @see ADR-259A (OpenAI Usage Tracking + Cost Protection)
 */

import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { AI_COST_CONFIG, tokenCostUsd } from '@/config/ai-analysis-config';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { OpenAIUsage } from './agentic-loop';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('AI_USAGE');

// ============================================================================
// TYPES
// ============================================================================

/** Firestore document shape for ai_usage collection */
export interface AiUsageDocument {
  userId: string;
  channel: string;
  /** Format: YYYY-MM */
  month: string;
  /** Daily message counts: { '2026-03-23': 5, '2026-03-24': 12 } */
  dailyCounts: Record<string, number>;
  /** Daily token breakdown: { '2026-03-23': { prompt: 3000, completion: 800 } } */
  dailyTokens: Record<string, { prompt: number; completion: number }>;
  /** Aggregated monthly totals */
  totalTokens: { prompt: number; completion: number };
  /** Estimated cost in USD — από τον τιμοκατάλογο του μοντέλου κάθε κλήσης (`tokenCostUsd`) */
  estimatedCostUsd: number;
  /** Κλήσεις μοντέλου χωρίς γραμμή στο `AI_COST_CONFIG.PRICING`: τα tokens τους μετρήθηκαν, το κόστος όχι */
  unpricedCalls?: number;
  /** Last update timestamp */
  updatedAt: FirebaseFirestore.Timestamp;
}

/** Result of daily cap check */
export interface DailyCapCheck {
  allowed: boolean;
  used: number;
  limit: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function getTodayKey(): string {
  return nowISO().slice(0, 10); // YYYY-MM-DD
}

function getCurrentMonth(): string {
  return nowISO().slice(0, 7); // YYYY-MM
}

/**
 * Τα πεδία εγγραφής μίας κλήσης για `set(…, { merge: true })`.
 *
 * ⚠️ **Εμφωλευμένοι χάρτες, ποτέ κλειδιά με τελεία.** Στο `set` ένα κλειδί `'dailyCounts.2026-11-04'` είναι **κυριολεκτικό**
 * όνομα πεδίου, όχι διαδρομή (μόνο το `update` ερμηνεύει τελείες)· μέχρι τις 2026-11-04 αυτό έκανε το `checkDailyCap` να
 * διαβάζει πάντα 0, δηλαδή το ημερήσιο όριο **δεν επιβαλλόταν ποτέ**. Ο εμφωλευμένος χάρτης με `merge` συγχωνεύεται σε βάθος.
 *
 * Κόστος από τον τιμοκατάλογο του **πραγματικού** μοντέλου (`tokenCostUsd`). Μοντέλο χωρίς τιμή ⇒ καμία τιμή δεν μαντεύεται:
 * τα tokens μετριούνται, το κόστος όχι, και το `unpricedCalls` το κάνει ορατό αντί να το κρύβει ως φθηνό.
 */
function usageWriteData(
  userId: string,
  channel: string,
  model: string,
  usage: OpenAIUsage,
): { readonly data: FirebaseFirestore.DocumentData; readonly costUsd: number | null } {
  const today = getTodayKey();
  const costUsd = tokenCostUsd(model, usage.prompt_tokens, usage.completion_tokens);
  const tokens = { prompt: FieldValue.increment(usage.prompt_tokens), completion: FieldValue.increment(usage.completion_tokens) };
  return {
    costUsd,
    data: {
      userId,
      channel,
      month: getCurrentMonth(),
      dailyCounts: { [today]: FieldValue.increment(1) },
      dailyTokens: { [today]: tokens },
      totalTokens: tokens,
      estimatedCostUsd: FieldValue.increment(costUsd ?? 0),
      unpricedCalls: FieldValue.increment(costUsd === null ? 1 : 0),
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Καταγράφει μία κλήση μοντέλου: μετρητή ημέρας (για το `checkDailyCap`), tokens και κόστος.
 * Ατομικά `FieldValue.increment()`· δημιουργεί το έγγραφο αν λείπει (`merge: true`). Αποτυχία δεν σπάει τη ροή.
 *
 * @param model το μοντέλο που **ζητήθηκε** (όνομα του τιμοκαταλόγου) — όχι το χρονολογημένο snapshot της απάντησης.
 */
export async function recordUsage(
  userId: string,
  channel: string,
  model: string,
  usage: OpenAIUsage,
): Promise<void> {
  try {
    const docId = enterpriseIdService.generateAiUsageDocId(channel, userId, getCurrentMonth());
    const { data, costUsd } = usageWriteData(userId, channel, model, usage);

    await getAdminFirestore().collection(COLLECTIONS.AI_USAGE).doc(docId).set(data, { merge: true });

    if (costUsd === null) logger.warn('Usage recorded without price — model missing from AI_COST_CONFIG.PRICING', { channel, model });
    logger.info('Usage recorded', {
      userId,
      channel,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      costUsd: costUsd?.toFixed(6) ?? 'unpriced',
    });
  } catch (error) {
    // Non-fatal: usage tracking failure must never break the pipeline
    logger.error('Failed to record usage', { userId, channel, error });
  }
}

/**
 * Check if a customer has exceeded their daily message cap.
 * Admin users are always allowed (checked at caller level).
 */
export async function checkDailyCap(
  userId: string,
  channel: string,
): Promise<DailyCapCheck> {
  const limit = AI_COST_CONFIG.LIMITS.CUSTOMER_DAILY_MESSAGE_CAP;

  try {
    const db = getAdminFirestore();
    const month = getCurrentMonth();
    const today = getTodayKey();
    const idService = enterpriseIdService;
    const docId = idService.generateAiUsageDocId(channel, userId, month);

    const docRef = db.collection(COLLECTIONS.AI_USAGE).doc(docId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { allowed: true, used: 0, limit };
    }

    const data = snap.data() as Partial<AiUsageDocument>;
    const used = data.dailyCounts?.[today] ?? 0;

    return {
      allowed: used < limit,
      used,
      limit,
    };
  } catch (error) {
    // On read failure, allow the message (fail-open for UX)
    logger.error('Failed to check daily cap — allowing message', { userId, channel, error });
    return { allowed: true, used: 0, limit };
  }
}

/**
 * Get monthly usage summary for a user.
 * Useful for admin dashboards and cost reporting.
 */
export async function getMonthlyUsage(
  userId: string,
  channel: string,
  month?: string,
): Promise<AiUsageDocument | null> {
  try {
    const db = getAdminFirestore();
    const targetMonth = month ?? getCurrentMonth();
    const idService = enterpriseIdService;
    const docId = idService.generateAiUsageDocId(channel, userId, targetMonth);

    const snap = await db.collection(COLLECTIONS.AI_USAGE).doc(docId).get();
    if (!snap.exists) return null;

    return snap.data() as AiUsageDocument;
  } catch (error) {
    logger.error('Failed to get monthly usage', { userId, channel, error });
    return null;
  }
}

// ============================================================================
// COMPANY SPEND — ADR-929 Δ16: όριο ασφαλείας ανά εταιρεία και μήνα
// ============================================================================

/** Μία χρεωμένη (ή από κρυφή μνήμη, κόστος 0) κλήση, όπως την καταγράφει η εταιρεία. */
export interface CompanyAiSpend {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Το κόστος από τον τιμοκατάλογο του μοντέλου (`tokenCostUsd`). */
  readonly costUsd: number;
  /** Επανεκτέλεση από την κρυφή μνήμη: μετριέται, ώστε να φαίνεται η εξοικονόμηση (Δ16 #1). */
  readonly cacheHit: boolean;
}

/** Η μηνιαία εγγραφή δαπάνης μιας εταιρείας σε ένα κανάλι. */
export interface CompanyAiUsageDocument {
  companyId: string;
  channel: string;
  month: string;
  dailyCalls: Record<string, number>;
  totalTokens: { prompt: number; completion: number };
  estimatedCostUsd: number;
  cacheHits: number;
  updatedAt: FirebaseFirestore.Timestamp;
}

function companyUsageRef(companyId: string, channel: string, month: string): FirebaseFirestore.DocumentReference {
  return getAdminFirestore()
    .collection(COLLECTIONS.AI_USAGE)
    .doc(enterpriseIdService.generateCompanyAiUsageDocId(channel, companyId, month));
}

/**
 * Η εγγραφή μίας δαπάνης ως **ζεύγος (αναφορά, δεδομένα)** για `set(…, { merge: true })`: ο καλών τη βάζει στην **ίδια**
 * δέσμη με την εγγραφή που τη γέννησε, ώστε η ανάγνωση και το κόστος της να γράφονται μαζί ή καθόλου.
 *
 * ⚠️ **Εμφωλευμένοι χάρτες, ποτέ κλειδιά με τελεία.** Στο `set` ένα κλειδί `'totalTokens.prompt'` είναι **κυριολεκτικό**
 * όνομα πεδίου, όχι διαδρομή (μόνο το `update` ερμηνεύει τελείες). Ο εμφωλευμένος χάρτης με `merge` συγχωνεύεται σε βάθος.
 */
export function companyAiSpendWrite(
  companyId: string,
  channel: string,
  spend: CompanyAiSpend,
): { readonly ref: FirebaseFirestore.DocumentReference; readonly data: FirebaseFirestore.DocumentData } {
  const month = getCurrentMonth();
  return {
    ref: companyUsageRef(companyId, channel, month),
    data: {
      companyId,
      channel,
      month,
      dailyCalls: { [getTodayKey()]: FieldValue.increment(1) },
      totalTokens: { prompt: FieldValue.increment(spend.inputTokens), completion: FieldValue.increment(spend.outputTokens) },
      estimatedCostUsd: FieldValue.increment(spend.costUsd),
      cacheHits: FieldValue.increment(spend.cacheHit ? 1 : 0),
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
}

/**
 * Η δαπάνη της εταιρείας τον τρέχοντα μήνα σε USD. **Ρίχνει** σε αποτυχία ανάγνωσης, σε αντίθεση με το `checkDailyCap`:
 * ένα όριο κόστους που «επιτρέπει όταν δεν ξέρει» δεν είναι όριο. Ο καλών αποφασίζει (Δ16 #4: μόνο γεωμετρία).
 */
export async function getCompanyMonthlySpendUsd(companyId: string, channel: string): Promise<number> {
  const snap = await companyUsageRef(companyId, channel, getCurrentMonth()).get();
  if (!snap.exists) return 0;
  const cost = (snap.data() as Partial<CompanyAiUsageDocument>).estimatedCostUsd;
  return typeof cost === 'number' && Number.isFinite(cost) ? cost : 0;
}
