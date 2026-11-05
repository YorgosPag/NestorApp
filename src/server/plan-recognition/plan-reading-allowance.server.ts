import 'server-only';

/**
 * **Ένα σημείο απόφασης** για το «επιτρέπεται μια ανάγνωση κάτοψης;» (ADR-929 Δ15 #1 + Δ16 #3).
 *
 * Σειρά ελέγχων, ο φθηνότερος και ο πιο θεμελιώδης πρώτος:
 * 1. **Η εταιρεία** (Δ15 #1): ο διακόπτης του διαχειριστή **και** η νομική γνωστοποίηση σε ισχύ
 *    (`server/company/company-ai-processing.server.ts`). Αν η εταιρεία δεν επιτρέπει, η δαπάνη δεν διαβάζεται καν.
 * 2. **Το κόστος** (Δ16): εκτίμηση πριν την κλήση, όριο ανά σελίδα, όριο μήνα ανά εταιρεία. Σήμερα από τα σταθερά
 *    όρια του `AI_COST_CONFIG.LIMITS`· αύριο από το πακέτο της εταιρείας, χωρίς αλλαγή στη ροή.
 *
 * 🔑 Άρνηση ≠ σφάλμα: η αναγνώριση συνεχίζει μόνο με γεωμετρία και ο χρήστης βλέπει τον λόγο (Δ16 #4).
 * 🔑 Αδυναμία ανάγνωσης (ρύθμισης ή δαπάνης) ⇒ **άρνηση** (fail-closed): ένα όριο που «επιτρέπει όταν δεν ξέρει» δεν είναι όριο.
 * ⚠️ Δύο ταυτόχρονες αναγνώσεις **διαφορετικών** σελίδων κοντά στο όριο μπορούν να το ξεπεράσουν κατά το πολύ μία
 * εκτίμηση σελίδας η καθεμία. Είναι όριο ασφαλείας, όχι χρέωση· η ίδια σελίδα δύο φορές αποκλείεται από τη μία-πτήση.
 *
 * @module server/plan-recognition/plan-reading-allowance.server
 */

import { AI_COST_CONFIG } from '@/config/ai-analysis-config';
import { getCompanyMonthlySpendUsd } from '@/services/ai-pipeline/ai-usage.service';
import { readAiPurposeStatus } from '@/server/company/company-ai-processing.server';
import type { AiPurposeStatus } from '@/types/company-ai-processing';
import type { PlanReadingUnavailableReason } from '@/subapps/dxf-viewer/bim/plan-recognition/plan-recognition-types';

/** Το κανάλι της ανάγνωσης κατόψεων στο `ai_usage`. */
export const PLAN_READING_USAGE_CHANNEL = 'plan-reading';

export type PlanReadingAllowance =
  | { readonly allowed: true; readonly remainingUsd: number }
  | { readonly allowed: false; readonly reason: PlanReadingUnavailableReason };

export interface PlanReadingAllowanceDeps {
  /** Η ενεργή κατάσταση του σκοπού `plan-reading` για την εταιρεία. Throw ⇒ fail-closed. */
  readonly companyPurpose: (companyId: string) => Promise<AiPurposeStatus>;
  readonly monthlySpendUsd: (companyId: string) => Promise<number>;
  readonly limits: { readonly pageCapUsd: number; readonly monthlyCapUsd: number };
}

/** Οι εξαρτήσεις της παραγωγής. Εξάγονται ώστε τα τεστ να αλλάζουν **μία** (π.χ. την πολιτική σε ισχύ) και να τρέχουν τις υπόλοιπες. */
export const DEFAULT_PLAN_READING_ALLOWANCE_DEPS: PlanReadingAllowanceDeps = {
  companyPurpose: (companyId) => readAiPurposeStatus(companyId, 'plan-reading'),
  monthlySpendUsd: (companyId) => getCompanyMonthlySpendUsd(companyId, PLAN_READING_USAGE_CHANNEL),
  limits: {
    pageCapUsd: AI_COST_CONFIG.LIMITS.PLAN_READING_PAGE_CAP_USD,
    monthlyCapUsd: AI_COST_CONFIG.LIMITS.PLAN_READING_COMPANY_MONTHLY_CAP_USD,
  },
};

/** Ο έλεγχος της εταιρείας: `null` = επιτρέπει, αλλιώς ο λόγος της άρνησης. */
async function companyRefusal(companyId: string, deps: PlanReadingAllowanceDeps): Promise<PlanReadingUnavailableReason | null> {
  let status: AiPurposeStatus;
  try {
    status = await deps.companyPurpose(companyId);
  } catch {
    return 'allowance-unverifiable';
  }
  if (status.state !== 'enabled') return 'ai-disabled-for-company';
  if (status.legal !== 'disclosed') return 'ai-legal-disclosure-pending';
  return status.effective ? null : 'ai-disabled-for-company';
}

/** `estimateUsd: null` ⇒ το κόστος δεν εκτιμάται ⇒ η κλήση δεν γίνεται (κανένα κόστος δεν μαντεύεται). */
export async function resolvePlanReadingAllowance(
  companyId: string,
  estimateUsd: number | null,
  deps: PlanReadingAllowanceDeps = DEFAULT_PLAN_READING_ALLOWANCE_DEPS,
): Promise<PlanReadingAllowance> {
  const refusal = await companyRefusal(companyId, deps);
  if (refusal !== null) return { allowed: false, reason: refusal };
  if (estimateUsd === null) return { allowed: false, reason: 'cost-unknown' };
  if (estimateUsd > deps.limits.pageCapUsd) return { allowed: false, reason: 'page-cost-exceeds-cap' };
  let spent: number;
  try {
    spent = await deps.monthlySpendUsd(companyId);
  } catch {
    return { allowed: false, reason: 'allowance-unverifiable' };
  }
  const remainingUsd = deps.limits.monthlyCapUsd - spent;
  return remainingUsd >= estimateUsd ? { allowed: true, remainingUsd } : { allowed: false, reason: 'allowance-exhausted' };
}
