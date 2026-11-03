'use client';

/**
 * **Αιτήματα προσφοράς από τη βιτρίνα** (ADR-923 §5.13 Ε6β): το opt-in του προμηθευτή και το email παραλαβής.
 *
 * Ίδιο singleton και ίδιο CAS με το προφίλ παρόχου, άλλη πράξη (`saveQuoteIntake`): ο διακομιστής γράφει μόνο τη ρύθμιση και κρατά
 * περιγραφή και έργα. Ταυτόχρονη αποθήκευση από το διπλανό πάνελ απαντά με σύγκρουση αναθεώρησης, όχι με σιωπηλή αντικατάσταση.
 * 🔒 Το email μένει στο ιδιωτικό έγγραφο. Η βιτρίνα δείχνει μόνο ότι ο προμηθευτής δέχεται αιτήματα, και η οθόνη το λέει.
 *
 * @module components/catalog/settings/QuoteIntakePanel
 */

import { useMemo } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { useCompanyId } from '@/hooks/useCompanyId';
import { saveQuoteIntake, type SupplierProfileRecord } from '@/services/catalog/catalog-api.client';
import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id-convenience';
import { validateQuoteIntake } from '@/subapps/catalog/schema/validate-supplier-profile';
import { storedQuoteIntakeOf } from '@/subapps/catalog/schema/zod/supplier-profile.schema';
import {
  EMPTY_SUPPLIER_PROFILE,
  MAX_QUOTE_RECIPIENT_EMAIL_LENGTH,
  type CatalogQuoteIntake,
  type CatalogSupplierProfileStored,
} from '@/subapps/catalog/types/supplier-profile';

import { optimisticWire } from '../shared/catalog-actions';
import { IssueSummary } from '../shared/CatalogIssues';
import { EditorFooter } from '../shared/EditorFooter';
import { useCatalogCanManage, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { useDefinitionDraft } from '../shared/use-definition-draft';
import { useDraftUnsavedGuard } from '../shared/use-unsaved-guard';

/** Κενό πεδίο ⇒ χωρίς παραλήπτη, ίδια κανονικοποίηση με το σύρμα. */
const emailOfInput = (raw: string): string | null => (raw.trim() === '' ? null : raw);

/** Το αισιόδοξο έγγραφο κρατά περιγραφή και έργα, όπως και ο διακομιστής. */
function storedWith(settled: SupplierProfileRecord | null, quoteIntake: CatalogQuoteIntake): CatalogSupplierProfileStored {
  const content = settled ?? EMPTY_SUPPLIER_PROFILE;
  return { description: content.description, projects: content.projects, quoteIntake };
}

function useQuoteIntakeEditor() {
  const notice = useCatalogFailureNotice();
  const load = useCatalogCollection('CATALOG_SUPPLIER_PROFILES');
  const ops = useCatalogOptimistic(load.items, notice);
  const companyId = useCompanyId()?.companyId ?? null;
  const id = companyId ? generateDeterministicCatalogSupplierProfileId(companyId) : null;
  const settled = ops.settled[0] ?? null;
  const base = useMemo(() => storedQuoteIntakeOf(settled?.quoteIntake), [settled]);
  const editor = useDefinitionDraft<CatalogQuoteIntake>(base, id ?? 'quote-intake', settled?.revision ?? 0);
  const issues = useMemo(() => validateQuoteIntake(editor.draft), [editor.draft]);
  return { settled, ops, id, editor, issues };
}

export function QuoteIntakePanel() {
  const { t } = useCatalogText();
  const { settled, ops, id, editor, issues } = useQuoteIntakeEditor();
  const disabled = !useCatalogCanManage();
  const unsaved = useDraftUnsavedGuard(editor.unsaved);
  const { draft } = editor;

  const save = () => {
    if (!id) return;
    const quoteIntake = editor.draft;
    ops.submit({
      key: id,
      optimistic: optimisticWire(storedWith(settled, quoteIntake), settled, id),
      baseRevision: editor.baseRevision ?? 0,
      send: (revision) => saveQuoteIntake(revision ?? 0, quoteIntake),
      onSettled: editor.beginSave<SupplierProfileRecord>(),
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4" aria-labelledby="quote-intake-title">
      <header>
        <h2 id="quote-intake-title" className="m-0 text-lg font-semibold">{t('quoteIntake.title')}</h2>
        <p className="m-0 text-sm text-muted-foreground">{t('quoteIntake.lead')}</p>
      </header>
      <Label className="flex items-center gap-2 text-sm">
        <Switch checked={draft.enabled} disabled={disabled} onCheckedChange={(enabled) => editor.update({ ...draft, enabled })} />
        {t('quoteIntake.enabled')}
      </Label>
      <Label className="flex flex-col gap-1 text-sm">
        {t('quoteIntake.recipientEmail')}
        <Input type="email" autoComplete="email" maxLength={MAX_QUOTE_RECIPIENT_EMAIL_LENGTH} disabled={disabled}
          value={draft.recipientEmail ?? ''} onChange={(event) => editor.update({ ...draft, recipientEmail: emailOfInput(event.target.value) })} />
      </Label>
      <p className="m-0 text-xs text-muted-foreground">{t('quoteIntake.privacy')}</p>
      <IssueSummary issues={[...issues, ...editor.serverIssues]} title={t('editor.issuesTitle')} />
      <EditorFooter editor={editor} issues={issues} authority="schema" onSave={save} />
      {unsaved.dialog}
    </section>
  );
}
