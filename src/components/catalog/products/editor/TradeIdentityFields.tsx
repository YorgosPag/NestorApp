'use client';
/**
 * **Η ενότητα «Ταυτότητα προϊόντος»** του επεξεργαστή — μάρκα · GTIN · MPN · «χωρίς GTIN» (ADR-934 Σ1β).
 *
 * Όπως η ενότητα «Product identifiers» του Google Merchant Center και το «Barcode» της παραλλαγής στο Shopify: σταθερά
 * πεδία πλατφόρμας, **πάνω** από τις καρτέλες ιδιοτήτων του προμηθευτή.
 * - **Μάρκα**: επεξεργάσιμη μόνο στον κάτοχό της (βάθος 0 — ρίζα ή απλό προϊόν)· αλλού γκρι «ορίζεται στο …» (Δ1).
 * - **GTIN / MPN / χωρίς GTIN**: μόνο σε SKU. Το GTIN κρίνεται **ζωντανά** από τον ίδιο επικυρωτή με τον γραφέα (ευρήματα
 *   από την `judgeAggregate`)· η προειδοποίηση «εσωτερικός κωδικός» δεν μπλοκάρει.
 *
 * @module components/catalog/products/editor/TradeIdentityFields
 */

import { Input } from '@/components/ui/input';
import { EnumSelect } from '@/components/ui/enum-select';
import { tradeWarningsOf } from '@/subapps/catalog/derived/trade-keys';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { NO_VALUE_REASONS, type CatalogProductDefinition, type NoValueReason } from '@/subapps/catalog/types/product';
import type { InheritanceLink } from '@/subapps/catalog/values/resolve-inherited';
import {
  BRAND_FIELD,
  BRAND_OWNER_DEPTH,
  brandOf,
  brandOfChain,
  tradeIdentityOf,
  writeBrand,
  writeGtin,
  writeMpn,
  writeNoGtinReason,
} from '@/subapps/catalog/values/trade-identity';

import { CatalogField } from '../../shared/CatalogFormFields';
import { useIssueMessage } from '../../shared/CatalogIssues';
import { useCatalogText } from '../../shared/catalog-ui-hooks';
import type { HolderDefinition } from './use-product-editor';

/** «Πήγαινε στο πεδίο» από τη σύνοψη ευρημάτων: το πεδίο σημαδεύεται με `data-trade-field` (το `id` ανήκει στην ετικέτα). */
export function focusTradeField(field: string): void {
  const host = document.querySelector<HTMLElement>(`[data-trade-field="${field}"]`);
  const target = host?.matches('input, button') ? host : host?.querySelector<HTMLElement>('input, button');
  target?.focus();
}

/** Η επιλογή «δεν δηλώθηκε απουσία» — το Radix δεσμεύει το `''` (CHECK 3.48). */
const UNDECLARED = 'undeclared';
type NoGtinChoice = typeof UNDECLARED | NoValueReason;
const NO_GTIN_CHOICES: readonly NoGtinChoice[] = [UNDECLARED, ...NO_VALUE_REASONS];

export interface TradeIdentityFieldsProps {
  readonly draft: HolderDefinition;
  readonly saved: HolderDefinition;
  readonly chain: readonly InheritanceLink[];
  readonly depth: number;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
  readonly nameOf: (link: InheritanceLink) => string;
  readonly onChange: (next: HolderDefinition) => void;
}

function BrandField(props: TradeIdentityFieldsProps) {
  const { t } = useCatalogText();
  const owner = props.chain[BRAND_OWNER_DEPTH];
  if (props.depth !== BRAND_OWNER_DEPTH) {
    const inherited = brandOfChain(props.chain);
    return (
      <CatalogField label={t('trade.brand')} hint={owner ? t('values.definedIn', { name: props.nameOf(owner) }) : undefined}>
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={inherited ?? ''} readOnly disabled />}
      </CatalogField>
    );
  }
  return (
    <CatalogField label={t('trade.brand')} hint={t('trade.brandHelp')} issues={props.issues} path={BRAND_FIELD}>
      {({ id, describedBy }) => (
        <Input id={id} data-trade-field={BRAND_FIELD} aria-describedby={describedBy} value={brandOf(props.draft) ?? ''} disabled={props.disabled}
          onChange={(event) => props.onChange(writeBrand(props.draft, event.target.value))} />
      )}
    </CatalogField>
  );
}

type ProductFieldsProps = TradeIdentityFieldsProps & { readonly product: CatalogProductDefinition; readonly savedProduct: CatalogProductDefinition | null };

function GtinField(props: ProductFieldsProps) {
  const { t } = useCatalogText();
  const warnings = tradeWarningsOf(props.product);
  const message = useIssueMessage(warnings.length > 0);
  const hint = warnings.length > 0 ? warnings.map(message).join(' ') : t('trade.gtinHelp');
  return (
    <CatalogField label={t('trade.gtin')} hint={hint} issues={props.issues} path="gtin">
      {({ id, describedBy }) => (
        <Input id={id} data-trade-field="gtin" aria-describedby={describedBy} inputMode="numeric" autoComplete="off"
          value={tradeIdentityOf(props.product).gtin ?? ''} disabled={props.disabled}
          onChange={(event) => props.onChange(writeGtin(props.product, event.target.value))} />
      )}
    </CatalogField>
  );
}

function NoGtinField(props: ProductFieldsProps) {
  const { t } = useCatalogText();
  const reason = tradeIdentityOf(props.product).noGtinReason;
  const labelOf = (choice: NoGtinChoice) => (choice === UNDECLARED ? t('trade.noGtinUndeclared') : t(`values.noValue.${choice}`));
  return (
    <CatalogField label={t('trade.noGtinReason')} hint={t('trade.noGtinHelp')} issues={props.issues} path="noGtinReason">
      {({ id }) => (
        <span data-trade-field="noGtinReason" className="contents">
          <EnumSelect<NoGtinChoice> id={id} value={reason ?? UNDECLARED} values={NO_GTIN_CHOICES} getLabel={labelOf}
            disabled={props.disabled}
            onValueChange={(choice) => props.onChange(writeNoGtinReason(props.product, choice === UNDECLARED ? null : choice, props.savedProduct))} />
        </span>
      )}
    </CatalogField>
  );
}

function MpnField(props: ProductFieldsProps) {
  const { t } = useCatalogText();
  return (
    <CatalogField label={t('trade.mpn')} hint={t('trade.mpnHelp')} issues={props.issues} path="mpn">
      {({ id, describedBy }) => (
        <Input id={id} data-trade-field="mpn" aria-describedby={describedBy} autoComplete="off"
          value={tradeIdentityOf(props.product).mpn ?? ''} disabled={props.disabled}
          onChange={(event) => props.onChange(writeMpn(props.product, event.target.value))} />
      )}
    </CatalogField>
  );
}

const productOf = (definition: HolderDefinition): CatalogProductDefinition | null => ('modelId' in definition ? definition : null);

export function TradeIdentityFields(props: TradeIdentityFieldsProps) {
  const { t } = useCatalogText();
  const product = productOf(props.draft);
  const productProps = product ? { ...props, product, savedProduct: productOf(props.saved) } : null;
  return (
    <section aria-labelledby="trade-identity-title" className="grid gap-3 rounded-md border p-4">
      <header>
        <h2 id="trade-identity-title" className="m-0 text-base font-semibold">{t('trade.title')}</h2>
        <p className="m-0 text-sm text-muted-foreground">{t('trade.lead')}</p>
      </header>
      <fieldset className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2 xl:grid-cols-4">
        <BrandField {...props} />
        {productProps ? <><GtinField {...productProps} /><MpnField {...productProps} /><NoGtinField {...productProps} /></> : null}
      </fieldset>
    </section>
  );
}
