'use client';

/**
 * Pending Approval — landing για αυτο-εγγεγραμμένους χρήστες χωρίς tenant (ADR-660).
 *
 * Ο χρήστης είναι αυθεντικοποιημένος αλλά ΔΕΝ έχει `companyId` claim → το
 * fail-closed (ADR-657) του αρνείται κάθε δεδομένο. Αντί για σπασμένη app, εδώ
 * βλέπει φιλική οθόνη «εκκρεμεί έγκριση». Μόλις ένας admin τον εγκρίνει (κονσόλα
 * Διαχείρισης Ρόλων → set-user-claims) και ξανασυνδεθεί, το claim εμφανίζεται και
 * ανακατευθύνεται στην εφαρμογή.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { PageLoadingState } from '@/core/states';

export default function PendingApprovalPage() {
  const { user, loading, signOut, refreshToken } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('auth');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.companyId) {
      router.replace('/');
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
          <Button onClick={handleCheckAgain} disabled={checking} className="w-full">
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
