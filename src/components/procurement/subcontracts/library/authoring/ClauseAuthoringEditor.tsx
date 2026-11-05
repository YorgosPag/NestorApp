'use client';

/**
 * **Ο επεξεργαστής συγγραφής ρήτρας** (ADR-928 §5.22 · Φ3γ-0b-1): γραμμή εργαλείων · λωρίδα σύγκρουσης · φόρμα |
 * προεπισκόπηση · διάλογος λόγου της πρότασης.
 *
 * 🔑 Τα κοινά του επεξεργαστή συμφωνητικού (`EditorToolbar` · `ConflictBanner` · `EditorSplitLayout`), με τις δικές του
 *    λέξεις: «Υποβολή πρότασης», «καμία αλλαγή», «άλλος άλλαξε αυτή τη ρήτρα».
 * 🔑 Η υποβολή ζητά **λόγο** (`ReasonDialog`, προαιρετικός: η αλλαγή φαίνεται στη σύγκριση)· ο διάλογος μένει ανοιχτός
 *    αν αποτύχει, με το κείμενο του ανθρώπου.
 * Φορτώνεται με `import()` (ADR-744 §34): TipTap, κριτές και μοντέλο εγγράφου δεν μπαίνουν στο slice της σελίδας.
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { proposalBaseOf } from '@/subapps/procurement/subcontracts/clauses/clause-draft';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';
import { EditorSplitLayout } from '../../editor/EditorSplitLayout';
import { ConflictBanner, EditorToolbar, type DraftEditorCopy } from '../../editor/EditorToolbar';
import { ReasonDialog } from '../../ReasonDialog';
import { useLibraryActions } from '../useLibraryActions';
import { ClauseAuthoringForm } from './ClauseAuthoringForm';
import { ClauseAuthoringPreview } from './ClauseAuthoringPreview';
import { useClauseAuthoring, type ClauseAuthoring } from './useClauseAuthoring';

export interface ClauseAuthoringEditorProps {
  /** `null` = νέα ρήτρα· αλλιώς πρόταση νέας έκδοσης. */
  readonly clause: SubcontractClause | null;
  /** Όλες οι εκδόσεις της ρήτρας (κενό για νέα) — από εδώ η αφετηρία (`proposalBaseOf`). */
  readonly versions: readonly SubcontractClauseVersion[];
  /** Όλες οι ρήτρες του χώρου, και αρχειοθετημένες — τα κλειδιά τους είναι πιασμένα. */
  readonly clauses: readonly SubcontractClause[];
  readonly templates: readonly SubcontractTradeTemplate[];
  readonly authority: SubcontractLibraryAuthorityView;
}

function useAuthoringCopy(): DraftEditorCopy {
  const { t } = useTranslation('procurement');
  return useMemo(() => ({
    status: {
      clean: t('subcontracts.library.authoring.status.clean'),
      dirty: t('subcontracts.library.authoring.status.dirty'),
      saving: t('subcontracts.library.authoring.status.saving'),
      saved: t('subcontracts.library.authoring.status.saved'),
    },
    saveAction: t('subcontracts.library.authoring.submit'),
    conflictMessage: t('subcontracts.library.authoring.conflict'),
  }), [t]);
}

function SubmitDialog({ authoring }: { readonly authoring: ClauseAuthoring }) {
  const { t } = useTranslation('procurement');
  if (!authoring.submitting) return null;
  return (
    <ReasonDialog
      title={t(authoring.mode === 'create' ? 'subcontracts.library.authoring.submitDialog.createTitle' : 'subcontracts.library.authoring.submitDialog.proposeTitle')}
      description={t('subcontracts.library.authoring.submitDialog.description')}
      confirmLabel={t('subcontracts.library.authoring.submit')}
      reasonRequired={false}
      onSend={authoring.submit}
      onClose={authoring.closeSubmit}
    />
  );
}

export default function ClauseAuthoringEditor({ clause, versions, clauses, templates, authority }: ClauseAuthoringEditorProps) {
  const actions = useLibraryActions();
  const base = useMemo(() => (clause ? proposalBaseOf(clause, versions) : null), [clause, versions]);
  const takenKeys = useMemo(() => new Set(clauses.map((candidate) => candidate.clauseKey)), [clauses]);
  const authoring = useClauseAuthoring({ mode: clause ? 'propose' : 'create', clause, base, takenKeys, authority, actions });
  const copy = useAuthoringCopy();
  return (
    <section className="space-y-3">
      <EditorToolbar editor={authoring} copy={copy} />
      <ConflictBanner editor={authoring} copy={copy} />
      <EditorSplitLayout
        form={<ClauseAuthoringForm authoring={authoring} takenKeys={takenKeys} />}
        preview={<ClauseAuthoringPreview authoring={authoring} clause={clause} templates={templates} />}
      />
      <SubmitDialog authoring={authoring} />
    </section>
  );
}
