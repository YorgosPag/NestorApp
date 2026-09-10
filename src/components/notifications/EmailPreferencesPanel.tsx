'use client';

/**
 * @fileoverview **ΟΙ ΠΡΟΤΙΜΗΣΕΙΣ EMAIL, ΧΩΡΙΣ ΣΥΝΔΕΣΗ** — «λιγότερα» ή «κανένα», με αναίρεση.
 * @related ADR-848 · app/api/notifications/email/subscription/route.ts
 * @module components/notifications/EmailPreferencesPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ Ο ΕΝΑΣ ΣΤΑΘΜΟΣ ΠΟΥ ΠΡΟΣΘΕΤΟΥΜΕ
 * ────────────────────────────────────────────────────────────────────────────
 * - **Χωρίς σύνδεση** (Google: η διαγραφή «must not require the recipient to log in»).
 * - **«Λιγότερα» δίπλα στο «κανένα»** (Medium · LinkedIn): μία σύνοψη την ημέρα αντί
 *   για διακοπή — ο άνθρωπος που ενοχλείται από τον **ρυθμό** δεν χάνεται ολόκληρος.
 * - **Αναίρεση που επαναφέρει ΑΚΡΙΒΩΣ** (Gmail): το endpoint επιστρέφει το
 *   `previous`, και η αναίρεση το στέλνει πίσω αυτούσιο — ποτέ «ξαναενεργοποίησε»
 *   που θα έχανε ένα `weekly`.
 *
 * ⚠️ **Το GET δεν αλλάζει τίποτα** — η σελίδα μόνο **δείχνει**· κάθε αλλαγή είναι
 * POST πίσω από κουμπί. Οι σαρωτές συνδέσμων ανοίγουν τη σελίδα χωρίς συνέπεια.
 *
 * ⚠️ **Αναμονή, όχι αισιόδοξη ενημέρωση** (N.7.2 #6): μια διαγραφή που «φάνηκε» να
 * πέτυχε ενώ δεν γράφτηκε είναι ακριβώς το ψέμα που κάνει τον άνθρωπο να πατήσει
 * «Αναφορά ως ανεπιθύμητο».
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/email/preferences/[token]`. Ψυχρή είσοδος
// από email, χωρίς προηγούμενη πλοήγηση: ωμό κλειδί εδώ είναι η ΜΟΝΗ πληροφορία που θα
// είχε ο άνθρωπος. Στατική εισαγωγή, εμβέλεια MODULE, ΠΟΤΕ στο Server Component.
import routeSlice from '@/i18n/generated/routes/email__preferences__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import {
  emailsAreOn,
  parseSubscriptionResponse,
  type EmailSubscriptionChange,
  type EmailSubscriptionState,
  type SubscriptionFailure,
  type SubscriptionResponse,
} from '@/lib/notifications/email-subscription-contract';
import { emailOneClickHref } from '@/lib/notifications/email-subscription-routes';

registerRouteSlice(routeSlice);

const NS = 'auth';

/** Ό,τι έλυσε ο διακομιστής — **τίποτα δεν ξαναρωτιέται από τον πελάτη**. */
export type EmailPreferencesView =
  | { readonly kind: 'ready'; readonly token: string; readonly state: EmailSubscriptionState }
  | { readonly kind: 'refused'; readonly reason: SubscriptionFailure };

/** Ρητές φάσεις — ποτέ `isLoading` + `error` + `data` μαζί. */
type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | {
      readonly kind: 'done';
      readonly change: EmailSubscriptionChange['kind'];
      readonly previous: EmailSubscriptionState;
    }
  | { readonly kind: 'failed'; readonly reason: SubscriptionFailure };

// ⚠️ ΠΛΗΡΗ κλειδιά σε πίνακες και ΟΧΙ πρότυπα `…failure.${reason}`: ο γεννήτορας του
// route slice λύνει σταθερούς πίνακες, ενώ ένα πρότυπο είναι «ανεπίλυτη δυναμική κλήση»
// που τον κάνει να αρνηθεί να εκπέμψει (ADR-744).
const FAILURE_KEYS: Readonly<Record<SubscriptionFailure, string>> = {
  'link-invalid': 'auth:emailPreferences.failure.linkInvalid',
  'request-invalid': 'auth:emailPreferences.failure.requestInvalid',
  'service-unavailable': 'auth:emailPreferences.failure.serviceUnavailable',
  'write-failed': 'auth:emailPreferences.failure.writeFailed',
};

const DONE_KEYS: Readonly<Record<EmailSubscriptionChange['kind'], string>> = {
  unsubscribe: 'auth:emailPreferences.done.unsubscribe',
  daily: 'auth:emailPreferences.done.daily',
  restore: 'auth:emailPreferences.done.restore',
};

const FREQUENCY_KEYS: Readonly<Record<'realtime' | 'daily' | 'weekly', string>> = {
  realtime: 'auth:emailPreferences.frequency.realtime',
  daily: 'auth:emailPreferences.frequency.daily',
  weekly: 'auth:emailPreferences.frequency.weekly',
};

/** Η αλλαγή στο endpoint — η απάντηση **ελέγχεται**, ποτέ δεν πιστεύεται. */
async function postChange(token: string, change: EmailSubscriptionChange): Promise<SubscriptionResponse> {
  try {
    const response = await fetch(emailOneClickHref(token), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ change }),
    });
    return parseSubscriptionResponse(await response.json().catch(() => null));
  } catch {
    return { ok: false, reason: 'service-unavailable' };
  }
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  const layout = useLayoutClasses();
  return (
    // CHECK 3.63 (ADR-797) `[page-measure]` — το πλάτος της κάρτας auth ζει ονομασμένο
    // στο `layout.cardAuthWidth` (ίδια συμβολοσειρά με το `max-w-md`), όχι χειρόγραφο.
    <section className={`${layout.cardAuthWidth} flex flex-col gap-4 rounded-lg border border-border bg-card p-6`}>
      <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
      {children}
    </section>
  );
}

/** Τι ισχύει τώρα, σε μία πρόταση. */
function StateLine({ state }: { state: EmailSubscriptionState }) {
  const { t } = useTranslation([NS]);
  if (!emailsAreOn(state) || state.emailFrequency === 'disabled') {
    return <p className="text-sm text-card-foreground">{t('auth:emailPreferences.stateOff')}</p>;
  }
  const frequency = t(FREQUENCY_KEYS[state.emailFrequency]);
  return <p className="text-sm text-card-foreground">{t('auth:emailPreferences.stateOn', { frequency })}</p>;
}

/** Οι επιλογές — **μόνο** όσες αλλάζουν κάτι στην τρέχουσα κατάσταση. */
function Actions(props: {
  state: EmailSubscriptionState;
  busy: boolean;
  onChange: (change: EmailSubscriptionChange) => void;
}) {
  const { t } = useTranslation([NS]);
  const on = emailsAreOn(props.state);
  const alreadyDaily = on && props.state.emailFrequency === 'daily';

  return (
    <nav className="flex flex-col gap-2" aria-label={t('auth:emailPreferences.title')}>
      {on && (
        <Button disabled={props.busy} onClick={() => props.onChange({ kind: 'unsubscribe' })}>
          {t('auth:emailPreferences.unsubscribe')}
        </Button>
      )}
      {!alreadyDaily && (
        <Button variant="outline" disabled={props.busy} onClick={() => props.onChange({ kind: 'daily' })}>
          {t(on ? 'auth:emailPreferences.daily' : 'auth:emailPreferences.dailyResume')}
        </Button>
      )}
    </nav>
  );
}

/** Το αποτέλεσμα της τελευταίας πράξης — ζωντανή περιοχή για τον αναγνώστη οθόνης. */
function Outcome(props: { phase: Phase; onUndo: (previous: EmailSubscriptionState) => void }) {
  const { t } = useTranslation([NS]);
  const { phase } = props;

  if (phase.kind === 'sending') {
    return <p role="status" className="text-sm text-muted-foreground">{t('auth:emailPreferences.sending')}</p>;
  }
  if (phase.kind === 'failed') {
    return <p role="alert" className="text-sm text-destructive">{t(FAILURE_KEYS[phase.reason])}</p>;
  }
  if (phase.kind !== 'done') return null;

  return (
    <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-card-foreground">
      {t(DONE_KEYS[phase.change])}
      {phase.change !== 'restore' && (
        <Button variant="link" className="h-auto p-0" onClick={() => props.onUndo(phase.previous)}>
          {t('auth:emailPreferences.undo')}
        </Button>
      )}
    </p>
  );
}

function ReadyPanel({ token, initial }: { token: string; initial: EmailSubscriptionState }) {
  const { t } = useTranslation([NS]);
  const [state, setState] = useState(initial);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const submit = useCallback(
    async (change: EmailSubscriptionChange) => {
      setPhase({ kind: 'sending' });
      const result = await postChange(token, change);
      if (!result.ok) {
        setPhase({ kind: 'failed', reason: result.reason });
        return;
      }
      setState(result.current);
      setPhase({ kind: 'done', change: change.kind, previous: result.previous });
    },
    [token],
  );

  return (
    <PanelShell title={t('auth:emailPreferences.title')}>
      <StateLine state={state} />
      <Actions state={state} busy={phase.kind === 'sending'} onChange={submit} />
      <Outcome phase={phase} onUndo={(previous) => submit({ kind: 'restore', state: previous })} />
      <p className="text-xs text-muted-foreground">{t('auth:emailPreferences.mandatoryNote')}</p>
    </PanelShell>
  );
}

export function EmailPreferencesPanel({ view }: { view: EmailPreferencesView }): React.ReactElement {
  const { t } = useTranslation([NS]);

  if (view.kind === 'refused') {
    return (
      <PanelShell title={t('auth:emailPreferences.title')}>
        <p role="alert" className="text-sm text-muted-foreground">{t(FAILURE_KEYS[view.reason])}</p>
      </PanelShell>
    );
  }
  return <ReadyPanel token={view.token} initial={view.state} />;
}
