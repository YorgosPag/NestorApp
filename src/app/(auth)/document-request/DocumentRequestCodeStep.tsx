'use client';

/**
 * @fileoverview ADR-915 §29 — **το βήμα του κωδικού**: ο κάτοχος του συνδέσμου γράφει τον 6ψήφιο κωδικό που του είπε το
 *   γραφείο τηλεφωνικά, πριν δει οτιδήποτε για ακίνητο, έγγραφο ή επαγγελματία (πρακτική DocuSign «Access Code»).
 * @related DocumentRequestGate.tsx (ο καλών) · document-request-api.ts (`unlockDocumentRequest`) ·
 *   server/invitations/invitation-access-code.ts (η κρίση)
 * @module app/(auth)/document-request/DocumentRequestCodeStep
 *
 * 🔑 `autoComplete="one-time-code"` + `inputMode="numeric"`: αριθμητικό πληκτρολόγιο στο κινητό, και ο browser προτείνει
 *    τον κωδικό όταν έρθει με SMS (το επόμενο κανάλι — καμία αλλαγή εδώ τότε).
 * 🔒 Ο κωδικός ζει **μόνο** στη μνήμη αυτού του component και ανεβαίνει στον γονέα για την απάντηση· ποτέ σε URL ή storage.
 * 🔑 Λάθος ⇒ «απομένουν Ν προσπάθειες», ανακοινώνεται (`role="alert"`) και η εστίαση μένει στο πεδίο για νέα προσπάθεια.
 */

import React, { useEffect, useId, useRef, useState } from 'react';

import { AuthCardSection } from '@/components/ui/auth-card-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IssuanceLinkGateView, IssuanceLinkView } from '@/types/issuance-invitation';

import { DocumentRequestFailureState } from './DocumentRequestFailureState';
import { unlockDocumentRequest, type DocumentRequestFailure } from './document-request-api';

/** Πόσα ψηφία ζητά ο διακομιστής (`ACCESS_CODE_DIGITS`) — εδώ μόνο ως όριο πληκτρολόγησης, η κρίση είναι του διακομιστή. */
const CODE_LENGTH = 6;

type Phase =
  | { readonly kind: 'idle'; readonly remaining: number | null }
  | { readonly kind: 'checking' }
  | { readonly kind: 'failed'; readonly failure: DocumentRequestFailure };

interface CodeStepProps {
  readonly token: string;
  readonly gate: IssuanceLinkGateView;
  readonly onUnlocked: (view: IssuanceLinkView, accessCode: string) => void;
}

function WrongCode({ remaining }: { readonly remaining: number }) {
  const { t } = useTranslation(['document-request']);
  return (
    <p role="alert" className={`m-0 text-sm ${COLOR_BRIDGE.text.error}`}>
      {remaining === 1 ? t('document-request:code.wrongLast') : t('document-request:code.wrong', { remaining })}
    </p>
  );
}

export function DocumentRequestCodeStep({ token, gate, onUnlocked }: CodeStepProps) {
  const { t } = useTranslation(['document-request']);
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle', remaining: null });
  const inputRef = useRef<HTMLInputElement>(null);
  const codeId = useId();
  const remainingAfterWrong = phase.kind === 'idle' ? phase.remaining : null;
  // Η εστίαση ΜΕΤΑ το re-render: στο ίδιο tick με το λάθος το πεδίο είναι ακόμη `disabled` και το `focus()` χάνεται
  // (μετρημένο σε browser: ο χρήστης πληκτρολογίου έγραφε στο κενό).
  useEffect(() => {
    if (remainingAfterWrong !== null) inputRef.current?.focus();
  }, [remainingAfterWrong]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPhase({ kind: 'checking' });
    const outcome = await unlockDocumentRequest(token, { accessCode: code });
    if (outcome.ok) return onUnlocked(outcome.data.view, code);
    if (outcome.failure !== 'code-wrong') return setPhase({ kind: 'failed', failure: outcome.failure });
    setCode('');
    setPhase({ kind: 'idle', remaining: outcome.remaining });
  };
  if (phase.kind === 'failed') return <DocumentRequestFailureState failure={phase.failure} />;
  const checking = phase.kind === 'checking';
  const remaining = remainingAfterWrong;
  return (
    <AuthCardSection gap={4}>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-lg font-semibold text-card-foreground">{t('document-request:code.heading')}</h1>
        <p className="m-0 text-sm text-card-foreground">{t('document-request:page.for', { name: gate.recipientName ?? t('document-request:facts.unnamed') })}</p>
        <p className="m-0 text-xs text-muted-foreground">{t('document-request:page.notYou')}</p>
      </header>
      <p className="m-0 text-sm text-card-foreground">
        {gate.officeName === null ? t('document-request:code.introUnnamed') : t('document-request:code.intro', { office: gate.officeName })}
      </p>
      <form className="flex flex-col gap-2" onSubmit={(event) => { void submit(event); }} noValidate>
        <Label htmlFor={codeId} className="text-sm font-medium">{t('document-request:code.label')}</Label>
        <Input
          id={codeId}
          ref={inputRef}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          aria-invalid={remaining !== null}
          disabled={checking}
          autoFocus
        />
        {remaining === null ? null : <WrongCode remaining={remaining} />}
        <footer className="flex flex-wrap gap-2">
          <Button type="submit" className={COLOR_BRIDGE.action.primary} disabled={checking || code.length !== CODE_LENGTH}>
            {checking ? t('document-request:code.checking') : t('document-request:code.submit')}
          </Button>
        </footer>
      </form>
      <p className="m-0 text-xs text-muted-foreground">{t('document-request:code.noCode')}</p>
    </AuthCardSection>
  );
}
