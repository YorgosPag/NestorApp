'use client';

/**
 * @fileoverview **Η γραμματοσειρά της έκδοσης** — της πλατφόρμας ή οικογένεια του προμηθευτή, με δήλωση άδειας (ADR-923 §5.6.1).
 * @related subapps/catalog/publishing/publication-font-rights.ts (η ίδια κρίση με τον γραφέα)
 * @module components/catalog/publishing/PublicationFontField
 *
 * 🔑 Ο άνθρωπος διαλέγει **οικογένεια**, όχι αρχεία: οι όψεις της έρχονται μαζί, όπως στο Brand Kit του Canva.
 * 🔑 Η επιλογή δεν είναι ελεύθερο όνομα: προσφέρονται μόνο μέσα που πέρασαν την κρίση στη σύνδεση του αρχείου.
 */

import React, { useId, useMemo } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { EnumSelect } from '@/components/ui/enum-select';
import { Label } from '@/components/ui/label';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { publicationFontFamilies } from '@/subapps/catalog/publishing/publication-font-rights';
import { PUBLICATION_FONTS, PUBLICATION_FONT_CODES } from '@/subapps/catalog/publishing/publication-fonts';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { withSupplierFont, withTheme, type PublicationFieldsProps } from './publication-draft';

const PLATFORM_PREFIX = 'platform:';
const SUPPLIER_PREFIX = 'supplier:';

function useFontChoices(selectedIds: readonly string[]) {
  const assets = useCatalogCollection('CATALOG_ASSETS');
  return useMemo(() => {
    const families = publicationFontFamilies(assets.items);
    const current = [...families.entries()].find(([, faces]) => selectedIds.length > 0 && faces.some((face) => selectedIds.includes(face.id)))?.[0] ?? null;
    return { families, current };
  }, [assets.items, selectedIds]);
}

export function PublicationFontField({ draft, onChange, issues, disabled }: PublicationFieldsProps) {
  const { t } = useCatalogText();
  const checkId = useId();
  const { theme } = draft;
  const { families, current } = useFontChoices(theme.fontAssetIds ?? []);
  const values = [...PUBLICATION_FONT_CODES.map((code) => `${PLATFORM_PREFIX}${code}`), ...[...families.keys()].map((family) => `${SUPPLIER_PREFIX}${family}`)];
  const value = current === null ? `${PLATFORM_PREFIX}${theme.fontCode}` : `${SUPPLIER_PREFIX}${current}`;
  const platformCodeOf = (choice: string) => PUBLICATION_FONT_CODES.find((code) => `${PLATFORM_PREFIX}${code}` === choice) ?? theme.fontCode;
  const labelOf = (choice: string) => (choice.startsWith(SUPPLIER_PREFIX) ? choice.slice(SUPPLIER_PREFIX.length) : PUBLICATION_FONTS[platformCodeOf(choice)].family);
  const choose = (choice: string) => {
    if (!choice.startsWith(SUPPLIER_PREFIX)) { onChange(withTheme(withSupplierFont(draft, null), { fontCode: platformCodeOf(choice) })); return; }
    onChange(withSupplierFont(draft, (families.get(choice.slice(SUPPLIER_PREFIX.length)) ?? []).map((face) => face.id)));
  };
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <CatalogField label={t('publishing.fields.font')} issues={issues} path="theme.fontAssetIds">
        {({ id }) => <EnumSelect id={id} value={value} values={values} disabled={disabled} getLabel={labelOf} onValueChange={choose} />}
      </CatalogField>
      {theme.fontAssetIds ? (
        <span className="flex items-center gap-2">
          <Checkbox id={checkId} checked={theme.fontLicenseConfirmed === true} disabled={disabled}
            onCheckedChange={(next) => onChange(withTheme(draft, { fontLicenseConfirmed: next === true }))} />
          <Label htmlFor={checkId}>{t('publishing.fields.fontLicense')}</Label>
        </span>
      ) : null}
      <FieldIssues issues={issues} path="theme.fontLicenseConfirmed" exact />
    </section>
  );
}
