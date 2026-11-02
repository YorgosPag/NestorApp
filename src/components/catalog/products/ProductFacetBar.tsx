'use client';
/**
 * **Τα φίλτρα ιδιοτήτων** — κοινά στη λίστα προϊόντων και στο εύρος έκδοσης (ADR-923 §5.10.4 Β2 · §5.6.1).
 *
 * Εμφανίζονται **μόνο** μέσα σε οικογένεια (είναι δεμένα σε ιδιότητές της): χωρίς αυτήν ο καλών περνά κενές ομάδες. Πολλές τιμές
 * ανά ιδιότητα (OR), εναλλαγή με `aria-pressed`. Ο καλών κρατά την επιλογή: η λίστα φιλτράρει ζωντανά, η συνταγή αποθηκεύει.
 *
 * @module components/catalog/products/ProductFacetBar
 */

import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import type { FacetSelection } from '@/subapps/catalog/list/catalog-list-query';
import { isFacetSelected, toggleFacet, type FacetGroup } from '@/subapps/catalog/list/product-facets';

import { useCatalogText } from '../shared/catalog-ui-hooks';

export interface ProductFacetBarProps {
  readonly groups: readonly FacetGroup[];
  readonly selection: FacetSelection;
  readonly onChange: (selection: FacetSelection) => void;
  readonly disabled?: boolean;
}

export function ProductFacetBar({ groups, selection, onChange, disabled = false }: ProductFacetBarProps) {
  const { t, text } = useCatalogText();
  if (groups.length === 0) return null;
  return (
    <section className="flex flex-wrap items-center gap-3" aria-label={t('products.filter.facets')}>
      {groups.map((group) => (
        <fieldset key={group.attributeId} className="flex flex-wrap items-center gap-1 border-0 p-0">
          <legend className="mr-1 text-xs text-muted-foreground">{text(group.labels, group.code)}</legend>
          {group.values.map((value) => (
            <ToggleButton key={value.key} size="sm" pressed={isFacetSelected(selection, value.key)} disabled={disabled}
              onClick={() => onChange(toggleFacet(selection, group, value.key))}>
              {value.kind === 'option' ? text(value.labels, value.code) : t(value.value ? 'products.filter.yes' : 'products.filter.no')}
            </ToggleButton>
          ))}
        </fieldset>
      ))}
      {selection.length > 0 ? (
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}>{t('products.filter.clearFacets')}</Button>
      ) : null}
    </section>
  );
}
