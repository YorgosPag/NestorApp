'use client';

/**
 * @fileoverview Το περιεχόμενο της παλέτας: μία γραμμή ανά πεδίο πινακίδας (ADR-745 Φ3β).
 *
 * **Δείχνει το «γιατί», όχι ένα ποσοστό.** Κάτω από κάθε πρόταση παρατίθενται οι μαρτυρίες
 * («ταιριάζει το τηλέφωνο», «το όνομα ταιριάζει σε συντομογραφία»). Αυτό είναι το σημείο όπου
 * ξεπερνάμε τα εμπορικά CAD: κανένα δεν εξηγεί την πρόταση που κάνει, οπότε ο χρήστης είτε την
 * εμπιστεύεται τυφλά είτε την αγνοεί.
 *
 * **Ό,τι δεν συνδέεται εμφανίζεται ΜΕ ΑΙΤΙΑ**, ποτέ κρυμμένο (§8 κανόνας 3): «δεν βρέθηκε» και
 * «δεν κοιτάχτηκε» είναι διαφορετικά πράγματα και ο χρήστης πρέπει να τα ξεχωρίζει.
 */

import React from 'react';
import { AlertCircle, Link2Off } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  BindingBlockReason,
  BindingEvidenceKind,
  BindingProposal,
  BindingTargetKind,
} from '@/types/title-block-binding';
import type { TitleBlockFieldKey } from '@/types/title-block-reading';

/**
 * Ρητοί χάρτες κλειδιών — **ποτέ** ``t(`titleBlockBinding.fields.${key}`)``.
 *
 * Ο generator του shell slice (CHECK 3.34) **αρνείται να παράγει** όταν συναντήσει ανεπίλυτη
 * δυναμική `t()`, και το αποτέλεσμα θα ήταν ωμό κλειδί στην οθόνη με τη μετάφραση να **υπάρχει**.
 * Πρότυπο: `LandownerAcquisitionControl.tsx`.
 */
const FIELD_LABEL: Record<TitleBlockFieldKey, string> = {
  employer: 'titleBlockBinding.fields.employer',
  projectTitle: 'titleBlockBinding.fields.projectTitle',
  location: 'titleBlockBinding.fields.location',
  designers: 'titleBlockBinding.fields.designers',
  studyType: 'titleBlockBinding.fields.studyType',
  drawingType: 'titleBlockBinding.fields.drawingType',
  drawingNumber: 'titleBlockBinding.fields.drawingNumber',
  scale: 'titleBlockBinding.fields.scale',
  studyDate: 'titleBlockBinding.fields.studyDate',
  drawnBy: 'titleBlockBinding.fields.drawnBy',
  signature: 'titleBlockBinding.fields.signature',
};

const EVIDENCE_LABEL: Record<BindingEvidenceKind, string> = {
  email: 'titleBlockBinding.evidence.email',
  phone: 'titleBlockBinding.evidence.phone',
  'name-exact': 'titleBlockBinding.evidence.name-exact',
  'name-abbrev': 'titleBlockBinding.evidence.name-abbrev',
  'name-fuzzy': 'titleBlockBinding.evidence.name-fuzzy',
};

const BLOCKED_LABEL: Record<BindingBlockReason, string> = {
  'no-project': 'titleBlockBinding.blocked.no-project',
  'unsupported-field': 'titleBlockBinding.blocked.unsupported-field',
  'no-match': 'titleBlockBinding.blocked.no-match',
  'role-undecided': 'titleBlockBinding.blocked.role-undecided',
};

const TARGET_LABEL: Record<BindingTargetKind, string> = {
  contact: 'titleBlockBinding.target.contact',
  landowner: 'titleBlockBinding.target.landowner',
  'project-address': 'titleBlockBinding.target.project-address',
  'project-field': 'titleBlockBinding.target.project-field',
  'drawing-meta': 'titleBlockBinding.target.drawing-meta',
};

/** Σταθερό κλειδί λίστας: το ίδιο κελί μπορεί να δώσει πολλές προτάσεις (πρόσωπα, ενότητες). */
const proposalKey = (p: BindingProposal, index: number): string =>
  `${p.titleBlockIndex}:${p.sourceHandle}:${p.fieldKey}:${p.personName ?? index}`;

interface Props {
  readonly proposals: readonly BindingProposal[];
}

export const TitleBlockProposalList: React.FC<Props> = ({ proposals }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <ul className="flex flex-col gap-2">
      {proposals.map((proposal, index) => {
        const best = proposal.candidates[0];
        return (
          <li
            key={proposalKey(proposal, index)}
            className="rounded-md border border-border bg-card px-3 py-2"
          >
            <header className="flex items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(FIELD_LABEL[proposal.fieldKey])}
              </h4>
              {best ? (
                <span className="text-[11px] text-muted-foreground">
                  {t(TARGET_LABEL[best.target.kind])}
                </span>
              ) : null}
            </header>

            <p className="mt-1 break-words text-sm text-foreground">
              {proposal.personName ?? proposal.snapshotValue}
            </p>

            {best ? (
              <section className="mt-1.5">
                <p className="text-sm font-medium text-primary">→ {best.label}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {best.evidence.map((item) => (
                    <li
                      key={`${item.kind}:${item.value}`}
                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {t(EVIDENCE_LABEL[item.kind])}
                    </li>
                  ))}
                </ul>
                {proposal.candidates.length > 1 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t('titleBlockBinding.moreCandidates', { count: proposal.candidates.length - 1 })}
                  </p>
                ) : null}
              </section>
            ) : (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                {proposal.blockedBy === 'no-match' ? (
                  <Link2Off className="mt-px size-3 shrink-0" aria-hidden />
                ) : (
                  <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
                )}
                {proposal.blockedBy ? t(BLOCKED_LABEL[proposal.blockedBy]) : null}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
};
