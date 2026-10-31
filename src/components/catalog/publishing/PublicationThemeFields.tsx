'use client';

/**
 * @fileoverview **Το θέμα της έκδοσης** — γραμματοσειρά και δύο χρώματα, καθένα σε RGB (οθόνη) **και** CMYK (εκτύπωση)
 *   (ADR-923 §5.6.1).
 * @module components/catalog/publishing/PublicationThemeFields
 *
 * 🔑 Η γραμματοσειρά είναι **κλειστό σύνολο** με ελεγμένη άδεια (`PUBLICATION_FONTS`)· δεν υπάρχει ελεύθερο όνομα.
 * 🔑 Το ίδιο χρώμα δηλώνεται και στους δύο χώρους, γιατί το Typst δεν μετατρέπει: η εκτύπωση παίρνει ακριβώς τα CMYK που
 *    έγραψε ο άνθρωπος. Η επικύρωση (`#rrggbb`, 0–100) είναι η ίδια συνάρτηση με του γραφέα.
 * 🔑 Το λογότυπο (`logoAssetId`) δεν έχει επιλογέα ακόμη: η τιμή διατηρείται όπως είναι.
 */

import React, { useId } from 'react';

import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericField } from '@/components/ui/numeric-field';
import { PUBLICATION_FONTS, PUBLICATION_FONT_CODES } from '@/subapps/catalog/publishing/publication-fonts';
import type { LayoutColour } from '@/subapps/catalog/publishing/layout-model';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { withCmykPart, withTheme, type PublicationFieldsProps } from './publication-draft';

/** Τα τέσσερα μελάνια — διεθνείς συντομογραφίες, όχι μεταφράσιμο κείμενο. */
const CMYK_INKS = ['C', 'M', 'Y', 'K'] as const;

interface ColourFieldProps {
  readonly legend: string;
  readonly value: LayoutColour;
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
  readonly path: string;
  readonly onChange: (colour: LayoutColour) => void;
}

function ColourField({ legend, value, disabled, issues, path, onChange }: ColourFieldProps) {
  const baseId = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{legend}</legend>
      <span className="flex flex-wrap items-center gap-2">
        <Input id={`${baseId}-rgb`} type="color" value={value.rgb} disabled={disabled} aria-label={`${legend} RGB`}
          className="h-9 w-14 p-1" onChange={(event) => onChange({ ...value, rgb: event.target.value })} />
        {CMYK_INKS.map((ink, index) => (
          <span key={ink} className="flex items-center gap-1">
            <Label htmlFor={`${baseId}-${ink}`} className="text-xs text-muted-foreground">{ink}</Label>
            <NumericField id={`${baseId}-${ink}`} className="w-20" value={value.cmyk[index] ?? 0} min={0} max={100} step={1} disabled={disabled}
              onValueChange={(part) => onChange(withCmykPart(value, index, part))} />
          </span>
        ))}
      </span>
      <FieldIssues issues={issues} path={path} exact />
    </fieldset>
  );
}

export function PublicationThemeFields({ draft, onChange, issues, disabled }: PublicationFieldsProps) {
  const { t } = useCatalogText();
  const { theme } = draft;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <CatalogField label={t('publishing.fields.font')} issues={issues} path="theme.fontCode">
        {({ id }) => (
          <EnumSelect id={id} value={theme.fontCode} values={PUBLICATION_FONT_CODES} disabled={disabled}
            getLabel={(code) => PUBLICATION_FONTS[code].family} onValueChange={(fontCode) => onChange(withTheme(draft, { fontCode }))} />
        )}
      </CatalogField>
      <ColourField legend={t('publishing.fields.primary')} value={theme.primary} disabled={disabled} issues={issues} path="theme.primary"
        onChange={(primary) => onChange(withTheme(draft, { primary }))} />
      <ColourField legend={t('publishing.fields.accent')} value={theme.accent} disabled={disabled} issues={issues} path="theme.accent"
        onChange={(accent) => onChange(withTheme(draft, { accent }))} />
    </section>
  );
}
