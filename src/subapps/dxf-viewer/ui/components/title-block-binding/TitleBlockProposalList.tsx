'use client';

/**
 * @fileoverview Το περιεχόμενο της παλέτας: μία γραμμή ανά πεδίο πινακίδας (ADR-745 Φ3β).
 *
 * Η **λίστα** εδώ, η **γραμμή** στο {@link ./TitleBlockProposalRow}, οι **ετικέτες** στο
 * {@link ./proposal-labels} — χωρισμένα εξαρχής (N.7.1: εξαγωγή, ποτέ trim).
 *
 * 🔴 **Καμία εγγραφή εδώ.** Η βάση αλλάζει **μόνο** μέσα από το `approve` του
 * {@link ./useTitleBlockApproval}, που το καλεί **ρητό κλικ**. Ούτε ένα `useEffect` σε αυτό το
 * αρχείο· ούτε ένα «αν είναι μονοσήμαντο, γράψ' το».
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockProposalList
 */

import React, { useCallback, useState } from 'react';
import type { BindingProposal } from '@/types/title-block-binding';
import { TitleBlockProposalRow } from './TitleBlockProposalRow';
import { useTitleBlockApproval } from './useTitleBlockApproval';

/** Σταθερό κλειδί λίστας: το ίδιο κελί μπορεί να δώσει πολλές προτάσεις (πρόσωπα, ενότητες). */
const proposalKey = (p: BindingProposal, index: number): string =>
  `${p.titleBlockIndex}:${p.sourceHandle}:${p.fieldKey}:${p.personName ?? index}`;

interface Props {
  readonly proposals: readonly BindingProposal[];
  /** 🔴 `null` στο cold load — το κουμπί κλείνει **με ορατό μήνυμα**, ποτέ `?? ''`. */
  readonly fileRecordId: string | null;
  readonly levelId: string | null;
  readonly layerName: string;
  readonly projectId?: string;
}

export const TitleBlockProposalList: React.FC<Props> = ({
  proposals,
  fileRecordId,
  levelId,
  layerName,
  projectId,
}) => {
  const approval = useTitleBlockApproval({ fileRecordId, levelId, layerName, projectId });

  // Η παράβλεψη είναι **μόνο για αυτή τη συνεδρία** και το λέει η ετικέτα της: δεν γράφεται
  // τίποτα και δεν σβήνεται τίποτα. Μια «απόρριψη» που έμοιαζε μόνιμη θα ήταν ψέμα, αφού η
  // επόμενη ανάγνωση θα την ξανάφερνε.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => new Set(prev).add(key));
  }, []);

  return (
    <>
      <ul className="flex flex-col gap-2">
        {proposals.map((proposal, index) => {
          const key = proposalKey(proposal, index);
          if (dismissed.has(key)) return null;
          return (
            <TitleBlockProposalRow
              key={key}
              proposal={proposal}
              approved={approval.approvedIds.has(key)}
              busy={approval.approving === key}
              blockerFor={approval.blockerFor}
              onApprove={(req) => void approval.approve(key, req)}
              onDismiss={() => dismiss(key)}
            />
          );
        })}
      </ul>

      {approval.error ? (
        <p role="alert" className="mt-2 text-[11px] text-destructive">
          {approval.error}
        </p>
      ) : null}

      {/* Ο φύλακας των πινάκων ποσοστών — ο ΙΔΙΟΣ που βλέπει η καρτέλα του έργου. */}
      {approval.ImpactDialog}
    </>
  );
};
