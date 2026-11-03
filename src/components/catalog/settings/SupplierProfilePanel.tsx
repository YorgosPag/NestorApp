'use client';

/**
 * **Το προφίλ του παρόχου** (ADR-923 §22 Υ8): περιγραφή και έργα, δίπλα στην επιβεβαίωση του προμηθευτή.
 *
 * Singleton με CAS, ίδιο μοτίβο με τις ρυθμίσεις: η βάση είναι ό,τι επιβεβαιώθηκε, το κλειδί της αισιόδοξης πράξης το ντετερμινιστικό id.
 * 🔑 Μόνο εικόνες με δικαιώματα καταλόγου προτείνονται: ό,τι άλλο θα αποθηκευόταν και δεν θα φαινόταν ποτέ. Η τελική κρίση μένει στη
 *    δημόσια προβολή, γιατί η άδεια μπορεί να λήξει αργότερα.
 * 🔑 Λογότυπο, ιστοσελίδα και περιοχή δεν γράφονται εδώ: ζουν στη βιτρίνα επαγγελματία, και η οθόνη το λέει.
 *
 * @module components/catalog/settings/SupplierProfilePanel
 */

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useCatalogAssetFiles } from '@/hooks/catalog/useCatalogAssetFiles';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { useCompanyId } from '@/hooks/useCompanyId';
import { saveSupplierProfile, type AssetRecord, type SupplierProfileRecord } from '@/services/catalog/catalog-api.client';
import { generateCatalogPortfolioProjectId, generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id-convenience';
import { validateSupplierProfile } from '@/subapps/catalog/schema/validate-supplier-profile';
import { EMPTY_SUPPLIER_PROFILE, MAX_PORTFOLIO_PROJECTS, MAX_PORTFOLIO_PROJECT_IMAGES, type CatalogPortfolioProject, type CatalogSupplierProfileDefinition } from '@/subapps/catalog/types/supplier-profile';
import { isMediaLicensePurposeIn } from '@/constants/media-rights-vocabulary';

import { optimisticWire } from '../shared/catalog-actions';
import { IssueSummary } from '../shared/CatalogIssues';
import { EditorFooter } from '../shared/EditorFooter';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { useCatalogCanManage, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { useDefinitionDraft } from '../shared/use-definition-draft';
import { useDraftUnsavedGuard } from '../shared/use-unsaved-guard';
import { AssetPickerPopover } from '../values/AssetPickerPopover';
import { emptyProject, withAsset, withoutAsset, withoutProject, withProject, yearOfInput } from './supplier-profile-draft';

const definitionOf = (record: SupplierProfileRecord | null): CatalogSupplierProfileDefinition =>
  record ? { description: record.description, projects: record.projects } : EMPTY_SUPPLIER_PROFILE;

const isPublishableImage = (asset: AssetRecord): boolean => asset.kind === 'image' && isMediaLicensePurposeIn('catalog', asset.rights.license.purpose);

interface ProjectEditorProps {
  readonly project: CatalogPortfolioProject;
  readonly assets: readonly AssetRecord[];
  readonly disabled: boolean;
  readonly onChange: (project: CatalogPortfolioProject) => void;
  readonly onRemove: () => void;
}

function ProjectEditor({ project, assets, disabled, onChange, onRemove }: ProjectEditorProps) {
  const { t, text } = useCatalogText();
  const files = useCatalogAssetFiles();
  const [picking, setPicking] = useState(false);
  const eligible = useMemo(() => assets.filter((asset) => !project.assetIds.includes(asset.id)), [assets, project.assetIds]);
  const chosen = project.assetIds.flatMap((id) => assets.find((asset) => asset.id === id) ?? []);
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <LocalizedTextField label={t('profile.projectTitle')} value={project.title} disabled={disabled} onChange={(title) => onChange({ ...project, title })} />
      <LocalizedTextField label={t('profile.projectDescription')} multiline value={project.description} disabled={disabled} onChange={(description) => onChange({ ...project, description })} />
      <Label className="flex items-center gap-2 text-sm">
        {t('profile.projectYear')}
        <Input className="w-24" inputMode="numeric" disabled={disabled} defaultValue={project.year ?? ''} onChange={(event) => onChange({ ...project, year: yearOfInput(event.target.value) })} />
      </Label>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {chosen.map((asset) => (
          <li key={asset.id} className="flex items-center gap-1 rounded-sm border px-2 py-1 text-sm">
            {text(asset.labels, asset.code)}
            <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('profile.removeImage')} onClick={() => onChange(withoutAsset(project, asset.id))}><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap gap-2">
        <Popover open={picking} onOpenChange={setPicking}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" disabled={disabled || project.assetIds.length >= MAX_PORTFOLIO_PROJECT_IMAGES}>{t('profile.addImage')}</Button>
          </PopoverTrigger>
          <AssetPickerPopover assets={eligible} files={files.byId} text={text} onPick={(id) => { onChange(withAsset(project, id)); setPicking(false); }} />
        </Popover>
        <Button type="button" variant="ghost" disabled={disabled} onClick={onRemove}>{t('profile.removeProject')}</Button>
      </footer>
    </li>
  );
}

function useProfileEditor() {
  const notice = useCatalogFailureNotice();
  const load = useCatalogCollection('CATALOG_SUPPLIER_PROFILES');
  const ops = useCatalogOptimistic(load.items, notice);
  const companyId = useCompanyId()?.companyId ?? null;
  const id = companyId ? generateDeterministicCatalogSupplierProfileId(companyId) : null;
  const settled = ops.settled[0] ?? null;
  const base = useMemo(() => definitionOf(settled), [settled]);
  const editor = useDefinitionDraft<CatalogSupplierProfileDefinition>(base, id ?? 'supplier-profile', settled?.revision ?? 0);
  const issues = useMemo(() => validateSupplierProfile(editor.draft), [editor.draft]);
  return { settled, ops, id, editor, issues };
}

export function SupplierProfilePanel() {
  const { t } = useCatalogText();
  const { settled, ops, id, editor, issues } = useProfileEditor();
  const assets = useCatalogCollection('CATALOG_ASSETS');
  const canManage = useCatalogCanManage();
  const publishable = useMemo(() => assets.items.filter(isPublishableImage), [assets.items]);
  const { draft } = editor;
  const disabled = !canManage;
  const unsaved = useDraftUnsavedGuard(editor.unsaved);

  const save = () => {
    if (!id) return;
    const definition = editor.draft;
    ops.submit({
      key: id,
      optimistic: optimisticWire(definition, settled, id),
      baseRevision: editor.baseRevision ?? 0,
      send: (revision) => saveSupplierProfile(revision ?? 0, definition),
      onSettled: editor.beginSave<SupplierProfileRecord>(),
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4" aria-labelledby="supplier-profile-title">
      <header>
        <h2 id="supplier-profile-title" className="m-0 text-lg font-semibold">{t('profile.title')}</h2>
        <p className="m-0 text-sm text-muted-foreground">{t('profile.lead')}</p>
      </header>
      <LocalizedTextField label={t('profile.description')} multiline value={draft.description} disabled={disabled} onChange={(description) => editor.update({ ...draft, description })} />
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {draft.projects.map((project) => (
          <ProjectEditor key={project.id} project={project} assets={publishable} disabled={disabled}
            onChange={(next) => editor.update(withProject(draft, next))}
            onRemove={() => editor.update(withoutProject(draft, project.id))} />
        ))}
      </ul>
      <Button type="button" variant="outline" className="self-start" disabled={disabled || draft.projects.length >= MAX_PORTFOLIO_PROJECTS}
        onClick={() => editor.update({ ...draft, projects: [...draft.projects, emptyProject(generateCatalogPortfolioProjectId())] })}>
        {t('profile.addProject')}
      </Button>
      <IssueSummary issues={[...issues, ...editor.serverIssues]} title={t('editor.issuesTitle')} />
      <EditorFooter editor={editor} issues={issues} authority="schema" onSave={save} />
      {unsaved.dialog}
    </section>
  );
}
