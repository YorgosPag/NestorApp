'use client';
/**
 * **Φίλτρα της λίστας** — οικογένεια · ταξινόμηση · κανάλι × γλώσσα πληρότητας · facets (ADR-923 §5.10.4 Β2).
 *
 * Akeneo: επιλογέας «scope / locale» πάνω από το πλέγμα, φίλτρα ανά ιδιότητα. Τα facets εμφανίζονται **μόνο** μέσα
 * σε οικογένεια (είναι δεμένα σε ιδιότητές της) — πολλές τιμές ανά ιδιότητα (OR), εναλλαγή με `aria-pressed`.
 *
 * @module components/catalog/products/ProductListToolbar
 */

import { useMemo } from 'react';

import { ClearableSelect } from '@/components/ui/clearable-select';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Button } from '@/components/ui/button';
import type { HumanLanguage } from '@/i18n/languages';
import type { FamilyRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';
import { CATALOG_LIST_SORTS, type CatalogListSort } from '@/subapps/catalog/list/catalog-list-query';
import { CATALOG_CHANNELS, type CatalogChannel } from '@/subapps/catalog/vocabulary/channels';

import { CHANNEL_KEYS, LANGUAGE_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { isFacetSelected, toggleFacet, type FacetGroup } from './product-facets';
import type { ProductListFilter } from './use-product-list';

export interface ListScope {
  readonly channel: CatalogChannel;
  readonly locale: HumanLanguage;
}

export interface ProductListToolbarProps {
  readonly families: readonly FamilyRecord[];
  readonly filter: ProductListFilter;
  readonly onFilter: (filter: ProductListFilter) => void;
  readonly scope: ListScope;
  readonly onScope: (scope: ListScope) => void;
  readonly settings: CatalogSettingsDefinition;
  readonly facetGroups: readonly FacetGroup[];
}

const SORT_KEYS: Readonly<Record<CatalogListSort, string>> = { updated: 'products.filter.sortUpdated', label: 'products.filter.sortLabel' };
const scopeKey = (scope: ListScope) => `${scope.channel}:${scope.locale}`;

/** Επιλογέας **κανάλι × γλώσσα** — κοινός σε λίστα και επεξεργαστή (Akeneo scope/locale switcher). */
export function ScopeSelect(props: { readonly settings: CatalogSettingsDefinition; readonly scope: ListScope; readonly onScope: (scope: ListScope) => void; readonly id?: string }) {
  const { t } = useCatalogText();
  const id = props.id ?? 'products-scope';
  const scopes = useMemo(() => CATALOG_CHANNELS.flatMap((channel) =>
    props.settings.channelLocales[channel].map((locale) => ({ channel, locale }))), [props.settings]);
  return (
    <span className="grid gap-1">
      <Label htmlFor={id}>{t('products.filter.scope')}</Label>
      <Select value={scopeKey(props.scope)} onValueChange={(value) => { const next = scopes.find((scope) => scopeKey(scope) === value); if (next) props.onScope(next); }}>
        <SelectTrigger id={id} className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          {scopes.map((scope) => (
            <SelectItem key={scopeKey(scope)} value={scopeKey(scope)}>{`${t(CHANNEL_KEYS[scope.channel])} · ${t(LANGUAGE_KEYS[scope.locale])}`}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}

function FacetBar({ props }: { readonly props: ProductListToolbarProps }) {
  const { t, text } = useCatalogText();
  const { filter } = props;
  if (filter.familyId === null) return <p className="m-0 text-sm text-muted-foreground">{t('products.filter.familyFirst')}</p>;
  if (props.facetGroups.length === 0) return null;
  return (
    <section className="flex flex-wrap items-center gap-3" aria-label={t('products.filter.facets')}>
      {props.facetGroups.map((group) => (
        <fieldset key={group.attributeId} className="flex flex-wrap items-center gap-1 border-0 p-0">
          <legend className="mr-1 text-xs text-muted-foreground">{text(group.labels, group.code)}</legend>
          {group.values.map((value) => (
            <ToggleButton key={value.key} size="sm" pressed={isFacetSelected(filter.facets, value.key)}
              onClick={() => props.onFilter({ ...filter, facets: toggleFacet(filter.facets, group, value.key) })}>
              {value.kind === 'option' ? text(value.labels, value.code) : t(value.value ? 'products.filter.yes' : 'products.filter.no')}
            </ToggleButton>
          ))}
        </fieldset>
      ))}
      {filter.facets.length > 0 ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => props.onFilter({ ...filter, facets: [] })}>{t('products.filter.clearFacets')}</Button>
      ) : null}
    </section>
  );
}

export function ProductListToolbar(props: ProductListToolbarProps) {
  const { t, text } = useCatalogText();
  const { filter } = props;
  return (
    <section className="flex flex-col gap-3">
      <section className="flex flex-wrap items-end gap-3">
        <span className="grid gap-1">
          <Label htmlFor="products-family">{t('products.filter.family')}</Label>
          <ClearableSelect id="products-family" value={filter.familyId ?? ''} placeholder={t('products.filter.allFamilies')}
            clearLabel={t('products.filter.allFamilies')} triggerClassName="w-56"
            onValueChange={(value) => props.onFilter({ ...filter, familyId: value === '' ? null : value, facets: [] })}>
            {props.families.map((family) => <SelectItem key={family.id} value={family.id}>{text(family.labels, family.code)}</SelectItem>)}
          </ClearableSelect>
        </span>
        <span className="grid gap-1">
          <Label htmlFor="products-sort">{t('products.filter.sort')}</Label>
          <Select value={filter.sort} onValueChange={(value) => { const sort = CATALOG_LIST_SORTS.find((s) => s === value); if (sort) props.onFilter({ ...filter, sort }); }}>
            <SelectTrigger id="products-sort" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{CATALOG_LIST_SORTS.map((sort) => <SelectItem key={sort} value={sort}>{t(SORT_KEYS[sort])}</SelectItem>)}</SelectContent>
          </Select>
        </span>
        <ScopeSelect settings={props.settings} scope={props.scope} onScope={props.onScope} />
      </section>
      <FacetBar props={props} />
    </section>
  );
}
