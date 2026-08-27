/**
 * /procurement/analytics — Enterprise Spend Analytics Page (ADR-331 Phase D).
 *
 * Server component: verifies session cookie + RBAC role (D10) before rendering
 * the client shell. Forbidden users redirect to `/projects`.
 *
 * @see ADR-331 §2.2, §4 D10
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import { verifySessionCookieToken } from '@/server/admin/admin-guards';
import { canViewSpendAnalytics } from '@/lib/auth/permissions/spend-analytics';

import { AnalyticsPageShell } from './_components/AnalyticsPageShell';

const FORBIDDEN_REDIRECT = '/projects';
const LOGIN_REDIRECT = '/login';

async function resolveGlobalRole(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_CONFIG.NAME)?.value;

  // ⛔ **ΚΑΜΙΑ ΚΑΤΑΣΚΕΥΗ ΡΟΛΟΥ — ΣΒΗΣΤΗΚΕ 2026-08-27 (ADR-821 §4.4).** Εδώ
  //    επιστρεφόταν σκέτο `'company_admin'` σε `development` χωρίς cookie: ο
  //    **πέμπτος** από τους έξι κατασκευαστές, και ο μόνος που έφτιαχνε ρόλο ως
  //    γυμνό `string`, έξω από κάθε τύπο ταυτότητας. Χωρίς cookie ⇒ σύνδεση.
  if (!sessionCookie) return null;

  const decoded = await verifySessionCookieToken(sessionCookie);
  if (!decoded) return null;

  const claimed = (decoded as Record<string, unknown>).globalRole;
  return typeof claimed === 'string' ? claimed : '';
}

export default async function SpendAnalyticsPage() {
  const role = await resolveGlobalRole();

  if (role === null) redirect(LOGIN_REDIRECT);
  if (!canViewSpendAnalytics(role)) redirect(FORBIDDEN_REDIRECT);

  return <AnalyticsPageShell />;
}
