'use client';

import { useEffect } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useAuth } from '@/auth';
import { useTranslation } from '@/i18n';
import { DashboardHome } from '@/components/dashboard/DashboardHome';
import { LayoutDashboard } from 'lucide-react';
import { PageLoadingState } from '@/core/states';
import { AUTH_ROUTES, resolvePostLoginRoute } from '@/lib/routes';
import { createStaleCache } from '@/lib/stale-cache';

// SSoT stale-while-revalidate cache (ADR-300) — stores auth-known state.
// DashboardHome is fully static — safe to render optimistically on re-navigation.
const authCache = createStaleCache<boolean>('dashboard-auth');

/**
 * `/dashboard` — **ο χώρος εργασίας** (ADR-179: Hybrid Navigation Dashboard).
 *
 * Συνδεδεμένος → Dashboard Home (πλακίδια πλοήγησης, ύφος SAP Fiori)
 * Ανώνυμος → `/login`
 *
 * 🔴 **ΜΕΤΑΚΟΜΙΣΕ ΑΠΟ ΤΟ `/` (2026-08-11, ADR-777 §8.13).** Όσο ζούσε στη ρίζα, το
 * `router.replace('/login')` παρακάτω χτυπούσε **κάθε ανώνυμο επισκέπτη του
 * nestorconstruct.gr** — δηλαδή η δημόσια πόρτα του προϊόντος ήταν **κλειδαριά**. Η
 * ρίζα ανήκει πλέον στην **οθόνη 1** (Α3). Η ανακατεύθυνση **εδώ** παραμένει σωστή:
 * αυτή η σελίδα *είναι* πίσω από τη σύνδεση.
 *
 * ⚠️ Καμία «αρχική» δεν δείχνει σε literal `'/'`: όλες περνούν από
 * {@link AUTH_ROUTES}`.home`, που είναι το ένα σημείο που μετακόμισε.
 */
export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Boy Scout (N.11): το μήνυμα ήταν **ωμό ελληνικό** στη σήμανση. Το `common`
  // ταξιδεύει ΟΛΟΚΛΗΡΟ στο shell slice (`shell-slice.whole.json`), άρα το κλειδί
  // απαντιέται **σύγχρονα** στο πρώτο καρέ — καμία ανταλλαγή σκληρού κειμένου με
  // ωμό κλειδί (CHECK 3.51).
  const { t } = useTranslation('common');

  // 🔴 ADR-660 (2026-08-23) — Η ΣΕΛΙΔΑ ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ ΠΛΕΟΝ **ΠΟΥ** ΑΝΗΚΕΙ Ο ΑΝΘΡΩΠΟΣ.
  //
  // Πριν, έκρινε μόνη της `!user.companyId` και έστελνε σε **ωμό** `/pending-approval`
  // — δηλαδή ο πολίτης που μόλις γράφτηκε έβλεπε ως πρώτη οθόνη έναν τοίχο που του
  // έλεγε «δεν υπάρχεις». Η ερώτηση «ποια είναι η αρχική ΑΥΤΟΥ του ανθρώπου;» έχει
  // πλέον **έναν** απαντητή (`lib/routes/landing.ts`)· εδώ μένει μόνο η ερώτηση
  // «είναι **αυτή** η σελίδα δική του;».
  //
  // ⚠️ Η απουσία `companyId` **δεν** είναι λόγος για ουρά έγκρισης — είναι απλώς
  //    ένδειξη ότι ο άνθρωπος ενεργεί στον **δικό του** χώρο (ADR-787 Ε-3).
  const landing = user ? resolvePostLoginRoute(user) : null;
  const belongsHere = landing === AUTH_ROUTES.home;

  useEffect(() => {
    if (!loading) {
      authCache.set(!!user);
    }
    if (!loading && !user) {
      router.replace(AUTH_ROUTES.login);
      return;
    }
    if (!loading && landing !== null && !belongsHere) {
      router.replace(landing);
    }
  }, [user, loading, router, landing, belongsHere]);

  // First visit: show loading until auth resolves.
  // Subsequent navigations: cache hit → render immediately (ADR-300).
  if (loading && !(authCache.hasLoaded() && authCache.get() === true)) {
    return (
      <PageLoadingState
        icon={LayoutDashboard}
        message={t('loading.dashboard')}
        layout="fullscreen"
      />
    );
  }

  if (!loading && !user) {
    return null;
  }

  // Ο άνθρωπος ανήκει αλλού → μην κάνεις flash τον χώρο εργασίας όσο φεύγει.
  if (!loading && user && !belongsHere) {
    return null;
  }

  return <DashboardHome />;
}