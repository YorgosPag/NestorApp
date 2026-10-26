'use client';
/**
 * **Ο επεξεργαστής προϊόντος σε πλήρες πλάτος** — ρίζα · υπο-μοντέλο · SKU · απλό (ADR-923 §5.10.4 Β3, Akeneo product page).
 *
 * Breadcrumb ρίζα › υπο-μοντέλο › SKU (κάθε κρίκος ανοίγει) · κανάλι × γλώσσα · καρτέλες ανά ομάδα · πάνελ πληρότητας
 * με «πήγαινε στο πεδίο» · υποσέλιδο με την **ίδια** κρίση με τον διακομιστή. Στα μοντέλα: παραλλαγές (Β4) και
 * πραγματικός πίνακας (Β6) ως καρτέλες.
 *
 * @module components/catalog/products/editor/ProductEditorView
 */

import { ArrowLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalogAggregateRecords } from '@/hooks/catalog/useCatalogAggregateRecords';
import type { HumanLanguage } from '@/i18n/languages';
import type { ProductModelRecord } from '@/services/catalog/catalog-api.client';
import type { StoredMemberShape } from '@/subapps/catalog/aggregate/aggregate-members';
import type { InheritanceLink } from '@/subapps/catalog/values/resolve-inherited';
import type { CatalogChannel } from '@/subapps/catalog/vocabulary/channels';

import { IssueSummary } from '../../shared/CatalogIssues';
import { EditorFooter } from '../../shared/EditorFooter';
import { useCatalogText } from '../../shared/catalog-ui-hooks';
import { useDirtyParts } from '../../shared/use-unsaved-guard';
import { useValueEditorEnv } from '../../values/use-value-editor-env';
import type { ValueEditorEnv } from '../../values/value-editor-types';
import { ScopeSelect, type ListScope } from '../ProductListToolbar';
import type { ProductCatalogContext } from '../use-product-catalog-context';
import { CompletenessPanel } from './CompletenessPanel';
import { EditorGroupsTabs } from './EditorGroupsTabs';
import { editorGroups, groupOfAttribute } from './editor-layout';
import { useProductEditor, type HolderRecord } from './use-product-editor';
import { VariantsPanel } from '../variants/VariantsPanel';
import { variantColumnIds } from '../variants/variant-rows';

export interface ProductEditorViewProps {
  readonly id: string;
  readonly ctx: ProductCatalogContext;
  readonly canManage: boolean;
  readonly scope: ListScope;
  readonly onScope: (scope: ListScope) => void;
  readonly onOpen: (id: string) => void;
  readonly onBack: () => void;
  readonly reportDirty: (dirty: boolean) => void;
}

/** Όνομα κρίκου της αλυσίδας: κωδικός μοντέλου · αναγνωριστικό/ετικέτα SKU. */
function useNameOf(members: readonly StoredMemberShape[]) {
  return useCallback((link: InheritanceLink): string => {
    const member = members.find((candidate) => candidate.record.id === link.id);
    if (member?.kind === 'productModel') return member.record.code;
    return member?.record.derived?.identifier ?? member?.record.derived?.label ?? link.id;
  }, [members]);
}

function Breadcrumb({ chain, nameOf, onOpen }: { readonly chain: readonly InheritanceLink[]; readonly nameOf: (link: InheritanceLink) => string; readonly onOpen: (id: string) => void }) {
  const { t } = useCatalogText();
  return (
    <nav aria-label={t('products.editor.breadcrumb')}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-sm">
        {chain.map((link, index) => (
          <li key={link.id} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden /> : null}
            {index === chain.length - 1
              ? <span aria-current="page" className="font-mono font-semibold">{nameOf(link)}</span>
              : <Button type="button" variant="link" size="sm" className="h-auto p-0 font-mono" onClick={() => onOpen(link.id)}>{nameOf(link)}</Button>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type HolderEditorProps = ProductEditorViewProps & { readonly record: HolderRecord; readonly rootId: string | null; readonly members: readonly StoredMemberShape[] };

type Judgement = NonNullable<ReturnType<typeof useProductEditor>['judgement']>;

/** Καρτέλα ιδιοτήτων + «πήγαινε στο πεδίο» από το πάνελ πληρότητας. */
function useEditorPlan(props: HolderEditorProps, judgement: Judgement | null) {
  const family = props.ctx.familyById.get(props.record.familyId) ?? null;
  const plan = useMemo(() => (family && judgement ? editorGroups(family, props.ctx.library.attributeById, props.ctx.library.groups, judgement.schema.scheme, judgement.depth) : []), [family, judgement, props.ctx.library]);
  const [active, setActive] = useState('');
  useEffect(() => { if (plan.length > 0 && !plan.some((group) => group.groupId === active)) setActive(plan[0].groupId); }, [plan, active]);
  const jump = (attributeId: string, channel: CatalogChannel, locale: HumanLanguage) => {
    props.onScope({ channel, locale });
    const group = groupOfAttribute(plan, attributeId);
    if (group) setActive(group);
    requestAnimationFrame(() => document.getElementById(`value-${attributeId}`)?.focus());
  };
  return { plan, active, setActive, jump };
}

/**
 * Καρτέλες μοντέλου: Ιδιότητες · Παραλλαγές. **`forceMount`**: η αλλαγή καρτέλας ΔΕΝ είναι πράξη απόρριψης — ζωντανά, το
 * Radix έκανε unmount την ανενεργή καρτέλα και ένα πλέγμα με επικολλημένες τιμές χανόταν σιωπηλά (Ιδιότητες → πίσω).
 */
function ModelTabs({ props, record, judgement, columnIds, env, attributes, reportVariants }: {
  readonly props: HolderEditorProps; readonly record: ProductModelRecord; readonly judgement: Judgement; readonly columnIds: readonly string[];
  readonly env: ValueEditorEnv; readonly attributes: React.ReactNode; readonly reportVariants: (dirty: boolean) => void;
}) {
  const { t } = useCatalogText();
  return (
    <Tabs defaultValue="attributes">
      <TabsList>
        <TabsTrigger value="attributes">{t('products.editor.attributesTab')}</TabsTrigger>
        <TabsTrigger value="variants">{t('products.editor.variantsTab')}</TabsTrigger>
      </TabsList>
      <TabsContent value="attributes" forceMount>{attributes}</TabsContent>
      <TabsContent value="variants" forceMount>
        <VariantsPanel root={record} rootId={props.rootId ?? record.id} parentId={record.id} depth={judgement.depth} columnIds={columnIds} members={props.members}
          schema={judgement.schema} refs={judgement.refs} scope={props.scope} env={env} ctx={props.ctx} canManage={props.canManage} reportDirty={reportVariants} />
      </TabsContent>
    </Tabs>
  );
}

function HolderEditor(props: HolderEditorProps) {
  const { t } = useCatalogText();
  const dirtyPart = useDirtyParts(props.reportDirty);
  const { editor, judgement, issues, save, record } = useProductEditor({ record: props.record, rootId: props.rootId, members: props.members, ctx: props.ctx, reportDirty: dirtyPart('attributes') });
  const nameOf = useNameOf(props.members);
  const env = useValueEditorEnv(props.ctx, judgement?.references.describe ?? ((target) => target.id));
  const { plan, active, setActive, jump } = useEditorPlan(props, judgement);
  if (!judgement) return <p className="m-0 p-4 text-sm text-muted-foreground">{t('products.editor.familyMissing')}</p>;
  const columnIds = 'code' in record ? variantColumnIds(judgement.schema.scheme, judgement.depth) : null;
  const attributes = (
    <section className="grid gap-4">
      <IssueSummary issues={issues} title={t('editor.issuesTitle')} />
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <EditorGroupsTabs plan={plan} active={active} onActive={setActive} holder={editor.draft} resolved={judgement.resolved} chain={judgement.chain}
          depth={judgement.depth} scope={props.scope} env={env} issues={issues} disabled={!props.canManage} nameOf={nameOf}
          onHolder={(holder) => editor.update({ ...editor.draft, ...holder })} onOpen={props.onOpen} />
        <aside><CompletenessPanel matrix={judgement.completeness} attributeById={props.ctx.library.attributeById} onJump={jump}
          variantSummary={'code' in record ? record.derived.summary : null} /></aside>
      </section>
      <EditorFooter editor={editor} issues={issues} authority="products" onSave={save} />
    </section>
  );
  return (
    <article className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <Breadcrumb chain={judgement.chain} nameOf={nameOf} onOpen={props.onOpen} />
        <ScopeSelect id="editor-scope" settings={props.ctx.settings.definition} scope={props.scope} onScope={props.onScope} />
      </header>
      {columnIds && 'code' in record
        ? <ModelTabs props={props} record={record} judgement={judgement} columnIds={columnIds} env={env} attributes={attributes} reportVariants={dirtyPart('variants')} />
        : attributes}
    </article>
  );
}

export function ProductEditorView(props: ProductEditorViewProps) {
  const { t } = useCatalogText();
  const records = useCatalogAggregateRecords(props.id);
  return (
    <section className="grid gap-4">
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={props.onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />{t('pages.products.title')}
      </Button>
      {records.state === 'loading' ? <p className="m-0 text-sm text-muted-foreground">{t('common.loading')}</p> : null}
      {records.state === 'missing' || records.state === 'failed' ? <p className="m-0 text-sm text-destructive">{t('products.editor.notFound')}</p> : null}
      {records.state === 'ready' && records.target
        ? <HolderEditor key={props.id} {...props} record={records.target} rootId={records.rootId} members={records.members} />
        : null}
    </section>
  );
}
