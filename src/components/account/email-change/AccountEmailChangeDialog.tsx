'use client';

/**
 * @fileoverview **Ο ΔΙΑΛΟΓΟΣ ΤΗΣ ΑΛΛΑΓΗΣ EMAIL** — νέα διεύθυνση + κωδικός, (2FA), «κοιτάξτε τα εισερχόμενα» (ADR-850).
 * @related useAccountEmailChange.ts (η λογική) · auth/account-email-change.ts (η Firebase)
 * @module components/account/email-change/AccountEmailChangeDialog
 *
 * 🏆 **Πρότυπο Airbnb / Google Account / GitHub «sudo»**: η αλλαγή ζητά **κωδικό** και
 * ολοκληρώνεται **μόνο** από σύνδεσμο στη νέα διεύθυνση· η παλιά ειδοποιείται με
 * δυνατότητα αναίρεσης (το κάνει η Firebase).
 *
 * 🔴 **`stopPropagation` ΣΤΙΣ ΦΟΡΜΕΣ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΥΠΕΡΒΟΛΗ**: ο διάλογος ζει σε portal,
 * αλλά τα γεγονότα του React **ανεβαίνουν στο δέντρο του React**, όχι του DOM — δηλαδή
 * στη φόρμα του προφίλ που τον περιέχει. Χωρίς αυτό, το «Αποστολή συνδέσμου» θα πατούσε
 * **και** το «Αποθήκευση» του προφίλ.
 */

import React from 'react';

import type { EmailChangeIssue } from '@/auth/account-email-change';
import { AccountNotice } from '@/components/account/AccountNotice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { cn } from '@/lib/design-system';

import { EMAIL_CHANGE_ISSUE_KEYS, EMAIL_CHANGE_KEYS } from './email-change-labels';
import { useAccountEmailChange, type AccountEmailChangeFlow } from './useAccountEmailChange';

export interface AccountEmailChangeDialogProps {
  readonly open: boolean;
  readonly currentEmail: string;
  readonly onClose: () => void;
}

export function AccountEmailChangeDialog({
  open,
  currentEmail,
  onClose,
}: AccountEmailChangeDialogProps): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const flow = useAccountEmailChange();

  // ⚠️ **Δεν κλείνει όσο δουλεύει** — ένα κλείσιμο στη μέση θα άφηνε τον άνθρωπο χωρίς
  //    να ξέρει αν έφυγε ο σύνδεσμος.
  function close(): void {
    if (flow.busy) return;
    flow.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(EMAIL_CHANGE_KEYS.title)}</DialogTitle>
          <DialogDescription>{t(EMAIL_CHANGE_KEYS.description)}</DialogDescription>
        </DialogHeader>
        <EmailChangeStep flow={flow} currentEmail={currentEmail} onCancel={close} />
      </DialogContent>
    </Dialog>
  );
}

function EmailChangeStep({
  flow,
  currentEmail,
  onCancel,
}: {
  readonly flow: AccountEmailChangeFlow;
  readonly currentEmail: string;
  readonly onCancel: () => void;
}): React.JSX.Element {
  switch (flow.phase.kind) {
    case 'credentials':
      return (
        <CredentialsStep
          issue={flow.phase.issue}
          busy={flow.busy}
          currentEmail={currentEmail}
          onSubmit={flow.submitCredentials}
          onCancel={onCancel}
        />
      );
    case 'second-factor':
      return (
        <SecondFactorStep
          issue={flow.phase.issue}
          busy={flow.busy}
          onSubmit={flow.submitCode}
          onCancel={onCancel}
        />
      );
    case 'sent':
      return <SentStep newEmail={flow.phase.newEmail} onDone={onCancel} />;
  }
}

/** Ονομαστικός λόγος — **κλειδί**, ποτέ ελεύθερο κείμενο (N.11). */
function IssueNotice({ issue }: { readonly issue: EmailChangeIssue | null }): React.JSX.Element | null {
  const { t } = useTranslation(COMMON_NAMESPACES);
  if (issue === null) return null;

  return <AccountNotice tone="error">{t(EMAIL_CHANGE_ISSUE_KEYS[issue])}</AccountNotice>;
}

/**
 * ⚠️ **Δέχεται ΚΕΙΜΕΝΟ, όχι κλειδί**: ένα `t(submitKey)` εδώ είναι **δυναμική** κλήση — ο
 * στατικός τεμαχιστής i18n (CHECK 3.34) δεν μπορεί να ξέρει ποιο κλειδί θα ζητηθεί, και
 * **αρνείται** να εκπέμψει το slice της σελίδας. Κάθε καλών μεταφράζει το **δικό του**
 * κυριολεκτικό κλειδί.
 */
function StepActions({
  busy,
  submitLabel,
  onCancel,
}: {
  readonly busy: boolean;
  readonly submitLabel: string;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);

  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
        {t(EMAIL_CHANGE_KEYS.cancel)}
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? t(EMAIL_CHANGE_KEYS.submitting) : submitLabel}
      </Button>
    </DialogFooter>
  );
}

function CredentialsStep({
  issue,
  busy,
  currentEmail,
  onSubmit,
  onCancel,
}: {
  readonly issue: EmailChangeIssue | null;
  readonly busy: boolean;
  readonly currentEmail: string;
  readonly onSubmit: (newEmail: string, password: string) => Promise<void>;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const layout = useLayoutClasses();
  const [newEmail, setNewEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <form
      className={layout.flexColGap4}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void onSubmit(newEmail, password);
      }}
    >
      <fieldset className={layout.flexColGap2}>
        <Label htmlFor="email-change-current">{t(EMAIL_CHANGE_KEYS.currentLabel)}</Label>
        <Input id="email-change-current" value={currentEmail} readOnly />
      </fieldset>
      <fieldset className={layout.flexColGap2}>
        <Label htmlFor="email-change-new">{t(EMAIL_CHANGE_KEYS.newLabel)}</Label>
        <Input
          id="email-change-new"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          disabled={busy}
          required
          autoFocus
        />
      </fieldset>
      <fieldset className={layout.flexColGap2}>
        <Label htmlFor="email-change-password">{t(EMAIL_CHANGE_KEYS.currentPassword)}</Label>
        <Input
          id="email-change-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          required
        />
      </fieldset>
      <IssueNotice issue={issue} />
      <StepActions busy={busy} submitLabel={t(EMAIL_CHANGE_KEYS.submit)} onCancel={onCancel} />
    </form>
  );
}

function SecondFactorStep({
  issue,
  busy,
  onSubmit,
  onCancel,
}: {
  readonly issue: EmailChangeIssue | null;
  readonly busy: boolean;
  readonly onSubmit: (code: string) => Promise<void>;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const layout = useLayoutClasses();
  const [code, setCode] = React.useState('');

  return (
    <form
      className={layout.flexColGap4}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void onSubmit(code);
      }}
    >
      <fieldset className={layout.flexColGap2}>
        <Label htmlFor="email-change-code">{t(EMAIL_CHANGE_KEYS.codeLabel)}</Label>
        {/* ⚠️ Ίδια σύμβαση εισόδου με την εγγραφή 2FA (`TwoFactorEnrollment`): ψηφία μόνο. */}
        <Input
          id="email-change-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          disabled={busy}
          required
          autoFocus
          aria-describedby="email-change-code-hint"
        />
        <p id="email-change-code-hint">{t(EMAIL_CHANGE_KEYS.codeHint)}</p>
      </fieldset>
      <IssueNotice issue={issue} />
      <StepActions busy={busy} submitLabel={t(EMAIL_CHANGE_KEYS.verify)} onCancel={onCancel} />
    </form>
  );
}

/**
 * **Έφυγε** — και λέει την αλήθεια χωρίς να απαριθμεί λογαριασμούς.
 *
 * ⚠️ Το `sentNote` λέει *«ή μήπως χρησιμοποιείται ήδη»* **πάντα**, όχι μόνο όταν ισχύει:
 * διαφορετική οθόνη θα πρόδιδε ποιες διευθύνσεις έχουν λογαριασμό (OWASP).
 */
function SentStep({
  newEmail,
  onDone,
}: {
  readonly newEmail: string;
  readonly onDone: () => void;
}): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const layout = useLayoutClasses();
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <section className={layout.flexColGap4} role="status" aria-live="polite">
      <h3 className={cn(typography.body.base, 'font-medium')}>{t(EMAIL_CHANGE_KEYS.sentTitle)}</h3>
      <p className={typography.body.sm}>{t(EMAIL_CHANGE_KEYS.sentBody, { email: newEmail })}</p>
      <p className={cn(typography.body.xs, colors.text.muted)}>{t(EMAIL_CHANGE_KEYS.sentNote)}</p>
      <DialogFooter>
        <Button type="button" onClick={onDone}>{t(EMAIL_CHANGE_KEYS.done)}</Button>
      </DialogFooter>
    </section>
  );
}
