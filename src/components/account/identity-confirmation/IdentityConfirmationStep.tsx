'use client';

/**
 * @fileoverview **«Επιβεβαιώστε ότι είστε εσείς»** — η όψη της επαν-πιστοποίησης, μέσα στην κάρτα που τη ζήτησε (ADR-851 Φ2).
 * @related useIdentityConfirmation.ts (η κρίση και οι πράξεις)
 * @module components/account/identity-confirmation/IdentityConfirmationStep
 *
 * 🏆 **Πρότυπο «sudo»** (ίδιο με την αλλαγή email, ADR-850): ο πάροχος ζήτησε πρόσφατη σύνδεση ⇒ ζητάμε τον κωδικό
 * **επιτόπου** και η πράξη συνεχίζει — ποτέ «αποσυνδεθείτε και ξαναμπείτε» σε όποιον έχει κωδικό να γράψει.
 *
 * Render-only: ο κωδικός ζει **εδώ** ως ελεγχόμενη είσοδος και φεύγει ως όρισμα — δεν αποθηκεύεται πουθενά αλλού.
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

import { AccountNotice } from '@/components/account/AccountNotice';
import { AccountStepIntro } from '@/components/account/AccountStepIntro';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';

import { IDENTITY_BODY_KEYS, IDENTITY_ISSUE_KEYS, IDENTITY_KEYS } from './identity-confirmation-labels';
import type { IdentityPrompt } from './useIdentityConfirmation';

const TITLE_ID = 'identity-confirmation-title';
const PASSWORD_ID = 'identity-confirmation-password';

export interface IdentityConfirmationStepProps {
  readonly prompt: Extract<IdentityPrompt, { kind: 'open' }>;
  readonly busy: boolean;
  readonly onSubmit: (password: string) => Promise<unknown>;
  readonly onCancel: () => void;
}

export function IdentityConfirmationStep({
  prompt,
  busy,
  onSubmit,
  onCancel,
}: IdentityConfirmationStepProps): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const layout = useLayoutClasses();
  const [password, setPassword] = React.useState('');
  const asksPassword = prompt.route === 'password';

  return (
    <form
      className={layout.flexColGap4}
      aria-labelledby={TITLE_ID}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (asksPassword) void onSubmit(password);
      }}
    >
      <AccountStepIntro
        icon={ShieldCheck}
        titleId={TITLE_ID}
        title={t(IDENTITY_KEYS.title)}
        body={t(IDENTITY_BODY_KEYS[prompt.route])}
      />

      {asksPassword && (
        <fieldset className={layout.flexColGap2}>
          <Label htmlFor={PASSWORD_ID}>{t(IDENTITY_KEYS.password)}</Label>
          <Input
            id={PASSWORD_ID}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            required
            autoFocus
          />
        </fieldset>
      )}

      {prompt.issue !== null && <AccountNotice tone="error">{t(IDENTITY_ISSUE_KEYS[prompt.issue])}</AccountNotice>}

      <nav className={layout.flexCenterGap2}>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
          {t(IDENTITY_KEYS.cancel)}
        </Button>
        {asksPassword && (
          <Button type="submit" className="flex-1" disabled={busy || password.length === 0}>
            {t(busy ? IDENTITY_KEYS.confirming : IDENTITY_KEYS.confirm)}
          </Button>
        )}
      </nav>
    </form>
  );
}
