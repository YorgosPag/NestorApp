/**
 * =============================================================================
 * JOB: firebase-auth-config-drift — **ΣΥΜΦΩΝΕΙ Η ΚΟΝΣΟΛΑ ΜΕ ΤΟ GIT;** (ADR-851)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει**: το action URL **όλων** των email της Firebase έδειχνε επί μήνες σε
 * νεκρό υποdomain του Vercel, και **κανείς δεν το ήξερε** — η ρύθμιση ζούσε μόνο στην
 * κονσόλα. Ο έλεγχος `npm run firebase-auth:config:check` το πιάνει όταν τον τρέξει
 * άνθρωπος· αυτή η εργασία το πιάνει **χωρίς** να θυμηθεί κανείς.
 *
 * ⚠️ **Απόκλιση ≠ αποτυχία εργασίας.** Η εργασία **πέτυχε** να κοιτάξει· η απόκλιση είναι
 * **εύρημα** και φεύγει ως γεγονός Sentry. Αποτυχία είναι μόνο το «δεν μπορέσαμε να
 * κρίνουμε» (λείπει η δημόσια διεύθυνση, η Google δεν απάντησε) — τότε **πετά**, ώστε ο
 * monitor του ADR-740 να χτυπήσει.
 *
 * 🔒 **Δεν γράφει ΠΟΤΕ.** Η διόρθωση είναι πράξη ανθρώπου (`--apply --expect-drift=N`).
 *
 * @module lib/cron/jobs/firebase-auth-config-drift.job
 */

import 'server-only';

import { sentryCaptureMessage } from '@/lib/telemetry';
import { auditFirebaseAuthConfig } from '@/server/firebase-auth-config/auth-config-audit';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runFirebaseAuthConfigDrift(): Promise<CronJobResult> {
  const audit = await auditFirebaseAuthConfig();
  if (audit.kind === 'refused') {
    throw new Error('Firebase Auth config not judged: NEXT_PUBLIC_APP_URL is not configured');
  }

  if (audit.drifts.length > 0) {
    // ⚠️ Μόνο διαδρομές — οι περιγραφές κουβαλούν θέματα email, όχι μυστικά, αλλά ο
    //    συναγερμός δεν χρειάζεται περισσότερα για να πει «τρέξε το --check».
    sentryCaptureMessage('Firebase Auth config drifted from git', 'warning', {
      tags: { component: 'firebase-auth-config' },
      extra: { projectId: audit.projectId, paths: audit.drifts.map((drift) => drift.path) },
    });
  }

  return {
    summary: `drifts ${audit.drifts.length}, not judged ${audit.notJudged.length}`,
    metrics: { drifts: audit.drifts.length, notJudged: audit.notJudged.length },
  };
}
