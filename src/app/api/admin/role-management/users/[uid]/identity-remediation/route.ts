/**
 * =============================================================================
 * PATCH …/role-management/users/[uid]/identity-remediation — ΕΚΤΟΣ ΜΙΣΘΩΤΗ
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΔΙΠΛΟΤΥΠΟ** (ADR-822 §4.6 · ADR-749):
 *
 * Η διαχείριση ρόλων του ADR-244 *(`role-management/users/[uid]/role`)* είναι
 * πλήρης, φρουρημένη και ελεγχόμενη — αλλά ξεκινά με `prepareMemberMutation`,
 * που **απαιτεί ο στόχος να είναι μέλος της εταιρείας** του καλούντος.
 *
 * 🔑 **ΚΑΙ ΟΙ ΤΕΣΣΕΡΙΣ ΜΕΤΡΗΜΕΝΕΣ ΑΠΟΚΛΙΣΕΙΣ ΕΙΝΑΙ ΑΚΡΙΒΩΣ ΤΑΥΤΟΤΗΤΕΣ ΠΟΥ ΔΕΝ
 * ΕΙΝΑΙ ΜΕΛΗ** *(`companyId: null`, ή χωρίς έγγραφο)*. Δηλαδή το υπάρχον
 * εργαλείο **ούτε τις βλέπει ούτε μπορεί να τις αγγίξει** — το ίδιο το ADR-244
 * το κατέγραψε ως *«404 User not found in this company»* και **έκρυψε** τις
 * συνθετικές από τη λίστα αντί να τις θεραπεύσει. *Οι αποκλίσεις επέζησαν
 * επειδή κανένα εργαλείο δεν έφτανε εκεί.*
 *
 * Αυτή η διαδρομή είναι το **σύνορο που έλειπε**: διαχείριση ταυτότητας
 * **χωρίς μισθωτή**, που ανήκει αποκλειστικά στον `super_admin`.
 *
 * 🔑 **ΚΑΘΕΤΑΙ ΔΙΠΛΑ ΣΤΑ ΤΡΙΑ ΑΔΕΛΦΙΑ ΤΗΣ** *(`role` · `status` ·
 * `permission-sets`)* **επίτηδες**: το τυφλό σημείο και η κάλυψή του πρέπει να
 * είναι ορατά στον ίδιο φάκελο. Το τι ΤΗ ΧΩΡΙΖΕΙ από αυτά είναι μία γραμμή —
 * δεν καλεί `prepareMemberMutation`, γιατί ο στόχος **δεν είναι μέλος**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ **ΔΕΝ** ΚΑΝΕΙ, ΕΠΙΤΗΔΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * * **Δεν διαγράφει.** Ποτέ, καμία διαδρομή. NIST SP 800-61: *containment*
 *   πριν *eradication*· το έγγραφο είναι αποδεικτικό υλικό.
 * * **Δεν δημιουργεί έγγραφο** για λογαριασμό που δεν έχει. Αυτό θα ήταν
 *   **επινόηση ταυτότητας** — η βλάβη του ADR-821.
 * * **Δεν ανεβάζει ποτέ ρόλο.** Μόνο προς την ασφαλή τιμή (ADR-657 §3.5).
 * * **Δεν αγγίζει claims.** Η εξουσία ζει στο Auth και αλλάζει από τη
 *   φρουρημένη `set-user-claims` — ένα λεξιλόγιο, όχι δεύτερο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ SCRIPT — Η ΑΠΑΝΤΗΣΗ ΤΩΝ ΜΕΓΑΛΩΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένα `tsx` script με service-account key θα ήταν **Admin SDK γραφέας που
 * παρακάμπτει τους Firestore rules, χωρίς ανθρώπινο δράστη** — δηλαδή
 * **γραμμή προς γραμμή η βλάβη του ADR-821**. Καθάρισμα αποτυπώματος με το
 * ίδιο εργαλείο που το άφησε.
 *
 * Οι μεγάλοι *(AWS, Okta, Google)* κάνουν identity remediation μέσα από το
 * **ίδιο control plane**: ο δράστης είναι **πιστοποιημένος άνθρωπος**, ισχύουν
 * οι **ίδιοι** φρουροί, και η καταγραφή είναι **αυτόματη, όχι προαιρετική**.
 *
 * @module api/admin/role-management/users/[uid]/identity-remediation
 * @see ADR-822 §4.5 (αντιστρεψιμότητα) · §4.6 (γιατί διαδρομή)
 * @see ADR-244 — το πρότυπο σχήμα, και το τυφλό του σημείο
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth, logAuditEvent, logRoleChange } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { extractUidFromPath } from '@/lib/api/route-helpers';
import { failWithLoggedError, parseJsonBody, rejectSelfTarget } from '@/lib/api/role-management-helpers';
import { reconcileIdentity } from '@/lib/auth/identity-provenance';
import {
  explainNoMaterialisation,
  explainNoPlan,
  planMaterialisation,
  planRemediation,
} from '@/lib/auth/identity-remediation';

import {
  applyRemediation,
  materialiseDocument,
  readAuthProfile,
  readIdentityPair,
} from './remediation-operations';

const logger = createModuleLogger('IdentityRemediation');

/**
 * ⚠️ **`apply` ΨΕΥΔΕΣ ΕΞ ΟΡΙΣΜΟΥ, ΚΑΙ `reason` ΥΠΟΧΡΕΩΤΙΚΟΣ ≥ 10 ΧΑΡΑΚΤΗΡΕΣ.**
 * Και τα δύο δανεισμένα αυτούσια από το ADR-244: μια γραφή σε ζωντανή ταυτότητα
 * χωρίς **γραπτό λόγο** δεν είναι διαχείριση, είναι ατύχημα με πληκτρολόγιο.
 */
const RemediateSchema = z.object({
  apply: z.boolean().default(false),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  /**
   * Η ετυμηγορία που **περιμένει** ο καλών. Αν η ζωντανή κατάσταση λέει κάτι
   * άλλο, η πράξη **αρνείται** — ο άνθρωπος ενέκρινε άλλη πραγματικότητα.
   */
  expectedVerdict: z.string().min(1),
  /**
   * ⛔ **ΤΟ ΔΕΥΤΕΡΟ ΚΛΕΙΔΙ** (ADR-822 §4.7). Η **μόνη** μη-αναστρέψιμη πράξη —
   * δημιουργία εγγράφου για λογαριασμό που δεν έχει — απαιτεί **ρητή** δεύτερη
   * σημαία πέρα από το `apply`. *Dual control*, το πρότυπο των μεγάλων για
   * πράξεις χωρίς undo. Χωρίς αυτό, η ετυμηγορία μένει
   * `requires-human-identification` και **τίποτα δεν γράφεται**.
   */
  materialiseFromAuth: z.boolean().default(false),
});

export const PATCH = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      // Ίδιος εξαγωγέας με τα τρία αδέλφια (`role` · `status` · `permission-sets`)
      // — κανένας δεύτερος τρόπος να διαβαστεί uid από διαδρομή (ADR-749).
      const targetUid = extractUidFromPath(request, 'identity-remediation');
      if (!targetUid) {
        return NextResponse.json({ success: false, error: 'Missing target uid in URL path' }, { status: 400 });
      }

      try {
        const parsed = await parseJsonBody(request, RemediateSchema);
        if (!parsed.ok) return parsed.response;
        const body = parsed.value;

        // Αυτοπροστασία — ο διαχειριστής δεν θεραπεύει τον εαυτό του (ADR-244).
        const selfBlocked = rejectSelfTarget(targetUid, ctx.uid, 'Cannot remediate your own identity');
        if (selfBlocked) return selfBlocked;

        const db = getAdminFirestore();
        const pair = await readIdentityPair(db, getAdminAuth(), targetUid);
        if (!pair.account && !pair.document) {
          return NextResponse.json(
            { success: false, error: 'Unknown identity: absent from BOTH registries' },
            { status: 404 },
          );
        }

        const outcome = reconcileIdentity(pair.account, pair.document);
        if (outcome.verdict !== body.expectedVerdict) {
          // 🔑 Ο άνθρωπος ενέκρινε ΑΛΛΗ κατάσταση. Άρνηση, όχι «κάν' το πάντως».
          return NextResponse.json(
            {
              success: false,
              error: 'Verdict changed since approval',
              approved: body.expectedVerdict,
              actual: outcome.verdict,
            },
            { status: 409 },
          );
        }

        // ── Η ΜΟΝΗ ΜΗ-ΑΝΑΣΤΡΕΨΙΜΗ ΠΡΑΞΗ: δύο κλειδιά, ρητά και τα δύο. ──────
        if (outcome.verdict === 'account-without-document' && body.materialiseFromAuth) {
          return await handleMaterialisation(ctx, targetUid, body.apply, body.reason);
        }

        const plan = planRemediation(targetUid, outcome.verdict, pair.document, pair.updatedAtMs);
        if (plan.kind === 'none') {
          return NextResponse.json({
            success: true,
            applied: false,
            verdict: outcome.verdict,
            plan: null,
            reason: explainNoPlan(plan.reason),
          });
        }

        // ── DRY-RUN: η ΠΡΟΕΠΙΛΟΓΗ. Δείχνει τα πάντα, γράφει τίποτα. ──────────
        if (!body.apply) {
          return NextResponse.json({
            success: true,
            applied: false,
            dryRun: true,
            verdict: outcome.verdict,
            before: pair.document,
            plan: plan.plan,
          });
        }

        const result = await applyRemediation(db, plan.plan, ctx.uid);
        if (!result.ok) {
          return NextResponse.json(
            { success: false, error: result.error, verdict: outcome.verdict },
            { status: 409 },
          );
        }

        await recordRemediation(ctx, targetUid, plan.plan.forward.summary, body.reason, {
          verdict: outcome.verdict,
          before: result.before,
          after: result.after,
          inverse: plan.plan.inverse,
        });

        logger.info('Identity remediation applied', { targetUid, verdict: outcome.verdict });

        return NextResponse.json({
          success: true,
          applied: true,
          verdict: outcome.verdict,
          before: result.before,
          after: result.after,
          /** 🔑 Η αναίρεση επιστρέφεται **στον καλούντα**, όχι μόνο στο log. */
          inverse: plan.plan.inverse,
        });
      } catch (error) {
        return failWithLoggedError(logger, 'Identity remediation failed', error);
      }
    },
    { requiredGlobalRoles: ['super_admin'] },
  ),
);

/**
 * Η **υλοποίηση**: έγγραφο χτισμένο **αποκλειστικά** από Auth + claims.
 *
 * ⚠️ Ξαναδιαβάζει τον λογαριασμό **μέσα** στη ροή της γραφής, ώστε οι τιμές που
 * γράφονται να είναι αυτές που μόλις είδαμε — όχι ένα στιγμιότυπο από νωρίτερα.
 */
async function handleMaterialisation(
  ctx: AuthContext,
  targetUid: string,
  apply: boolean,
  reason: string,
): Promise<NextResponse> {
  const auth = getAdminAuth();
  const facts = await readAuthProfile(auth, targetUid);
  if (!facts) {
    return NextResponse.json({ success: false, error: 'Account not found in Firebase Auth' }, { status: 404 });
  }

  const outcome = planMaterialisation(facts, Date.now());
  if (outcome.kind === 'none') {
    return NextResponse.json({
      success: true,
      applied: false,
      plan: null,
      reason: explainNoMaterialisation(outcome.reason),
    });
  }

  if (!apply) {
    return NextResponse.json({ success: true, applied: false, dryRun: true, plan: outcome.plan });
  }

  const created = await materialiseDocument(getAdminFirestore(), outcome.plan, ctx.uid);
  if (!created.ok) {
    return NextResponse.json({ success: false, error: created.error }, { status: 409 });
  }

  await logAuditEvent(ctx, 'data_created', targetUid, 'user', {
    previousValue: null,
    newValue: { type: 'status', value: outcome.plan.document },
    metadata: { reason: `${outcome.plan.summary} — ${reason}` },
  });

  logger.info('Identity document materialised from Auth', { targetUid });
  return NextResponse.json({
    success: true,
    applied: true,
    created: true,
    document: outcome.plan.document,
    omitted: outcome.plan.omitted,
    inverse: null,
    inverseNote: outcome.plan.inverseNote,
  });
}

/**
 * Η καταγραφή — **μέσα από το υπάρχον SSoT**, ποτέ απευθείας στη συλλογή.
 *
 * ⚠️ Δύο εγγραφές όταν αλλάζει ρόλος, **επίτηδες**: το `role_changed` είναι το
 * ερώτημα *«ποιος άλλαξε ρόλο;»* που ρωτά η κονσόλα του ADR-244· το
 * `data_fix_executed` είναι το ερώτημα *«τι θεραπείες έγιναν;»*. Διαφορετικά
 * ερωτήματα, διαφορετικοί αναγνώστες.
 */
async function recordRemediation(
  ctx: AuthContext,
  targetUid: string,
  summary: string,
  reason: string,
  evidence: Record<string, unknown>,
): Promise<void> {
  const before = evidence.before as { globalRole?: string | null } | null;
  const after = evidence.after as { globalRole?: string | null } | null;

  if (before?.globalRole !== after?.globalRole) {
    await logRoleChange(ctx, targetUid, before?.globalRole ?? '—', after?.globalRole ?? '—', reason);
  }

  await logAuditEvent(ctx, 'data_fix_executed', targetUid, 'user', {
    previousValue: { type: 'status', value: before as Record<string, unknown> | null },
    newValue: { type: 'status', value: after as Record<string, unknown> | null },
    metadata: { reason: `${summary} — ${reason}` },
  });
}
