'use client';

/**
 * ADR-892 Φ3 — **η αποχώρηση του ίδιου**: προεπισκόπηση → πράξη → (οικείος χώρος) παράδοση συνεδρίας → πλοήγηση.
 *
 * Η σειρά μετά την πράξη εξαρτάται από το τι έκανε ο διακομιστής στη συνεδρία (`SessionContinuation`):
 * - `unchanged` — το γραφείο ήταν **ξένος** χώρος: κανένα claim, καμία ανάκληση ⇒ κατευθείαν στο `/home`.
 * - `reissued`  — ήταν ο **οικείος** χώρος: όλες οι συνεδρίες ανακλήθηκαν, και αυτή η συσκευή πήρε κλειδί νέας.
 *   Υιοθέτηση → αναμονή του **γεγονότος** «το `AuthContext` έστησε χρήστη ΚΑΙ cookie» (`SessionPhase`,
 *   ADR-859 — ποτέ `setTimeout`) → `/home`. Όσο διαρκεί, ο ακροατής των claims σωπαίνει (`session-handover`).
 * - `ended`     — ανακλήθηκαν χωρίς κλειδί ⇒ αποσύνδεση **με λόγια** και σύνδεση ξανά. Η αποχώρηση **έγινε**.
 *
 * 🔑 **Πλήρης πλοήγηση** στο `/home` (όχι του router): ο διακομιστής κρίνει τον προορισμό με το **νέο** cookie
 * (επόμενο γραφείο ή προσωπικός χώρος), και καμία μνήμη του παλιού γραφείου δεν επιζεί στη σελίδα.
 *
 * @module components/workspace-membership/use-leave-workspace
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth';
import { adoptIssuedSession } from '@/auth/issued-session';
import { beginSessionHandover } from '@/auth/contexts/auth-context/session-handover';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { navigateDocument } from '@/lib/browser/document-navigation';
import { AUTH_ROUTES } from '@/lib/routes';
import { useRouter } from '@/lib/workspace/navigation';
import { HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';
// ⚠️ TYPE-ONLY πέρα από το σύνορο του διακομιστή — σβήνονται στη μεταγλώττιση (ιδίωμα `useMemberExit`).
import type { MemberExitPreview } from '@/server/workspace/member-exit';
import type { HomeAfterExit } from '@/server/workspace/member-exit-claims';
import type { SessionContinuation } from '@/server/workspace/member-exit-session';

import { settleMemberAction, useExitPreview, type ExitPreview } from './exit-action';
import { LEAVE_REFUSALS, type LeaveRefusal } from './leave-workspace-labels';

/** Η απάντηση του `GET` — η προεπισκόπηση μαζί με τα **ονόματα** που ο αποχωρών δεν μπορεί να βρει μόνος. */
export interface LeavePreview {
  readonly preview: MemberExitPreview;
  readonly workspaceName: string;
  readonly heirName: string | null;
}

interface LeaveResponse {
  readonly status: 'left';
  readonly home: HomeAfterExit;
  readonly session: SessionContinuation;
}

/** Πού βρίσκεται η πράξη — ρητές καταστάσεις, ποτέ σημαίες. */
export type LeaveStage =
  | { readonly kind: 'ready' }
  | { readonly kind: 'leaving' }
  /** Η θητεία έκλεισε· στήνεται η νέα συνεδρία αυτής της συσκευής. */
  | { readonly kind: 'handover' }
  | { readonly kind: 'refused'; readonly refusal: LeaveRefusal }
  | { readonly kind: 'failed' };

export interface LeaveWorkspace extends ExitPreview<LeavePreview> {
  readonly stage: LeaveStage;
  readonly leave: () => Promise<void>;
}

/** Πλήρης πλοήγηση — ο διακομιστής αποφασίζει πού (δες την κεφαλίδα)· το γραφείο φεύγει από το ιστορικό. */
function goHome(): void {
  navigateDocument(HOME_REDIRECT_ROUTE, { replace: true });
}

/**
 * @param onSignedOut Καλείται όταν η συσκευή **δεν** συνεχίζει (`ended` ή αποτυχία υιοθέτησης) — ο διάλογος το
 *   λέει με λόγια πριν τη σύνδεση.
 */
export function useLeaveWorkspace(onSignedOut: () => void): LeaveWorkspace {
  const { previewState, reloadPreview } = useExitPreview<LeavePreview>(API_ROUTES.WORKSPACES.MY_MEMBERSHIP);
  const { user, sessionPhase, signOut } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<LeaveStage>({ kind: 'ready' });
  const endHandover = useRef<(() => void) | null>(null);
  const staleUser = useRef<unknown>(null);

  // Η ΑΝΑΧΩΡΗΣΗ — μόνο όταν το `AuthContext` έστησε **νέο** χρήστη (άλλο αντικείμενο από του παλιού κλειδιού).
  useEffect(() => {
    if (stage.kind !== 'handover' || sessionPhase !== 'established' || user === null) return;
    if (user === staleUser.current) return;
    endHandover.current?.();
    goHome();
  }, [stage, sessionPhase, user]);

  const signInAgain = useCallback(async () => {
    endHandover.current?.();
    onSignedOut();
    router.replace(AUTH_ROUTES.login);
    await signOut();
  }, [onSignedOut, router, signOut]);

  const continueAfter = useCallback(async (session: SessionContinuation) => {
    if (session.kind === 'unchanged') return goHome();
    if (session.kind === 'ended') return signInAgain();
    staleUser.current = user;
    setStage({ kind: 'handover' });
    const adopted = await adoptIssuedSession(session.token);
    if (adopted.kind === 'not-signed-in') await signInAgain();
  }, [signInAgain, user]);

  const leave = useCallback(async () => {
    setStage({ kind: 'leaving' });
    endHandover.current = beginSessionHandover();
    const result = await settleMemberAction(
      () => apiClient.post<LeaveResponse>(API_ROUTES.WORKSPACES.MY_MEMBERSHIP, {}),
      LEAVE_REFUSALS,
    );
    if (result.kind === 'done') return continueAfter(result.data.session);
    endHandover.current?.();
    setStage(result.kind === 'refused' ? { kind: 'refused', refusal: result.refusal } : { kind: 'failed' });
  }, [continueAfter]);

  // Ο διάλογος κλείνει/αποσυναρμολογείται ⇒ καμία παράδοση δεν μένει ανοιχτή για πάντα.
  useEffect(() => () => endHandover.current?.(), []);

  return { previewState, reloadPreview, stage, leave };
}
