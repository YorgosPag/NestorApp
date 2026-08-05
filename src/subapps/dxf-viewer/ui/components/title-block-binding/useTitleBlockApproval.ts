'use client';

/**
 * @fileoverview **Η ΜΟΝΗ ΓΡΑΦΗ** της παλέτας σύνδεσης πινακίδας (ADR-745 Φ3β, Τομέας Δ2).
 *
 * 🔴 **Δεν υπάρχει `useEffect` σε αυτό το αρχείο, και αυτό είναι το ζητούμενο.**
 * Ο κίνδυνος δεν είναι θεωρητικός: το `ContactSearchManager:221-229` κατεβάζει ήδη επαφές μέσα
 * από `useEffect` **χωρίς κανένα κλικ**, και μια γραμμή που «προ-εφαρμόζει» μια μονοσήμαντη
 * πρόταση θα άφηνε την άγκυρα καθαρότητας του Λ2 **πράσινη** — το λέει η ίδια της η κεφαλίδα.
 * Ο φύλακας είναι ο κατάσκοπος εγγραφής, όχι αυτό το σχόλιο.
 *
 * 🔑 **Ο φύλακας των οικοπεδούχων ΔΕΝ παρακάμπτεται.** Η καρτέλα δεν καλεί σκέτο το gateway:
 * περνά από `useGuardedLandownersSave` → preview των `ownership_tables` που μπαγιατεύουν. Ο
 * καμβάς **αλλάζει ποσοστά** (νέο πρόσωπο με %), άρα περνά από τον **ίδιο** φύλακα — τον
 * υπάρχοντα, όχι δίδυμο (N.18).
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/useTitleBlockApproval
 */

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useGuardedLandownersSave } from '@/hooks/useGuardedLandownersSave';
import {
  approveTitleBlockProposal,
  listTitleBlockBindings,
} from '@/services/title-block-apply';
import type { BindingProposal, BindingTarget, TitleBlockBinding } from '@/types/title-block-binding';

/** Γιατί το κουμπί είναι απενεργοποιημένο — **ποτέ σιωπηλά ανενεργό**. */
export type ApprovalBlocker = 'noFileRecord' | 'noUser' | 'needsPercent';

export interface ApproveRequest {
  readonly proposal: BindingProposal;
  readonly target: BindingTarget;
  /** Το ποσοστό που δήλωσε ο άνθρωπος — απαιτείται μόνο για οικοπεδούχο (Γ6). */
  readonly landOwnershipPct?: number;
}

export interface UseTitleBlockApprovalParams {
  /** 🔴 `null` στο cold load — **ποτέ `?? ''`** (ADR-745 §Γ2). */
  readonly fileRecordId: string | null;
  readonly levelId: string | null;
  readonly layerName: string;
  /** Απόν όταν το σχέδιο δεν είναι δεμένο σε έργο — τότε ο Λ2 έχει ήδη μπλοκάρει τα πάντα. */
  readonly projectId?: string;
}

/**
 * Τι **έγινε** σε μια επιτυχή έγκριση, πέρα από το «πέτυχε».
 *
 * 🔑 Χωρίς αυτό, το `supersededIds` που επιστρέφει ο διανομέας πεταγόταν — και ο χρήστης δεν
 * μάθαινε ποτέ ότι η έγκρισή του **απέσυρε** προηγούμενη. Σιωπηλή αντικατάσταση σε συλλογή που
 * υπάρχει για να **εξηγεί** την προέλευση είναι αντίφαση.
 */
export interface ApprovalOutcome {
  readonly supersededCount: number;
  /** Παλιοί στόχοι που έμειναν συνδεδεμένοι παρά την αντικατάσταση — σχεδόν πάντα 0. */
  readonly withdrawFailureCount: number;
}

export interface TitleBlockApprovalState {
  readonly approving: string | null;
  readonly approvedIds: ReadonlySet<string>;
  readonly error: string | null;
  /** Ο κωδικός του τελευταίου σφάλματος — για **μεταφρασμένο** μήνυμα αντί για τεχνικό κείμενο. */
  readonly errorCode: string | null;
  readonly outcomeFor: (key: string) => ApprovalOutcome | null;
  readonly blockerFor: (req: ApproveRequest) => ApprovalBlocker | null;
  readonly approve: (key: string, req: ApproveRequest) => Promise<boolean>;
  readonly ImpactDialog: ReactNode;
}

export function useTitleBlockApproval(
  params: UseTitleBlockApprovalParams,
): TitleBlockApprovalState {
  const { fileRecordId, levelId, layerName, projectId } = params;
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId ?? null;

  const [approving, setApproving] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, ApprovalOutcome>>(new Map());

  const outcomeFor = useCallback((key: string) => outcomes.get(key) ?? null, [outcomes]);

  // Ο φύλακας ζει σε επίπεδο έργου και είναι ο **υπάρχων** — το ίδιο hook που καλεί η καρτέλα
  // (`ProjectLandownersTab.tsx:110`). Δεύτερη, «απλούστερη» υλοποίηση εδώ θα ήταν sibling clone
  // (N.18) και, χειρότερα, θα ήταν **πιο αδύναμος** γραφέας από την καρτέλα.
  const { runSaveOperation, ImpactDialog } = useGuardedLandownersSave(projectId ?? '');

  /**
   * Γιατί **δεν** μπορεί να πατηθεί — υπολογισμένο, ώστε το UI να δείχνει **αιτία**, όχι ένα
   * γκρίζο κουμπί. Ένα κουμπί που δεν εξηγεί γιατί δεν δουλεύει είναι σφάλμα αναφοράς.
   */
  const blockerFor = useCallback(
    (req: ApproveRequest): ApprovalBlocker | null => {
      // 🔴 Γ2: το `fileRecordId` είναι ΠΡΟΑΙΡΕΤΙΚΟ, ΜΗΔΕΝΙΣΙΜΟ και φτάνει ΑΡΓΟΤΕΡΑ. Στο cold
      // load ένα `?? ''` θα γεννούσε κλειδί που το επόμενο φόρτωμα δεν ξαναβρίσκει ⇒ το δεύτερο
      // κλικ θα έφτιαχνε ΔΕΥΤΕΡΟ έγγραφο για την ίδια σύνδεση.
      if (!fileRecordId || !levelId) return 'noFileRecord';
      if (!user?.uid || !companyId) return 'noUser';
      if (req.target.kind === 'landowner') {
        const pct = req.landOwnershipPct;
        if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0 || pct > 100) {
          return 'needsPercent';
        }
      }
      return null;
    },
    [fileRecordId, levelId, user?.uid, companyId],
  );

  const approve = useCallback(
    async (key: string, req: ApproveRequest): Promise<boolean> => {
      if (blockerFor(req) !== null) return false;
      if (!fileRecordId || !levelId || !user?.uid || !companyId) return false;

      setApproving(key);
      setError(null);
      setErrorCode(null);
      try {
        // Η **τρέχουσα** εικόνα του σχεδίου: μέσα σε αυτήν ψάχνεται τι πρέπει να αποσυρθεί.
        // Ποτέ από στιγμιότυπο της παλέτας — το supersede πρέπει να δει ό,τι υπάρχει τώρα.
        const existingBindings: TitleBlockBinding[] = await listTitleBlockBindings({
          companyId,
          fileRecordId,
          levelId,
          status: 'active',
        });

        const run = () =>
          approveTitleBlockProposal({
            proposal: req.proposal,
            target: req.target,
            fileRecordId,
            levelId,
            layerName,
            existingBindings,
            ctx: {
              userId: user.uid,
              companyId,
              snapshotValue: req.proposal.personName ?? req.proposal.snapshotValue,
              ...(req.landOwnershipPct !== undefined
                ? { landOwnershipPct: req.landOwnershipPct }
                : {}),
            },
          });

        let ok = false;
        const capture = async () => {
          const result = await run();
          ok = result.success;
          if (result.success) {
            // Ό,τι αντικαταστάθηκε γίνεται **ορατό**. Μια συλλογή που υπάρχει για να εξηγεί την
            // προέλευση δεν επιτρέπεται να αποσύρει σιωπηλά προηγούμενη έγκριση.
            setOutcomes((prev) =>
              new Map(prev).set(key, {
                supersededCount: result.supersededIds.length,
                withdrawFailureCount: result.withdrawFailures.length,
              }),
            );
          } else {
            setError(result.error);
            setErrorCode(result.errorCode);
          }
        };

        if (req.target.kind === 'landowner' && projectId) {
          // Ίδιος φύλακας με την καρτέλα: αν υπάρχουν πίνακες ποσοστών που μπαγιατεύουν, ο
          // άνθρωπος το βλέπει ΠΡΙΝ γραφτεί οτιδήποτε — και μπορεί να ακυρώσει.
          const proceeded = await runSaveOperation(
            { landownersChanged: true, bartexChanged: false },
            capture,
          );
          if (!proceeded) return false;
        } else {
          await capture();
        }

        if (ok) setApprovedIds((prev) => new Set(prev).add(key));
        return ok;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return false;
      } finally {
        setApproving(null);
      }
    },
    [blockerFor, fileRecordId, levelId, user?.uid, companyId, layerName, projectId, runSaveOperation],
  );

  return { approving, approvedIds, error, errorCode, outcomeFor, blockerFor, approve, ImpactDialog };
}
