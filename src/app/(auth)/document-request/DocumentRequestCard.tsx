'use client';

/**
 * @fileoverview ADR-915 §28 — **η απάντηση με τον σύνδεσμο**: ο υπεύθυνος εγκρίνει/αρνείται, ο επαγγελματίας αποδέχεται/αρνείται.
 * @related DocumentRequestGate.tsx (η είσοδος) · document-request-api.ts · server/issuance-invitations/issuance-invitation-answer.ts
 * @module app/(auth)/document-request/DocumentRequestCard
 *
 * 🔑 **Πρώτα ποιος και τι, μετά το κουμπί** (anti-phishing, ίδια σειρά με το email): γραφείο · ακίνητο · έγγραφο ·
 *    επαγγελματίας με **δηλωμένο** προσόν και σύνδεσμο ελέγχου μητρώου.
 * 🔑 **«Για: <όνομα>»** — η σελίδα λέει σε ποιον απευθύνεται και ζητά από όποιον δεν είναι αυτός να **μην** απαντήσει
 *    (αντιστάθμιση προώθησης, §28 Η-Β6).
 * 🔑 Η πράξη φεύγει **μόνο** από κουμπί (POST)· το άνοιγμα της σελίδας δεν αλλάζει τίποτα.
 */

import React, { useId, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import { DOCUMENT_KIND_LABEL_KEYS, qualificationText } from '@/components/document-registry/document-registry-labels';
import { AuthCardSection } from '@/components/ui/auth-card-section';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { qualificationLookupUrl } from '@/config/document-validity/document-issuers';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISSUANCE_NOTE_MAX } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceLinkAnswer } from '@/lib/document-validity/issuance-request';
import { formatDate } from '@/lib/intl-formatting';
import type { IssuanceLinkView } from '@/types/issuance-invitation';

import { DocumentRequestFailureState } from './DocumentRequestFailureState';
import { answerDocumentRequest, type DocumentRequestFailure } from './document-request-api';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Τα λόγια ανά ακροατήριο — κάθε κλειδί κυριολεκτικό (CHECK 3.34 τα λύνει στατικά). */
function audienceTexts(t: Translate, view: IssuanceLinkView) {
  if (view.audience === 'owner') {
    return {
      heading: t('document-request:owner.heading'),
      intro: t('document-request:owner.intro'),
      yes: t('document-request:owner.approve'),
      no: t('document-request:owner.reject'),
      answers: ['approve', 'reject'] as const,
    };
  }
  return {
    heading: t('document-request:professional.heading'),
    intro: t('document-request:professional.intro'),
    yes: t('document-request:professional.accept'),
    no: t('document-request:professional.decline'),
    answers: ['accept', 'decline'] as const,
  };
}

function doneText(t: Translate, answer: IssuanceLinkAnswer): string {
  switch (answer) {
    case 'approve': return t('document-request:done.approved');
    case 'reject': return t('document-request:done.rejected');
    case 'accept': return t('document-request:done.accepted');
    case 'decline': return t('document-request:done.declined');
  }
}

function Fact({ term, children }: { readonly term: string; readonly children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="m-0 text-sm text-card-foreground">{children}</dd>
    </>
  );
}

function ProfessionalFacts({ professional }: { readonly professional: NonNullable<IssuanceLinkView['professional']> }) {
  const { t } = useTranslation(['document-request', 'document-registry', 'property-market']);
  const lookupUrl = qualificationLookupUrl(professional.qualification);
  const qualification = qualificationText(t, professional.qualification);
  return (
    <>
      <Fact term={t('document-request:facts.professional')}>{professional.name ?? t('document-request:facts.unnamed')}</Fact>
      <Fact term={t('document-request:facts.credential')}>
        <span>{professional.registryNumber === null ? qualification : t('document-request:facts.credentialWithNumber', { qualification, number: professional.registryNumber })}</span>
        {lookupUrl !== null ? (
          <a href={lookupUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs underline underline-offset-4">
            {t('document-request:facts.verifyRegistry')}<ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
      </Fact>
    </>
  );
}

function RequestFacts({ view }: { readonly view: IssuanceLinkView }) {
  const { t } = useTranslation(['document-request', 'conveyance', 'legality']);
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1">
      <Fact term={t('document-request:facts.office')}>{view.officeName ?? t('document-request:facts.unnamed')}</Fact>
      <Fact term={t('document-request:facts.property')}>{view.propertyLabel ?? t('document-request:facts.unnamed')}</Fact>
      <Fact term={t('document-request:facts.document')}>{t(DOCUMENT_KIND_LABEL_KEYS[view.documentKind])}</Fact>
      {view.professional === null ? null : <ProfessionalFacts professional={view.professional} />}
      {view.note === null ? null : <Fact term={t('document-request:facts.note')}>{view.note}</Fact>}
      <Fact term={t('document-request:facts.expires')}>{formatDate(view.expiresAt)}</Fact>
    </dl>
  );
}

type Phase = { readonly kind: 'idle' } | { readonly kind: 'sending' } | { readonly kind: 'done'; readonly answer: IssuanceLinkAnswer } | { readonly kind: 'failed'; readonly failure: DocumentRequestFailure };

/** `accessCode` (§29): ο κωδικός που ξεκλείδωσε την όψη — ξανακρίνεται με την απάντηση· `null` = ο σύνδεσμος αρκεί. */
export function DocumentRequestCard({ token, view, accessCode }: { readonly token: string; readonly view: IssuanceLinkView; readonly accessCode: string | null }) {
  const { t } = useTranslation(['document-request']);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const noteId = useId();
  const texts = audienceTexts(t, view);
  const answer = async (choice: IssuanceLinkAnswer) => {
    setPhase({ kind: 'sending' });
    const outcome = await answerDocumentRequest(token, { answer: choice, note: note.trim() || null, accessCode });
    setPhase(outcome.ok ? { kind: 'done', answer: outcome.data.answer } : { kind: 'failed', failure: outcome.failure });
  };
  if (phase.kind === 'failed') return <DocumentRequestFailureState failure={phase.failure} />;
  if (phase.kind === 'done') {
    return (
      <AuthCardSection gap={2} role="status">
        <h1 className="m-0 text-lg font-semibold text-card-foreground">{doneText(t, phase.answer)}</h1>
        <p className="m-0 text-sm text-muted-foreground">{t('document-request:done.officeTold')}</p>
      </AuthCardSection>
    );
  }
  const sending = phase.kind === 'sending';
  return (
    <AuthCardSection gap={4}>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-lg font-semibold text-card-foreground">{texts.heading}</h1>
        <p className="m-0 text-sm text-card-foreground">{t('document-request:page.for', { name: view.recipientName ?? t('document-request:facts.unnamed') })}</p>
        <p className="m-0 text-xs text-muted-foreground">{t('document-request:page.notYou')}</p>
      </header>
      <p className="m-0 text-sm text-card-foreground">{texts.intro}</p>
      <RequestFacts view={view} />
      <Label htmlFor={noteId} className="text-sm font-medium">{t('document-request:page.noteLabel')}</Label>
      <Textarea id={noteId} value={note} maxLength={ISSUANCE_NOTE_MAX} onChange={(event) => setNote(event.target.value)} disabled={sending} />
      <p className="m-0 text-xs text-muted-foreground">{t('document-request:page.recordedOnly')}</p>
      <footer className="flex flex-wrap gap-2">
        {/* ADR-770 §18.6: `variant="default"` = `bg-primary` ≡ `--card` στο σκοτεινό ⇒ το «ναι» δεν ξεχώριζε (ADR-915 §29.1). */}
        <Button type="button" className={COLOR_BRIDGE.action.primary} onClick={() => { void answer(texts.answers[0]); }} disabled={sending}>{texts.yes}</Button>
        <Button type="button" variant="outline" onClick={() => { void answer(texts.answers[1]); }} disabled={sending}>{texts.no}</Button>
      </footer>
      {sending ? <p role="status" className="m-0 text-xs text-muted-foreground">{t('document-request:page.sending')}</p> : null}
    </AuthCardSection>
  );
}
