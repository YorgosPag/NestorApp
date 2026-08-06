'use client';

/**
 * @fileoverview Μία γραμμή πρότασης — **μαρτυρία, επιλογή, κουμπί** (ADR-745 Φ3β, Τομέας Δ2).
 *
 * Δείχνει το **«γιατί»**, όχι ποσοστό βεβαιότητας. Εκεί ξεπερνάμε τα εμπορικά CAD — κανένα δεν
 * εξηγεί την πρόταση που κάνει, οπότε ο χρήστης είτε την εμπιστεύεται τυφλά είτε την αγνοεί.
 *
 * 🔴 **Ό,τι δεν συνδέεται εμφανίζεται ΜΕ ΑΙΤΙΑ**, ποτέ κρυμμένο (§8 κανόνας 3) — και το ίδιο
 * ισχύει για το **κουμπί**: απενεργοποιημένο χωρίς εξήγηση είναι σφάλμα αναφοράς.
 *
 * 🔴 **Η ΔΙΟΡΘΩΣΗ ΤΗΣ 05/08: εδώ ζούσε `const best = proposal.candidates[0]`.** Σε διφορούμενη
 * ειδικότητα οι υποψήφιοι είναι **ισοδύναμοι** — ίδιο όνομα, ίδια μαρτυρία, άλλος ρόλος — και
 * το κουμπί ήταν **ενεργό**: η βάση έγραφε αυθαίρετο ρόλο. Η επιλογή ανήκει στον άνθρωπο, και
 * όταν δεν την έχει κάνει, το κουμπί **λέει γιατί**.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockProposalRow
 */

import React, { useState } from 'react';
import { AlertCircle, Check, Link2Off, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { parseGreekDecimal } from '@/lib/number/greek-decimal';
import { PROJECT_ROLE_LABEL_NAMESPACE } from '@/config/project-role-labels';
import { SURVEY_RECORD_LABEL_NAMESPACE } from '@/config/survey-record-labels';
import type { BindingCandidate, BindingProposal } from '@/types/title-block-binding';
import { unambiguousWinner } from '@/types/title-block-binding';
import {
  BLOCKED_LABEL,
  BLOCKER_LABEL,
  candidateLabel,
  CAUTION_LABEL,
  FIELD_LABEL,
  TARGET_LABEL,
  type RowBlocker,
} from './proposal-labels';
import { LandownerPercentField, ProposalEvidence } from './proposal-row-parts';
import { TitleBlockCandidatePicker } from './TitleBlockCandidatePicker';
import { TitleBlockContactCreation } from './TitleBlockContactCreation';
import type { ApproveRequest, ApprovalBlocker } from './useTitleBlockApproval';
import type { ProposalPerson } from '@/lib/title-block/contact-prefill';

interface Props {
  readonly proposal: BindingProposal;
  readonly approved: boolean;
  readonly busy: boolean;
  readonly blockerFor: (req: ApproveRequest) => ApprovalBlocker | null;
  readonly onApprove: (req: ApproveRequest) => void;
  readonly onDismiss: () => void;
  /** Ο επιλεγμένος υποψήφιος ζει **στη λίστα**, γιατί συνθέτει το κλειδί έγκρισης (δες εκεί). */
  readonly chosen: BindingCandidate | null;
  readonly onChoose: (candidate: BindingCandidate) => void;
  /**
   * Το πρόσωπο πίσω από την πρόταση — `null` όταν η γραμμή δεν αφορά πρόσωπο.
   *
   * Έρχεται από τη λίστα (που κρατά τις αναγνώσεις) και **όχι** από την ίδια την πρόταση: το
   * `BindingProposal` είναι σκόπιμα το **αποτέλεσμα** του Λ2 και δεν κουβαλά την πρώτη ύλη.
   */
  readonly subject: ProposalPerson | null;
  readonly onContactCreated: () => void;
}

export const TitleBlockProposalRow: React.FC<Props> = ({
  proposal,
  approved,
  busy,
  blockerFor,
  onApprove,
  onDismiss,
  chosen,
  onChoose,
  subject,
  onContactCreated,
}) => {
  // Δύο δανεικά namespaces, και τα δύο για τον **ίδιο** λόγο: το λεξιλόγιο ανήκει σε άλλη
  // οθόνη και δεν ξαναγράφεται εδώ (SSoT). Ο **ρόλος** ζει στο `building-address`· το
  // **«Ναι/Όχι»** μιας λογικής τιμής ζει στην καρτέλα τοπογραφικού (`surveyRecord`), όπου ο
  // μηχανικός θα δει την ίδια λέξη μετά την έγκριση. Χωρίς τη δήλωση βάφεται ωμό κλειδί — για
  // προθεματισμένο κλειδί δεν υπάρχει δίχτυ (δες `roleLabel`). Το φυλάει το
  // `title-block-binding-wiring.test.ts`.
  const { t } = useTranslation([
    'dxf-viewer-shell',
    PROJECT_ROLE_LABEL_NAMESPACE,
    SURVEY_RECORD_LABEL_NAMESPACE,
  ]);

  // Γ6 — η πινακίδα αποδεικνύει ΟΝΟΜΑ, ποτέ μερίδιο. Το κρατάμε ως κείμενο ώστε το άδειο πεδίο
  // να είναι «δεν δηλώθηκε», όχι `0` — που θα σήμαινε «δεν κατέχει τίποτα».
  const [pctText, setPctText] = useState('');

  // 🔑 Η **εμφάνιση** διαβάζει τον πρώτο υποψήφιο, η **εγγραφή** μόνο τον επιλεγμένο. Δεν είναι
  // ασυνέπεια: όλοι οι υποψήφιοι μιας πρότασης μοιράζονται `kind` (ο Λ2 δεν αναμειγνύει είδη
  // στόχου), άρα «είναι οικοπεδούχος;» απαντιέται πριν διαλέξει ο άνθρωπος. Χωρίς αυτό, μια
  // διφορούμενη πρόταση οικοπεδούχου δεν θα έδειχνε ούτε ότι είναι οικοπεδούχος.
  const shape = proposal.candidates[0];
  const needsPercent = shape?.target.kind === 'landowner';
  // Ελληνικό πληκτρολόγιο: «12,5» και «12.5» είναι το ΙΔΙΟ ποσοστό — το ερμηνεύει το SSoT
  // (ADR-397), όχι inline replace.
  const parsedPct = parseGreekDecimal(pctText) ?? undefined;

  const request: ApproveRequest | null = chosen
    ? {
        proposal,
        target: chosen.target,
        ...(parsedPct !== undefined ? { landOwnershipPct: parsedPct } : {}),
      }
    : null;

  // Η αιτία «δεν έχεις διαλέξει» γεννιέται **εδώ**: ο `blockerFor` απαιτεί χτισμένο αίτημα, που
  // χωρίς επιλογή δεν υπάρχει. Πριν από αυτό, το κουμπί έκλεινε από ένα σιωπηλό `!request`.
  const blocker: RowBlocker | null = request ? blockerFor(request) : shape ? 'needsChoice' : null;
  const fieldId = `tbb-${proposal.titleBlockIndex}-${proposal.fieldKey}-${proposal.sourceHandle}`;

  return (
    <li className="rounded-md border border-border bg-card px-3 py-2">
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(FIELD_LABEL[proposal.fieldKey])}
        </h4>
        {shape ? (
          <span className="text-[11px] text-muted-foreground">
            {t(TARGET_LABEL[shape.target.kind])}
          </span>
        ) : null}
      </header>

      <p className="mt-1 break-words text-sm text-foreground">
        {proposal.personName ?? proposal.snapshotValue}
      </p>

      {shape ? (
        <section className="mt-1.5">
          {chosen ? (
            <p className="break-words text-sm font-medium text-primary">
              → {candidateLabel(chosen, t)}
            </p>
          ) : null}
          {/* Το όνομα ως μαρτυρία περισσεύει **μόνο** όταν αποδίδεται η γραμμή «→ …» από πάνω —
              δηλαδή όταν υπάρχει επιλεγμένος. Χωρίς αυτόν (διφορούμενη πρόταση, ακριβώς η
              περίπτωση για την οποία γεννήθηκε ο επιλογέας) το όνομα είναι η **μόνη** ένδειξη
              ποιον αφορά η μαρτυρία, και η απόκρυψή του θα έκρυβε πληροφορία. */}
          <ProposalEvidence
            evidence={(chosen ?? shape).evidence}
            nameValueRedundant={chosen !== null}
          />

          {/* Ο επιλογέας εμφανίζεται όποτε υπάρχει **πραγματική** επιλογή. Ένας υποψήφιος δεν
              είναι επιλογή· δύο ισοδύναμοι είναι, και τότε δεν επιτρέπεται προεπιλογή. */}
          {proposal.candidates.length > 1 ? (
            <TitleBlockCandidatePicker
              candidates={proposal.candidates}
              chosen={chosen}
              onChoose={onChoose}
              disabled={approved || busy}
              fieldId={`${fieldId}-pick`}
            />
          ) : null}

          {needsPercent ? (
            <LandownerPercentField
              fieldId={`${fieldId}-pct`}
              value={pctText}
              onChange={setPctText}
            />
          ) : null}

          <footer className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-7"
              disabled={approved || busy || blocker !== null}
              title={blocker ? t(BLOCKER_LABEL[blocker]) : t('titleBlockBinding.approveTitle')}
              onClick={() => request && onApprove(request)}
            >
              <Check className="mr-1 size-3" aria-hidden />
              {approved
                ? t('titleBlockBinding.approved')
                : busy
                  ? t('titleBlockBinding.approving')
                  : t('titleBlockBinding.approve')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              disabled={busy}
              title={t('titleBlockBinding.dismissTitle')}
              onClick={onDismiss}
            >
              <X className="mr-1 size-3" aria-hidden />
              {t('titleBlockBinding.dismiss')}
            </Button>
          </footer>

          {/* Η αιτία ΔΙΠΛΑ στο κουμπί, όχι μόνο σε tooltip: ένα κλειστό κουμπί που δεν λέει
              γιατί, μοιάζει με σπασμένη εφαρμογή. */}
          {blocker && !approved ? (
            <p role="status" className="mt-1 text-[11px] text-muted-foreground">
              {t(BLOCKER_LABEL[blocker])}
            </p>
          ) : null}

          {/* 🔴 **Η επιφύλαξη στέκεται δίπλα σε κουμπί που ΔΟΥΛΕΥΕΙ** — εκεί είναι όλη η
              διαφορά της από τον φραγμό από κάτω. Λέει «γίνεται· να τι δεν ξέρουμε», και
              γι' αυτό μπαίνει **πάνω από** το κλικ και όχι σε tooltip: ο μηχανικός πρέπει να
              τη διαβάσει **πριν** εγκρίνει, όχι αφού αναρωτηθεί. Το «Π.Ε. 39» πέρασε δύο
              φάσεις ως αδιέξοδο ακριβώς επειδή δεν υπήρχε αυτή η θέση στην οθόνη. */}
          {proposal.caution && !approved ? (
            <p role="status" className="mt-1 flex items-start gap-1.5 text-[11px] text-[hsl(var(--text-warning))]">
              <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
              {t(CAUTION_LABEL[proposal.caution])}
            </p>
          ) : null}

          {/* 🔑 **Πόσα έγγραφα του σχεδίου λένε το ίδιο** (ADR-759 Φ4). Δεν είναι σκορ: είναι
              μετρημένο γεγονός, και είναι ο λόγος που ο μηχανικός βλέπει **μία** γραμμή αντί
              για τρεις πανομοιότυπες. Εμφανίζεται μόνο όταν οι μάρτυρες είναι >1 — «το λέει
              1 έγγραφο» δεν είναι πληροφορία, είναι θόρυβος. */}
          {proposal.corroboration !== undefined && proposal.corroboration > 1 && !approved ? (
            <p role="status" className="mt-1 text-[11px] text-muted-foreground">
              {t('titleBlockBinding.corroboration', { count: proposal.corroboration })}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="mt-1.5">
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            {proposal.blockedBy === 'no-match' ? (
              <Link2Off className="mt-px size-3 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
            )}
            {proposal.blockedBy ? t(BLOCKED_LABEL[proposal.blockedBy]) : null}
          </p>

          {/* 🔴 **Μόνο στο `no-match`, και αυτό δεν είναι λεπτομέρεια.** Καμία από τις άλλες
              οκτώ αιτίες δεν θεραπεύεται με νέα επαφή: το `role-undecided` **βρήκε** τον
              άνθρωπο (νέα επαφή θα έφτιαχνε **δίδυμο**), ενώ τα `unsupported-field`,
              `no-primary-address`, `resolver-gap`, `no-project` και τα τρία του τοπογραφικού
              δεν αφορούν καν πρόσωπο. Ένα κουμπί που εμφανίζεται όπου δεν βοηθά είναι
              πρόσκληση να δημιουργηθούν διπλότυπες επαφές — δηλαδή θεραπεία που γεννά
              χειρότερη ασθένεια από αυτήν που λύνει. */}
          {proposal.blockedBy === 'no-match' && subject ? (
            <TitleBlockContactCreation
              subject={subject}
              onCreated={onContactCreated}
              disabled={busy}
            />
          ) : null}
        </section>
      )}
    </li>
  );
};

/** Η αρχική επιλογή μιας γραμμής — **μόνο** όταν ο νικητής είναι αδιαμφισβήτητος. */
export const initialChoice = (proposal: BindingProposal): BindingCandidate | null =>
  unambiguousWinner(proposal.candidates);
