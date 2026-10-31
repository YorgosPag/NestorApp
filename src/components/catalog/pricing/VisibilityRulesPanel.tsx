'use client';

/**
 * @fileoverview **Η καρτέλα «Ορατότητα»**: ποιος βλέπει τι από τον κατάλογο (ADR-923 §12 · §5.12 Δ1).
 * @related subapps/catalog/pricing/visibility.ts (η ΜΙΑ κρίση) · visibility-rule-draft.ts · PriceAnalysisPanel.tsx («δες σαν τον Χ»)
 * @module components/catalog/pricing/VisibilityRulesPanel
 *
 * 🔑 Ζει στη σελίδα «Εκπτώσεις»: μιλά για τα ίδια κοινά, και η όψη `discounts` δίνει ήδη κανόνες και ονόματα.
 * 🔑 **Άμεσες πράξεις** (Google Contacts): η απάντηση αλλάζει με μία επιλογή, αισιόδοξα· ο κανόνας γυρίζει πίσω αν αρνηθεί ο γραφέας.
 * 🔑 Ο κωδικός επιλύεται με το **ίδιο** `useCatalogCodeResolver` των γραμμών τιμοκαταλόγου.
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { visibilityRuleKey, visibilitySubjectKey } from '@/subapps/catalog/pricing/visibility';
import type { PriceAudience } from '@/subapps/catalog/types/price-list';
import type { VisibilityRuleWire } from '@/subapps/catalog/types/pricing-views';
import type { VisibilityRuleDefinition, VisibilitySubject } from '@/subapps/catalog/types/visibility-rule';
import {
  CATALOG_VISIBILITIES,
  VISIBILITY_SUBJECT_KINDS,
  type CatalogVisibility,
  type VisibilitySubjectKind,
} from '@/subapps/catalog/vocabulary/pricing';
import { deleteDefinition, newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { CatalogField } from '../shared/CatalogFormFields';
import { CatalogListSection } from '../shared/CatalogList';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { useCatalogCodeResolver } from '../products/use-catalog-code-resolver';
import { AudienceField } from './AudienceField';
import { isCompleteAudience } from './price-analysis';
import { VISIBILITY_KEYS, VISIBILITY_SUBJECT_KEYS } from './pricing-labels';
import type { DiscountsWorkspace } from './use-discounts-workspace';
import { useDiscountWords } from './use-discount-words';
import { hasRuleFor, needsCode, rulesBySpecificity, subjectOfTarget } from './visibility-rule-draft';

const NO_ISSUES: readonly never[] = [];
const isVisibility = (value: string): value is CatalogVisibility => (CATALOG_VISIBILITIES as readonly string[]).includes(value);
const isSubjectKind = (value: string): value is VisibilitySubjectKind => (VISIBILITY_SUBJECT_KINDS as readonly string[]).includes(value);

function VisibilitySelect({ value, onChange, disabled, label }: {
  readonly value: CatalogVisibility;
  readonly onChange: (next: CatalogVisibility) => void;
  readonly disabled: boolean;
  readonly label: string;
}) {
  const { t } = useCatalogText();
  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => { if (isVisibility(next)) onChange(next); }}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {CATALOG_VISIBILITIES.map((item) => <SelectItem key={item} value={item}>{t(VISIBILITY_KEYS[item])}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function save(workspace: DiscountsWorkspace, definition: VisibilityRuleDefinition, existing: VisibilityRuleWire | null): void {
  saveDefinition(workspace.visibilityRules, {
    kind: 'visibilityRule',
    existing,
    definition,
    optimistic: optimisticWire(definition, existing, existing?.id ?? newEntityKey(visibilityRuleKey(definition))),
  });
}

function useSubjectName(workspace: DiscountsWorkspace): (subject: VisibilitySubject) => string {
  const { t } = useCatalogText();
  const names = workspace.view?.subjectNames ?? {};
  return (subject) =>
    subject.kind === 'catalog' ? t(VISIBILITY_SUBJECT_KEYS.catalog) : (names[visibilitySubjectKey(subject)] ?? t('pricing.visibility.unnamed'));
}

function RuleRow({ rule, workspace, disabled }: { readonly rule: VisibilityRuleWire; readonly workspace: DiscountsWorkspace; readonly disabled: boolean }) {
  const { t } = useCatalogText();
  const words = useDiscountWords(workspace.customerGroups.view, workspace.partyNames);
  const subjectName = useSubjectName(workspace);
  const name = subjectName(rule.subject);
  const pending = workspace.visibilityRules.pendingKeys.has(rule.id);
  return (
    <li className="grid items-center gap-2 rounded-md px-2 py-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_auto]" aria-busy={pending || undefined}>
      <span className="min-w-0 truncate text-sm">{t(VISIBILITY_SUBJECT_KEYS[rule.subject.kind])}: {name}</span>
      <span className="min-w-0 truncate text-sm text-muted-foreground">{words.audience(rule.audience)}</span>
      <VisibilitySelect value={rule.visibility} disabled={disabled} label={t('pricing.visibility.answer')}
        onChange={(visibility) => save(workspace, { subject: rule.subject, audience: rule.audience, visibility }, rule)} />
      {disabled ? null : (
        <Button type="button" size="icon" variant="ghost" aria-label={t('pricing.visibility.remove', { name })}
          onClick={() => deleteDefinition(workspace.visibilityRules, 'visibilityRule', rule)}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </li>
  );
}

function CategorySelect({ value, onChange }: { readonly value: string | undefined; readonly onChange: (id: string) => void }) {
  const { t, text } = useCatalogText();
  const categories = useCatalogCollection('CATALOG_CATEGORIES');
  return (
    <CatalogField label={t('pricing.visibility.subjects.category')}>
      {({ id }) => (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.items.map((category) => <SelectItem key={category.id} value={category.id}>{text(category.labels, category.code)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </CatalogField>
  );
}

/** Το αντικείμενο του προχείρου: επιλογή, κωδικός ή λίστα κατηγοριών, ανάλογα με το είδος. */
function SubjectField({ kind, onKind, categoryId, onCategory, code, onCode, notFound }: {
  readonly kind: VisibilitySubjectKind;
  readonly onKind: (kind: VisibilitySubjectKind) => void;
  readonly categoryId: string | undefined;
  readonly onCategory: (id: string) => void;
  readonly code: string;
  readonly onCode: (code: string) => void;
  readonly notFound: boolean;
}) {
  const { t } = useCatalogText();
  return (
    <>
      <CatalogField label={t('pricing.visibility.subject')}>
        {({ id }) => (
          <Select value={kind} onValueChange={(next) => { if (isSubjectKind(next)) onKind(next); }}>
            <SelectTrigger id={id}><SelectValue /></SelectTrigger>
            <SelectContent>
              {VISIBILITY_SUBJECT_KINDS.map((item) => <SelectItem key={item} value={item}>{t(VISIBILITY_SUBJECT_KEYS[item])}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
      {kind === 'category' ? <CategorySelect value={categoryId} onChange={onCategory} /> : null}
      {needsCode(kind) ? (
        <CatalogField label={t('pricing.visibility.code')} hint={notFound ? t('pricing.visibility.unresolved') : undefined}>
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} value={code} autoComplete="off" onChange={(event) => onCode(event.target.value)} />
          )}
        </CatalogField>
      ) : null}
    </>
  );
}

function useSubjectDraft() {
  const attributes = useCatalogCollection('CATALOG_ATTRIBUTES');
  const resolve = useCatalogCodeResolver(attributes.items);
  const [kind, setKind] = useState<VisibilitySubjectKind>('catalog');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [code, setCode] = useState('');
  const [notFound, setNotFound] = useState(false);
  const resolved = async (): Promise<VisibilitySubject | null> => {
    if (kind === 'catalog') return { kind };
    if (kind === 'category') return categoryId ? { kind, categoryId } : null;
    const subject = subjectOfTarget(kind, await resolve(code));
    setNotFound(subject === null);
    return subject;
  };
  const chooseKind = (next: VisibilitySubjectKind) => { setKind(next); setNotFound(false); };
  const chooseCode = (next: string) => { setCode(next); setNotFound(false); };
  return { kind, categoryId, code, notFound, resolved, chooseKind, chooseCategory: setCategoryId, chooseCode };
}

function AddRule({ workspace }: { readonly workspace: DiscountsWorkspace }) {
  const { t } = useCatalogText();
  const subject = useSubjectDraft();
  const [audience, setAudience] = useState<PriceAudience>({ kind: 'signedIn' });
  const [visibility, setVisibility] = useState<CatalogVisibility>('visible');
  const [duplicate, setDuplicate] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = await subject.resolved();
    if (target === null || !isCompleteAudience(audience)) return;
    const exists = hasRuleFor(workspace.visibilityRules.view, target, audience);
    setDuplicate(exists);
    if (!exists) save(workspace, { subject: target, audience, visibility }, null);
  };
  return (
    <form className="grid gap-3 rounded-md border p-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
      <SubjectField kind={subject.kind} onKind={subject.chooseKind} categoryId={subject.categoryId} onCategory={subject.chooseCategory}
        code={subject.code} onCode={subject.chooseCode} notFound={subject.notFound} />
      <AudienceField value={audience} allowNone={false} customerGroups={workspace.customerGroups.view} disabled={false} issues={NO_ISSUES}
        onChange={(next) => { if (next) { setAudience(next); setDuplicate(false); } }} />
      <CatalogField label={t('pricing.visibility.answer')}>
        {() => <VisibilitySelect value={visibility} onChange={setVisibility} disabled={false} label={t('pricing.visibility.answer')} />}
      </CatalogField>
      {duplicate ? <p className="m-0 text-sm sm:col-span-2" role="alert">{t('pricing.visibility.duplicate')}</p> : null}
      <Button type="submit" size="sm" className="self-start sm:col-span-2 sm:justify-self-start"><Plus className="mr-1 h-4 w-4" aria-hidden />{t('pricing.visibility.add')}</Button>
    </form>
  );
}

export function VisibilityRulesPanel({ workspace }: { readonly workspace: DiscountsWorkspace }) {
  const { t } = useCatalogText();
  const disabled = useCatalogAccess('pricing') !== 'granted';
  const rules = rulesBySpecificity(workspace.visibilityRules.view);
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <p className="m-0 text-sm text-muted-foreground">{t('pricing.visibility.lead')}</p>
      <CatalogListSection title={t('pricing.visibility.title')} count={rules.length}>
        {rules.length === 0 ? <p className="m-0 px-2 text-sm text-muted-foreground">{t('pricing.visibility.empty')}</p> : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {rules.map((rule) => <RuleRow key={rule.id} rule={rule} workspace={workspace} disabled={disabled} />)}
          </ul>
        )}
      </CatalogListSection>
      {disabled ? null : <AddRule workspace={workspace} />}
    </section>
  );
}
