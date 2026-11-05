'use client';

/**
 * **Ο επεξεργαστής προτύπου ειδικότητας** — πρόχειρο, ζωντανή κρίση, αποθήκευση με CAS (ADR-928 §5.22 · Φ3γ-0b-2).
 *
 * Ιδιοκτησία κατάστασης (όπως `useAgreementEditor`):
 *   - **βάση** → το ζωντανό πρότυπο (`templateDefinitionOf`), ή αντίγραφο του προτύπου-αφετηρίας για νέο·
 *   - **πρόχειρο** → `useRevisionedDraft` με `hold`: η αλλαγή άλλου φαίνεται **πριν** την αποθήκευση· το 409 δεν πατά τη δουλειά·
 *   - **κρίση** → παράγωγο (`judgeTemplateDraft` = οι κριτές του γραφέα, απέναντι στην **εγκεκριμένη** βιβλιοθήκη).
 * 🔑 Η αποθήκευση είναι **ολική αντικατάσταση** του ορισμού (ο γραφέας κρατά τον κωδικό)· τα υπάρχοντα πρόχειρα
 *    συμφωνητικών **δεν** αλλάζουν — πήραν αντίγραφο στο «Νέο» (Ariba: «το πρότυπο δεν αγγίζει υπάρχοντα συμβόλαια»).
 * 🔑 Νέο πρότυπο: μετά την αποθήκευση η φόρμα παύει **πρώτα** να δηλώνει αλλαγές και **μετά** πλοηγεί στο πρότυπο.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRevisionedDraft, useShownDraftIssues, type DraftOutcome, type RevisionedDraft } from '@/hooks/drafts/useRevisionedDraft';
import type { SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { getSubcontractTemplateEditUrl } from '@/lib/navigation/procurement-urls';
import { useRouter } from '@/lib/workspace/navigation';
import { useReportUnsavedEdits, useUnsavedEditsSaver } from '@/providers/DirtyFormProvider';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { judgeTemplateDraft, newTemplateFrom, templateDefinitionOf, type TemplateEditorMode } from '@/subapps/procurement/subcontracts/templates/template-edits';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';
import type { DraftEditorChrome } from '../../editor/EditorToolbar';
import { saveBlockOf, type EditorSaveBlock } from '../../editor/save-block';
import type { LibraryActions } from '../useLibraryActions';

/** Τι επεξεργάζεται: υπάρχον πρότυπο, ή νέο ως αντίγραφο ενός ορισμού-αφετηρίας. */
export type TemplateEditorTarget =
  | { readonly kind: 'edit'; readonly template: SubcontractTradeTemplate }
  | { readonly kind: 'create'; readonly source: SubcontractTradeTemplateDefinition };

export interface TemplateEditorInputs {
  readonly target: TemplateEditorTarget;
  readonly takenCodes: ReadonlySet<string>;
  readonly library: ApprovedLibrary;
  readonly authority: SubcontractLibraryAuthorityView;
  readonly actions: Pick<LibraryActions, 'createTemplate' | 'updateTemplate'>;
}

export interface TemplateEditor extends DraftEditorChrome {
  readonly mode: TemplateEditorMode;
  readonly draft: SubcontractTradeTemplateDefinition;
  readonly update: (next: SubcontractTradeTemplateDefinition) => void;
  readonly issues: readonly SubcontractIssue[];
}

/** Νέο πρότυπο: η φόρμα παύει να δηλώνει αλλαγές και μετά πλοηγεί στο γραμμένο πρότυπο (ο φύλακας εξόδου δεν ρωτά). */
function useCreatedNavigation(unsaved: boolean): (templateId: string) => void {
  const router = useRouter();
  const [createdId, setCreatedId] = useState<string | null>(null);
  useReportUnsavedEdits(unsaved && createdId === null);
  useEffect(() => {
    if (createdId !== null) router.replace(getSubcontractTemplateEditUrl(createdId));
  }, [createdId, router]);
  return setCreatedId;
}

type Draft = RevisionedDraft<SubcontractTradeTemplateDefinition, SubcontractIssue>;

function useSave(inputs: TemplateEditorInputs, editor: Draft, saveBlock: EditorSaveBlock | null, onCreated: (id: string) => void) {
  const { target, actions } = inputs;
  const { beginSave, draft, baseRevision } = editor;
  return useCallback(async (): Promise<boolean> => {
    if (saveBlock !== null) return false;
    const settle = beginSave<SubcontractTradeTemplate>((record) => {
      if (target.kind === 'create') onCreated(record.id);
    });
    const outcome: DraftOutcome<SubcontractTradeTemplate, SubcontractIssue> = target.kind === 'create'
      ? await actions.createTemplate({ definition: draft })
      : await actions.updateTemplate(target.template.id, { expectedRevision: baseRevision ?? target.template.revision, definition: draft });
    settle(outcome);
    return outcome.ok;
  }, [saveBlock, beginSave, target, onCreated, actions, draft, baseRevision]);
}

export function useTemplateEditor(inputs: TemplateEditorInputs): TemplateEditor {
  const { target, takenCodes, library, authority } = inputs;
  const base = useMemo(() => (target.kind === 'edit' ? templateDefinitionOf(target.template) : newTemplateFrom(target.source)), [target]);
  const identity = target.kind === 'edit' ? target.template.id : `new:${target.source.code}`;
  const editor = useRevisionedDraft<SubcontractTradeTemplateDefinition, SubcontractIssue>(base, identity, target.kind === 'edit' ? target.template.revision : null, 'hold');
  const judged = useMemo(() => judgeTemplateDraft(editor.draft, { mode: target.kind, takenCodes, library }), [editor.draft, target.kind, takenCodes, library]);
  const issues = useShownDraftIssues(editor, judged);
  const saveBlock = saveBlockOf({
    dirty: editor.dirty, status: editor.status, checking: authority.pending, allowed: authority.canManageTemplates,
    openProposal: null, behind: editor.behind, issueCount: judged.length,
  });
  const onCreated = useCreatedNavigation(editor.unsaved);
  const save = useSave(inputs, editor, saveBlock, onCreated);
  useUnsavedEditsSaver(editor.unsaved, save);
  return {
    mode: target.kind, draft: editor.draft, update: editor.update, issues, status: editor.status, unsaved: editor.unsaved,
    behind: editor.behind, saveBlock, discard: editor.discard, adoptLatestBase: editor.adoptLatestBase, save,
  };
}
