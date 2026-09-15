'use client';

/**
 * @fileoverview **ΟΙ ΠΡΟΤΙΜΗΣΕΙΣ EMAIL, ΧΩΡΙΣ ΣΥΝΔΕΣΗ** — «λιγότερα» ή «κανένα», με αναίρεση.
 * @related ADR-848 · ADR-849 Α2 (email ανά τύπο) · app/api/notifications/email/subscription/route.ts
 * @module components/notifications/EmailPreferencesPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ Ο ΕΝΑΣ ΣΤΑΘΜΟΣ ΠΟΥ ΠΡΟΣΘΕΤΟΥΜΕ
 * ────────────────────────────────────────────────────────────────────────────
 * - **Χωρίς σύνδεση** (Google: η διαγραφή «must not require the recipient to log in»).
 * - **«Λιγότερα» δίπλα στο «κανένα»** (Medium · LinkedIn): μία σύνοψη την ημέρα αντί
 *   για διακοπή — ο άνθρωπος που ενοχλείται από τον **ρυθμό** δεν χάνεται ολόκληρος.
 * - **Ανά τύπο** (ADR-849, LinkedIn/Zillow): «όχι ταιριάσματα, ναι εντολές» — στο
 *   `EmailTypePreferences`, με τους τύπους του email που σε έφερε **μπροστά**.
 * - **Αναίρεση που επαναφέρει ΑΚΡΙΒΩΣ — και ΜΟΝΟ ό,τι άλλαξε** (Gmail): καθολική αλλαγή ⇒
 *   `restore` των καθολικών· αλλαγή τύπου ⇒ ο ίδιος τύπος στην προηγούμενη κατάσταση.
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

import { EmailTypePreferences } from '@/components/notifications/EmailTypePreferences';
import { preferenceRowOf } from '@/services/user-notification-settings/notification-preference-table';
import { Button } from '@/components/ui/button';
import { AuthCardSection } from '@/components/ui/auth-card-section';
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
import type { EmailTypeMode } from '@/services/user-notification-settings/user-notification-settings.email-types';

registerRouteSlice(routeSlice);

const NS = 'auth';

/** Ό,τι έλυσε ο διακομιστής — **τίποτα δεν ξαναρωτιέται από τον πελάτη**. */
export type EmailPreferencesView =
  | {
      readonly kind: 'ready';
      readonly token: string;
      readonly state: EmailSubscriptionState;
      /** ADR-849 — οι τύποι της εμβέλειας του token: μπαίνουν **μπροστά**. */
      readonly focus: readonly string[];
    }
  | { readonly kind: 'refused'; readonly reason: SubscriptionFailure };

/** Ρητές φάσεις — ποτέ `isLoading` + `error` + `data` μαζί. */
type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | {
      readonly kind: 'done';
      readonly change: EmailSubscriptionChange;
      readonly previous: EmailSubscriptionState;
      /** `false` όταν η ίδια η αλλαγή **ήταν** αναίρεση — καμία «αναίρεση της αναίρεσης». */
      readonly undoable: boolean;
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

const DONE_KEYS: Readonly<Record<Exclude<EmailSubscriptionChange['kind'], 'type'>, string>> = {
  unsubscribe: 'auth:emailPreferences.done.unsubscribe',
  daily: 'auth:emailPreferences.done.daily',
  restore: 'auth:emailPreferences.done.restore',
};

const TYPE_DONE_KEYS: Readonly<Record<EmailTypeMode, string>> = {
  off: 'auth:emailPreferences.done.typeOff',
  on: 'auth:emailPreferences.done.typeOn',
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

/**
 * **Η αναίρεση μιας αλλαγής — ΜΟΝΟ ό,τι άλλαξε** (ADR-849).
 *
 * Αλλαγή τύπου ⇒ ο ίδιος τύπος στην κατάσταση που είχε στο `previous`· καθολική ⇒ τα
 * καθολικά του `previous`. Ποτέ ολόκληρη η λίστα τύπων: θα έσβηνε ό,τι άλλαξε στο μεταξύ
 * η οθόνη ρυθμίσεων.
 */
function undoOf(change: EmailSubscriptionChange, previous: EmailSubscriptionState): EmailSubscriptionChange {
  if (change.kind === 'type') {
    const [first] = change.settings;
    const mode: EmailTypeMode = first !== undefined && previous.mutedTypes.includes(first) ? 'off' : 'on';
    return { kind: 'type', settings: change.settings, mode };
  }
  return { kind: 'restore', state: { emailEnabled: previous.emailEnabled, emailFrequency: previous.emailFrequency } };
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    // CHECK 3.63 (ADR-797) `[page-measure]` — το πλάτος της κάρτας auth ζει ονομασμένο
    // στο `layout.cardAuthWidth`, και η ίδια η κάρτα **μία φορά** στο `AuthCardSection`.
    <AuthCardSection gap={4}>
      <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
      {children}
    </AuthCardSection>
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

/** Το μήνυμα επιτυχίας — για τύπο, **ονομάζει** τον τύπο με την ετικέτα της οθόνης. */
function DoneMessage({ change }: { change: EmailSubscriptionChange }) {
  const { t } = useTranslation([NS, 'common-account']);
  if (change.kind !== 'type') return <>{t(DONE_KEYS[change.kind])}</>;
  const row = preferenceRowOf(change.settings[0] ?? '');
  return <>{t(TYPE_DONE_KEYS[change.mode], { type: row ? t(row.labelKey) : '' })}</>;
}

/** Το αποτέλεσμα της τελευταίας πράξης — ζωντανή περιοχή για τον αναγνώστη οθόνης. */
function Outcome(props: { phase: Phase; onUndo: (change: EmailSubscriptionChange) => void }) {
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
      <DoneMessage change={phase.change} />
      {phase.undoable && (
        <Button variant="link" className="h-auto p-0" onClick={() => props.onUndo(undoOf(phase.change, phase.previous))}>
          {t('auth:emailPreferences.undo')}
        </Button>
      )}
    </p>
  );
}

function ReadyPanel(props: { token: string; initial: EmailSubscriptionState; focus: readonly string[] }) {
  const { t } = useTranslation([NS, 'common-account']);
  const [state, setState] = useState(props.initial);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const { token } = props;

  const submit = useCallback(
    async (change: EmailSubscriptionChange, undoable = true) => {
      setPhase({ kind: 'sending' });
      const result = await postChange(token, change);
      if (!result.ok) {
        setPhase({ kind: 'failed', reason: result.reason });
        return;
      }
      setState(result.current);
      setPhase({ kind: 'done', change, previous: result.previous, undoable });
    },
    [token],
  );
  const busy = phase.kind === 'sending';

  return (
    <PanelShell title={t('auth:emailPreferences.title')}>
      <StateLine state={state} />
      <Actions state={state} busy={busy} onChange={(change) => submit(change)} />
      <Outcome phase={phase} onUndo={(change) => submit(change, false)} />
      <EmailTypePreferences
        mutedTypes={state.mutedTypes}
        focus={props.focus}
        emailsOn={emailsAreOn(state)}
        busy={busy}
        onToggle={(path, mode) => submit({ kind: 'type', settings: [path], mode })}
      />
      <p className="text-xs text-muted-foreground">{t('common-account:account.notificationSettings.preferences.mandatoryNote')}</p>
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
  return <ReadyPanel token={view.token} initial={view.state} focus={view.focus} />;
}
