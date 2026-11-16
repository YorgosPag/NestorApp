'use client';

/**
 * @fileoverview ADR-915 §28 · §42 — **η απάντηση με τον σύνδεσμο**: ο επαγγελματίας δίνει **προσφορά** (ή αρνείται), ο
 *   υπεύθυνος **εγκρίνει την προσφορά** (πρόσωπο και τιμή μαζί) ή όχι. Παλιές αναθέσεις (§27): «Αναλαμβάνω/Αρνούμαι».
 * @related DocumentRequestGate.tsx (η είσοδος) · DocumentRequestQuote.tsx · document-request-api.ts ·
 *   server/issuance-invitations/issuance-invitation-answer.ts
 * @module app/(auth)/document-request/DocumentRequestCard
 *
 * 🔑 **Πρώτα ποιος και τι, μετά το κουμπί** (anti-phishing, ίδια σειρά με το email): γραφείο · ακίνητο · έγγραφο ·
 *    επαγγελματίας με **δηλωμένο** προσόν και σύνδεσμο ελέγχου μητρώου.
 * 🔑 **«Για: <όνομα>»** — η σελίδα λέει σε ποιον απευθύνεται και ζητά από όποιον δεν είναι αυτός να **μην** απαντήσει
 *    (αντιστάθμιση προώθησης, §28 Η-Β6).
 * 🔑 Η πράξη φεύγει **μόνο** από κουμπί (POST)· το άνοιγμα της σελίδας δεν αλλάζει τίποτα.
 * 🔑 §42 — ο υπεύθυνος στέλνει **την αναθεώρηση που είδε**: αν η τιμή άλλαξε στο μεταξύ, ο μειωτής αρνείται.
 */

import React, { useId, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import { DOCUMENT_KIND_LABEL_KEYS, qualificationText } from '@/components/document-registry/document-registry-labels';
import { IssuanceAdvanceSchedule } from '@/components/document-registry/IssuanceAdvanceSchedule';
import { IssuanceQuoteFields } from '@/components/document-registry/IssuanceQuoteFields';
import { emptyQuoteDraft, quoteTermsFromDraft, type QuoteDraft } from '@/components/document-registry/issuance-quote-draft';
import { AuthCardSection } from '@/components/ui/auth-card-section';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { qualificationLookupUrl } from '@/config/document-validity/document-issuers';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISSUANCE_NOTE_MAX } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceLinkAnswer, IssuanceLinkAnswerBody } from '@/lib/document-validity/issuance-request';
import { formatDate } from '@/lib/intl-formatting';
import { Link } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import type { IssuanceLinkView, IssuanceSpaceView } from '@/types/issuance-invitation';

import { DocumentRequestFailureState } from './DocumentRequestFailureState';
import { Fact } from './DocumentRequestFact';
import { emptyOwnersDraft, ownerAttestationFromDraft, type OwnersDraft } from './document-request-owners-draft';
import { DocumentRequestOwners } from './DocumentRequestOwners';
import { QuoteBriefFacts, QuoteFacts } from './DocumentRequestQuote';
import { answerDocumentRequest, type DocumentRequestFailure } from './document-request-api';

type Translate = ReturnType<typeof useTranslation>['t'];


/** Τα λόγια ανά βήμα — κάθε κλειδί κυριολεκτικό (CHECK 3.34 τα λύνει στατικά). */
function stepTexts(t: Translate, view: IssuanceLinkView) {
  switch (view.step) {
    case 'approve-quote': return {
      heading: t('document-request:owner.heading'), intro: t('document-request:owner.quoteIntro'),
      yes: t('document-request:owner.approveQuote'), no: t('document-request:owner.rejectQuote'),
    };
    case 'give-quote': return {
      heading: t('document-request:professional.quoteHeading'), intro: t('document-request:professional.quoteIntro'),
      yes: t('document-request:professional.submitQuote'), no: t('document-request:professional.noQuote'),
    };
    case 'legacy-accept': return {
      heading: t('document-request:professional.heading'), intro: t('document-request:professional.intro'),
      yes: t('document-request:professional.accept'), no: t('document-request:professional.decline'),
    };
  }
}

function doneText(t: Translate, answer: IssuanceLinkAnswer): string {
  switch (answer) {
    case 'approve': return t('document-request:done.approved');
    case 'reject': return t('document-request:done.rejected');
    case 'accept': return t('document-request:done.accepted');
    case 'decline': return t('document-request:done.declined');
    case 'quote': return t('document-request:done.quoted');
  }
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
      {view.quote === null ? null : <QuoteFacts quote={view.quote} />}
      {view.note === null ? null : <Fact term={t('document-request:facts.note')}>{view.note}</Fact>}
      <Fact term={t('document-request:facts.expires')}>{formatDate(view.expiresAt)}</Fact>
    </dl>
  );
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'done'; readonly answer: IssuanceLinkAnswer; readonly space: IssuanceSpaceView }
  | { readonly kind: 'failed'; readonly failure: DocumentRequestFailure };

/**
 * §39 — **το επόμενο βήμα μετά την ανάθεση**: ο χώρος της, με λογαριασμό στη διεύθυνση του συνδέσμου. Ο σύνδεσμος ήρθε
 * **και** με email (η απόδειξη) — αν ο άνθρωπος κλείσει τη σελίδα, δεν χάνεται.
 */
function SpaceNextStep({ space }: { readonly space: IssuanceSpaceView }) {
  const { t } = useTranslation(['document-request']);
  if (space.kind === 'none') return null;
  // Κυριολεκτικά κλειδιά (ADR-744): ο γεννήτορας του slice διαβάζει μόνο ό,τι λύνεται στατικά.
  if (space.kind === 'no-project') return <p className="m-0 text-sm text-muted-foreground">{t('document-request:space.noProject')}</p>;
  if (space.kind === 'no-authority') return <p className="m-0 text-sm text-muted-foreground">{t('document-request:space.noAuthority')}</p>;
  return (
    <section className="flex flex-col gap-2" aria-label={t('document-request:space.heading')}>
      <h2 className="m-0 text-base font-semibold text-card-foreground">{t('document-request:space.heading')}</h2>
      <p className="m-0 text-sm text-card-foreground">{t('document-request:space.body')}</p>
      <Button asChild variant="outline" className={COLOR_BRIDGE.action.primary}>
        <Link href={declaredHref('ADR-915 §39 — η σελίδα της πρόσκλησης στον χώρο, χτισμένη από τον server (`caseInvitationHref`)', space.href)}>{t('document-request:space.open')}</Link>
      </Button>
      <p className="m-0 text-xs text-muted-foreground">{t('document-request:space.emailed')}</p>
    </section>
  );
}

/** §45.15 — το «Εγκρίνω» με το τεκμήριο ιδιοκτητών· `null` όσο λείπει κρίση για κάποιον (ή ΑΦΜ είναι άκυρο). */
function approveBodyOf(view: IssuanceLinkView, owners: OwnersDraft, note: string | null, accessCode: string | null): IssuanceLinkAnswerBody | null {
  const attestation = ownerAttestationFromDraft(view.owners, owners);
  if (view.quote === null || attestation === null) return null;
  return { answer: 'approve', note, accessCode, quoteRevision: view.quote.revision, ownerAttestation: attestation === 'none' ? null : attestation };
}

/**
 * Το σώμα του «ναι» για κάθε βήμα — `null` όσο η προσφορά δεν είναι πλήρης (το κουμπί μένει ανενεργό). Ο υπεύθυνος
 * στέλνει την αναθεώρηση που **βλέπει**.
 */
function yesBodyOf(view: IssuanceLinkView, drafts: { readonly quote: QuoteDraft; readonly owners: OwnersDraft }, note: string | null, accessCode: string | null): IssuanceLinkAnswerBody | null {
  const draft = drafts.quote;
  switch (view.step) {
    case 'approve-quote': return approveBodyOf(view, drafts.owners, note, accessCode);
    case 'legacy-accept': return { answer: 'accept', note, accessCode };
    case 'give-quote': {
      const terms = quoteTermsFromDraft(draft);
      return terms === null ? null : { answer: 'quote', note, accessCode, terms };
    }
  }
}

function noBodyOf(view: IssuanceLinkView, note: string | null, accessCode: string | null): IssuanceLinkAnswerBody | null {
  if (view.step !== 'approve-quote') return { answer: 'decline', note, accessCode };
  return view.quote === null ? null : { answer: 'reject', note, accessCode, quoteRevision: view.quote.revision };
}

/** `accessCode` (§29): ο κωδικός που ξεκλείδωσε την όψη — ξανακρίνεται με την απάντηση· `null` = ο σύνδεσμος αρκεί. */
export function DocumentRequestCard({ token, view, accessCode }: { readonly token: string; readonly view: IssuanceLinkView; readonly accessCode: string | null }) {
  const { t } = useTranslation(['document-request']);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<QuoteDraft>(() => emptyQuoteDraft());
  const [owners, setOwners] = useState<OwnersDraft>(() => emptyOwnersDraft());
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const noteId = useId();
  const texts = stepTexts(t, view);
  const answer = async (body: IssuanceLinkAnswerBody | null) => {
    if (body === null) return;
    setPhase({ kind: 'sending' });
    const outcome = await answerDocumentRequest(token, body);
    setPhase(outcome.ok ? { kind: 'done', answer: outcome.data.answer, space: outcome.data.space } : { kind: 'failed', failure: outcome.failure });
  };
  if (phase.kind === 'failed') return <DocumentRequestFailureState failure={phase.failure} />;
  if (phase.kind === 'done') {
    return (
      <AuthCardSection gap={2} role="status">
        <h1 className="m-0 text-lg font-semibold text-card-foreground">{doneText(t, phase.answer)}</h1>
        <p className="m-0 text-sm text-muted-foreground">{t('document-request:done.officeTold')}</p>
        <SpaceNextStep space={phase.space} />
      </AuthCardSection>
    );
  }
  const sending = phase.kind === 'sending';
  const trimmed = note.trim() || null;
  const yesBody = yesBodyOf(view, { quote: draft, owners }, trimmed, accessCode);
  return (
    <AuthCardSection gap={4}>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-lg font-semibold text-card-foreground">{texts.heading}</h1>
        <p className="m-0 text-sm text-card-foreground">{t('document-request:page.for', { name: view.recipientName ?? t('document-request:facts.unnamed') })}</p>
        <p className="m-0 text-xs text-muted-foreground">{t('document-request:page.notYou')}</p>
      </header>
      <p className="m-0 text-sm text-card-foreground">{texts.intro}</p>
      <RequestFacts view={view} />
      {view.quote?.advance ? <IssuanceAdvanceSchedule terms={view.quote.advance} /> : null}
      {view.brief === null ? null : <QuoteBriefFacts brief={view.brief} />}
      {view.step === 'give-quote' ? <IssuanceQuoteFields draft={draft} onChange={setDraft} disabled={sending} /> : null}
      {view.owners !== null && view.owners.length > 0 ? (
        <DocumentRequestOwners owners={view.owners} draft={owners} onChange={setOwners} disabled={sending} complete={yesBody !== null} />
      ) : null}
      <Label htmlFor={noteId} className="text-sm font-medium">{t('document-request:page.noteLabel')}</Label>
      <Textarea id={noteId} value={note} maxLength={ISSUANCE_NOTE_MAX} onChange={(event) => setNote(event.target.value)} disabled={sending} />
      <p className="m-0 text-xs text-muted-foreground">{t('document-request:page.recordedOnly')}</p>
      <footer className="flex flex-wrap gap-2">
        {/* ADR-770 §18.6: `variant="default"` = `bg-primary` ≡ `--card` στο σκοτεινό ⇒ το «ναι» δεν ξεχώριζε (ADR-915 §29.1). */}
        <Button type="button" variant="outline" className={COLOR_BRIDGE.action.primary} onClick={() => { void answer(yesBody); }} disabled={sending || yesBody === null}>{texts.yes}</Button>
        <Button type="button" variant="outline" onClick={() => { void answer(noBodyOf(view, trimmed, accessCode)); }} disabled={sending}>{texts.no}</Button>
      </footer>
      {sending ? <p role="status" className="m-0 text-xs text-muted-foreground">{t('document-request:page.sending')}</p> : null}
    </AuthCardSection>
  );
}
