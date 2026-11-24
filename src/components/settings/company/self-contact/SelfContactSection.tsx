'use client';

/**
 * @fileoverview **«Η επαφή του χώρου»** στις Ρυθμίσεις → Εταιρεία → Στοιχεία (ADR-951).
 * @module components/settings/company/self-contact/SelfContactSection
 *
 * Τέσσερις όψεις, όλες από την απάντηση του server: **συνδεδεμένη** · **πρόταση** από το ΑΦΜ · **πολλές** με το ίδιο
 * ΑΦΜ (διαλέγει ο άνθρωπος) · **καμία** (δημιουργία από τα στοιχεία του χώρου — μοτίβο Odoo).
 * 🔑 Αν η επαφή έχει δική της εικόνα, η σύνδεση **ρωτά** αν θα γίνει λογότυπο του χώρου — ποτέ σιωπηλή αντικατάσταση.
 * 🔑 Ενέργειες μόνο όταν ο server απαντά `canEdit` — η οθόνη δεν δείχνει κουμπί που ο server θα αρνηθεί.
 * 🔑 Με πρόταση, **πρώτα η σύνδεση**: η δημιουργία γίνεται δευτερεύουσα («Καμία από αυτές…») και, αν ο server βρει
 *    επαφή με το ίδιο ΑΦΜ, ζητά ρητή επιβεβαίωση (`TaxIdTakenPrompt`, ADR-951 §4).
 */

import { useId, useState } from 'react';
import { Building2, Link2, Link2Off, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getEntityHref } from '@/lib/navigation/entity-href';
import { Link } from '@/lib/workspace/navigation';
import type {
  SelfContactCandidate,
  SelfContactLogoChoice,
  SelfContactRefusal,
  SelfContactResponse,
  SelfContactSuggestion,
} from '@/types/company-self-contact';
import { TaxIdTakenPrompt } from './TaxIdTakenPrompt';
import { useSelfContact, type SelfContactPending, type SelfContactProblem } from './useSelfContact';

const REFUSAL_KEY: Readonly<Record<Exclude<SelfContactRefusal, 'tax-id-taken'>, string>> = {
  'contact-not-found': 'orgStructure.selfContact.refusal.contactNotFound',
  'not-a-company': 'orgStructure.selfContact.refusal.notACompany',
  'contact-inactive': 'orgStructure.selfContact.refusal.contactInactive',
  'already-linked': 'orgStructure.selfContact.refusal.alreadyLinked',
  'contact-image-unavailable': 'orgStructure.selfContact.refusal.contactImageUnavailable',
  'contact-image-refused': 'orgStructure.selfContact.refusal.contactImageRefused',
  'profile-nameless': 'orgStructure.selfContact.refusal.profileNameless',
};

const SUGGESTION_KEY: Readonly<Record<SelfContactSuggestion['kind'], string>> = {
  suggested: 'orgStructure.selfContact.suggestion.suggested',
  ambiguous: 'orgStructure.selfContact.suggestion.ambiguous',
  none: 'orgStructure.selfContact.suggestion.none',
  'no-tax-id': 'orgStructure.selfContact.suggestion.noTaxId',
};

/** Τα προβλήματα που λέγονται σε μία γραμμή — το `tax-id-taken` έχει δική του επιβεβαίωση. */
function problemKey(problem: Exclude<SelfContactProblem, { readonly kind: 'tax-id-taken' }>): string {
  if (problem.kind === 'refused') return REFUSAL_KEY[problem.refusal];
  return problem.kind === 'load-failed' ? 'orgStructure.selfContact.loadFailed' : 'orgStructure.selfContact.saveFailed';
}

interface CandidateProps {
  readonly candidate: SelfContactCandidate;
  readonly busy: boolean;
  /** Από τον server (`canEdit`) — χωρίς δικαίωμα, η επαφή φαίνεται χωρίς ενέργεια. */
  readonly canEdit: boolean;
  readonly onLink: (contactId: string, choice: SelfContactLogoChoice) => void;
}

/** Μία υποψήφια επαφή — με ερώτηση εικόνας όταν έχει δική της. */
function CandidateRow({ candidate, busy, canEdit, onLink }: CandidateProps) {
  const { t } = useTranslation('org-structure');
  const [asking, setAsking] = useState(false);
  const link = (choice: SelfContactLogoChoice) => { setAsking(false); onLink(candidate.contactId, choice); };
  return (
    <li className="space-y-2 rounded-md border border-border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="h-4 w-4" aria-hidden />
        <Link href={getEntityHref('contact', candidate.contactId)} className="underline underline-offset-2">
          {candidate.displayName || t('orgStructure.selfContact.unnamedContact')}
        </Link>
      </p>
      {!canEdit ? null : asking ? (
        <fieldset className="space-y-2">
          <legend className="text-sm text-muted-foreground">{t('orgStructure.selfContact.imageQuestion')}</legend>
          <Button type="button" size="sm" disabled={busy} onClick={() => link('keep-workspace-logo')}>{t('orgStructure.selfContact.keepWorkspaceLogo')}</Button>{' '}
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => link('use-contact-image')}>{t('orgStructure.selfContact.useContactImage')}</Button>
        </fieldset>
      ) : (
        <Button
          type="button" size="sm" disabled={busy}
          onClick={() => (candidate.hasOwnImage ? setAsking(true) : link('keep-workspace-logo'))}
        >
          <Link2 className="mr-1 h-4 w-4" aria-hidden />{t('orgStructure.selfContact.thisIsUs')}
        </Button>
      )}
    </li>
  );
}

interface ViewProps {
  readonly view: SelfContactResponse;
  readonly pending: SelfContactPending;
  readonly onLink: (contactId: string, choice: SelfContactLogoChoice) => void;
  readonly onCreate: (confirmDuplicateTaxId?: boolean) => void;
  readonly onUnlink: () => void;
}

/** Η όψη χωρίς δεσμό — πρόταση · πολλές · καμία. */
function UnlinkedView({ view, pending, onLink, onCreate }: Omit<ViewProps, 'onUnlink'>) {
  const { t } = useTranslation('org-structure');
  const busy = pending !== null;
  const canEdit = view.canEdit;
  const suggestion = view.suggestion;
  const candidates = suggestion?.kind === 'suggested' ? [suggestion.candidate] : suggestion?.kind === 'ambiguous' ? suggestion.candidates : [];
  const intro = SUGGESTION_KEY[suggestion?.kind ?? 'none'];
  const createLabel = candidates.length > 0
    ? 'orgStructure.selfContact.createAnother'
    : 'orgStructure.selfContact.createFromWorkspace';
  return (
    <>
      <p className="text-sm text-muted-foreground">{t(intro)}</p>
      {candidates.length > 0 ? (
        <ul className="space-y-2">
          {candidates.map((c) => <CandidateRow key={c.contactId} candidate={c} busy={busy} canEdit={canEdit} onLink={onLink} />)}
        </ul>
      ) : null}
      {canEdit ? (
        <Button
          type="button" size="sm" variant={candidates.length > 0 ? 'ghost' : 'outline'} disabled={busy}
          onClick={() => onCreate()}
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          {pending === 'create' ? t('orgStructure.selfContact.creating') : t(createLabel)}
        </Button>
      ) : null}
    </>
  );
}

function LinkedView({ view, pending, onUnlink }: Pick<ViewProps, 'view' | 'pending' | 'onUnlink'>) {
  const { t } = useTranslation('org-structure');
  if (view.linked === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-3 text-sm">
      <Building2 className="h-4 w-4" aria-hidden />
      <Link href={getEntityHref('contact', view.linked.contactId)} className="font-medium underline underline-offset-2">
        {view.linked.displayName || t('orgStructure.selfContact.unnamedContact')}
      </Link>
      {view.canEdit ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending !== null} onClick={onUnlink}>
          <Link2Off className="mr-1 h-4 w-4" aria-hidden />
          {pending === 'unlink' ? t('orgStructure.selfContact.unlinking') : t('orgStructure.selfContact.unlink')}
        </Button>
      ) : null}
    </p>
  );
}

export function SelfContactSection({ onBrandLogoChanged }: { readonly onBrandLogoChanged: () => void }) {
  const { t } = useTranslation('org-structure');
  const { state, link, create, unlink, dismissProblem } = useSelfContact(onBrandLogoChanged);
  const titleId = useId();
  const view = state.view;
  const problem = state.problem;
  return (
    <section aria-labelledby={titleId} className="space-y-3 py-6">
      <header className="space-y-1">
        <h2 id={titleId} className="text-base font-semibold">{t('orgStructure.selfContact.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('orgStructure.selfContact.description')}</p>
      </header>
      {view?.linked ? <LinkedView view={view} pending={state.pending} onUnlink={() => void unlink()} /> : null}
      {view !== null && view.linked === null ? (
        <UnlinkedView view={view} pending={state.pending} onLink={(id, c) => void link(id, c)} onCreate={(c) => void create(c)} />
      ) : null}
      {problem?.kind === 'tax-id-taken' ? (
        <TaxIdTakenPrompt
          holders={problem.holders} busy={state.pending !== null}
          onCreateAnyway={() => void create(true)} onCancel={dismissProblem}
        />
      ) : null}
      {problem !== null && problem.kind !== 'tax-id-taken' ? (
        <p role="alert" className="text-sm text-destructive">{t(problemKey(problem))}</p>
      ) : null}
    </section>
  );
}
