'use client';

/**
 * **Η κατάσταση της συγγραφής ρήτρας** (ADR-928 §5.22 · Φ3γ-0b-1): πρόχειρο · ζωντανή κρίση · υποβολή με λόγο και CAS.
 *
 * Ιδιοκτησία κατάστασης (όπως `useAgreementEditor`):
 *   - **βάση** → η ζωντανή ρήτρα + η έκδοση-αφετηρία (`proposalBaseOf`)· νέα ρήτρα ⇒ κενό πρόχειρο·
 *   - **πρόχειρο** → `useRevisionedDraft` με `hold`: αν άλλος αλλάξει τη ρήτρα (νέα πρόταση/έγκριση), φαίνεται **πριν**
 *     την υποβολή· το 409 δεν πατά τη δουλειά·
 *   - **κρίση** → παράγωγο (`judgeClauseDraft`, οι κριτές του γραφέα) — κανένα αντίγραφο σε state.
 * 🔑 Η υποβολή είναι **πρόταση**, όχι αποθήκευση: ισχύει μόνο αφού την εγκρίνει **άλλος** (τέσσερα μάτια). Μετά την
 *    επιτυχία ο άνθρωπος πηγαίνει στην ουρά ελέγχου, στη δική του πρόταση.
 * 🔑 Καμία σιωπηλή άρνηση: δικαίωμα σε αναμονή ⇒ «ελέγχεται»· χωρίς δικαίωμα ⇒ αιτία· ανοιχτή πρόταση ⇒ ποια έκδοση.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRevisionedDraft, useShownDraftIssues, type DraftOutcome, type RevisionedDraft } from '@/hooks/drafts/useRevisionedDraft';
import type { SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { getSubcontractLibraryReviewUrl } from '@/lib/navigation/procurement-urls';
import { useRouter } from '@/lib/workspace/navigation';
import { useReportUnsavedEdits } from '@/providers/DirtyFormProvider';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import {
  clauseDraftOf,
  emptyClauseDraft,
  judgeClauseDraft,
  lockedParameterKeys,
  type ClauseAuthoringDraft,
  type ClauseAuthoringMode,
} from '@/subapps/procurement/subcontracts/clauses/clause-draft';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import type { DraftEditorChrome } from '../../editor/EditorToolbar';
import type { EditorSaveBlock } from '../../editor/useAgreementEditor';
import type { LibraryActions } from '../useLibraryActions';

export interface ClauseAuthoringInputs {
  readonly mode: ClauseAuthoringMode;
  /** Μόνο στην πρόταση: η ρήτρα και η έκδοση-αφετηρία. */
  readonly clause: SubcontractClause | null;
  readonly base: SubcontractClauseVersion | null;
  /** Τα κλειδιά όλων των ρητρών του χώρου (και αρχειοθετημένων). */
  readonly takenKeys: ReadonlySet<string>;
  readonly authority: SubcontractLibraryAuthorityView;
  readonly actions: Pick<LibraryActions, 'createClause' | 'proposeClauseVersion'>;
}

export interface ClauseAuthoring extends DraftEditorChrome {
  readonly mode: ClauseAuthoringMode;
  readonly draft: ClauseAuthoringDraft;
  readonly update: (next: ClauseAuthoringDraft) => void;
  readonly issues: readonly SubcontractIssue[];
  readonly base: SubcontractClauseVersion | null;
  readonly locked: ReadonlySet<string>;
  /** Ο διάλογος «λόγος της πρότασης» είναι ανοιχτός. */
  readonly submitting: boolean;
  readonly closeSubmit: () => void;
  readonly submit: (reason: string | null) => Promise<boolean>;
}

const NEW_DRAFT = emptyClauseDraft();

interface BlockFacts {
  readonly dirty: boolean;
  readonly status: string;
  readonly behind: boolean;
  readonly issueCount: number;
  readonly authority: SubcontractLibraryAuthorityView;
  readonly openProposal: number | null;
}

function saveBlockOf(facts: BlockFacts): EditorSaveBlock | null {
  if (facts.status === 'saving') return { kind: 'saving' };
  if (!facts.dirty) return { kind: 'clean' };
  if (facts.authority.pending) return { kind: 'checking' };
  if (!facts.authority.canPropose) return { kind: 'notAuthorized' };
  if (facts.openProposal !== null) return { kind: 'proposalPending', version: facts.openProposal };
  if (facts.behind) return { kind: 'conflict' };
  return facts.issueCount > 0 ? { kind: 'issues', count: facts.issueCount } : null;
}

type Sent = SubcontractClause | SubcontractClauseVersion;
const clauseIdOf = (record: Sent): string => ('clauseId' in record ? record.clauseId : record.id);

function useSubmit(inputs: ClauseAuthoringInputs, editor: RevisionedDraft<ClauseAuthoringDraft, SubcontractIssue>, onSent: (clauseId: string) => void) {
  const { mode, clause, actions } = inputs;
  const { beginSave, draft, baseRevision } = editor;
  return useCallback(async (reason: string | null): Promise<boolean> => {
    const settle = beginSave<Sent>((record) => onSent(clauseIdOf(record)));
    const content = { body: draft.body, parameters: draft.parameters, proposalReason: reason };
    const outcome: DraftOutcome<Sent, SubcontractIssue> = mode === 'create' || clause === null
      ? await actions.createClause({ clauseKey: draft.clauseKey, title: draft.title, ...content })
      : await actions.proposeClauseVersion(clause.id, { expectedRevision: baseRevision ?? clause.revision, ...content });
    settle(outcome);
    return outcome.ok;
  }, [beginSave, onSent, mode, clause, actions, draft, baseRevision]);
}

/**
 * Μετά την υποβολή ο άνθρωπος πηγαίνει στην ουρά ελέγχου. Η φόρμα παύει **πρώτα** να δηλώνει αλλαγές (ήταν πρόταση, όχι
 * χαμένη δουλειά) και **μετά** γίνεται η πλοήγηση, σε effect — αλλιώς ο φύλακας εξόδου θα ρωτούσε «να χαθούν οι αλλαγές;».
 */
function useSentNavigation(unsaved: boolean) {
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);
  useReportUnsavedEdits(unsaved && sent === null);
  useEffect(() => {
    if (sent !== null) router.push(getSubcontractLibraryReviewUrl(sent));
  }, [sent, router]);
  return { mark: setSent };
}

export function useClauseAuthoring(inputs: ClauseAuthoringInputs): ClauseAuthoring {
  const { mode, clause, base: baseVersion, takenKeys, authority } = inputs;
  const base = useMemo(() => (clause ? clauseDraftOf(clause, baseVersion) : NEW_DRAFT), [clause, baseVersion]);
  const editor = useRevisionedDraft<ClauseAuthoringDraft, SubcontractIssue>(base, clause?.id ?? 'new', clause?.revision ?? null, 'hold');
  const judged = useMemo(() => judgeClauseDraft(editor.draft, { mode, takenKeys }), [editor.draft, mode, takenKeys]);
  const issues = useShownDraftIssues(editor, judged);
  const locked = useMemo(() => (mode === 'propose' ? lockedParameterKeys(baseVersion) : new Set<string>()), [mode, baseVersion]);
  const [submitting, setSubmitting] = useState(false);
  const saveBlock = saveBlockOf({ dirty: editor.dirty, status: editor.status, behind: editor.behind, issueCount: judged.length, authority, openProposal: clause?.openProposal ?? null });
  const sentTo = useSentNavigation(editor.unsaved);
  const submit = useSubmit(inputs, editor, sentTo.mark);
  const save = useCallback(async () => {
    if (saveBlock !== null) return false;
    setSubmitting(true);
    return true;
  }, [saveBlock]);

  return {
    mode, draft: editor.draft, update: editor.update, issues, base: baseVersion, locked,
    status: editor.status, unsaved: editor.unsaved, behind: editor.behind, saveBlock,
    discard: editor.discard, adoptLatestBase: editor.adoptLatestBase, save,
    submitting, closeSubmit: () => setSubmitting(false), submit,
  };
}
