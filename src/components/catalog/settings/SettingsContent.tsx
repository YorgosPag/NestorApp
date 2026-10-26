'use client';
/**
 * **`/catalog/settings` — κανάλια × γλώσσες** (ADR-923 §5.10 Δ6, §5.10.4 Β5).
 *
 * Singleton ανά χώρο, με CAS: χωρίς αποθηκευμένο έγγραφο η βάση είναι **0** και φαίνονται οι προεπιλογές. Το κλειδί
 * της αισιόδοξης πράξης είναι το **ντετερμινιστικό** id των ρυθμίσεων — ίδιο πριν και μετά την πρώτη αποθήκευση.
 * Κρίση πριν από την αποστολή: `validateCatalogSettings` (ο ίδιος με τον διακομιστή) + κλειδώματα κελιών
 * (`settings-model`). Αλλαγή γλωσσών ⇒ πρόταση επανυπολογισμού της πληρότητας.
 *
 * @module components/catalog/settings/SettingsContent
 */

import { useEffect, useMemo } from 'react';

import { useCatalogLocaleUsage } from '@/hooks/catalog/useCatalogLocaleUsage';
import { useCatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { useCatalogRecompute } from '@/hooks/catalog/useCatalogRecompute';
import { useCatalogSettings } from '@/hooks/catalog/useCatalogSettings';
import { useCompanyId } from '@/hooks/useCompanyId';
import { saveCatalogSettings, type CatalogSettingsRecord } from '@/services/catalog/catalog-api.client';
import { generateDeterministicCatalogSettingsId } from '@/services/enterprise-id-convenience';
import { validateCatalogSettings } from '@/subapps/catalog/schema/validate-catalog-settings';
import type { CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';

import { optimisticWire } from '../shared/catalog-actions';
import { IssueSummary } from '../shared/CatalogIssues';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { EditorFooter } from '../shared/EditorFooter';
import { RecomputePanel } from '../shared/RecomputePanel';
import { useCatalogCanManage, useCatalogCanManageProducts, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { useDefinitionDraft } from '../shared/use-definition-draft';
import { useUnsavedGuard } from '../shared/use-unsaved-guard';
import { SettingsMatrix } from './SettingsMatrix';
import { settingsChangeAffectsCompleteness, toggleChannelLocale } from './settings-model';

function useSettingsEditor() {
  const notice = useCatalogFailureNotice();
  const settings = useCatalogSettings();
  const ops = useCatalogOptimistic(settings.records, notice);
  const companyId = useCompanyId()?.companyId ?? null;
  const id = companyId ? generateDeterministicCatalogSettingsId(companyId) : null;
  // Η βάση = ό,τι **επιβεβαιώθηκε** (`settled`: απάντηση του γραφέα + στιγμιότυπο) — όχι σκέτο στιγμιότυπο.
  const settled = ops.settled[0] ?? null;
  const base = useMemo<CatalogSettingsDefinition>(
    () => (settled ? { channelLocales: settled.channelLocales } : settings.definition),
    [settled, settings.definition],
  );
  const editor = useDefinitionDraft<CatalogSettingsDefinition>(base, id ?? 'settings', settled?.revision ?? 0);
  const issues = useMemo(() => validateCatalogSettings(editor.draft), [editor.draft]);
  return { settings, settled, base, ops, id, editor, issues };
}

export function SettingsContent() {
  const { t } = useCatalogText();
  const { settings, settled, base, ops, id, editor, issues } = useSettingsEditor();
  const usage = useCatalogLocaleUsage();
  const recompute = useCatalogRecompute();
  const canManage = useCatalogCanManage();
  const canRecompute = useCatalogCanManageProducts();
  const unsaved = useUnsavedGuard();
  const { reportDirty } = unsaved;
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);

  const save = () => {
    if (!id) return;
    const before = base;
    const definition = editor.draft;
    const settle = editor.beginSave<CatalogSettingsRecord>(() => {
      if (settingsChangeAffectsCompleteness(before, definition)) recompute.invalidate();
    });
    ops.submit({
      key: id,
      optimistic: optimisticWire(definition, settled, id),
      baseRevision: editor.baseRevision ?? 0,
      send: (revision) => saveCatalogSettings(revision ?? 0, definition),
      onSettled: settle,
    });
  };

  return (
    <CatalogPageFrame title={t('pages.settings.title')} lead={t('pages.settings.lead')} state={settings.state}>
      <section className="flex max-w-3xl flex-col gap-4">
        {settled === null ? <p className="m-0 text-sm text-muted-foreground">{t('settings.defaults')}</p> : null}
        {usage && [...usage.values()].includes('unknown') ? <p className="m-0 text-sm text-muted-foreground">{t('settings.usageUnknown')}</p> : null}
        <SettingsMatrix settings={editor.draft} usage={usage} disabled={!canManage}
          onToggle={(channel, locale) => editor.update(toggleChannelLocale(editor.draft, channel, locale))} />
        <IssueSummary issues={[...issues, ...editor.serverIssues]} title={t('editor.issuesTitle')} />
        {recompute.needed || recompute.state.kind !== 'idle' ? (
          <RecomputePanel recompute={recompute} familyId={null} prompt={t('settings.recomputePrompt')} canRun={canRecompute} />
        ) : null}
        <EditorFooter editor={editor} issues={issues} canManage={canManage} onSave={save} />
      </section>
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
