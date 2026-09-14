'use client';

/**
 * @fileoverview **«ΛΑΜΒΑΝΕΙ ΑΥΤΟ ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ;»** — η οθόνη του παραλήπτη (ADR-841 §7 Α21.18).
 * @related app/(auth)/card-email/[token]/page.tsx · components/mandate/MandateConsentContent.tsx (το πρότυπο)
 * @module components/mandate/ShowcaseEmailConfirmationContent
 *
 * 🔑 **Δύο κουμπιά ίσης θέσης**: «Επιβεβαίωση» και «Δεν το ζήτησα εγώ». Όταν ο άνθρωπος ήρθε από τον
 * σύνδεσμο άρνησης (`disownFirst`) η άρνηση μπαίνει **πρώτη** — δεν του ζητάμε να ψάξει το «όχι».
 *
 * ⚠️ **Η απάντηση κλειδώνει**, αντίθετα από τη συγκατάθεση εντολής: επιβεβαίωση γραμματοκιβωτίου είναι
 * **γεγονός** («έλαβα»), όχι γνώμη. Όποιος θέλει να αναιρεθεί, ζητά από το γραφείο να βγάλει τη διεύθυνση.
 *
 * ⚠️ Καμία συμβολοσειρά οθόνης εδώ (N.11) — κλειδιά στο `property-market:mandate.cardEmail`.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { emailConfirmationDecisionPath } from '@/components/mandate/showcase-card-paths';
import type { ShowcaseEmailConfirmationLookup } from '@/services/mandate/showcase-email-confirmation-decision';
import type { ShowcaseEmailConfirmationDecision, ShowcaseEmailConfirmationRefusal } from '@/types/showcase-email-confirmation';

// 🧩 ADR-744 — PER-ROUTE SLICE ΤΗΣ `/card-email/[token]`. Στατική εισαγωγή σε εμβέλεια module, στο
//    Client Component (ίδιος λόγος με το `MandateConsentContent`): αλλιώς ωμά κλειδιά στο πρώτο καρέ.
import routeSlice from '@/i18n/generated/routes/card-email__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'property-market';
const K = `${NS}:mandate.cardEmail`;

type FailureReason = ShowcaseEmailConfirmationRefusal | 'unavailable';

type Phase =
  | { readonly kind: 'asking' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'answered'; readonly decision: ShowcaseEmailConfirmationDecision }
  | { readonly kind: 'failed'; readonly reason: FailureReason };

function reasonOf(body: unknown): FailureReason {
  const reason = (body as { reason?: unknown } | null)?.reason;
  return typeof reason === 'string' ? (reason as FailureReason) : 'unavailable';
}

function useDecision(token: string): { readonly phase: Phase; readonly decide: (decision: ShowcaseEmailConfirmationDecision) => Promise<void> } {
  const [phase, setPhase] = useState<Phase>({ kind: 'asking' });
  async function decide(decision: ShowcaseEmailConfirmationDecision): Promise<void> {
    setPhase({ kind: 'sending' });
    try {
      const response = await fetch(emailConfirmationDecisionPath(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const body: unknown = await response.json().catch(() => null);
      setPhase(response.ok ? { kind: 'answered', decision } : { kind: 'failed', reason: reasonOf(body) });
    } catch {
      setPhase({ kind: 'failed', reason: 'unavailable' });
    }
  }
  return { phase, decide };
}

/**
 * 🔑 **Το πλάτος το κατέχει η κάρτα — με ΟΝΟΜΑ** (ADR-797 / CHECK 3.63): το `(auth)/layout.tsx` δηλώνει «κανένα
 * `measure`, την κάρτα την κεντράρει και την πλαταίνει η ίδια». Ωμό `mx-auto max-w-md` θα ήταν ακόμη ένα αντίγραφο
 * της κλίμακας — ίδια θεραπεία με το αδελφό `GuestContactContent` (`layout.cardAuthWidth`).
 */
function Shell({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const layout = useLayoutClasses();
  return (
    <section className={`${layout.cardAuthWidth} flex flex-col gap-5 rounded-lg border border-border bg-card p-6`}>
      {children}
    </section>
  );
}

function Decision({
  phase,
  disownFirst,
  onDecide,
}: {
  readonly phase: Phase;
  readonly disownFirst: boolean;
  readonly onDecide: (decision: ShowcaseEmailConfirmationDecision) => void;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  if (phase.kind === 'answered') {
    return (
      <p role="status" className="text-sm font-medium text-card-foreground">
        {phase.decision === 'confirm' ? t(`${K}.confirmedBody`) : t(`${K}.disownedBody`)}
      </p>
    );
  }
  const sending = phase.kind === 'sending';
  const confirm = (
    <Button key="confirm" type="button" variant={disownFirst ? 'outline' : 'default'} disabled={sending} onClick={() => onDecide('confirm')}>
      {sending ? t(`${K}.sending`) : t(`${K}.confirm`)}
    </Button>
  );
  const disown = (
    <Button key="disown" type="button" variant={disownFirst ? 'default' : 'outline'} disabled={sending} onClick={() => onDecide('disown')}>
      {t(`${K}.disown`)}
    </Button>
  );
  return (
    <footer className="flex flex-col gap-3">
      {phase.kind === 'failed' ? (
        <p role="alert" className="text-sm font-medium text-destructive">{t(`${K}.reason.${phase.reason}`)}</p>
      ) : null}
      <span className="flex flex-wrap gap-2">{disownFirst ? [disown, confirm] : [confirm, disown]}</span>
    </footer>
  );
}

export function ShowcaseEmailConfirmationContent({
  token,
  lookup,
  disownFirst,
}: {
  readonly token: string;
  readonly lookup: ShowcaseEmailConfirmationLookup;
  readonly disownFirst: boolean;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { phase, decide } = useDecision(token);

  if (!lookup.ok) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-card-foreground">{t(`${K}.title`)}</h1>
        <p role="alert" className="text-sm text-muted-foreground">{t(`${K}.reason.${lookup.reason}`)}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-card-foreground">{t(`${K}.title`)}</h1>
        <p className="text-sm text-muted-foreground">
          {t(`${K}.intro`, { agency: lookup.view.agencyName, email: lookup.view.email })}
        </p>
      </header>
      <p className="text-sm text-muted-foreground">{t(`${K}.explain`)}</p>
      <Decision phase={phase} disownFirst={disownFirst} onDecide={(decision) => void decide(decision)} />
    </Shell>
  );
}
