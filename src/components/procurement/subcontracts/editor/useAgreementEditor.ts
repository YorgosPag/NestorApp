'use client';

/**
 * **Ο επεξεργαστής ενός πρόχειρου συμφωνητικού** — πρόχειρο, ζωντανή κρίση, αποθήκευση με CAS, φύλακας εξόδου
 * (ADR-928 Φ3γ αποφάσεις 2–4).
 *
 * Ιδιοκτησία κατάστασης:
 *   - **αποθηκευμένο** → η ζωντανή ανάγνωση (`useSubcontractAgreement`) — ο καλών το δίνει·
 *   - **πρόχειρο** → `useRevisionedDraft` με πολιτική `hold`: το 409 **δεν** πατά τη δουλειά του ανθρώπου· η αλλαγή
 *     άλλου φαίνεται ως «πίσω» **πριν** την αποθήκευση·
 *   - **κρίση** → παράγωγο (`judgeAgreementDraft`), οι ίδιοι κριτές με τον γραφέα — κανένα αντίγραφο σε state.
 * 🔑 Αποθήκευση **μόνο** όταν ο γραφέας θα δεχτεί: βιβλιοθήκη φορτωμένη · κανένα εύρημα · καμία ανοιχτή σύγκρουση.
 *    Ό,τι λείπει λέγεται (`saveBlock`), ποτέ σιωπηλά ανενεργό κουμπί.
 * 🔑 Καμία αισιόδοξη εγγραφή: η αποθήκευση γράφει περιεχόμενο που ο γραφέας **ξαναλύνει** (μέρη, αποκλίσεις)· η ζωντανή
 *    ανάγνωση φέρνει το αποτέλεσμα και το πρόχειρο το ακολουθεί (καθαρό = ίδιο με τη βάση).
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRevisionedDraft, useShownDraftIssues, type DraftStatus } from '@/hooks/drafts/useRevisionedDraft';
import { useSubcontractClauseLibrary } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { todayLocalDate } from '@/lib/date-local';
import { useReportUnsavedEdits, useUnsavedEditsSaver } from '@/providers/DirtyFormProvider';
import { updateSubcontractAgreementDraft } from '@/services/procurement/subcontracts/subcontract-agreements-api.client';
import { subcontractFailureOf } from '@/services/procurement/subcontracts/subcontract-failure';
import { draftInputOf } from '@/subapps/procurement/subcontracts/agreements/agreement-draft-input';
import type { SubcontractAgreementDraftInput } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import { judgeAgreementDraft, type DraftJudgement } from '@/subapps/procurement/subcontracts/agreements/judge-agreement-draft';
import { projectDraftAgreement, type ProjectedDraftAgreement } from '@/subapps/procurement/subcontracts/agreements/project-draft-agreement';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { useSubcontractFailureNotice } from '../subcontract-messages';

/** Γιατί η «Αποθήκευση» δεν προσφέρεται τώρα. */
export type EditorSaveBlock =
  | { readonly kind: 'clean' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'conflict' }
  /** Συγγραφή βιβλιοθήκης (ADR-928 §5.22): λείπει το δικαίωμα, ή η ρήτρα έχει ήδη ανοιχτή πρόταση (μία ανά ρήτρα). */
  | { readonly kind: 'notAuthorized' }
  | { readonly kind: 'proposalPending'; readonly version: number }
  | { readonly kind: 'issues'; readonly count: number };

export interface AgreementEditor {
  readonly saved: SubcontractAgreement;
  readonly draft: SubcontractAgreementDraftInput;
  readonly update: (next: SubcontractAgreementDraftInput) => void;
  readonly status: DraftStatus;
  readonly unsaved: boolean;
  /** Η αποθηκευμένη εκδοχή άλλαξε από άλλον μετά από ό,τι διάβασε ο άνθρωπος (ή ο γραφέας απάντησε 409). */
  readonly behind: boolean;
  readonly discard: () => void;
  readonly adoptLatestBase: () => void;
  /** Τα ευρήματα που **φαίνονται** (ανέγγιχτη φόρμα δεν κοκκινίζει) — πελάτη + διακομιστή. */
  readonly issues: readonly SubcontractIssue[];
  readonly judgement: DraftJudgement;
  /** Το συμφωνητικό όπως θα είναι αν αποθηκευτεί τώρα — η είσοδος της ζωντανής προεπισκόπησης. */
  readonly projected: ProjectedDraftAgreement;
  readonly saveBlock: EditorSaveBlock | null;
  readonly save: () => Promise<boolean>;
}

interface JudgeInputs {
  readonly saved: SubcontractAgreement;
  readonly draft: SubcontractAgreementDraftInput;
  readonly actorUid: string;
}

/** Η κρίση και η προβολή — παράγωγα του πρόχειρου, ποτέ αντίγραφο σε state. */
function useJudgedDraft({ saved, draft, actorUid }: JudgeInputs) {
  const { library, loading } = useSubcontractClauseLibrary();
  const judgement = useMemo(
    () => judgeAgreementDraft(draft, { library, previous: saved.clauses, actorUid, today: todayLocalDate() }),
    [draft, library, saved.clauses, actorUid],
  );
  const projected = useMemo(() => projectDraftAgreement(saved, draft, judgement.selections), [saved, draft, judgement.selections]);
  return { judgement, projected, libraryLoading: loading };
}

function saveBlockOf(state: { dirty: boolean; status: DraftStatus; libraryLoading: boolean; behind: boolean; issueCount: number }): EditorSaveBlock | null {
  if (state.status === 'saving') return { kind: 'saving' };
  if (!state.dirty) return { kind: 'clean' };
  if (state.libraryLoading) return { kind: 'checking' };
  if (state.behind) return { kind: 'conflict' };
  return state.issueCount > 0 ? { kind: 'issues', count: state.issueCount } : null;
}

export function useAgreementEditor(saved: SubcontractAgreement): AgreementEditor {
  const actorUid = useAuth().user?.uid ?? '';
  const base = useMemo(() => draftInputOf(saved), [saved]);
  const editor = useRevisionedDraft<SubcontractAgreementDraftInput, SubcontractIssue>(base, saved.id, saved.revision, 'hold');
  const { judgement, projected, libraryLoading } = useJudgedDraft({ saved, draft: editor.draft, actorUid });
  const issues = useShownDraftIssues(editor, judgement.issues);
  const notifyFailure = useSubcontractFailureNotice();
  const saveBlock = saveBlockOf({ dirty: editor.dirty, status: editor.status, libraryLoading, behind: editor.behind, issueCount: judgement.issues.length });

  const { beginSave, draft, baseRevision } = editor;
  const save = useCallback(async (): Promise<boolean> => {
    if (saveBlock !== null) return false;
    const settle = beginSave<SubcontractAgreement>();
    try {
      settle({ ok: true, record: await updateSubcontractAgreementDraft(saved.id, baseRevision ?? saved.revision, draft) });
      return true;
    } catch (cause) {
      const failure = subcontractFailureOf(cause);
      settle({ ok: false, failure });
      // Η σύγκρουση φαίνεται στη λωρίδα του επεξεργαστή, με δύο ρητές επιλογές — όχι ως ειδοποίηση που σβήνει.
      if (failure.kind !== 'revisionMismatch') notifyFailure(failure);
      return false;
    }
  }, [saveBlock, beginSave, saved.id, saved.revision, baseRevision, draft, notifyFailure]);

  useReportUnsavedEdits(editor.unsaved);
  useUnsavedEditsSaver(editor.unsaved, save);

  return {
    saved, draft: editor.draft, update: editor.update, status: editor.status, unsaved: editor.unsaved, behind: editor.behind,
    discard: editor.discard, adoptLatestBase: editor.adoptLatestBase, issues, judgement, projected, saveBlock, save,
  };
}
