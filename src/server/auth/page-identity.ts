import 'server-only';

/**
 * «Ποιος ρωτά;» — **μία φορά**, για Server Components
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ (ADR-787 §5.3 ι)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένα Server Component δεν έχει `NextRequest`, άρα **δεν** μπορεί να καλέσει το
 * `buildRequestContext`. Μέχρι σήμερα η ίδια ~50γραμμη ακολουθία *(διάβασε
 * cookie → επαλήθευσε → βγάλε claims → fail-closed)* ζούσε **δύο** φορές, και
 * μια τρίτη αντιγραφή γεννιόταν με **κάθε** νέο φρουρό σελίδας.
 *
 * 🔑 **Εξήχθη, δεν γράφτηκε** (Boy Scout, N.0.2): ο κώδικας είναι **ο ίδιος** που
 * έτρεχε ήδη στο `require-project-for-page.ts` — μαζί με τα σχόλιά του και τη
 * ρητή απόφαση fail-closed του ADR-657 §3.5.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΠΙΣΤΡΕΦΕΙ ΕΤΥΜΗΓΟΡΙΑ ΚΑΙ ΔΕΝ ΠΕΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι καλούντες **διαφωνούν στο τι σημαίνει αποτυχία**, και αυτό είναι σωστό: ο
 * φρουρός έργου θέλει `403`· ο φρουρός χώρου θέλει **404 που δεν αποκαλύπτει
 * τίποτα** (Ε-5 §4 #1). Ένα `throw` με σταθερό μήνυμα θα ανάγκαζε τον έναν από
 * τους δύο να **μαντεύει** από κείμενο σφάλματος.
 *
 * ⚠️ Οι λόγοι μένουν **διακριτοί** ώστε ο καλών να κρατά τα δικά του μηνύματα
 * αυτούσια — μια ένωσή τους σε ένα «απέτυχε» θα έσβηνε διαγνωστικά που ήδη
 * υπάρχουν.
 *
 * ⛔ **ΔΕΝ ενοποιείται με το `requireAdminForPage`**: εκείνο απαντά **άλλο**
 * ερώτημα *(«είναι διαχειριστής, και έχει MFA;»)* και έχει δικό του
 * περιβαλλοντικό φράγμα. Ένωση θα ήταν το λάθος του ADR-775 — δύο ερωτήματα σε
 * έναν μηχανισμό.
 *
 * @module server/auth/page-identity
 */

import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import { getDevCompanyId } from '@/config/dev-environment';
import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { verifySessionCookieToken } from '@/server/admin/admin-guards';
import { isValidGlobalRole, type GlobalRole, type AuthContext } from '@/lib/auth/types';
// ADR-801 §2.8 — ο ΕΝΑΣ αναγνώστης του claim `permissions`.
// 🔴 ΓΙΑΤΙ ΕΙΝΑΙ ΕΔΩ: αυτό είναι ο **δεύτερος** παραγωγός `AuthContext` του
// server (ο πρώτος είναι το `buildRequestContext`). Αν μόνο εκείνος διάβαζε το
// claim, οι **σελίδες** θα έκριναν διαφορετικά από τις **διαδρομές API** — η
// ίδια βλάβη που κλείνει αυτή η φάση, έναν όροφο πιο κάτω.
import { readPermissionsClaim } from '@/lib/auth/claim-permissions';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('PageIdentity');

/** Γιατί δεν έχουμε ταυτότητα — **διακριτά**, ποτέ ένα «απέτυχε». */
export type PageIdentityRejection =
  | 'no-session'
  | 'invalid-session'
  | 'missing-companyId'
  | 'invalid-role';

export type PageIdentity =
  | { readonly ok: true; readonly ctx: AuthContext }
  | { readonly ok: false; readonly reason: PageIdentityRejection };

/**
 * Η ταυτότητα του αιτούντος, από το cookie συνεδρίας.
 *
 * ⚠️ **FAIL-CLOSED, και είναι απόφαση με ιστορία** (ADR-657 §3.5): cookie χωρίς
 * claims RFC-v6 **απορρίπτεται** — δεν προάγεται σιωπηλά σε προεπιλεγμένο
 * μισθωτή με ρόλο `company_admin`. Ούτε fallback από μεταβλητή περιβάλλοντος.
 */
export async function readPageIdentity(): Promise<PageIdentity> {
  const environment = getCurrentRuntimeEnvironment();
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_CONFIG.NAME)?.value;

  if (!sessionCookie && environment === 'development') {
    logger.info('[PAGE_IDENTITY] Dev bypass — no session cookie');
    return {
      ok: true,
      ctx: {
        uid: 'dev-user',
        email: 'dev@localhost',
        companyId: await getDevCompanyId(),
        globalRole: 'company_admin',
        mfaEnrolled: false,
        isAuthenticated: true,
      },
    };
  }

  if (!sessionCookie) return { ok: false, reason: 'no-session' };

  const decoded = await verifySessionCookieToken(sessionCookie);
  if (!decoded) return { ok: false, reason: 'invalid-session' };

  const companyId = decoded.companyId as string | undefined;
  if (typeof companyId !== 'string' || companyId.length === 0) {
    return { ok: false, reason: 'missing-companyId' };
  }

  const globalRoleRaw = decoded.globalRole as string | undefined;
  if (typeof globalRoleRaw !== 'string' || !isValidGlobalRole(globalRoleRaw)) {
    return { ok: false, reason: 'invalid-role' };
  }
  const globalRole: GlobalRole = globalRoleRaw;

  return {
    ok: true,
    ctx: {
      uid: decoded.uid,
      email: decoded.email || '',
      companyId,
      globalRole,
      mfaEnrolled: decoded.mfaEnrolled === true,
      isAuthenticated: true,
      permissions: readPermissionsClaim(decoded.permissions),
    },
  };
}
