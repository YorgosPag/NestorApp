'use client';

/**
 * **«Ζήτησες να μπεις σε ΓΡΑΦΕΙΟ»** — η οθόνη της εκκρεμούς αίτησης (ADR-660).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΛΛΑΞΕ ΣΗΜΑΣΙΑ 2026-08-23 — ΚΑΙ Η ΣΗΜΑΣΙΑ ΗΤΑΝ ΤΟ ΕΛΑΤΤΩΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα αυτή η σελίδα ήταν η **προσγείωση κάθε** αυτο-εγγεγραμμένου χωρίς
 * `companyId` — δηλαδή **η πρώτη οθόνη του πολίτη** που μόλις γράφτηκε, και του
 * έλεγε *«ο λογαριασμός σας εκκρεμεί έγκριση»*. Η λέξη «εγγραφή» όμως σημαίνει
 * **δύο** πράγματα:
 *
 * | *«θέλω να **μπω στο γραφείο σου**»* | ⇒ έγκριση, **σωστά** |
 * | *«θέλω να **υπάρχω**»*              | ⇒ **ποτέ** έγκριση (ADR-787 Ε-3) |
 *
 * Ο κώδικας ήξερε μόνο το πρώτο. Η προσγείωση ανήκει πλέον στον
 * `resolvePostLoginRoute` (`lib/routes/landing.ts`) και **δεν στέλνει κανέναν εδώ**·
 * η σελίδα μιλά μόνο για το **αίτημα εισόδου σε ξένο χώρο**.
 *
 * ⚠️ **Η ΠΟΡΤΑ ΕΞΟΔΟΥ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ.** Σήμερα **δεν** υπάρχει σήμα που να
 * ξεχωρίζει *«ζήτησα γραφείο»* από *«απλώς γράφτηκα»* — το πεδίο `status:'pending'`
 * δεν το διαβάζει κανένας φρουρός και **δεν υπάρχει σε κανένα έγγραφο** (μετρημένο
 * 2026-08-23: 4 χρήστες, 0 pending). Άρα όποιος φτάσει εδώ με απευθείας διεύθυνση
 * **πρέπει** να έχει δρόμο προς τα εμπρός· αλλιώς η οθόνη ξαναγίνεται ο τοίχος που
 * μόλις έπαψε να είναι *(«end the onboarding flow inside a useful screen, not on a
 * dead-end confirmation»)*.
 *
 * ⚠️ **Καμία αυτόματη ανακατεύθυνση προς τον ιδιωτικό χώρο**: θα έκανε τη σελίδα
 * **απρόσιτη** και για τον επαγγελματία που όντως περιμένει απάντηση — δηλαδή θα
 * έσβηνε τη μία περίπτωση που την δικαιολογεί.
 *
 * @see ADR-657 §3.5 (fail-closed) · ADR-244 (η κονσόλα έγκρισης)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, LogOut, RefreshCw, ArrowRight } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { PageLoadingState } from '@/core/states';
import { AUTH_ROUTES, PRIVATE_SPACE_HOME, resolvePostLoginRoute } from '@/lib/routes';

export default function PendingApprovalPage() {
  const { user, loading, signOut, refreshToken } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('auth');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(AUTH_ROUTES.login);
      return;
    }
    if (user.companyId) {
      // Το αίτημα απαντήθηκε ⇒ φύγε. Ο ΙΔΙΟΣ επιλυτής με κάθε άλλη προσγείωση —
      // ποτέ ωμό `/` (εκεί ζει η ΔΗΜΟΣΙΑ οθόνη, ADR-777 §8.13) και ποτέ δεύτερη
      // απόφαση δίπλα στην πρώτη (ADR-749).
      router.replace(resolvePostLoginRoute(user));
    }
  }, [user, loading, router]);

  // Μεταβατικές καταστάσεις (φόρτωση / redirect) → spinner, όχι flash της οθόνης.
  if (loading || !user || user.companyId) {
    return <PageLoadingState icon={ShieldCheck} message={t('loading.checkingAccess')} layout="fullscreen" />;
  }

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      await refreshToken();
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <header className="space-y-3">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            {t('pendingApproval.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('pendingApproval.subtitle')}
          </p>
        </header>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('pendingApproval.body')}
        </p>

        <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('pendingApproval.signedInAs')}: </span>
          <strong className="break-all">{user.email}</strong>
        </p>

        <div className="flex flex-col gap-2">
          {/*
            Η ΠΡΩΤΗ πράξη είναι ο ΔΙΚΟΣ ΤΟΥ χώρος, όχι η αναμονή: ο άνθρωπος έχει
            ήδη πού να πάει, και το κουμπί το λέει πριν από οτιδήποτε άλλο.
          */}
          <Button asChild className="w-full">
            <Link href={PRIVATE_SPACE_HOME}>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {t('pendingApproval.goToMySpace')}
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleCheckAgain}
            disabled={checking}
            className="w-full"
          >
            <RefreshCw className={checking ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
            {t('pendingApproval.checkAgain')}
          </Button>
          <Button variant="ghost" onClick={() => void signOut()} className="w-full text-muted-foreground">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t('pendingApproval.signOut')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('pendingApproval.help')}
        </p>
      </section>
    </main>
  );
}
