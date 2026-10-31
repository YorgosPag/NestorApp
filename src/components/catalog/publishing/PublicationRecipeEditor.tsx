'use client';

/**
 * @fileoverview **Ο επεξεργαστής συνταγής έκδοσης** — γενικά · εύρος · τιμές · έξοδος · θέμα, με CAS στην αναθεώρηση
 *   (ADR-923 §5.6.1).
 * @related shared/use-definition-draft.ts (πρόχειρο + βάση CAS) · shared/EditorFooter.tsx (αποθήκευση / διαγραφή)
 * @module components/catalog/publishing/PublicationRecipeEditor
 *
 * 🔑 **Ο κωδικός είναι αμετάβλητος μετά τη δημιουργία** (η ταυτότητα). Η αποθήκευση στέλνει την αναθεώρηση που **διάβασε**
 *    ο άνθρωπος (`baseRevision`)· 409 ⇒ το πρόχειρο επιστρέφει στη νεότερη βάση και ο άνθρωπος ειδοποιείται (όχι βλάβη).
 * 🔑 Η κλειδωμένη αποθήκευση στηρίζεται στην ΙΔΙΑ επικύρωση με τον γραφέα (`validatePublicationRecipe`)· ένα γνωστό 422
 *    δεν στέλνεται ποτέ.
 * 🔑 **Δεν υπάρχει αισιόδοξη εγγραφή**: η συνταγή δεν είναι συλλογή που ακούμε ζωντανά (η όψη του εκδότη έρχεται από τον
 *    διακομιστή)· μετά την αποθήκευση η όψη ανανεώνεται στο παρασκήνιο.
 */

import React, { useCallback, useEffect, useMemo } from 'react';

import { useNotifications } from '@/providers/NotificationProvider';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { createPublicationRecipe, deletePublicationRecipe, updatePublicationRecipe } from '@/services/catalog/catalog-publishing-api.client';
import type { PublicationRecipeDefinition, PublicationRecipeWire } from '@/subapps/catalog/types/publication';
import { useCatalogAccess, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { EditorFooter } from '../shared/EditorFooter';
import { IssueSummary } from '../shared/CatalogIssues';
import { useDefinitionDraft, useShownIssues, type DefinitionDraft } from '../shared/use-definition-draft';
import { emptyRecipe, recipeDefinitionOf, recipeIssues, type PublicationFieldsProps } from './publication-draft';
import { PublicationGeneralFields } from './PublicationGeneralFields';
import { PublicationOutputFields } from './PublicationOutputFields';
import { PublicationPricingFields } from './PublicationPricingFields';
import { PublicationScopeFields } from './PublicationScopeFields';
import { PublicationThemeFields } from './PublicationThemeFields';

export interface PublicationRecipeEditorProps {
  /** `null` = νέα συνταγή. */
  readonly record: PublicationRecipeWire | null;
  /** Ανανέωση της όψης στο παρασκήνιο μετά από εγγραφή. */
  readonly revalidate: () => Promise<void>;
  readonly onCreated: (code: string) => void;
  readonly onDeleted: () => void;
  readonly reportDirty: (dirty: boolean) => void;
}

/** Η αποθήκευση: νέα ⇒ δημιουργία· υπάρχουσα ⇒ αντικατάσταση με CAS στη βάση του πρόχειρου. */
function useRecipeSave({ record, revalidate, onCreated }: PublicationRecipeEditorProps, editor: DefinitionDraft<PublicationRecipeDefinition>) {
  const { t } = useCatalogText();
  const { success } = useNotifications();
  const notifyFailure = useCatalogFailureNotice();
  const { draft, baseRevision, beginSave } = editor;
  return useCallback(async () => {
    const settle = beginSave<PublicationRecipeWire>((saved) => { if (record === null) onCreated(saved.code); });
    try {
      const saved = record === null ? await createPublicationRecipe(draft) : await updatePublicationRecipe(record.id, baseRevision ?? record.revision, draft);
      settle({ ok: true, record: saved });
      success(t('publishing.saved'));
    } catch (cause) {
      const failure = catalogFailureOf(cause);
      settle({ ok: false, failure });
      notifyFailure(failure);
    }
    await revalidate();
  }, [beginSave, draft, baseRevision, record, onCreated, revalidate, success, t, notifyFailure]);
}

function useRecipeDelete({ record, revalidate, onDeleted }: PublicationRecipeEditorProps) {
  const notifyFailure = useCatalogFailureNotice();
  return useCallback(async () => {
    if (record === null) return;
    try {
      await deletePublicationRecipe(record.id, record.revision);
      onDeleted();
    } catch (cause) {
      notifyFailure(catalogFailureOf(cause));
    }
    await revalidate();
  }, [record, onDeleted, revalidate, notifyFailure]);
}

function RecipeSections(props: PublicationFieldsProps & { readonly codeLocked: boolean }) {
  return (
    <>
      <PublicationGeneralFields {...props} />
      <PublicationScopeFields {...props} />
      <PublicationPricingFields {...props} />
      <PublicationOutputFields {...props} />
      <PublicationThemeFields {...props} />
    </>
  );
}

export function PublicationRecipeEditor(props: PublicationRecipeEditorProps) {
  const { record, reportDirty } = props;
  const { t, language } = useCatalogText();
  const canManage = useCatalogAccess('pricing') === 'granted';
  const base = useMemo(() => (record === null ? emptyRecipe(language) : recipeDefinitionOf(record)), [record, language]);
  const editor = useDefinitionDraft(base, record?.id ?? 'new', record?.revision ?? null);
  const clientIssues = useMemo(() => recipeIssues(editor.draft), [editor.draft]);
  const issues = useShownIssues(editor, clientIssues);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  const save = useRecipeSave(props, editor);
  const remove = useRecipeDelete(props);
  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => event.preventDefault()}>
      <section className="flex min-w-0 flex-1 flex-col gap-6 p-4">
        <IssueSummary issues={issues} title={t('editor.issuesTitle')} />
        <RecipeSections draft={editor.draft} onChange={editor.update} issues={issues} disabled={!canManage} codeLocked={record !== null} />
      </section>
      <EditorFooter editor={editor} issues={clientIssues} authority="pricing" record={record} onSave={() => { void save(); }}
        onDelete={record === null ? undefined : () => { void remove(); }} />
    </form>
  );
}
