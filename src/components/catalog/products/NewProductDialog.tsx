'use client';
/**
 * **«Νέο»** — μοντέλο με παραλλαγές ή απλό προϊόν (ADR-923 §5.10.4 Β2).
 *
 * Akeneo: «Create product» / «Create product model» με επιλογή οικογένειας (και family variant). Μετά τη δημιουργία
 * ανοίγει ο επεξεργαστής — όπως στο Akeneo. Ταυτότητες:
 * - **μοντέλο**: ντετερμινιστικό id από τον κωδικό (τον παράγει ο διακομιστής) — ο κωδικός κρίνεται εδώ με την
 *   **ίδια** γραμματική (`isCatalogCode`) ⇒ το γνωστό 422 δεν στέλνεται;
 * - **απλό SKU**: τυχαίο id γεννημένο **στον πελάτη** (`generateCatalogProductId`), επαληθευμένο από τον διακομιστή
 *   (ADR-866 Β) — ανοίγει **αμέσως** στο ίδιο id που θα γραφτεί.
 *
 * @module components/catalog/products/NewProductDialog
 */

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EnumSelect } from '@/components/ui/enum-select';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createCatalogDefinition, type FamilyRecord } from '@/services/catalog/catalog-api.client';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { generateCatalogProductId } from '@/services/enterprise-id-convenience';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { isCatalogCode } from '@/subapps/catalog/vocabulary/catalog-limits';

import { CatalogCodeField } from '../shared/CatalogFormFields';
import { IssueSummary } from '../shared/CatalogIssues';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { CodeJumpTarget } from './catalog-code-jump';

type NewKind = 'model' | 'simple';
const NEW_KINDS: readonly NewKind[] = ['model', 'simple'];

export interface NewProductDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly families: readonly FamilyRecord[];
  readonly onCreated: (target: CodeJumpTarget) => void;
}

interface Draft {
  readonly familyId: string;
  readonly kind: NewKind;
  readonly schemeCode: string;
  readonly code: string;
}

function draftIssues(draft: Draft, family: FamilyRecord | null): CatalogIssue[] {
  if (!family || draft.kind === 'simple') return [];
  return isCatalogCode(draft.code) ? [] : [{ code: 'invalidCode', path: 'code' }];
}

async function create(draft: Draft): Promise<CodeJumpTarget> {
  const holder = { familyId: draft.familyId, values: {}, noValueReasons: {}, categoryIds: [] };
  if (draft.kind === 'model') {
    const record = await createCatalogDefinition('productModel', { ...holder, code: draft.code, variantSchemeCode: draft.schemeCode, parentId: null });
    return { kind: 'productModel', id: record.id };
  }
  const id = generateCatalogProductId();
  await createCatalogDefinition('product', { ...holder, modelId: null }, id);
  return { kind: 'product', id };
}

interface FieldsProps {
  readonly draft: Draft;
  readonly kind: NewKind;
  readonly family: FamilyRecord | null;
  readonly families: readonly FamilyRecord[];
  readonly issues: readonly CatalogIssue[];
  readonly onDraft: (draft: Draft) => void;
}

function FamilyField({ draft, families, onDraft }: FieldsProps) {
  const { t, text } = useCatalogText();
  const choose = (familyId: string) => {
    const next = families.find((candidate) => candidate.id === familyId);
    onDraft({ ...draft, familyId, schemeCode: next?.variantSchemes[0]?.code ?? '' });
  };
  return (
    <span className="grid gap-1.5">
      <Label htmlFor="new-product-family">{t('products.new.family')}</Label>
      <Select value={draft.familyId || undefined} onValueChange={choose}>
        <SelectTrigger id="new-product-family"><SelectValue placeholder={t('products.new.family')} /></SelectTrigger>
        <SelectContent>{families.map((item) => <SelectItem key={item.id} value={item.id}>{text(item.labels, item.code)}</SelectItem>)}</SelectContent>
      </Select>
    </span>
  );
}

function KindFields({ draft, kind, family, issues, onDraft }: FieldsProps) {
  const { t, text } = useCatalogText();
  const schemes = family?.variantSchemes ?? [];
  if (!family) return null;
  if (schemes.length === 0) return <p className="m-0 text-sm text-muted-foreground">{t('products.new.noScheme')}</p>;
  return (
    <>
      <span className="grid gap-1.5">
        <Label htmlFor="new-product-kind">{t('products.new.kind')}</Label>
        <EnumSelect id="new-product-kind" value={kind} values={NEW_KINDS} onValueChange={(next) => onDraft({ ...draft, kind: next })}
          getLabel={(value) => t(value === 'model' ? 'products.new.kindModel' : 'products.new.kindSimple')} />
      </span>
      {kind === 'model' ? (
        <>
          <span className="grid gap-1.5">
            <Label htmlFor="new-product-scheme">{t('products.new.scheme')}</Label>
            <EnumSelect id="new-product-scheme" value={draft.schemeCode} values={schemes.map((scheme) => scheme.code)}
              onValueChange={(schemeCode) => onDraft({ ...draft, schemeCode })}
              getLabel={(code) => { const scheme = schemes.find((item) => item.code === code); return scheme ? text(scheme.labels, code) : code; }} />
          </span>
          <CatalogCodeField value={draft.code} onChange={(code) => onDraft({ ...draft, code })} locked={false} issues={draft.code === '' ? [] : issues} />
        </>
      ) : null}
    </>
  );
}

const EMPTY_DRAFT: Draft = { familyId: '', kind: 'model', schemeCode: '', code: '' };

function useNewProduct(props: NewProductDialogProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [serverIssues, setServerIssues] = useState<readonly CatalogIssue[]>([]);
  const family = props.families.find((candidate) => candidate.id === draft.familyId) ?? null;
  const kind: NewKind = (family?.variantSchemes.length ?? 0) === 0 ? 'simple' : draft.kind;
  const issues = useMemo(() => draftIssues({ ...draft, kind }, family), [draft, kind, family]);
  const ready = family !== null && issues.length === 0 && (kind === 'simple' || draft.schemeCode !== '');
  const submit = async () => {
    setBusy(true);
    setServerIssues([]);
    try {
      props.onCreated(await create({ ...draft, kind }));
      props.onOpenChange(false);
      setDraft(EMPTY_DRAFT);
    } catch (cause) {
      setServerIssues(catalogFailureOf(cause).issues);
    } finally {
      setBusy(false);
    }
  };
  return { draft, setDraft, busy, serverIssues, family, kind, issues, ready, submit };
}

export function NewProductDialog(props: NewProductDialogProps) {
  const { t } = useCatalogText();
  const state = useNewProduct(props);
  const fields: FieldsProps = { draft: state.draft, kind: state.kind, family: state.family, families: props.families, issues: state.issues, onDraft: state.setDraft };
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('products.new.title')}</DialogTitle>
          <DialogDescription>{t('products.new.lead')}</DialogDescription>
        </DialogHeader>
        <section className="grid gap-4">
          <FamilyField {...fields} />
          <KindFields {...fields} />
          <IssueSummary issues={state.serverIssues} title={t('editor.issuesTitle')} />
        </section>
        <DialogFooter>
          <Button type="button" disabled={!state.ready || state.busy} onClick={() => void state.submit()}>
            {state.busy ? t('products.new.creating') : t('products.new.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
