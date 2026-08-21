'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — «θέλεις να το διαφημίσει αυτό το γραφείο;»
 * @related ADR-777 §8.33 · app/(auth)/mandate/[token]/page.tsx
 * @module components/mandate/MandateConsentContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΑΥΤΗ Η ΟΘΟΝΗ ΔΕΝ ΚΑΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Δεν ζητά σύνδεση.** Ο άνθρωπος απέναντι δεν έχει λογαριασμό και δεν πρόκειται
 *    να αποκτήσει επειδή του ζητήσαμε να απαντήσει «ναι» ή «όχι».
 * 2. **Δεν δείχνει τίποτα του επιπέδου Β.** Ούτε διεύθυνση, ούτε τιμή, ούτε αρχεία —
 *    μόνο τον **τίτλο**, το **γραφείο** και τη **λήξη**. Είναι ό,τι χρειάζεται για να
 *    πάρει τεκμηριωμένη απόφαση, και τίποτα που να μη δικαιούται να δει ένας
 *    κάτοχος συνδέσμου.
 * 3. **Δεν κλειδώνει την απάντηση.** Το «μπορείτε να αλλάξετε γνώμη» δεν είναι
 *    ευγένεια: ο **δρόμος της βεβαίωσης γραφείου** στηρίζεται σε αυτό — εκεί ο
 *    σύνδεσμος είναι **αντίρρησης**, πάνω σε εντολή ήδη ενεργή.
 *
 * ⚠️ **Καμία συμβολοσειρά οθόνης δεν ζει εδώ** (N.11). Το `search-results` ταξιδεύει
 * **ολόκληρο** στο κέλυφος (`shell-slice.whole.json`), οπότε τα κλειδιά απαντώνται
 * ήδη στο **πρώτο καρέ** του διακομιστή — κανένα ωμό κλειδί, χωρίς νέο μηχανισμό
 * (CHECK 3.51).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/intl-formatting';

const NS = 'property-market';
const K = `${NS}:mandate.consent`;

/** Ό,τι έλυσε ο διακομιστής — **τίποτα δεν ξαναρωτιέται από τον πελάτη**. */
export interface MandateConsentView {
  readonly token: string;
  readonly listingTitle: string;
  readonly agencyName: string | null;
  readonly mandateExpiresAt: string;
  readonly currentDecision: 'pending' | 'confirmed' | 'declined';
}

/**
 * Πού βρίσκεται η οθόνη.
 *
 * 🔑 **Ρητές καταστάσεις, ποτέ `isLoading` + `error` + `data` μαζί.** Τα τρία
 * ανεξάρτητα σημαία επιτρέπουν τέσσερις συνδυασμούς που δεν σημαίνουν τίποτα («φορτώνει
 * ΚΑΙ απέτυχε»), και η οθόνη τους ζωγραφίζει σιωπηλά.
 */
type Phase =
  | { readonly kind: 'asking' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'answered'; readonly decision: 'confirmed' | 'declined' }
  | { readonly kind: 'failed'; readonly reason: string };

export function MandateConsentContent({
  view,
}: {
  view: MandateConsentView;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [phase, setPhase] = useState<Phase>(
    view.currentDecision === 'pending'
      ? { kind: 'asking' }
      : { kind: 'answered', decision: view.currentDecision },
  );

  async function decide(decision: 'confirmed' | 'declined'): Promise<void> {
    setPhase({ kind: 'sending' });
    try {
      const response = await fetch(`/api/mandate/${encodeURIComponent(view.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.ok) {
        setPhase({ kind: 'answered', decision });
        return;
      }
      // ⚠️ Ο κωδικός του διακομιστή γίνεται **κλειδί**, ποτέ κείμενο: το μήνυμα ζει
      // στα locale και μεταφράζεται· ένα `body.message` θα ήταν ωμό κείμενο από το
      // δίκτυο, δηλαδή αμετάφραστο για πάντα.
      const reason = (body as { reason?: unknown } | null)?.reason;
      setPhase({
        kind: 'failed',
        reason: typeof reason === 'string' ? reason : 'write-failed',
      });
    } catch {
      setPhase({ kind: 'failed', reason: 'write-failed' });
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border border-border bg-card p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-card-foreground">{t(`${K}.title`)}</h1>
        <p className="text-sm text-muted-foreground">
          {view.agencyName === null
            ? t(`${K}.introNoAgency`)
            : t(`${K}.introWithAgency`, { agency: view.agencyName })}
        </p>
      </header>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{t(`${K}.listingLabel`)}</dt>
          <dd className="font-medium text-card-foreground">{view.listingTitle}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{t(`${K}.untilLabel`)}</dt>
          <dd className="font-medium text-card-foreground">
            {formatDate(view.mandateExpiresAt)}
          </dd>
        </div>
      </dl>

      <p className="text-sm text-muted-foreground">{t(`${K}.explain`)}</p>

      <MandateConsentDecision phase={phase} onDecide={decide} />
    </section>
  );
}

/**
 * Το μέρος που **αλλάζει** — απομονωμένο ώστε η κάρτα να μένει μία ανάγνωση.
 *
 * ⚠️ Το `answered` **δεν κρύβει τα κουμπιά**: του λέει τι ισχύει και τον αφήνει να το
 * αλλάξει. Μια οθόνη που εξαφανίζει την επιλογή μετά την πρώτη απάντηση μετατρέπει
 * ένα λάθος κλικ σε **μη αναστρέψιμη δήλωση για την περιουσία του**.
 */
function MandateConsentDecision({
  phase,
  onDecide,
}: {
  phase: Phase;
  onDecide: (decision: 'confirmed' | 'declined') => void;
}): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    <footer className="flex flex-col gap-3">
      {phase.kind === 'answered' && (
        <p className="text-sm font-medium text-card-foreground">
          {phase.decision === 'confirmed'
            ? t(`${K}.approvedBody`)
            : t(`${K}.declinedBody`)}
        </p>
      )}

      {phase.kind === 'failed' && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {t(`${K}.reason.${phase.reason}`)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={phase.kind === 'sending'}
          onClick={() => onDecide('confirmed')}
        >
          {phase.kind === 'sending' ? t(`${K}.sending`) : t(`${K}.approve`)}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={phase.kind === 'sending'}
          onClick={() => onDecide('declined')}
        >
          {t(`${K}.decline`)}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t(`${K}.changeMind`)}</p>
    </footer>
  );
}
