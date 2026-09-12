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
import { FROZEN_PATHS, partitionDrifts } from '@/server/firebase-auth-config/auth-config-state';
import type { CronJobResult } from '@/types/cron-schedule';

/**
 * **Είναι οι παγωμένες αποκλίσεις ΑΚΡΙΒΩΣ αυτές που περιμένουμε;**
 *
 * Σύγκριση **συνόλων διαδρομών**, όχι πλήθους: αν μια παγωμένη διαδρομή **πάψει** να αποκλίνει
 * (η Google ξεπάγωσε, ή κάποιος έγραψε την τιμή), το σύνολο **αλλάζει** — και αυτό είναι
 * **ακριβώς** η μέρα που θέλουμε να μάθουμε.
 */
function frozenDriftIsExpected(paths: readonly string[]): boolean {
  return JSON.stringify([...paths].sort()) === JSON.stringify([...FROZEN_PATHS].sort());
}

export async function runFirebaseAuthConfigDrift(): Promise<CronJobResult> {
  const audit = await auditFirebaseAuthConfig();
  if (audit.kind === 'refused') {
    throw new Error('Firebase Auth config not judged: NEXT_PUBLIC_APP_URL is not configured');
  }

  const { applicable, frozen } = partitionDrifts(audit.drifts);
  const expected = frozenDriftIsExpected(frozen.map((drift) => drift.path));

  // ────────────────────────────────────────────────────────────────────────────
  // 🔕 Η ΑΝΑΜΕΝΟΜΕΝΗ ΑΠΟΚΛΙΣΗ ΔΕΝ ΧΤΥΠΑΕΙ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΣΙΩΠΗ
  // ────────────────────────────────────────────────────────────────────────────
  // Από τις 2026-09-12 οι δύο παγωμένες διαδρομές αποκλίνουν **μόνιμα**: η Google αρνείται
  // την εγγραφή τους με κάθε τρόπο (ADR-851 §7 #1). Ένας συναγερμός που χτυπά **κάθε μέρα**
  // χωρίς να υπάρχει ενέργεια είναι **σπασμένος συναγερμός**: σε λίγες εβδομάδες κανείς δεν
  // τον κοιτά, και τότε χάνεται και η **μία** μέρα που έχει σημασία.
  //
  // ⚠️ Το «σιωπά» ΔΕΝ σημαίνει «δεν κοιτά»: η απόκλιση **κρίνεται** κανονικά και μετριέται
  //    παρακάτω. Χτυπάει όταν (α) υπάρχει **εγγράψιμη** απόκλιση — κάτι που ΜΠΟΡΟΥΜΕ να
  //    διορθώσουμε· ή (β) το **σύνολο** των παγωμένων άλλαξε — δηλαδή ξεπάγωσε κάτι, ή κάποιος
  //    πείραξε τιμή. Ό,τι δεν λέγεται, δεν μετριέται — γι' αυτό μπαίνουν και τα δύο στα metrics.
  if (applicable.length > 0 || !expected) {
    sentryCaptureMessage('Firebase Auth config drifted from git', 'warning', {
      tags: { component: 'firebase-auth-config' },
      extra: {
        projectId: audit.projectId,
        applicable: applicable.map((drift) => drift.path),
        frozen: frozen.map((drift) => drift.path),
        frozenDriftAsExpected: expected,
      },
    });
  }

  return {
    summary: `drifts ${audit.drifts.length} (${applicable.length} writable, ${frozen.length} frozen`
      + `${expected ? ', as expected' : ' — CHANGED'}), not judged ${audit.notJudged.length}`,
    metrics: {
      drifts: audit.drifts.length,
      applicable: applicable.length,
      frozen: frozen.length,
      notJudged: audit.notJudged.length,
    },
  };
}
