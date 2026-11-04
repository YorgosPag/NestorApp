import 'server-only';

/**
 * **Ένα σημείο απόφασης** για το «επιτρέπεται μια ανάγνωση κάτοψης;» (ADR-929 Δ16 #3). Σήμερα διαβάζει τα σταθερά όρια
 * του `AI_COST_CONFIG.LIMITS`· αύριο θα διαβάζει το πακέτο της εταιρείας, και η ροή δεν θα αλλάξει.
 *
 * 🔑 Η απόφαση γίνεται **πριν** την κλήση, από την **εκτίμηση** (Δ16 #2): ποτέ «πλήρωσε και μετά δες».
 * 🔑 Άρνηση ≠ σφάλμα: η αναγνώριση συνεχίζει μόνο με γεωμετρία και ο χρήστης βλέπει τον λόγο (Δ16 #4).
 * 🔑 Αδυναμία ανάγνωσης της δαπάνης ⇒ **άρνηση** (fail-closed): ένα όριο που «επιτρέπει όταν δεν ξέρει» δεν είναι όριο.
 * ⚠️ Δύο ταυτόχρονες αναγνώσεις **διαφορετικών** σελίδων κοντά στο όριο μπορούν να το ξεπεράσουν κατά το πολύ μία
 * εκτίμηση σελίδας η καθεμία. Είναι όριο ασφαλείας, όχι χρέωση· η ίδια σελίδα δύο φορές αποκλείεται από τη μία-πτήση.
 * ⏳ Ο διακόπτης ανά εταιρεία του Δ15 #1 θα μπει **εδώ** (λόγος `ai-disabled-for-company`), μέσω του μητρώου
 * εξουσιοδότησης (CHECK 3.68). Δεν υπάρχει ακόμη ρύθμιση εταιρείας για αυτόν (ADR-929 §6.4).
 *
 * @module server/plan-recognition/plan-reading-allowance.server
 */

import { AI_COST_CONFIG } from '@/config/ai-analysis-config';
import { getCompanyMonthlySpendUsd } from '@/services/ai-pipeline/ai-usage.service';
import type { PlanReadingUnavailableReason } from '@/subapps/dxf-viewer/bim/plan-recognition/plan-recognition-types';

/** Το κανάλι της ανάγνωσης κατόψεων στο `ai_usage`. */
export const PLAN_READING_USAGE_CHANNEL = 'plan-reading';

export type PlanReadingAllowance =
  | { readonly allowed: true; readonly remainingUsd: number }
  | { readonly allowed: false; readonly reason: PlanReadingUnavailableReason };

export interface PlanReadingAllowanceDeps {
  readonly monthlySpendUsd: (companyId: string) => Promise<number>;
  readonly limits: { readonly pageCapUsd: number; readonly monthlyCapUsd: number };
}

const DEFAULT_DEPS: PlanReadingAllowanceDeps = {
  monthlySpendUsd: (companyId) => getCompanyMonthlySpendUsd(companyId, PLAN_READING_USAGE_CHANNEL),
  limits: {
    pageCapUsd: AI_COST_CONFIG.LIMITS.PLAN_READING_PAGE_CAP_USD,
    monthlyCapUsd: AI_COST_CONFIG.LIMITS.PLAN_READING_COMPANY_MONTHLY_CAP_USD,
  },
};

/** `estimateUsd: null` ⇒ το κόστος δεν εκτιμάται ⇒ η κλήση δεν γίνεται (κανένα κόστος δεν μαντεύεται). */
export async function resolvePlanReadingAllowance(
  companyId: string,
  estimateUsd: number | null,
  deps: PlanReadingAllowanceDeps = DEFAULT_DEPS,
): Promise<PlanReadingAllowance> {
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
