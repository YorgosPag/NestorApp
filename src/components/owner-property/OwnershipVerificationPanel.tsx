'use client';

/**
 * @fileoverview **«Επαλήθευση ιδιοκτησίας»** — η κάρτα του ιδιοκτήτη (ADR-900 §3.8).
 *
 * Σχήμα Zillow «Claim your home» → Owner Dashboard: ο **δηλωμένος** βλέπει ζώνες («τουλάχιστον 3»), ο
 * **επαληθευμένος** τον ακριβή αριθμό. Η κάρτα λέει **γιατί** να επαληθεύσει, **πώς** (ΠΚΑ, Taxisnet, 5 €),
 * και — όταν η μηχανή δεν αποδεικνύει — **τι** κρίνει ο άνθρωπος της ουράς, με κλειστούς λόγους.
 *
 * Semantic: `<section>` με επικεφαλίδα, κατάσταση σε `<p role="status">`, λόγοι σε `<ul>`, άρνηση σε
 * `<aside role="alert">` με διέξοδο (σχήμα `MandateRequestOutcomeNotice`).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PRIVATE_PROFILE_ROUTE } from '@/lib/routes/accountRoutes';
import { Link } from '@/lib/workspace/navigation';
import {
  useOwnershipVerification,
  type OwnershipSubmitState,
} from '@/hooks/owner-property/useOwnershipVerification';
import type { OwnershipVerificationView } from '@/types/ownership-verification';
import {
  OWNERSHIP_KEYS,
  OWNERSHIP_NS,
  REASON_KEYS,
  STATUS_KEYS,
  SUBMIT_ERROR_KEYS,
} from './ownership-verification-labels';

export interface OwnershipVerificationPanelProps {
  readonly ownerPropertyId: string;
  /** Ο φάκελος της αγγελίας — εκεί φυλάσσεται το ΠΚΑ. `null` ⇒ παλιά αγγελία χωρίς φάκελο. */
  readonly dossier: { readonly id: string; readonly userId: string; readonly label: string } | null;
}

function CertificatePicker({ label, disabled, onFile }: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onFile: (file: File) => void;
}): React.ReactElement {
  const inputId = React.useId();
  return (
    <>
      <label
        htmlFor={inputId}
        aria-disabled={disabled}
        className="inline-block cursor-pointer rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept="application/pdf"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
        className="sr-only"
      />
    </>
  );
}

function VerificationStatus({ verification }: { readonly verification: OwnershipVerificationView }): React.ReactElement {
  const { t } = useTranslation([OWNERSHIP_NS]);
  return (
    <>
      <p role="status" className="m-0 text-sm font-medium text-foreground">{t(STATUS_KEYS[verification.status].title)}</p>
      <p className="m-0 text-sm text-muted-foreground">
        {t(STATUS_KEYS[verification.status].detail, { kaek: verification.kaek ?? '' })}
      </p>
      {verification.status === 'pending-review' && verification.reasons.length > 0 && (
        <>
          <p className="m-0 text-sm text-muted-foreground">{t(OWNERSHIP_KEYS.reasonsHeading)}</p>
          <ul className="m-0 list-disc pl-5 text-sm text-muted-foreground">
            {verification.reasons.map((reason) => <li key={reason}>{t(REASON_KEYS[reason])}</li>)}
          </ul>
        </>
      )}
    </>
  );
}

function SubmitFailure({ submit }: { readonly submit: OwnershipSubmitState }): React.ReactElement | null {
  const { t } = useTranslation([OWNERSHIP_NS]);
  if (submit.state !== 'failed') return null;
  return (
    <aside role="alert" className="flex flex-col items-start gap-2 rounded-md border border-border bg-card p-3 text-sm text-foreground">
      <p className="m-0">{t(SUBMIT_ERROR_KEYS[submit.code])}</p>
      {submit.code === 'identity-incomplete' && (
        <Link href={PRIVATE_PROFILE_ROUTE} className="font-medium text-foreground underline underline-offset-4">
          {t(OWNERSHIP_KEYS.remedyProfile)}
        </Link>
      )}
    </aside>
  );
}

export function OwnershipVerificationPanel({ ownerPropertyId, dossier }: OwnershipVerificationPanelProps): React.ReactElement {
  const { t } = useTranslation([OWNERSHIP_NS]);
  const { status, submit, submitCertificate } = useOwnershipVerification(ownerPropertyId, dossier);
  const headingId = React.useId();
  const verification = status.state === 'ready' ? status.verification : null;
  const canSubmit = dossier !== null && status.state === 'ready' && verification?.status !== 'verified'
    && verification?.status !== 'pending-review';

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(OWNERSHIP_KEYS.heading)}</h3>
      {status.state === 'loading' && <p className="m-0 text-sm text-muted-foreground">{t(OWNERSHIP_KEYS.loading)}</p>}
      {status.state === 'unavailable' && <p className="m-0 text-sm text-muted-foreground">{t(OWNERSHIP_KEYS.unavailable)}</p>}
      {verification !== null && <VerificationStatus verification={verification} />}
      {status.state === 'ready' && verification === null && (
        <>
          <p className="m-0 text-sm text-foreground">{t(OWNERSHIP_KEYS.intro)}</p>
          <p className="m-0 text-sm text-muted-foreground">{t(OWNERSHIP_KEYS.howTo)}</p>
        </>
      )}
      {dossier === null && <p className="m-0 text-sm text-muted-foreground">{t(OWNERSHIP_KEYS.noDossier)}</p>}
      {canSubmit && (
        <CertificatePicker
          label={t(submit.state === 'submitting' ? OWNERSHIP_KEYS.submitting : verification === null ? OWNERSHIP_KEYS.upload : OWNERSHIP_KEYS.uploadAgain)}
          disabled={submit.state === 'submitting'}
          onFile={(file) => void submitCertificate(file)}
        />
      )}
      <SubmitFailure submit={submit} />
      <p className="m-0 text-xs text-muted-foreground">{t(OWNERSHIP_KEYS.privacy)}</p>
    </section>
  );
}
