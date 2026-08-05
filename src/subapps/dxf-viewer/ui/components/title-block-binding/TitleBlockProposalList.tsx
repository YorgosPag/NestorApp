'use client';

/**
 * @fileoverview Το περιεχόμενο της παλέτας: μία γραμμή ανά πεδίο πινακίδας (ADR-745 Φ3β).
 *
 * Η **λίστα** εδώ, η **γραμμή** στο {@link ./TitleBlockProposalRow}, ο **επιλογέας** στο
 * {@link ./TitleBlockCandidatePicker}, οι **ετικέτες** στο {@link ./proposal-labels} —
 * χωρισμένα εξαρχής (N.7.1: εξαγωγή, ποτέ trim).
 *
 * 🔴 **Καμία εγγραφή εδώ.** Η βάση αλλάζει **μόνο** μέσα από το `approve` του
 * {@link ./useTitleBlockApproval}, που το καλεί **ρητό κλικ**. Ούτε ένα `useEffect` σε αυτό το
 * αρχείο· ούτε ένα «αν είναι μονοσήμαντο, γράψ' το».
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockProposalList
 */

import React, { useCallback, useState } from 'react';
import { targetRef } from '@/lib/title-block-binding-id';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { findProposalPerson } from '@/lib/title-block/contact-prefill';
import type { BindingCandidate, BindingProposal } from '@/types/title-block-binding';
import type { TitleBlockReading } from '@/types/title-block-reading';
import { initialChoice, TitleBlockProposalRow } from './TitleBlockProposalRow';
import { useTitleBlockApproval } from './useTitleBlockApproval';

/**
 * Η **ταυτότητα της γραμμής** — σταθερή όσο η γραμμή δείχνει το ίδιο κελί.
 *
 * ⚠️ Το `layerName` είναι μέσα **επίτηδες**: η παλέτα εναλλάσσει layers χωρίς να αποπροσαρτήσει
 * τις γραμμές, και δύο layers φέρουν ομώνυμες πινακίδες. Χωρίς αυτό, το ποσοστό που πληκτρολόγησε
 * ο χρήστης στο ένα layer **μετακόμιζε σιωπηλά** στο άλλο.
 */
const rowKeyOf = (p: BindingProposal, layerName: string, index: number): string =>
  `${layerName}:${p.titleBlockIndex}:${p.sourceHandle}:${p.fieldKey}:${p.personName ?? index}`;

/**
 * Η **ταυτότητα της έγκρισης** — αλλάζει όταν αλλάζει ο στόχος.
 *
 * 🔴 Χωρίς τον στόχο μέσα στο κλειδί, το `approvedIds` κλείδωνε τη γραμμή **ανεξάρτητα από την
 * επιλογή**: ο χρήστης ενέκρινε λάθος υποψήφιο, άλλαζε επιλογή, και το κουμπί έμενε κλειστό
 * γράφοντας «Εγκρίθηκε» ενώ ο επιλογέας έδειχνε **άλλον**. Η οθόνη έλεγε ψέματα ακριβώς στη ροή
 * που ο επιλογέας γεννήθηκε να εξυπηρετήσει — και η διόρθωση απαιτούσε επαναφόρτωση.
 */
const approvalKeyOf = (rowKey: string, chosen: BindingCandidate): string =>
  `${rowKey}#${targetRef(chosen.target)}`;

interface Props {
  readonly proposals: readonly BindingProposal[];
  /**
   * Οι **αναγνώσεις** του layer — η πρώτη ύλη πίσω από τις προτάσεις.
   *
   * Χρειάζονται για τη δημιουργία επαφής: η πρόταση κρατά μόνο το **όνομα** του προσώπου
   * (`personName`), ενώ η προσυμπλήρωση θέλει ειδικότητα, τηλέφωνα, e-mail, site, έδρα — **και
   * τα υπόλοιπα πρόσωπα του κελιού**, χωρίς τα οποία δεν ξεχωρίζει τι ανήκει στο γραφείο.
   */
  readonly readings: readonly TitleBlockReading[];
  /** 🔴 `null` στο cold load — το κουμπί κλείνει **με ορατό μήνυμα**, ποτέ `?? ''`. */
  readonly fileRecordId: string | null;
  readonly levelId: string | null;
  readonly layerName: string;
  readonly projectId?: string;
  /** Ζητά νέο στιγμιότυπο βάσης + **επαναϋπολογισμό** από τον ίδιο Λ2 (ADR-759 §4.5). */
  readonly onContactCreated: () => void;
}

export const TitleBlockProposalList: React.FC<Props> = ({
  proposals,
  readings,
  fileRecordId,
  levelId,
  layerName,
  projectId,
  onContactCreated,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const approval = useTitleBlockApproval({ fileRecordId, levelId, layerName, projectId });

  // Η παράβλεψη είναι **μόνο για αυτή τη συνεδρία** και το λέει η ετικέτα της: δεν γράφεται
  // τίποτα και δεν σβήνεται τίποτα. Μια «απόρριψη» που έμοιαζε μόνιμη θα ήταν ψέμα, αφού η
  // επόμενη ανάγνωση θα την ξανάφερνε.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => new Set(prev).add(key));
  }, []);

  // Η επιλογή ζει εδώ και όχι στη γραμμή, γιατί **συνθέτει το κλειδί έγκρισης**. Απούσα εγγραφή
  // σημαίνει «δεν έχει αγγίξει ο άνθρωπος» — τότε ισχύει ο αδιαμφισβήτητος νικητής, αν υπάρχει.
  const [choices, setChoices] = useState<ReadonlyMap<string, BindingCandidate>>(new Map());
  const choose = useCallback((key: string, candidate: BindingCandidate) => {
    setChoices((prev) => new Map(prev).set(key, candidate));
  }, []);

  return (
    <>
      <ul className="flex flex-col gap-2">
        {proposals.map((proposal, index) => {
          const rowKey = rowKeyOf(proposal, layerName, index);
          if (dismissed.has(rowKey)) return null;

          const chosen = choices.get(rowKey) ?? initialChoice(proposal);
          const approvalKey = chosen ? approvalKeyOf(rowKey, chosen) : null;
          const outcome = approvalKey ? approval.outcomeFor(approvalKey) : null;

          return (
            <React.Fragment key={rowKey}>
              <TitleBlockProposalRow
                proposal={proposal}
                chosen={chosen}
                onChoose={(candidate) => choose(rowKey, candidate)}
                approved={approvalKey !== null && approval.approvedIds.has(approvalKey)}
                busy={approvalKey !== null && approval.approving === approvalKey}
                blockerFor={approval.blockerFor}
                onApprove={(req) => approvalKey && void approval.approve(approvalKey, req)}
                onDismiss={() => dismiss(rowKey)}
                subject={findProposalPerson(proposal, readings)}
                onContactCreated={onContactCreated}
              />
              {outcome && outcome.supersededCount > 0 ? (
                <li role="status" className="px-3 text-[11px] text-muted-foreground">
                  {t('titleBlockBinding.supersededNote')}
                </li>
              ) : null}
            </React.Fragment>
          );
        })}
      </ul>

      {approval.error ? (
        <p role="alert" className="mt-2 text-[11px] text-destructive">
          {/* Ο φύλακας της αντικατάστασης οικοπεδούχου μιλά **ανθρώπινα**: λέει τι παραμένει και
              πού διορθώνεται. Ένα ωμό `slot already bound to…` θα ήταν τεχνικό κείμενο σε οθόνη
              μηχανικού που δεν έφταιξε σε τίποτα. */}
          {approval.errorCode === 'LANDOWNER_SLOT_TAKEN'
            ? t('titleBlockBinding.landowner.previousStays')
            : t('titleBlockBinding.approveFailed', { reason: approval.error })}
        </p>
      ) : null}

      {/* Ο φύλακας των πινάκων ποσοστών — ο ΙΔΙΟΣ που βλέπει η καρτέλα του έργου. */}
      {approval.ImpactDialog}
    </>
  );
};
